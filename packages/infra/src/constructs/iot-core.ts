import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface IotCoreConstructProps {
  config: EnvironmentConfig;
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  databaseSecret: secretsmanager.ISecret;
  databaseEndpoint: string;
}

export class IotCoreConstruct extends Construct {
  public readonly telemetryProcessorLambda: lambda.Function;
  public readonly thingType: iot.CfnThingType;
  public readonly thingPolicy: iot.CfnPolicy;
  public readonly telemetryRule: iot.CfnTopicRule;

  constructor(scope: Construct, id: string, props: IotCoreConstructProps) {
    super(scope, id);

    const { config, vpc, lambdaSecurityGroup, databaseSecret, databaseEndpoint } = props;

    // Create IoT Thing Type for farm equipment
    this.thingType = new iot.CfnThingType(this, 'EquipmentThingType', {
      thingTypeName: `farm-${config.environment}-equipment`,
      thingTypeProperties: {
        searchableAttributes: ['equipmentType', 'farmId', 'serialNumber'],
        thingTypeDescription: 'Farm equipment devices for telemetry',
      },
    });

    // Create IoT Policy for equipment devices
    this.thingPolicy = new iot.CfnPolicy(this, 'EquipmentPolicy', {
      policyName: `farm-${config.environment}-equipment-policy`,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['iot:Connect'],
            Resource: [`arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:client/\${iot:Connection.Thing.ThingName}`],
          },
          {
            Effect: 'Allow',
            Action: ['iot:Publish'],
            Resource: [
              `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/farm/\${iot:Connection.Thing.Attributes[farmId]}/telemetry`,
              `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/farm/\${iot:Connection.Thing.Attributes[farmId]}/status`,
            ],
          },
          {
            Effect: 'Allow',
            Action: ['iot:Subscribe'],
            Resource: [
              `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topicfilter/farm/\${iot:Connection.Thing.Attributes[farmId]}/commands/*`,
            ],
          },
          {
            Effect: 'Allow',
            Action: ['iot:Receive'],
            Resource: [
              `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/farm/\${iot:Connection.Thing.Attributes[farmId]}/commands/*`,
            ],
          },
        ],
      },
    });

    // Create Lambda function for processing telemetry
    const lambdaLogGroup = new logs.LogGroup(this, 'TelemetryProcessorLogGroup', {
      logGroupName: `/aws/lambda/farm-${config.environment}-telemetry-processor`,
      retention: config.environment === 'prod' 
        ? logs.RetentionDays.ONE_YEAR 
        : logs.RetentionDays.ONE_WEEK,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    this.telemetryProcessorLambda = new lambda.Function(this, 'TelemetryProcessor', {
      functionName: `farm-${config.environment}-telemetry-processor`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { Client } = require('pg');
        
        exports.handler = async (event) => {
          console.log('Received telemetry event:', JSON.stringify(event));
          
          const client = new Client({
            host: process.env.DATABASE_HOST,
            port: parseInt(process.env.DATABASE_PORT || '5432'),
            database: process.env.DATABASE_NAME,
            user: process.env.DATABASE_USERNAME,
            password: process.env.DATABASE_PASSWORD,
            ssl: { rejectUnauthorized: false }
          });
          
          try {
            await client.connect();
            
            const { deviceId, timestamp, readings, metadata } = event;
            
            // Validate required fields
            if (!deviceId || !timestamp) {
              console.error('Missing required fields: deviceId or timestamp');
              return { statusCode: 400, body: 'Missing required fields' };
            }
            
            // Check for duplicate within 5-second window
            const dedupeQuery = \`
              SELECT id FROM telemetry_readings 
              WHERE equipment_id = (SELECT id FROM equipment WHERE device_id = $1)
              AND time BETWEEN $2::timestamptz - interval '5 seconds' AND $2::timestamptz + interval '5 seconds'
              LIMIT 1
            \`;
            const dedupeResult = await client.query(dedupeQuery, [deviceId, timestamp]);
            
            if (dedupeResult.rows.length > 0) {
              console.log('Duplicate telemetry detected, skipping');
              return { statusCode: 200, body: 'Duplicate skipped' };
            }
            
            // Insert telemetry reading
            const insertQuery = \`
              INSERT INTO telemetry_readings (
                time, equipment_id, location, operating_hours, fuel_level, 
                speed, engine_rpm, fault_codes, resource_dispensed, raw_data
              )
              SELECT 
                $1::timestamptz,
                e.id,
                CASE WHEN $3::float IS NOT NULL AND $4::float IS NOT NULL 
                  THEN ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography 
                  ELSE NULL 
                END,
                $5, $6, $7, $8, $9, $10, $11
              FROM equipment e
              WHERE e.device_id = $2
              RETURNING id
            \`;
            
            const result = await client.query(insertQuery, [
              timestamp,
              deviceId,
              readings?.latitude,
              readings?.longitude,
              readings?.operatingHours,
              readings?.fuelLevel,
              readings?.speed,
              readings?.engineRpm,
              readings?.faultCodes || [],
              readings?.dispensing ? JSON.stringify(readings.dispensing) : null,
              JSON.stringify({ ...readings, ...metadata })
            ]);
            
            // Check for fault codes and create maintenance alert
            if (readings?.faultCodes && readings.faultCodes.length > 0) {
              const alertQuery = \`
                INSERT INTO maintenance_records (
                  equipment_id, type, description, performed_at, notes
                )
                SELECT 
                  e.id, 'emergency', 'Fault codes detected: ' || $2, NOW(), $3
                FROM equipment e
                WHERE e.device_id = $1
              \`;
              await client.query(alertQuery, [
                deviceId,
                readings.faultCodes.join(', '),
                JSON.stringify({ faultCodes: readings.faultCodes, timestamp })
              ]);
              console.log('Maintenance alert created for fault codes:', readings.faultCodes);
            }
            
            // Create resource application record if dispensing data present
            if (readings?.dispensing) {
              const resourceQuery = \`
                INSERT INTO resource_applications (
                  farm_id, field_id, resource_type, quantity, unit, application_date, equipment_id
                )
                SELECT 
                  e.farm_id, 
                  $3,
                  $4,
                  $5,
                  $6,
                  $1::date,
                  e.id
                FROM equipment e
                WHERE e.device_id = $2
              \`;
              await client.query(resourceQuery, [
                timestamp,
                deviceId,
                readings.dispensing.fieldId || null,
                readings.dispensing.type,
                readings.dispensing.quantity,
                readings.dispensing.unit
              ]);
              console.log('Resource application record created');
            }
            
            console.log('Telemetry processed successfully:', result.rows[0]?.id);
            return { statusCode: 200, body: 'Success' };
            
          } catch (error) {
            console.error('Error processing telemetry:', error);
            throw error;
          } finally {
            await client.end();
          }
        };
      `),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        DATABASE_HOST: databaseEndpoint,
        DATABASE_PORT: '5432',
        DATABASE_NAME: 'farmdb',
        NODE_ENV: config.environment,
      },
      logGroup: lambdaLogGroup,
    });

    // Grant Lambda access to database secret
    databaseSecret.grantRead(this.telemetryProcessorLambda);

    // Add environment variables from secret
    this.telemetryProcessorLambda.addEnvironment(
      'DATABASE_SECRET_ARN',
      databaseSecret.secretArn
    );

    // Create IAM role for IoT rule to invoke Lambda
    const iotRuleRole = new iam.Role(this, 'IotRuleRole', {
      roleName: `farm-${config.environment}-iot-rule-role`,
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
    });

    this.telemetryProcessorLambda.grantInvoke(iotRuleRole);

    // Create IoT Topic Rule for telemetry processing
    this.telemetryRule = new iot.CfnTopicRule(this, 'TelemetryRule', {
      ruleName: `farm_${config.environment}_telemetry_rule`.replace(/-/g, '_'),
      topicRulePayload: {
        sql: "SELECT * FROM 'farm/+/telemetry'",
        awsIotSqlVersion: '2016-03-23',
        actions: [
          {
            lambda: {
              functionArn: this.telemetryProcessorLambda.functionArn,
            },
          },
        ],
        errorAction: {
          cloudwatchLogs: {
            logGroupName: `/aws/iot/farm-${config.environment}/errors`,
            roleArn: iotRuleRole.roleArn,
          },
        },
        ruleDisabled: false,
        description: 'Process telemetry data from farm equipment',
      },
    });

    // Allow IoT to invoke Lambda
    this.telemetryProcessorLambda.addPermission('IotInvoke', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      sourceArn: this.telemetryRule.attrArn,
    });

    // Create IoT Topic Rule for status updates
    new iot.CfnTopicRule(this, 'StatusRule', {
      ruleName: `farm_${config.environment}_status_rule`.replace(/-/g, '_'),
      topicRulePayload: {
        sql: "SELECT * FROM 'farm/+/status'",
        awsIotSqlVersion: '2016-03-23',
        actions: [
          {
            lambda: {
              functionArn: this.telemetryProcessorLambda.functionArn,
            },
          },
        ],
        ruleDisabled: false,
        description: 'Process status updates from farm equipment',
      },
    });

    // Tags
    cdk.Tags.of(this.telemetryProcessorLambda).add('Environment', config.environment);
    cdk.Tags.of(this.telemetryProcessorLambda).add('Project', 'FarmManagement');
  }
}

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface DatabaseConstructProps {
  config: EnvironmentConfig;
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
}

export class DatabaseConstruct extends Construct {
  public readonly instance: rds.DatabaseInstance;
  public readonly secret: secretsmanager.ISecret;
  public readonly parameterGroup: rds.ParameterGroup;

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);

    const { config, vpc, securityGroup } = props;

    // Create parameter group with PostGIS and TimescaleDB settings
    // Note: Free tier uses simpler settings
    const parameters: Record<string, string> = config.useFreeTier
      ? {
          'max_connections': '50',
          'log_statement': 'ddl',
        }
      : {
          // Enable shared_preload_libraries for TimescaleDB
          'shared_preload_libraries': 'pg_stat_statements,timescaledb',
          // Performance tuning
          'max_connections': config.environment === 'prod' ? '200' : '100',
          'work_mem': '64MB',
          'maintenance_work_mem': '256MB',
          'effective_cache_size': '1GB',
          // Logging
          'log_statement': 'ddl',
          'log_min_duration_statement': '1000',
          // PostGIS settings
          'postgis.gdal_enabled_drivers': 'ENABLE_ALL',
        };

    this.parameterGroup = new rds.ParameterGroup(this, 'ParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      description: `Farm Management ${config.environment} PostgreSQL parameter group`,
      parameters,
    });

    // Create database credentials secret
    const databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `farm-${config.environment}/database/credentials`,
      description: `Database credentials for Farm Management ${config.environment}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'farmadmin',
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // Determine instance class based on config
    const instanceType = this.getInstanceType(config.rds.instanceClass);

    // Create RDS instance
    // Free tier: Place in public subnet with public access for simplicity
    this.instance = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: `farm-${config.environment}-db`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType,
      vpc,
      vpcSubnets: config.useFreeTier
        ? { subnetType: ec2.SubnetType.PUBLIC }
        : { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [securityGroup],
      credentials: rds.Credentials.fromSecret(databaseSecret),
      databaseName: 'farmdb',
      parameterGroup: this.parameterGroup,
      allocatedStorage: config.rds.allocatedStorage,
      maxAllocatedStorage: config.useFreeTier ? config.rds.allocatedStorage : config.rds.allocatedStorage * 4,
      storageType: rds.StorageType.GP2, // GP2 is free tier eligible
      storageEncrypted: !config.useFreeTier, // Encryption not available on t3.micro
      multiAz: config.rds.multiAz,
      autoMinorVersionUpgrade: true,
      allowMajorVersionUpgrade: false,
      backupRetention: cdk.Duration.days(config.rds.backupRetention),
      preferredBackupWindow: '03:00-04:00',
      preferredMaintenanceWindow: 'Sun:04:00-Sun:05:00',
      deletionProtection: config.environment === 'prod',
      publiclyAccessible: config.useFreeTier, // Allow public access for free tier (for migrations)
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      enablePerformanceInsights: !config.useFreeTier && config.environment !== 'dev',
      performanceInsightRetention: config.environment === 'prod' 
        ? rds.PerformanceInsightRetention.MONTHS_12 
        : rds.PerformanceInsightRetention.DEFAULT,
      cloudwatchLogsExports: config.useFreeTier ? [] : ['postgresql', 'upgrade'],
      monitoringInterval: config.environment === 'prod' 
        ? cdk.Duration.seconds(60) 
        : cdk.Duration.seconds(0),
    });

    this.secret = databaseSecret;

    // Tags
    cdk.Tags.of(this.instance).add('Environment', config.environment);
    cdk.Tags.of(this.instance).add('Project', 'FarmManagement');
  }

  private getInstanceType(instanceClass: string): ec2.InstanceType {
    // Parse instance class string like 'db.t3.medium' to InstanceType
    const parts = instanceClass.replace('db.', '').split('.');
    const instanceFamily = parts[0];
    const instanceSize = parts[1];

    // Map common instance families
    const familyMap: Record<string, ec2.InstanceClass> = {
      't3': ec2.InstanceClass.T3,
      't4g': ec2.InstanceClass.T4G,
      'r6g': ec2.InstanceClass.R6G,
      'r6i': ec2.InstanceClass.R6I,
      'm6g': ec2.InstanceClass.M6G,
      'm6i': ec2.InstanceClass.M6I,
    };

    const sizeMap: Record<string, ec2.InstanceSize> = {
      'micro': ec2.InstanceSize.MICRO,
      'small': ec2.InstanceSize.SMALL,
      'medium': ec2.InstanceSize.MEDIUM,
      'large': ec2.InstanceSize.LARGE,
      'xlarge': ec2.InstanceSize.XLARGE,
      '2xlarge': ec2.InstanceSize.XLARGE2,
      '4xlarge': ec2.InstanceSize.XLARGE4,
    };

    const family = familyMap[instanceFamily] || ec2.InstanceClass.T3;
    const size = sizeMap[instanceSize] || ec2.InstanceSize.MEDIUM;

    return ec2.InstanceType.of(family, size);
  }
}

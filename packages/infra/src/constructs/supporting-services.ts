import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface SupportingServicesConstructProps {
  config: EnvironmentConfig;
  vpc: ec2.IVpc;
  redisSecurityGroup: ec2.ISecurityGroup;
}

export class SupportingServicesConstruct extends Construct {
  public readonly redisCluster?: elasticache.CfnCacheCluster;
  public readonly redisSubnetGroup?: elasticache.CfnSubnetGroup;
  public readonly uploadsBucket: s3.Bucket;
  public readonly backupsBucket: s3.Bucket;
  public readonly telemetryArchiveBucket: s3.Bucket;
  public readonly jwtSecret: secretsmanager.Secret;
  public readonly apiKeysSecret: secretsmanager.Secret;
  public readonly redisEndpoint: string;

  constructor(scope: Construct, id: string, props: SupportingServicesConstructProps) {
    super(scope, id);

    const { config, vpc, redisSecurityGroup } = props;

    // Create Redis only if enabled (skip for free tier to save costs)
    if (config.redis.enabled) {
      // Create Redis subnet group
      this.redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
        cacheSubnetGroupName: `farm-${config.environment}-redis-subnet-group`,
        description: `Redis subnet group for Farm Management ${config.environment}`,
        subnetIds: vpc.privateSubnets.map((subnet: ec2.ISubnet) => subnet.subnetId),
      });

      // Create ElastiCache Redis cluster
      this.redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
        clusterName: `farm-${config.environment}-redis`,
        engine: 'redis',
        engineVersion: '7.0',
        cacheNodeType: config.redis.nodeType,
        numCacheNodes: config.redis.numCacheNodes,
        cacheSubnetGroupName: this.redisSubnetGroup.cacheSubnetGroupName,
        vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
        port: 6379,
        preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
        snapshotRetentionLimit: config.environment === 'prod' ? 7 : 1,
        snapshotWindow: '04:00-05:00',
        autoMinorVersionUpgrade: true,
        tags: [
          { key: 'Environment', value: config.environment },
          { key: 'Project', value: 'FarmManagement' },
        ],
      });

      this.redisCluster.addDependency(this.redisSubnetGroup);

      // Store Redis endpoint for use by other constructs
      this.redisEndpoint = this.redisCluster.attrRedisEndpointAddress;
    } else {
      // No Redis for free tier - use empty string (app should use in-memory cache)
      this.redisEndpoint = '';
    }

    // Create S3 bucket for file uploads (receipts, photos, etc.)
    const corsOrigins = config.domainName
      ? [
          `https://${config.domainName}`,
          `https://app.${config.domainName}`,
        ]
      : ['*']; // Allow all origins for free tier (POC only)

    this.uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `farm-${config.environment}-uploads-${cdk.Aws.ACCOUNT_ID}`,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'prod',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: config.environment === 'prod',
      lifecycleRules: config.useFreeTier ? [] : [
        {
          id: 'TransitionToIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: corsOrigins,
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Create S3 bucket for database backups
    this.backupsBucket = new s3.Bucket(this, 'BackupsBucket', {
      bucketName: `farm-${config.environment}-backups-${cdk.Aws.ACCOUNT_ID}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [
        {
          id: 'TransitionToGlacier',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
          expiration: cdk.Duration.days(365),
        },
      ],
    });

    // Create S3 bucket for telemetry data archive
    this.telemetryArchiveBucket = new s3.Bucket(this, 'TelemetryArchiveBucket', {
      bucketName: `farm-${config.environment}-telemetry-archive-${cdk.Aws.ACCOUNT_ID}`,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'prod',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          id: 'TransitionToIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
    });

    // Create JWT secret for authentication
    this.jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: `farm-${config.environment}/auth/jwt-secret`,
      description: `JWT signing secret for Farm Management ${config.environment}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: 'secret',
        excludePunctuation: false,
        passwordLength: 64,
      },
    });

    // Create API keys secret for external services
    this.apiKeysSecret = new secretsmanager.Secret(this, 'ApiKeysSecret', {
      secretName: `farm-${config.environment}/api-keys`,
      description: `External API keys for Farm Management ${config.environment}`,
      secretObjectValue: {
        weatherApiKey: cdk.SecretValue.unsafePlainText('PLACEHOLDER_WEATHER_API_KEY'),
        mapboxApiKey: cdk.SecretValue.unsafePlainText('PLACEHOLDER_MAPBOX_API_KEY'),
        anthropicApiKey: cdk.SecretValue.unsafePlainText('PLACEHOLDER_ANTHROPIC_API_KEY'),
      },
    });

    // Tags
    cdk.Tags.of(this.uploadsBucket).add('Environment', config.environment);
    cdk.Tags.of(this.uploadsBucket).add('Project', 'FarmManagement');
    cdk.Tags.of(this.backupsBucket).add('Environment', config.environment);
    cdk.Tags.of(this.backupsBucket).add('Project', 'FarmManagement');
  }
}

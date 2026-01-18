import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface EcsClusterConstructProps {
  config: EnvironmentConfig;
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  databaseSecret: secretsmanager.ISecret;
  databaseEndpoint: string;
  redisEndpoint?: string;
}

export class EcsClusterConstruct extends Construct {
  public readonly cluster: ecs.Cluster;
  public readonly apiRepository: ecr.Repository;
  public readonly webRepository: ecr.Repository;
  public readonly apiService: ecs.FargateService;
  public readonly webService: ecs.FargateService;
  public readonly apiTaskDefinition: ecs.FargateTaskDefinition;
  public readonly webTaskDefinition: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: EcsClusterConstructProps) {
    super(scope, id);

    const { config, vpc, securityGroup, databaseSecret, databaseEndpoint, redisEndpoint } = props;

    // Create ECS Cluster
    this.cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: `farm-${config.environment}-cluster`,
      vpc,
      containerInsights: config.environment !== 'dev',
      enableFargateCapacityProviders: true,
    });

    // Create ECR repositories
    this.apiRepository = new ecr.Repository(this, 'ApiRepository', {
      repositoryName: `farm-${config.environment}-api`,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep only 10 images',
        },
      ],
    });

    this.webRepository = new ecr.Repository(this, 'WebRepository', {
      repositoryName: `farm-${config.environment}-web`,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep only 10 images',
        },
      ],
    });

    // Create log groups
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/ecs/farm-${config.environment}/api`,
      retention: config.environment === 'prod' 
        ? logs.RetentionDays.ONE_YEAR 
        : logs.RetentionDays.ONE_WEEK,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    const webLogGroup = new logs.LogGroup(this, 'WebLogGroup', {
      logGroupName: `/ecs/farm-${config.environment}/web`,
      retention: config.environment === 'prod' 
        ? logs.RetentionDays.ONE_YEAR 
        : logs.RetentionDays.ONE_WEEK,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // Create API Task Definition
    this.apiTaskDefinition = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
      family: `farm-${config.environment}-api`,
      cpu: config.ecs.apiCpu,
      memoryLimitMiB: config.ecs.apiMemory,
    });

    // Grant API task access to database secret
    databaseSecret.grantRead(this.apiTaskDefinition.taskRole);

    // Add API container
    const apiContainer = this.apiTaskDefinition.addContainer('api', {
      containerName: 'api',
      image: ecs.ContainerImage.fromEcrRepository(this.apiRepository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup: apiLogGroup,
      }),
      environment: {
        NODE_ENV: config.environment === 'prod' ? 'production' : 'development',
        PORT: '3000',
        DATABASE_HOST: databaseEndpoint,
        DATABASE_PORT: '5432',
        DATABASE_NAME: 'farmdb',
        REDIS_HOST: redisEndpoint || '',
        REDIS_PORT: '6379',
      },
      secrets: {
        DATABASE_USERNAME: ecs.Secret.fromSecretsManager(databaseSecret, 'username'),
        DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(databaseSecret, 'password'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    apiContainer.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    // Create Web Task Definition
    this.webTaskDefinition = new ecs.FargateTaskDefinition(this, 'WebTaskDef', {
      family: `farm-${config.environment}-web`,
      cpu: config.ecs.webCpu,
      memoryLimitMiB: config.ecs.webMemory,
    });

    // Add Web container
    const webContainer = this.webTaskDefinition.addContainer('web', {
      containerName: 'web',
      image: ecs.ContainerImage.fromEcrRepository(this.webRepository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'web',
        logGroup: webLogGroup,
      }),
      environment: {
        NODE_ENV: config.environment === 'prod' ? 'production' : 'development',
        VITE_API_URL: `https://api.${config.domainName}`,
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:80/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(30),
      },
    });

    webContainer.addPortMappings({
      containerPort: 80,
      protocol: ecs.Protocol.TCP,
    });

    // Create API Fargate Service
    // Free tier: Use public subnets with public IP (no NAT Gateway needed)
    this.apiService = new ecs.FargateService(this, 'ApiService', {
      serviceName: `farm-${config.environment}-api`,
      cluster: this.cluster,
      taskDefinition: this.apiTaskDefinition,
      desiredCount: config.ecs.apiDesiredCount,
      securityGroups: [securityGroup],
      vpcSubnets: config.useFreeTier
        ? { subnetType: ec2.SubnetType.PUBLIC }
        : { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: config.useFreeTier, // Required for public subnet without NAT
      circuitBreaker: {
        rollback: true,
      },
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE_SPOT', // Use Spot for cost savings
          weight: config.useFreeTier ? 1 : (config.environment === 'prod' ? 0 : 2),
          base: config.useFreeTier ? 1 : 0,
        },
        {
          capacityProvider: 'FARGATE',
          weight: config.useFreeTier ? 0 : 1,
          base: config.useFreeTier ? 0 : 1,
        },
      ],
    });

    // Create Web Fargate Service
    this.webService = new ecs.FargateService(this, 'WebService', {
      serviceName: `farm-${config.environment}-web`,
      cluster: this.cluster,
      taskDefinition: this.webTaskDefinition,
      desiredCount: config.ecs.webDesiredCount,
      securityGroups: [securityGroup],
      vpcSubnets: config.useFreeTier
        ? { subnetType: ec2.SubnetType.PUBLIC }
        : { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: config.useFreeTier,
      circuitBreaker: {
        rollback: true,
      },
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: config.useFreeTier ? 1 : (config.environment === 'prod' ? 0 : 2),
          base: config.useFreeTier ? 1 : 0,
        },
        {
          capacityProvider: 'FARGATE',
          weight: config.useFreeTier ? 0 : 1,
          base: config.useFreeTier ? 0 : 1,
        },
      ],
    });

    // Configure Auto Scaling for API (skip for free tier)
    if (!config.useFreeTier) {
      const apiScaling = this.apiService.autoScaleTaskCount({
        minCapacity: config.ecs.minCapacity,
        maxCapacity: config.ecs.maxCapacity,
      });

      apiScaling.scaleOnCpuUtilization('ApiCpuScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(60),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });

      apiScaling.scaleOnMemoryUtilization('ApiMemoryScaling', {
        targetUtilizationPercent: 80,
        scaleInCooldown: cdk.Duration.seconds(60),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });

      // Configure Auto Scaling for Web
      const webScaling = this.webService.autoScaleTaskCount({
        minCapacity: config.ecs.minCapacity,
        maxCapacity: config.ecs.maxCapacity,
      });

      webScaling.scaleOnCpuUtilization('WebCpuScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(60),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });
    }

    // Tags
    cdk.Tags.of(this.cluster).add('Environment', config.environment);
    cdk.Tags.of(this.cluster).add('Project', 'FarmManagement');
  }
}

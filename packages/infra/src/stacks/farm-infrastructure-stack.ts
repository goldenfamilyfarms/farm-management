import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';
import { VpcConstruct } from '../constructs/vpc';
import { DatabaseConstruct } from '../constructs/database';
import { EcsClusterConstruct } from '../constructs/ecs-cluster';
import { NetworkingConstruct } from '../constructs/networking';
import { IotCoreConstruct } from '../constructs/iot-core';
import { SupportingServicesConstruct } from '../constructs/supporting-services';
import { CicdPipelineConstruct } from '../constructs/cicd-pipeline';

export interface FarmInfrastructureStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class FarmInfrastructureStack extends cdk.Stack {
  public readonly vpcConstruct: VpcConstruct;
  public readonly databaseConstruct: DatabaseConstruct;
  public readonly supportingServicesConstruct: SupportingServicesConstruct;
  public readonly ecsConstruct: EcsClusterConstruct;
  public readonly networkingConstruct: NetworkingConstruct;
  public readonly iotConstruct: IotCoreConstruct;
  public readonly cicdConstruct: CicdPipelineConstruct;

  constructor(scope: Construct, id: string, props: FarmInfrastructureStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create VPC with security groups
    this.vpcConstruct = new VpcConstruct(this, 'Vpc', {
      config,
    });

    // Create RDS PostgreSQL with PostGIS and TimescaleDB
    this.databaseConstruct = new DatabaseConstruct(this, 'Database', {
      config,
      vpc: this.vpcConstruct.vpc,
      securityGroup: this.vpcConstruct.rdsSecurityGroup,
    });

    // Create supporting services (Redis, S3, Secrets Manager)
    this.supportingServicesConstruct = new SupportingServicesConstruct(this, 'SupportingServices', {
      config,
      vpc: this.vpcConstruct.vpc,
      redisSecurityGroup: this.vpcConstruct.redisSecurityGroup,
    });

    // Create ECS Fargate cluster and services
    this.ecsConstruct = new EcsClusterConstruct(this, 'Ecs', {
      config,
      vpc: this.vpcConstruct.vpc,
      securityGroup: this.vpcConstruct.ecsSecurityGroup,
      databaseSecret: this.databaseConstruct.secret,
      databaseEndpoint: this.databaseConstruct.instance.dbInstanceEndpointAddress,
      redisEndpoint: this.supportingServicesConstruct.redisEndpoint,
    });

    // Create networking (ALB, Route 53, CloudFront, ACM)
    this.networkingConstruct = new NetworkingConstruct(this, 'Networking', {
      config,
      vpc: this.vpcConstruct.vpc,
      albSecurityGroup: this.vpcConstruct.albSecurityGroup,
      apiService: this.ecsConstruct.apiService,
      webService: this.ecsConstruct.webService,
    });

    // Create IoT Core for telemetry ingestion
    this.iotConstruct = new IotCoreConstruct(this, 'Iot', {
      config,
      vpc: this.vpcConstruct.vpc,
      lambdaSecurityGroup: this.vpcConstruct.lambdaSecurityGroup,
      databaseSecret: this.databaseConstruct.secret,
      databaseEndpoint: this.databaseConstruct.instance.dbInstanceEndpointAddress,
    });

    // Create CI/CD pipeline
    this.cicdConstruct = new CicdPipelineConstruct(this, 'Cicd', {
      config,
      apiRepository: this.ecsConstruct.apiRepository,
      webRepository: this.ecsConstruct.webRepository,
      apiService: this.ecsConstruct.apiService,
      webService: this.ecsConstruct.webService,
      ecsCluster: this.ecsConstruct.cluster,
    });

    // Output VPC ID
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpcConstruct.vpc.vpcId,
      description: 'VPC ID',
      exportName: `farm-${config.environment}-vpc-id`,
    });

    // Output public subnet IDs
    new cdk.CfnOutput(this, 'PublicSubnetIds', {
      value: this.vpcConstruct.vpc.publicSubnets.map(s => s.subnetId).join(','),
      description: 'Public Subnet IDs',
      exportName: `farm-${config.environment}-public-subnet-ids`,
    });

    // Output private subnet IDs
    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.vpcConstruct.vpc.privateSubnets.map(s => s.subnetId).join(','),
      description: 'Private Subnet IDs',
      exportName: `farm-${config.environment}-private-subnet-ids`,
    });

    // Output security group IDs
    new cdk.CfnOutput(this, 'AlbSecurityGroupId', {
      value: this.vpcConstruct.albSecurityGroup.securityGroupId,
      description: 'ALB Security Group ID',
      exportName: `farm-${config.environment}-alb-sg-id`,
    });

    new cdk.CfnOutput(this, 'EcsSecurityGroupId', {
      value: this.vpcConstruct.ecsSecurityGroup.securityGroupId,
      description: 'ECS Security Group ID',
      exportName: `farm-${config.environment}-ecs-sg-id`,
    });

    new cdk.CfnOutput(this, 'RdsSecurityGroupId', {
      value: this.vpcConstruct.rdsSecurityGroup.securityGroupId,
      description: 'RDS Security Group ID',
      exportName: `farm-${config.environment}-rds-sg-id`,
    });

    new cdk.CfnOutput(this, 'RedisSecurityGroupId', {
      value: this.vpcConstruct.redisSecurityGroup.securityGroupId,
      description: 'Redis Security Group ID',
      exportName: `farm-${config.environment}-redis-sg-id`,
    });

    // Database outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.databaseConstruct.instance.dbInstanceEndpointAddress,
      description: 'RDS Database Endpoint',
      exportName: `farm-${config.environment}-db-endpoint`,
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: this.databaseConstruct.instance.dbInstanceEndpointPort,
      description: 'RDS Database Port',
      exportName: `farm-${config.environment}-db-port`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseConstruct.secret.secretArn,
      description: 'Database Credentials Secret ARN',
      exportName: `farm-${config.environment}-db-secret-arn`,
    });

    // ECS outputs
    new cdk.CfnOutput(this, 'EcsClusterName', {
      value: this.ecsConstruct.cluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: `farm-${config.environment}-ecs-cluster-name`,
    });

    new cdk.CfnOutput(this, 'ApiRepositoryUri', {
      value: this.ecsConstruct.apiRepository.repositoryUri,
      description: 'API ECR Repository URI',
      exportName: `farm-${config.environment}-api-repo-uri`,
    });

    new cdk.CfnOutput(this, 'WebRepositoryUri', {
      value: this.ecsConstruct.webRepository.repositoryUri,
      description: 'Web ECR Repository URI',
      exportName: `farm-${config.environment}-web-repo-uri`,
    });

    new cdk.CfnOutput(this, 'ApiServiceArn', {
      value: this.ecsConstruct.apiService.serviceArn,
      description: 'API ECS Service ARN',
      exportName: `farm-${config.environment}-api-service-arn`,
    });

    new cdk.CfnOutput(this, 'WebServiceArn', {
      value: this.ecsConstruct.webService.serviceArn,
      description: 'Web ECS Service ARN',
      exportName: `farm-${config.environment}-web-service-arn`,
    });

    // Networking outputs
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.networkingConstruct.alb.loadBalancerDnsName,
      description: 'ALB DNS Name',
      exportName: `farm-${config.environment}-alb-dns`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: this.networkingConstruct.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
      exportName: `farm-${config.environment}-cloudfront-domain`,
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.networkingConstruct.certificate.certificateArn,
      description: 'ACM Certificate ARN',
      exportName: `farm-${config.environment}-certificate-arn`,
    });

    new cdk.CfnOutput(this, 'StaticAssetsBucketName', {
      value: this.networkingConstruct.staticAssetsBucket.bucketName,
      description: 'Static Assets S3 Bucket Name',
      exportName: `farm-${config.environment}-static-assets-bucket`,
    });

    // IoT outputs
    new cdk.CfnOutput(this, 'IotThingTypeName', {
      value: this.iotConstruct.thingType.thingTypeName || '',
      description: 'IoT Thing Type Name',
      exportName: `farm-${config.environment}-iot-thing-type`,
    });

    new cdk.CfnOutput(this, 'IotPolicyName', {
      value: this.iotConstruct.thingPolicy.policyName || '',
      description: 'IoT Policy Name',
      exportName: `farm-${config.environment}-iot-policy`,
    });

    new cdk.CfnOutput(this, 'TelemetryProcessorLambdaArn', {
      value: this.iotConstruct.telemetryProcessorLambda.functionArn,
      description: 'Telemetry Processor Lambda ARN',
      exportName: `farm-${config.environment}-telemetry-lambda-arn`,
    });

    // Supporting services outputs
    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.supportingServicesConstruct.redisEndpoint,
      description: 'Redis Cluster Endpoint',
      exportName: `farm-${config.environment}-redis-endpoint`,
    });

    new cdk.CfnOutput(this, 'UploadsBucketName', {
      value: this.supportingServicesConstruct.uploadsBucket.bucketName,
      description: 'Uploads S3 Bucket Name',
      exportName: `farm-${config.environment}-uploads-bucket`,
    });

    new cdk.CfnOutput(this, 'BackupsBucketName', {
      value: this.supportingServicesConstruct.backupsBucket.bucketName,
      description: 'Backups S3 Bucket Name',
      exportName: `farm-${config.environment}-backups-bucket`,
    });

    new cdk.CfnOutput(this, 'TelemetryArchiveBucketName', {
      value: this.supportingServicesConstruct.telemetryArchiveBucket.bucketName,
      description: 'Telemetry Archive S3 Bucket Name',
      exportName: `farm-${config.environment}-telemetry-archive-bucket`,
    });

    new cdk.CfnOutput(this, 'JwtSecretArn', {
      value: this.supportingServicesConstruct.jwtSecret.secretArn,
      description: 'JWT Secret ARN',
      exportName: `farm-${config.environment}-jwt-secret-arn`,
    });

    new cdk.CfnOutput(this, 'ApiKeysSecretArn', {
      value: this.supportingServicesConstruct.apiKeysSecret.secretArn,
      description: 'API Keys Secret ARN',
      exportName: `farm-${config.environment}-api-keys-secret-arn`,
    });

    // CI/CD outputs
    new cdk.CfnOutput(this, 'PipelineName', {
      value: this.cicdConstruct.pipeline.pipelineName,
      description: 'CodePipeline Name',
      exportName: `farm-${config.environment}-pipeline-name`,
    });

    new cdk.CfnOutput(this, 'PipelineArtifactBucket', {
      value: this.cicdConstruct.artifactBucket.bucketName,
      description: 'Pipeline Artifact Bucket',
      exportName: `farm-${config.environment}-pipeline-artifacts-bucket`,
    });
  }
}

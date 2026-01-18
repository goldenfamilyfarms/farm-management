import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface VpcConstructProps {
  config: EnvironmentConfig;
}

export class VpcConstruct extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly ecsSecurityGroup: ec2.SecurityGroup;
  public readonly rdsSecurityGroup: ec2.SecurityGroup;
  public readonly redisSecurityGroup: ec2.SecurityGroup;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    const { config } = props;

    // Create VPC with public and private subnets
    // Free tier: No NAT Gateway (saves ~$32/month), use public subnets only
    const subnetConfiguration: ec2.SubnetConfiguration[] = config.useFreeTier
      ? [
          {
            name: 'Public',
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
        ]
      : [
          {
            name: 'Public',
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
          {
            name: 'Private',
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 24,
          },
          {
            name: 'Isolated',
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            cidrMask: 24,
          },
        ];

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `farm-${config.environment}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr(config.vpcCidr),
      maxAzs: config.useFreeTier ? 2 : 3,
      natGateways: config.useFreeTier ? 0 : (config.environment === 'prod' ? 3 : 1),
      subnetConfiguration,
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // ALB Security Group - allows HTTP/HTTPS from internet
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `farm-${config.environment}-alb-sg`,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from anywhere'
    );
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS from anywhere'
    );

    // ECS Security Group - allows traffic from ALB
    this.ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `farm-${config.environment}-ecs-sg`,
      description: 'Security group for ECS Fargate tasks',
      allowAllOutbound: true,
    });
    this.ecsSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(3000),
      'Allow traffic from ALB to API'
    );
    this.ecsSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(80),
      'Allow traffic from ALB to Web'
    );

    // RDS Security Group - allows traffic from ECS and Lambda
    this.rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `farm-${config.environment}-rds-sg`,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: false,
    });
    this.rdsSecurityGroup.addIngressRule(
      this.ecsSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from ECS'
    );

    // Redis Security Group - allows traffic from ECS and Lambda
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `farm-${config.environment}-redis-sg`,
      description: 'Security group for ElastiCache Redis',
      allowAllOutbound: false,
    });
    this.redisSecurityGroup.addIngressRule(
      this.ecsSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Redis from ECS'
    );

    // Lambda Security Group - for IoT processing functions
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `farm-${config.environment}-lambda-sg`,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // Allow Lambda to access RDS and Redis
    this.rdsSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from Lambda'
    );
    this.redisSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Redis from Lambda'
    );

    // Add VPC Flow Logs for production
    if (config.environment === 'prod') {
      this.vpc.addFlowLog('FlowLog', {
        destination: ec2.FlowLogDestination.toCloudWatchLogs(),
        trafficType: ec2.FlowLogTrafficType.ALL,
      });
    }

    // Tags
    cdk.Tags.of(this.vpc).add('Environment', config.environment);
    cdk.Tags.of(this.vpc).add('Project', 'FarmManagement');
  }
}

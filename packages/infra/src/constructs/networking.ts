import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface NetworkingConstructProps {
  config: EnvironmentConfig;
  vpc: ec2.IVpc;
  albSecurityGroup: ec2.ISecurityGroup;
  apiService: ecs.FargateService;
  webService: ecs.FargateService;
}

export class NetworkingConstruct extends Construct {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly apiTargetGroup: elbv2.ApplicationTargetGroup;
  public readonly webTargetGroup: elbv2.ApplicationTargetGroup;
  public readonly certificate: acm.Certificate;
  public readonly hostedZone: route53.IHostedZone;
  public readonly distribution: cloudfront.Distribution;
  public readonly staticAssetsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: NetworkingConstructProps) {
    super(scope, id);

    const { config, vpc, albSecurityGroup, apiService, webService } = props;

    // Look up existing hosted zone or create new one
    // For production, you'd typically import an existing zone
    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: 'goldenfamilyfarms.org',
    });

    // Create ACM certificate for the domain
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: config.domainName,
      subjectAlternativeNames: [
        `*.${config.domainName}`,
        `api.${config.domainName}`,
        `app.${config.domainName}`,
      ],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    // Create Application Load Balancer
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      loadBalancerName: `farm-${config.environment}-alb`,
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // Create HTTPS listener
    const httpsListener = this.alb.addListener('HttpsListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [this.certificate],
      sslPolicy: elbv2.SslPolicy.TLS12,
    });

    // Create HTTP listener that redirects to HTTPS
    this.alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });

    // Create API target group
    this.apiTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      targetGroupName: `farm-${config.environment}-api-tg`,
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Create Web target group
    this.webTargetGroup = new elbv2.ApplicationTargetGroup(this, 'WebTargetGroup', {
      targetGroupName: `farm-${config.environment}-web-tg`,
      vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Register ECS services with target groups
    apiService.attachToApplicationTargetGroup(this.apiTargetGroup);
    webService.attachToApplicationTargetGroup(this.webTargetGroup);

    // Add routing rules to HTTPS listener
    // API routes to api.domain.com
    httpsListener.addAction('ApiRoute', {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.hostHeaders([`api.${config.domainName}`]),
      ],
      action: elbv2.ListenerAction.forward([this.apiTargetGroup]),
    });

    // Default action routes to web
    httpsListener.addAction('DefaultRoute', {
      priority: 100,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/*']),
      ],
      action: elbv2.ListenerAction.forward([this.webTargetGroup]),
    });

    // Create S3 bucket for static assets
    this.staticAssetsBucket = new s3.Bucket(this, 'StaticAssetsBucket', {
      bucketName: `farm-${config.environment}-static-assets-${cdk.Aws.ACCOUNT_ID}`,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'prod',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: config.environment === 'prod',
    });

    // Create CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `Farm Management ${config.environment} CDN`,
      defaultBehavior: {
        origin: new cloudfrontOrigins.LoadBalancerV2Origin(this.alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
      additionalBehaviors: {
        '/static/*': {
          origin: new cloudfrontOrigins.S3Origin(this.staticAssetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/assets/*': {
          origin: new cloudfrontOrigins.S3Origin(this.staticAssetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      domainNames: [config.domainName, `app.${config.domainName}`],
      certificate: this.certificate,
      priceClass: config.environment === 'prod' 
        ? cloudfront.PriceClass.PRICE_CLASS_ALL 
        : cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // Create Route 53 records
    // Main domain pointing to CloudFront
    new route53.ARecord(this, 'MainDomainRecord', {
      zone: this.hostedZone,
      recordName: config.domainName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(this.distribution)
      ),
    });

    // App subdomain pointing to CloudFront
    new route53.ARecord(this, 'AppDomainRecord', {
      zone: this.hostedZone,
      recordName: `app.${config.domainName}`,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(this.distribution)
      ),
    });

    // API subdomain pointing directly to ALB
    new route53.ARecord(this, 'ApiDomainRecord', {
      zone: this.hostedZone,
      recordName: `api.${config.domainName}`,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.LoadBalancerTarget(this.alb)
      ),
    });

    // Tags
    cdk.Tags.of(this.alb).add('Environment', config.environment);
    cdk.Tags.of(this.alb).add('Project', 'FarmManagement');
  }
}

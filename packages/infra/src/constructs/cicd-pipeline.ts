import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface CicdPipelineConstructProps {
  config: EnvironmentConfig;
  apiRepository: ecr.IRepository;
  webRepository: ecr.IRepository;
  apiService: ecs.FargateService;
  webService: ecs.FargateService;
  ecsCluster: ecs.ICluster;
}

export class CicdPipelineConstruct extends Construct {
  public readonly pipeline: codepipeline.Pipeline;
  public readonly apiBuildProject: codebuild.PipelineProject;
  public readonly webBuildProject: codebuild.PipelineProject;
  public readonly artifactBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: CicdPipelineConstructProps) {
    super(scope, id);

    const { config, apiRepository, webRepository, apiService, webService, ecsCluster } = props;

    // Create artifact bucket for pipeline
    this.artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      bucketName: `farm-${config.environment}-pipeline-artifacts-${cdk.Aws.ACCOUNT_ID}`,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'prod',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Create CodeBuild project for API
    this.apiBuildProject = new codebuild.PipelineProject(this, 'ApiBuildProject', {
      projectName: `farm-${config.environment}-api-build`,
      description: 'Build and push API Docker image',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true, // Required for Docker builds
        computeType: codebuild.ComputeType.MEDIUM,
      },
      environmentVariables: {
        AWS_ACCOUNT_ID: { value: cdk.Aws.ACCOUNT_ID },
        AWS_REGION: { value: cdk.Aws.REGION },
        ECR_REPO_URI: { value: apiRepository.repositoryUri },
        IMAGE_TAG: { value: 'latest' },
        ENVIRONMENT: { value: config.environment },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com',
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'IMAGE_TAG=${COMMIT_HASH:=latest}',
            ],
          },
          build: {
            commands: [
              'echo Building the Docker image...',
              'cd packages/api',
              'docker build -t $ECR_REPO_URI:$IMAGE_TAG -t $ECR_REPO_URI:latest .',
            ],
          },
          post_build: {
            commands: [
              'echo Pushing the Docker image...',
              'docker push $ECR_REPO_URI:$IMAGE_TAG',
              'docker push $ECR_REPO_URI:latest',
              'echo Writing image definitions file...',
              'printf \'[{"name":"api","imageUri":"%s"}]\' $ECR_REPO_URI:$IMAGE_TAG > imagedefinitions.json',
              'cat imagedefinitions.json',
            ],
          },
        },
        artifacts: {
          files: ['packages/api/imagedefinitions.json'],
          'discard-paths': 'yes',
        },
      }),
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
    });

    // Grant ECR permissions to API build project
    apiRepository.grantPullPush(this.apiBuildProject);

    // Create CodeBuild project for Web
    this.webBuildProject = new codebuild.PipelineProject(this, 'WebBuildProject', {
      projectName: `farm-${config.environment}-web-build`,
      description: 'Build and push Web Docker image',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
        computeType: codebuild.ComputeType.MEDIUM,
      },
      environmentVariables: {
        AWS_ACCOUNT_ID: { value: cdk.Aws.ACCOUNT_ID },
        AWS_REGION: { value: cdk.Aws.REGION },
        ECR_REPO_URI: { value: webRepository.repositoryUri },
        IMAGE_TAG: { value: 'latest' },
        ENVIRONMENT: { value: config.environment },
        VITE_API_URL: { value: `https://api.${config.domainName}` },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com',
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'IMAGE_TAG=${COMMIT_HASH:=latest}',
            ],
          },
          build: {
            commands: [
              'echo Building the Docker image...',
              'cd packages/web',
              'docker build --build-arg VITE_API_URL=$VITE_API_URL -t $ECR_REPO_URI:$IMAGE_TAG -t $ECR_REPO_URI:latest .',
            ],
          },
          post_build: {
            commands: [
              'echo Pushing the Docker image...',
              'docker push $ECR_REPO_URI:$IMAGE_TAG',
              'docker push $ECR_REPO_URI:latest',
              'echo Writing image definitions file...',
              'printf \'[{"name":"web","imageUri":"%s"}]\' $ECR_REPO_URI:$IMAGE_TAG > imagedefinitions.json',
              'cat imagedefinitions.json',
            ],
          },
        },
        artifacts: {
          files: ['packages/web/imagedefinitions.json'],
          'discard-paths': 'yes',
        },
      }),
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
    });

    // Grant ECR permissions to Web build project
    webRepository.grantPullPush(this.webBuildProject);

    // Create the pipeline
    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: `farm-${config.environment}-pipeline`,
      artifactBucket: this.artifactBucket,
      restartExecutionOnUpdate: true,
    });

    // Source stage - using CodeStar connection (GitHub)
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const sourceAction = new codepipelineActions.CodeStarConnectionsSourceAction({
      actionName: 'GitHub_Source',
      owner: 'golden-family-farms', // Replace with actual GitHub org/user
      repo: 'farm-management-platform', // Replace with actual repo name
      branch: config.environment === 'prod' ? 'main' : config.environment,
      output: sourceOutput,
      connectionArn: `arn:aws:codestar-connections:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:connection/PLACEHOLDER`, // Replace with actual connection ARN
      triggerOnPush: true,
    });

    this.pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    // Build stage
    const apiBuildOutput = new codepipeline.Artifact('ApiBuildOutput');
    const webBuildOutput = new codepipeline.Artifact('WebBuildOutput');

    this.pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipelineActions.CodeBuildAction({
          actionName: 'Build_API',
          project: this.apiBuildProject,
          input: sourceOutput,
          outputs: [apiBuildOutput],
        }),
        new codepipelineActions.CodeBuildAction({
          actionName: 'Build_Web',
          project: this.webBuildProject,
          input: sourceOutput,
          outputs: [webBuildOutput],
        }),
      ],
    });

    // Deploy stage
    this.pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipelineActions.EcsDeployAction({
          actionName: 'Deploy_API',
          service: apiService,
          input: apiBuildOutput,
          deploymentTimeout: cdk.Duration.minutes(30),
        }),
        new codepipelineActions.EcsDeployAction({
          actionName: 'Deploy_Web',
          service: webService,
          input: webBuildOutput,
          deploymentTimeout: cdk.Duration.minutes(30),
        }),
      ],
    });

    // Add manual approval for production
    if (config.environment === 'prod') {
      // Insert approval stage before deploy
      const approvalStage = this.pipeline.addStage({
        stageName: 'Approval',
        placement: {
          justAfter: this.pipeline.stages[1], // After Build stage
        },
        actions: [
          new codepipelineActions.ManualApprovalAction({
            actionName: 'Approve_Production_Deploy',
            notifyEmails: ['ops@goldenfamilyfarms.org'], // Replace with actual email
            additionalInformation: 'Please review the build artifacts before approving production deployment.',
          }),
        ],
      });
    }

    // Tags
    cdk.Tags.of(this.pipeline).add('Environment', config.environment);
    cdk.Tags.of(this.pipeline).add('Project', 'FarmManagement');
  }
}

#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FarmInfrastructureStack } from './stacks/farm-infrastructure-stack';
import { Environment, getEnvironmentConfig } from './config/environment';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const envName = (app.node.tryGetContext('env') as Environment) || 'dev';

// Get AWS account and region from environment or CDK context
const account = process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext('account');
const region = process.env.CDK_DEFAULT_REGION || app.node.tryGetContext('region') || 'us-east-1';

if (!account) {
  console.warn('Warning: AWS account not specified. Using CDK_DEFAULT_ACCOUNT or specify via --context account=xxx');
}

const config = getEnvironmentConfig(envName, account || 'ACCOUNT_ID', region);

// Create the main infrastructure stack
new FarmInfrastructureStack(app, `FarmInfrastructure-${config.environment}`, {
  config,
  env: {
    account: config.account,
    region: config.region,
  },
  description: `Farm Management Platform Infrastructure - ${config.environment}`,
  tags: {
    Environment: config.environment,
    Project: 'FarmManagement',
    ManagedBy: 'CDK',
  },
});

app.synth();

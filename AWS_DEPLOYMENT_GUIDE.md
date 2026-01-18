# AWS Deployment Guide - Farm Management Platform

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Pre-Deployment Setup](#pre-deployment-setup)
- [Environment Tiers](#environment-tiers)
- [Deployment Steps](#deployment-steps)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Scaling and Performance](#scaling-and-performance)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [Cost Estimates](#cost-estimates)

---

## Overview

The Farm Management Platform is a full-stack, multi-tenant SaaS application designed for agricultural operations. This guide covers deploying the application to AWS using Infrastructure as Code (AWS CDK).

### Application Stack

**Frontend:**
- React 18 + TypeScript
- Vite build system
- Tailwind CSS + Radix UI
- Mapbox GL for geospatial visualization

**Backend:**
- NestJS 10 + TypeScript
- Prisma ORM
- JWT authentication with role-based access control
- WebSocket support for real-time features

**Database:**
- PostgreSQL 15 with PostGIS (geospatial)
- TimescaleDB extension (time-series data)

**Caching:**
- Redis 7 (sessions and application cache)

**AI Integration:**
- Anthropic Claude API for crop recommendations

---

## Architecture

### AWS Services Used

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Requests                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                    ┌───────▼──────┐
                    │  Route 53    │ (DNS)
                    │ CloudFront   │ (CDN)
                    └───────┬──────┘
                            │
                  ┌─────────▼────────────┐
                  │ Application Load     │
                  │     Balancer         │
                  └──────────┬───────────┘
                             │
              ┌──────────────┴───────────────┐
              │                              │
      ┌───────▼──────┐              ┌────────▼──────┐
      │  ECS Fargate │              │  ECS Fargate  │
      │   (API)      │              │    (Web)      │
      └───────┬──────┘              └────────┬──────┘
              │                              │
              ├──────────────────────────────┘
              │
    ┌─────────┼────────────┬─────────────┐
    │         │            │             │
┌───▼──┐  ┌──▼───┐   ┌────▼────┐   ┌────▼────┐
│ RDS  │  │Redis │   │   S3    │   │IoT Core │
│ PG15 │  │Cache │   │ Storage │   │Telemetry│
└──────┘  └──────┘   └─────────┘   └─────────┘
```

### Key Components

1. **VPC (Virtual Private Cloud)**
   - Multi-AZ deployment across 3 availability zones
   - Public subnets: Application Load Balancer
   - Private subnets: ECS Fargate tasks
   - Isolated subnets: RDS PostgreSQL, ElastiCache Redis

2. **ECS Fargate**
   - API Service: NestJS backend
   - Web Service: Nginx serving React SPA
   - Auto-scaling based on CPU/memory
   - Health checks and rolling updates

3. **RDS PostgreSQL**
   - PostGIS extension for geospatial features
   - TimescaleDB extension for time-series telemetry
   - Automated backups
   - Multi-AZ for production

4. **ElastiCache Redis**
   - Session storage
   - Application caching
   - AI recommendation cache

5. **AWS IoT Core**
   - Equipment telemetry ingestion
   - MQTT protocol support
   - Direct integration with API

6. **S3 + CloudFront**
   - File storage (documents, images)
   - CDN for static assets
   - Global content delivery

---

## Prerequisites

### Required Tools

1. **AWS CLI** (v2.x or higher)
   ```bash
   # Install AWS CLI
   # macOS
   brew install awscli

   # Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install

   # Verify installation
   aws --version
   ```

2. **Node.js** (v18 or higher)
   ```bash
   # Check version
   node --version

   # Install via nvm (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

3. **pnpm** (Package Manager)
   ```bash
   npm install -g pnpm

   # Verify installation
   pnpm --version
   ```

4. **Docker** (for building container images)
   ```bash
   # Install Docker Desktop or Docker Engine
   # Verify installation
   docker --version
   docker-compose --version
   ```

### AWS Account Requirements

1. **AWS Account** with appropriate permissions:
   - EC2, ECS, RDS, ElastiCache
   - VPC, Route53, CloudFront
   - IAM, CloudFormation
   - S3, IoT Core

2. **IAM User/Role** with AdministratorAccess or custom policy

3. **AWS Region**: Defaults to `us-east-1` (configurable)

---

## Pre-Deployment Setup

### 1. Configure AWS Credentials

```bash
# Configure AWS CLI with your credentials
aws configure

# You'll be prompted for:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region name (e.g., us-east-1)
# - Default output format (json)

# Verify configuration
aws sts get-caller-identity
```

### 2. Clone and Install Dependencies

```bash
# Navigate to project root
cd farm-management

# Install all dependencies
pnpm install
```

### 3. Build Application Containers

```bash
# Build API Docker image
cd packages/api
docker build -t farm-api:latest .

# Build Web Docker image
cd ../web
docker build -t farm-web:latest .

# Return to root
cd ../..
```

### 4. Bootstrap AWS CDK (First Time Only)

```bash
# Get your AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="us-east-1"

# Bootstrap CDK in your account/region
cd packages/infra
npx cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
```

### 5. Set Up Environment Variables

Create environment-specific configuration files:

**For API** (`packages/api/.env.production`):
```env
# Database (will be provided by CDK outputs)
DATABASE_URL="postgresql://farmadmin:CHANGE_ME@rds-endpoint:5432/farm_management?schema=public"

# JWT Secrets (GENERATE SECURE RANDOM STRINGS)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_ACCESS_EXPIRES_IN="3600"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
JWT_REFRESH_EXPIRES_IN="604800"

# Redis (will be provided by CDK outputs)
REDIS_HOST="redis-endpoint"
REDIS_PORT="6379"

# Server
PORT="3000"
NODE_ENV="production"

# Anthropic Claude API
ANTHROPIC_API_KEY="sk-ant-xxxxx"
ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"
```

**For Web** (`packages/web/.env.production`):
```env
# Mapbox Token (get from https://account.mapbox.com/)
VITE_MAPBOX_TOKEN="pk.xxxxx"

# API URL (will be ALB endpoint or custom domain)
VITE_API_URL="https://your-domain.com/api"
```

**Generate Secure Secrets:**
```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Use output for JWT_SECRET

node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Use output for JWT_REFRESH_SECRET
```

---

## Environment Tiers

The platform supports four deployment tiers, each optimized for different use cases:

### 1. Free Tier (POC/Demo)
**Best for:** Testing, proof-of-concept, learning

**Features:**
- ❌ No NAT Gateway (saves ~$32/month)
- ✅ Fargate Spot instances (up to 70% savings)
- ✅ RDS db.t3.micro (free tier eligible for 12 months)
- ❌ No ElastiCache Redis (uses in-memory caching)
- ❌ No custom domain (uses ALB DNS)
- ❌ No auto-scaling

**Estimated Cost:** $15-30/month

### 2. Development
**Best for:** Active development, testing new features

**Features:**
- ✅ NAT Gateway
- ✅ ElastiCache Redis
- ✅ db.t3.medium RDS
- ✅ Custom domain (dev.goldenfamilyfarms.org)
- ✅ Basic auto-scaling (1-2 tasks)
- ✅ 7-day backups

**Estimated Cost:** $100-150/month

### 3. Staging
**Best for:** Pre-production testing, QA, client demos

**Features:**
- ✅ Enhanced resources (2-4 tasks)
- ✅ 14-day backups
- ✅ staging.goldenfamilyfarms.org domain
- ✅ Production-like environment

**Estimated Cost:** $150-200/month

### 4. Production
**Best for:** Live production workload

**Features:**
- ✅ Multi-AZ RDS (high availability)
- ✅ db.r6g.large instance
- ✅ Large Redis cache
- ✅ Aggressive auto-scaling (3-10 tasks)
- ✅ 30-day backups
- ✅ goldenfamilyfarms.org domain
- ✅ Production-grade resources

**Estimated Cost:** $500+/month

---

## Deployment Steps

### Option 1: Free Tier Deployment (Recommended for First-Time)

```bash
cd packages/infra

# Synthesize CloudFormation template (optional - review before deploy)
pnpm synth --context env=free

# Deploy to AWS
pnpm deploy:free

# The deployment will take 15-30 minutes
# CDK will create all resources and display outputs
```

**Expected Outputs:**
```
Outputs:
FarmInfrastructure-free.LoadBalancerDNS = farm-alb-xxxxx.us-east-1.elb.amazonaws.com
FarmInfrastructure-free.ApiEndpoint = http://farm-alb-xxxxx.us-east-1.elb.amazonaws.com/api
FarmInfrastructure-free.WebUrl = http://farm-alb-xxxxx.us-east-1.elb.amazonaws.com
FarmInfrastructure-free.DatabaseEndpoint = farm-db-free.xxxxx.us-east-1.rds.amazonaws.com
FarmInfrastructure-free.DatabaseName = farm_management
```

### Option 2: Development Environment

```bash
cd packages/infra

# Preview changes
pnpm diff:dev

# Deploy
pnpm deploy:dev

# Takes 20-40 minutes
```

### Option 3: Staging Environment

```bash
cd packages/infra
pnpm deploy:staging
```

### Option 4: Production Environment

```bash
cd packages/infra
pnpm deploy:prod
```

### Deployment Process Explained

During deployment, CDK will:

1. **Create VPC** (5-10 min)
   - Subnets across 3 availability zones
   - NAT Gateway (if not free tier)
   - Internet Gateway
   - Route tables and security groups

2. **Create RDS PostgreSQL** (10-15 min)
   - PostgreSQL 15 instance
   - Install PostGIS extension
   - Install TimescaleDB extension
   - Configure security groups

3. **Create ElastiCache Redis** (5-10 min, if enabled)
   - Redis cluster
   - Configure security groups

4. **Create ECS Cluster** (2-5 min)
   - Task definitions
   - Service configurations
   - Auto-scaling policies

5. **Create ALB** (3-5 min)
   - Load balancer
   - Target groups
   - Listeners and rules

6. **Deploy Containers** (5-10 min)
   - Pull/push images to ECR
   - Launch Fargate tasks
   - Health checks

7. **Configure IoT Core** (2-3 min)
   - IoT policies and certificates

---

## Post-Deployment Configuration

### 1. Retrieve Deployment Outputs

```bash
# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name FarmInfrastructure-free \
  --query 'Stacks[0].Outputs' \
  --output table

# Save important values:
# - LoadBalancerDNS
# - DatabaseEndpoint
# - RedisEndpoint (if applicable)
```

### 2. Initialize Database

```bash
# Connect to RDS via bastion or VPN
# Install PostgreSQL client if needed
sudo apt-get install postgresql-client

# Get RDS endpoint from CDK outputs
RDS_ENDPOINT="<from-outputs>"

# Connect to database
psql -h $RDS_ENDPOINT -U farmadmin -d farm_management

# Run migrations
cd packages/api
pnpm prisma migrate deploy

# Generate Prisma client
pnpm prisma generate

# Seed initial data (optional)
pnpm prisma db seed
```

### 3. Update Environment Variables in ECS

After deployment, update task definitions with actual values:

```bash
# Update API task definition with:
# - Actual RDS endpoint
# - Actual Redis endpoint (if applicable)
# - JWT secrets
# - Anthropic API key

# Update via AWS Console or CLI
aws ecs update-service \
  --cluster farm-cluster-free \
  --service farm-api-service \
  --force-new-deployment
```

### 4. Configure Custom Domain (Dev/Staging/Prod only)

If using custom domain:

```bash
# 1. Create Route 53 hosted zone (if not exists)
aws route53 create-hosted-zone \
  --name goldenfamilyfarms.org \
  --caller-reference $(date +%s)

# 2. Get nameservers
aws route53 get-hosted-zone --id <hosted-zone-id>

# 3. Update domain registrar with Route 53 nameservers

# 4. Request ACM certificate
aws acm request-certificate \
  --domain-name goldenfamilyfarms.org \
  --subject-alternative-names "*.goldenfamilyfarms.org" \
  --validation-method DNS \
  --region us-east-1

# 5. Validate certificate via DNS
# Follow instructions from ACM console

# 6. Update CDK stack with certificate ARN
# Re-deploy to attach HTTPS listener
```

### 5. Set Up CI/CD (Optional)

The infrastructure includes a CI/CD pipeline construct. To enable:

```bash
# 1. Create GitHub connection in AWS Console
# Go to: Developer Tools > Connections

# 2. Update infra code to enable pipeline
# Edit packages/infra/src/stacks/farm-infrastructure-stack.ts

# 3. Redeploy
pnpm deploy:free
```

---

## Monitoring and Maintenance

### CloudWatch Dashboards

CDK automatically creates CloudWatch dashboards for:

- **ECS Metrics**: CPU, memory, task count
- **RDS Metrics**: Connections, CPU, storage
- **ALB Metrics**: Request count, latency, errors
- **Application Logs**: API and web service logs

Access dashboards:
```bash
# Via AWS Console
AWS Console > CloudWatch > Dashboards

# Or via CLI
aws cloudwatch list-dashboards
```

### Logs

**View API Logs:**
```bash
# Get log group name
aws logs describe-log-groups --log-group-name-prefix /ecs/farm-api

# Tail logs
aws logs tail /ecs/farm-api-free --follow
```

**View Web Logs:**
```bash
aws logs tail /ecs/farm-web-free --follow
```

### Alarms

Set up CloudWatch alarms for:

1. **High CPU Usage** (>80%)
2. **High Memory Usage** (>80%)
3. **Database Connections** (>80% of max)
4. **ALB 5xx Errors** (>10 in 5 minutes)
5. **ECS Task Failures**

```bash
# Example: CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name farm-api-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### Database Backups

**Automated Backups:**
- Free: 1 day retention
- Dev: 7 days retention
- Staging: 14 days retention
- Prod: 30 days retention

**Manual Snapshot:**
```bash
aws rds create-db-snapshot \
  --db-instance-identifier farm-db-free \
  --db-snapshot-identifier farm-manual-backup-$(date +%Y%m%d)
```

**Restore from Snapshot:**
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier farm-db-restored \
  --db-snapshot-identifier farm-manual-backup-20260118
```

---

## Scaling and Performance

### Auto-Scaling Configuration

**API Service:**
- Target CPU: 70%
- Target Memory: 80%
- Scale-in cooldown: 300 seconds
- Scale-out cooldown: 60 seconds

**Adjust Scaling Thresholds:**
```bash
# Update service auto-scaling
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/farm-cluster-free/farm-api-service \
  --policy-name cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    }
  }'
```

### Database Scaling

**Vertical Scaling (Change Instance Type):**
```bash
aws rds modify-db-instance \
  --db-instance-identifier farm-db-free \
  --db-instance-class db.t3.small \
  --apply-immediately
```

**Connection Pooling:**
- Already configured in Prisma
- Default pool size: 10 connections
- Adjust in `packages/api/src/prisma/prisma.service.ts`

### Redis Cache Optimization

**Monitor Cache Hit Rate:**
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CacheHitRate \
  --dimensions Name=CacheClusterId,Value=farm-redis-free \
  --start-time 2026-01-17T00:00:00Z \
  --end-time 2026-01-18T00:00:00Z \
  --period 3600 \
  --statistics Average
```

---

## Security Considerations

### Network Security

1. **Security Groups:**
   - ALB: Allow 80/443 from internet
   - ECS: Allow traffic only from ALB
   - RDS: Allow 5432 only from ECS
   - Redis: Allow 6379 only from ECS

2. **VPC Configuration:**
   - Private subnets for application tier
   - Isolated subnets for data tier
   - No public access to databases

### Application Security

1. **Secrets Management:**
   ```bash
   # Store secrets in AWS Secrets Manager
   aws secretsmanager create-secret \
     --name farm/api/jwt-secret \
     --secret-string "your-secure-secret"

   # Update ECS task to read from Secrets Manager
   # Modify task definition to use secrets
   ```

2. **IAM Roles:**
   - Principle of least privilege
   - Separate roles for API and Web tasks
   - S3 bucket policies for file uploads

3. **Database Security:**
   - Strong password (use Secrets Manager)
   - SSL/TLS connections enforced
   - Regular security patches

### Compliance

1. **Enable AWS Config:**
   ```bash
   aws configservice put-configuration-recorder \
     --configuration-recorder name=default,roleARN=arn:aws:iam::ACCOUNT:role/config-role \
     --recording-group allSupported=true,includeGlobalResourceTypes=true
   ```

2. **Enable CloudTrail:**
   ```bash
   aws cloudtrail create-trail \
     --name farm-audit-trail \
     --s3-bucket-name farm-cloudtrail-logs
   ```

3. **Enable GuardDuty:**
   ```bash
   aws guardduty create-detector --enable
   ```

---

## Troubleshooting

### Common Issues

#### 1. Deployment Fails - Rate Limiting

**Error:** `Rate exceeded` or `Throttling exception`

**Solution:**
```bash
# Wait a few minutes and retry
pnpm deploy:free

# Or increase retry attempts
export CDK_MAX_ATTEMPTS=10
pnpm deploy:free
```

#### 2. ECS Tasks Not Starting

**Check task failures:**
```bash
# Get stopped tasks
aws ecs list-tasks \
  --cluster farm-cluster-free \
  --desired-status STOPPED

# Describe stopped task
aws ecs describe-tasks \
  --cluster farm-cluster-free \
  --tasks <task-id>
```

**Common causes:**
- Insufficient memory/CPU
- Missing environment variables
- Container health check failures
- ECR image pull errors

#### 3. Database Connection Failures

**Check security groups:**
```bash
# Verify ECS can reach RDS
aws ec2 describe-security-groups \
  --filters Name=group-name,Values=*rds*

# Check if rules allow port 5432 from ECS
```

**Test connection:**
```bash
# From ECS task (exec into container)
aws ecs execute-command \
  --cluster farm-cluster-free \
  --task <task-id> \
  --interactive \
  --command "/bin/bash"

# Inside container
nc -zv $DATABASE_HOST 5432
```

#### 4. ALB Health Checks Failing

**Check target health:**
```bash
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn>
```

**Common causes:**
- Health check path incorrect (should be `/health`)
- Application not listening on correct port
- Security group blocking ALB

#### 5. Out of Memory (OOM) Errors

**Increase task memory:**
```bash
# Update task definition
# In packages/infra/src/config/environment.ts
# Increase apiMemory from 512 to 1024

# Redeploy
pnpm deploy:free
```

### Debug Commands

```bash
# View all resources in stack
aws cloudformation describe-stack-resources \
  --stack-name FarmInfrastructure-free

# Check stack events
aws cloudformation describe-stack-events \
  --stack-name FarmInfrastructure-free \
  --max-items 20

# Get ECS task details
aws ecs describe-tasks \
  --cluster farm-cluster-free \
  --tasks $(aws ecs list-tasks --cluster farm-cluster-free --query 'taskArns[0]' --output text)

# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier farm-db-free

# View logs in real-time
aws logs tail /ecs/farm-api-free --follow --format short
```

---

## Cost Estimates

### Free Tier Breakdown

**Estimated Monthly Cost: $15-30**

| Service | Configuration | Estimated Cost |
|---------|--------------|----------------|
| ECS Fargate | 2 tasks × 0.25 vCPU × 0.5GB × 730 hrs | $10-15 |
| RDS db.t3.micro | Single-AZ, 20GB storage | $15 (free for 12 months) |
| ALB | Basic load balancing | $18 |
| Data Transfer | Minimal usage | $5-10 |
| CloudWatch Logs | 5GB logs/month | Free tier |
| **Total** | | **$15-30/month** |

### Development Environment

**Estimated Monthly Cost: $100-150**

| Service | Configuration | Estimated Cost |
|---------|--------------|----------------|
| ECS Fargate | 2-4 tasks × 512 CPU × 1GB | $30-50 |
| RDS db.t3.medium | Single-AZ, 20GB | $60 |
| ElastiCache Redis | cache.t3.micro | $15 |
| NAT Gateway | 1 NAT × 730 hrs | $32 |
| ALB | Basic usage | $18 |
| Data Transfer | Moderate usage | $10-15 |
| Route 53 | Hosted zone | $0.50 |
| **Total** | | **$100-150/month** |

### Production Environment

**Estimated Monthly Cost: $500+**

| Service | Configuration | Estimated Cost |
|---------|--------------|----------------|
| ECS Fargate | 3-10 tasks × 1-2 vCPU × 2-4GB | $150-300 |
| RDS db.r6g.large | Multi-AZ, 100GB | $250 |
| ElastiCache Redis | cache.r6g.large × 2 nodes | $150 |
| NAT Gateway | 3 NAT × 730 hrs | $96 |
| ALB | High traffic | $30-50 |
| CloudFront | CDN distribution | $20-50 |
| Data Transfer | High usage | $50-100 |
| Route 53 | Hosted zone + queries | $1-5 |
| IoT Core | Message processing | $10-30 |
| **Total** | | **$500-900/month** |

### Cost Optimization Tips

1. **Use Fargate Spot** (up to 70% savings)
   - Already enabled for free/dev/staging tiers
   - Trade-off: Potential interruptions

2. **Reserved Instances**
   - For production RDS: 30-40% savings
   - 1-year or 3-year commitments

3. **Auto-Scaling Policies**
   - Scale down during low-traffic periods
   - Schedule-based scaling (weekends, nights)

4. **S3 Lifecycle Policies**
   - Move old files to Glacier
   - Delete temporary files

5. **CloudWatch Logs Retention**
   - Reduce retention period (7-30 days)
   - Export to S3 for long-term storage

6. **Cleanup Unused Resources**
   ```bash
   # List unused EBS volumes
   aws ec2 describe-volumes --filters Name=status,Values=available

   # Delete old snapshots
   aws rds describe-db-snapshots --query 'DBSnapshots[?SnapshotCreateTime<`2025-01-01`]'
   ```

---

## Cleanup / Teardown

### Destroy Infrastructure

**Warning:** This will delete all resources and data!

```bash
cd packages/infra

# Destroy free tier stack
pnpm destroy:free

# Or other environments
pnpm destroy:dev
pnpm destroy:staging
pnpm destroy:prod
```

### Manual Cleanup (if needed)

Some resources may require manual deletion:

```bash
# Delete RDS snapshots
aws rds delete-db-snapshot --db-snapshot-identifier <snapshot-id>

# Delete S3 buckets
aws s3 rb s3://farm-bucket-name --force

# Delete ECR repositories
aws ecr delete-repository --repository-name farm-api --force
aws ecr delete-repository --repository-name farm-web --force

# Delete CloudWatch log groups
aws logs delete-log-group --log-group-name /ecs/farm-api-free
aws logs delete-log-group --log-group-name /ecs/farm-web-free
```

---

## Additional Resources

### Documentation

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [ECS Fargate Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [RDS PostgreSQL Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)

### AWS Cost Calculator

- [AWS Pricing Calculator](https://calculator.aws/)
- Use to estimate costs for your specific workload

### Support

For issues with:
- **Application Code**: Check GitHub repository
- **AWS Services**: AWS Support (if subscribed)
- **Infrastructure**: Review CloudFormation events and logs

---

## Quick Reference

### Essential Commands

```bash
# Development
pnpm dev                    # Start local dev environment
pnpm build                  # Build all packages
pnpm test                   # Run tests

# Database
pnpm db:migrate            # Run Prisma migrations
pnpm db:generate           # Generate Prisma client
pnpm db:studio             # Open Prisma Studio

# Docker
pnpm docker:up             # Start local services
pnpm docker:down           # Stop local services

# Infrastructure
cd packages/infra
pnpm synth                 # Generate CloudFormation
pnpm deploy:free           # Deploy free tier
pnpm deploy:dev            # Deploy development
pnpm deploy:staging        # Deploy staging
pnpm deploy:prod           # Deploy production
pnpm destroy:free          # Destroy free tier

# AWS
aws cloudformation describe-stacks --stack-name FarmInfrastructure-free
aws ecs list-tasks --cluster farm-cluster-free
aws logs tail /ecs/farm-api-free --follow
aws rds describe-db-instances
```

### Environment URLs

- **Free Tier**: `http://<alb-dns>`
- **Development**: `https://dev.goldenfamilyfarms.org`
- **Staging**: `https://staging.goldenfamilyfarms.org`
- **Production**: `https://goldenfamilyfarms.org`

---

## Conclusion

This guide covers the complete deployment process for the Farm Management Platform on AWS. The infrastructure is designed to be:

- ✅ **Scalable**: Auto-scaling based on demand
- ✅ **Secure**: Network isolation, encrypted data, least-privilege IAM
- ✅ **Reliable**: Multi-AZ deployment (production), automated backups
- ✅ **Cost-Effective**: Multiple tiers from $15/month to production-grade
- ✅ **Observable**: CloudWatch metrics, logs, and alarms

Start with the **free tier** to test the deployment, then scale up to development, staging, and production as needed.

For questions or issues, refer to the troubleshooting section or consult AWS documentation.

**Happy Deploying! 🚀🌾**

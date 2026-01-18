# Farm Management Platform - AWS Infrastructure

AWS CDK infrastructure for the Farm Management Platform.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 18+
- pnpm
- Docker (for building container images)

## Installation

```bash
pnpm install
```

## Deployment

### Free Tier (POC/Demo) - Recommended for Testing

The free tier deployment minimizes costs by:
- No NAT Gateway (saves ~$32/month)
- Using Fargate Spot instances (up to 70% savings)
- RDS db.t3.micro (free tier eligible for 12 months)
- No ElastiCache Redis (uses in-memory caching)
- No custom domain (uses ALB DNS directly)

```bash
# Bootstrap CDK (first time only)
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1

# Deploy free tier
pnpm deploy:free
```

**Estimated Cost:** ~$15-30/month (mostly Fargate Spot + RDS after free tier)

### Development Environment

```bash
pnpm deploy:dev
```

### Staging Environment

```bash
pnpm deploy:staging
```

### Production Environment

```bash
pnpm deploy:prod
```

## Architecture

The infrastructure includes:

- **VPC**: Multi-AZ VPC with public, private, and isolated subnets
- **Security Groups**: Configured for ALB, ECS, RDS, Redis, and Lambda
- **RDS PostgreSQL**: With PostGIS and TimescaleDB extensions
- **ECS Fargate**: For API and Web services
- **ElastiCache Redis**: For caching and sessions
- **IoT Core**: For equipment telemetry ingestion
- **S3**: For file storage
- **CloudFront**: For static asset delivery
- **Route 53**: DNS management for goldenfamilyfarms.org

## Useful Commands

- `pnpm build` - Compile TypeScript
- `pnpm synth` - Synthesize CloudFormation template
- `pnpm diff` - Compare deployed stack with current state
- `pnpm diff:free` - Compare free tier stack
- `pnpm deploy` - Deploy stack to AWS
- `pnpm deploy:free` - Deploy free tier stack
- `pnpm destroy` - Destroy stack
- `pnpm destroy:free` - Destroy free tier stack

## Environment Comparison

| Feature | Free Tier | Dev | Staging | Prod |
|---------|-----------|-----|---------|------|
| NAT Gateway | ❌ | ✅ | ✅ | ✅ |
| Redis | ❌ | ✅ | ✅ | ✅ |
| RDS Instance | db.t3.micro | db.t3.medium | db.t3.medium | db.r6g.large |
| Multi-AZ | ❌ | ❌ | ❌ | ✅ |
| Custom Domain | ❌ | ✅ | ✅ | ✅ |
| Auto-scaling | ❌ | ✅ | ✅ | ✅ |
| Fargate Spot | ✅ | ✅ | ✅ | ❌ |
| Est. Monthly Cost | $15-30 | $100-150 | $150-200 | $500+ |

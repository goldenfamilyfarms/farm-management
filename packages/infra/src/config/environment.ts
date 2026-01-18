export type Environment = 'dev' | 'staging' | 'prod' | 'free';

export interface EnvironmentConfig {
  environment: Environment;
  account: string;
  region: string;
  domainName: string;
  vpcCidr: string;
  useFreeTier: boolean;
  rds: {
    instanceClass: string;
    allocatedStorage: number;
    multiAz: boolean;
    backupRetention: number;
  };
  ecs: {
    apiDesiredCount: number;
    apiCpu: number;
    apiMemory: number;
    webDesiredCount: number;
    webCpu: number;
    webMemory: number;
    minCapacity: number;
    maxCapacity: number;
  };
  redis: {
    nodeType: string;
    numCacheNodes: number;
    enabled: boolean;
  };
}

export const environments: Record<Environment, Omit<EnvironmentConfig, 'account' | 'region'>> = {
  // FREE TIER - Minimal cost POC deployment
  free: {
    environment: 'free',
    domainName: '', // Use ALB DNS directly, no custom domain
    vpcCidr: '10.99.0.0/16',
    useFreeTier: true,
    rds: {
      instanceClass: 'db.t3.micro', // Free tier eligible (750 hrs/month for 12 months)
      allocatedStorage: 20, // Free tier: 20GB included
      multiAz: false,
      backupRetention: 1, // Minimal backups
    },
    ecs: {
      apiDesiredCount: 1,
      apiCpu: 256,
      apiMemory: 512,
      webDesiredCount: 1,
      webCpu: 256,
      webMemory: 512,
      minCapacity: 1,
      maxCapacity: 1, // No auto-scaling for free tier
    },
    redis: {
      nodeType: 'cache.t3.micro',
      numCacheNodes: 1,
      enabled: false, // Disabled for free tier - use in-memory caching
    },
  },
  dev: {
    environment: 'dev',
    domainName: 'dev.goldenfamilyfarms.org',
    vpcCidr: '10.0.0.0/16',
    useFreeTier: false,
    rds: {
      instanceClass: 'db.t3.medium',
      allocatedStorage: 20,
      multiAz: false,
      backupRetention: 7,
    },
    ecs: {
      apiDesiredCount: 1,
      apiCpu: 256,
      apiMemory: 512,
      webDesiredCount: 1,
      webCpu: 256,
      webMemory: 512,
      minCapacity: 1,
      maxCapacity: 2,
    },
    redis: {
      nodeType: 'cache.t3.micro',
      numCacheNodes: 1,
      enabled: true,
    },
  },
  staging: {
    environment: 'staging',
    domainName: 'staging.goldenfamilyfarms.org',
    vpcCidr: '10.1.0.0/16',
    useFreeTier: false,
    rds: {
      instanceClass: 'db.t3.medium',
      allocatedStorage: 50,
      multiAz: false,
      backupRetention: 14,
    },
    ecs: {
      apiDesiredCount: 2,
      apiCpu: 512,
      apiMemory: 1024,
      webDesiredCount: 2,
      webCpu: 256,
      webMemory: 512,
      minCapacity: 2,
      maxCapacity: 4,
    },
    redis: {
      nodeType: 'cache.t3.small',
      numCacheNodes: 1,
      enabled: true,
    },
  },
  prod: {
    environment: 'prod',
    domainName: 'goldenfamilyfarms.org',
    vpcCidr: '10.2.0.0/16',
    useFreeTier: false,
    rds: {
      instanceClass: 'db.r6g.large',
      allocatedStorage: 100,
      multiAz: true,
      backupRetention: 30,
    },
    ecs: {
      apiDesiredCount: 3,
      apiCpu: 1024,
      apiMemory: 2048,
      webDesiredCount: 2,
      webCpu: 512,
      webMemory: 1024,
      minCapacity: 3,
      maxCapacity: 10,
    },
    redis: {
      nodeType: 'cache.r6g.large',
      numCacheNodes: 2,
      enabled: true,
    },
  },
};

export function getEnvironmentConfig(env: Environment, account: string, region: string): EnvironmentConfig {
  return {
    ...environments[env],
    account,
    region,
  };
}

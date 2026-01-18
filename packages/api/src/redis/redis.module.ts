import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Global Redis module that provides a Redis client for caching.
 * Used for weather data caching and other caching needs.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);
        const password = configService.get<string>('REDIS_PASSWORD', '');

        const redis = new Redis({
          host,
          port,
          password: password || undefined,
          retryStrategy: (times) => {
            // Retry with exponential backoff, max 30 seconds
            const delay = Math.min(times * 100, 30000);
            return delay;
          },
          maxRetriesPerRequest: 3,
        });

        redis.on('error', (err) => {
          console.error('Redis connection error:', err.message);
        });

        redis.on('connect', () => {
          console.log('Redis connected successfully');
        });

        return redis;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor() {}

  async onModuleDestroy() {
    // Redis client cleanup is handled by NestJS DI container
  }
}

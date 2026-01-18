import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma';
import { DataAggregationService } from './data-aggregation.service';
import { DataAggregationController } from './data-aggregation.controller';
import { LlmIntegrationService } from './llm-integration.service';
import { RecommendationCacheService } from './recommendation-cache.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [DataAggregationController],
  providers: [DataAggregationService, LlmIntegrationService, RecommendationCacheService],
  exports: [DataAggregationService, LlmIntegrationService, RecommendationCacheService],
})
export class RecommendationModule {}

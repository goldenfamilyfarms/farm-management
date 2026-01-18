import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DataAggregationService } from './data-aggregation.service';
import { LlmIntegrationService } from './llm-integration.service';
import { RecommendationCacheService } from './recommendation-cache.service';
import { AggregatedDataResponseDto, CropRecommendationDto, MissingDataDto } from './dto/recommendation.dto';

/**
 * Controller for data aggregation and recommendation endpoints.
 * Provides access to aggregated soil, weather, market, and yield data for zones,
 * as well as AI-powered crop recommendations with caching support.
 */
@Controller('recommendations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DataAggregationController {
  constructor(
    private readonly dataAggregationService: DataAggregationService,
    private readonly llmIntegrationService: LlmIntegrationService,
    private readonly recommendationCacheService: RecommendationCacheService,
  ) {}

  /**
   * Aggregates all data needed for generating crop recommendations for a zone.
   * Implements Requirement 4.1: WHEN a user requests recommendations for a zone,
   * THE Recommendation_Engine SHALL consider soil quality, historical weather,
   * forecasts, market prices, and past yields.
   */
  @Get('zones/:zoneId/data')
  @Roles('owner', 'manager')
  async getAggregatedData(
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
  ): Promise<AggregatedDataResponseDto> {
    return this.dataAggregationService.aggregateDataForZone(zoneId);
  }

  /**
   * Gets a summary of data availability for a zone.
   * Useful for UI to show data completeness before requesting recommendations.
   */
  @Get('zones/:zoneId/data-availability')
  @Roles('owner', 'manager', 'viewer')
  async getDataAvailability(
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
  ): Promise<{
    zoneId: string;
    dataAvailability: Record<string, boolean>;
    completenessScore: number;
  }> {
    return this.dataAggregationService.getDataAvailabilitySummary(zoneId);
  }

  /**
   * Validates that sufficient data exists for generating recommendations.
   * Returns validation result with details about missing inputs.
   * Implements Requirement 4.5: IF the Recommendation_Engine cannot generate
   * recommendations due to insufficient data, THEN it SHALL return a clear
   * error message listing missing inputs.
   */
  @Get('zones/:zoneId/validate')
  @Roles('owner', 'manager')
  async validateDataSufficiency(
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
  ): Promise<{
    valid: boolean;
    message: string;
    canGenerateRecommendations: boolean;
    missingInputs: MissingDataDto[];
    criticalMissing: MissingDataDto[];
    nonCriticalMissing: MissingDataDto[];
  }> {
    const aggregatedData = await this.dataAggregationService.aggregateDataForZone(zoneId);
    const sufficiencyCheck = this.dataAggregationService.checkDataSufficiency(aggregatedData);
    
    // If critical data is missing, throw the exception with all missing inputs
    if (!sufficiencyCheck.canGenerateRecommendations) {
      this.dataAggregationService.validateSufficientData(aggregatedData);
    }
    
    return {
      valid: true,
      message: sufficiencyCheck.missingInputs.length === 0
        ? 'All data available for generating recommendations'
        : 'Sufficient data available for generating recommendations (some non-critical data missing)',
      canGenerateRecommendations: sufficiencyCheck.canGenerateRecommendations,
      missingInputs: sufficiencyCheck.missingInputs,
      criticalMissing: sufficiencyCheck.criticalMissing,
      nonCriticalMissing: sufficiencyCheck.nonCriticalMissing,
    };
  }

  /**
   * Generates AI-powered crop recommendations for a zone.
   * Implements Requirements 4.2, 4.3, and 4.4:
   * - THE Recommendation_Engine SHALL return crop suggestions with expected yield ranges,
   *   optimal planting windows, and risk assessments
   * - WHEN generating recommendations, THE Recommendation_Engine SHALL provide explanations
   *   for why each crop was suggested
   * - THE Recommendation_Engine SHALL cache recommendations and invalidate cache when
   *   input data changes significantly
   */
  @Post('zones/:zoneId/generate')
  @Roles('owner', 'manager')
  async generateRecommendations(
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
  ): Promise<CropRecommendationDto> {
    // First, aggregate all the data needed for recommendations
    const aggregatedData = await this.dataAggregationService.aggregateDataForZone(zoneId);
    
    // Validate that we have sufficient data
    this.dataAggregationService.validateSufficientData(aggregatedData);
    
    // Check if we have a valid cached recommendation with unchanged inputs
    const cachedRecommendation = await this.recommendationCacheService.getCachedRecommendationIfValid(
      zoneId,
      aggregatedData.inputs,
    );
    
    if (cachedRecommendation) {
      return cachedRecommendation;
    }
    
    // Generate new recommendations using the LLM
    const recommendation = await this.llmIntegrationService.generateRecommendations(
      zoneId,
      aggregatedData.zoneName,
      aggregatedData.inputs,
    );
    
    // Cache the new recommendation
    await this.recommendationCacheService.cacheRecommendation(recommendation);
    
    return recommendation;
  }

  /**
   * Gets the cached recommendation for a zone if one exists.
   * Returns 404 if no cached recommendation is available.
   * Implements Requirement 4.4: Cache recommendations by zone_id.
   */
  @Get('zones/:zoneId/cached')
  @Roles('owner', 'manager', 'viewer')
  async getCachedRecommendation(
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
  ): Promise<CropRecommendationDto | null> {
    return this.recommendationCacheService.getCachedRecommendation(zoneId);
  }

  /**
   * Invalidates the cached recommendation for a zone.
   * Useful when the user wants to force regeneration of recommendations.
   * Implements Requirement 4.4: Invalidate cache when input data changes.
   */
  @Delete('zones/:zoneId/cache')
  @Roles('owner', 'manager')
  async invalidateCache(
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
  ): Promise<{ message: string }> {
    await this.recommendationCacheService.invalidateCache(zoneId);
    return { message: `Cache invalidated for zone ${zoneId}` };
  }
}

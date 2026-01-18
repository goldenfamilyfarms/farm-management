import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import {
  CropRecommendationDto,
  RecommendationInputsDto,
  CropSuggestionDto,
} from './dto/recommendation.dto';

/**
 * Service responsible for caching crop recommendations.
 * Implements Requirement 4.4: THE Recommendation_Engine SHALL cache recommendations
 * and invalidate cache when input data changes significantly.
 * 
 * Property 13: Recommendation caching behavior
 * - For any zone with unchanged input data, requesting recommendations twice
 *   SHALL return cached results on the second request.
 * - After input data changes, the cache SHALL be invalidated.
 */
@Injectable()
export class RecommendationCacheService {
  private readonly logger = new Logger(RecommendationCacheService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Retrieves a cached recommendation for a zone if it exists and is still valid.
   * Returns null if no valid cached recommendation exists.
   */
  async getCachedRecommendation(zoneId: string): Promise<CropRecommendationDto | null> {
    const farmId = this.getFarmId();

    // Verify zone belongs to the farm
    const zoneExists = await this.verifyZoneBelongsToFarm(zoneId, farmId);
    if (!zoneExists) {
      return null;
    }

    const cached = await this.prisma.recommendation.findFirst({
      where: {
        zoneId,
        validUntil: {
          gt: new Date(),
        },
      },
      orderBy: {
        generatedAt: 'desc',
      },
    });

    if (!cached) {
      this.logger.debug(`No valid cached recommendation found for zone ${zoneId}`);
      return null;
    }

    this.logger.debug(`Found cached recommendation for zone ${zoneId}, generated at ${cached.generatedAt}`);

    return this.mapToDto(cached);
  }

  /**
   * Retrieves a cached recommendation and validates it against current input data.
   * Returns the cached recommendation only if input data hasn't changed significantly.
   * 
   * @param zoneId - The zone ID to get cached recommendation for
   * @param currentInputs - Current aggregated input data to compare against cached
   * @returns Cached recommendation if valid and inputs unchanged, null otherwise
   */
  async getCachedRecommendationIfValid(
    zoneId: string,
    currentInputs: RecommendationInputsDto,
  ): Promise<CropRecommendationDto | null> {
    const cached = await this.getCachedRecommendation(zoneId);
    
    if (!cached) {
      return null;
    }

    // Compare input data to detect significant changes
    const inputsChanged = this.hasInputDataChanged(cached.inputData, currentInputs);
    
    if (inputsChanged) {
      this.logger.debug(`Input data changed for zone ${zoneId}, invalidating cache`);
      await this.invalidateCache(zoneId);
      return null;
    }

    this.logger.debug(`Returning cached recommendation for zone ${zoneId}`);
    return cached;
  }

  /**
   * Stores a new recommendation in the cache.
   */
  async cacheRecommendation(recommendation: CropRecommendationDto): Promise<void> {
    const farmId = this.getFarmId();

    // Verify zone belongs to the farm
    const zoneExists = await this.verifyZoneBelongsToFarm(recommendation.zoneId, farmId);
    if (!zoneExists) {
      this.logger.warn(`Cannot cache recommendation: zone ${recommendation.zoneId} not found`);
      return;
    }

    // Invalidate any existing cached recommendations for this zone
    await this.invalidateCache(recommendation.zoneId);

    // Store the new recommendation
    await this.prisma.recommendation.create({
      data: {
        zoneId: recommendation.zoneId,
        generatedAt: new Date(recommendation.generatedAt),
        validUntil: new Date(recommendation.validUntil),
        recommendations: recommendation.recommendations as unknown as object,
        inputData: recommendation.inputData as unknown as object,
        explanation: recommendation.explanation,
      },
    });

    this.logger.debug(`Cached recommendation for zone ${recommendation.zoneId}`);
  }

  /**
   * Invalidates (deletes) cached recommendations for a zone.
   * Called when input data changes or when explicitly requested.
   */
  async invalidateCache(zoneId: string): Promise<void> {
    const result = await this.prisma.recommendation.deleteMany({
      where: {
        zoneId,
      },
    });

    if (result.count > 0) {
      this.logger.debug(`Invalidated ${result.count} cached recommendation(s) for zone ${zoneId}`);
    }
  }

  /**
   * Invalidates cached recommendations for all zones in a field.
   * Useful when field-level data changes (e.g., weather data update).
   */
  async invalidateCacheForField(fieldId: string): Promise<void> {
    const farmId = this.getFarmId();

    // Get all zones in the field
    const zones = await this.prisma.zone.findMany({
      where: {
        fieldId,
        field: {
          farmId,
        },
      },
      select: {
        id: true,
      },
    });

    if (zones.length === 0) {
      return;
    }

    const zoneIds = zones.map((z) => z.id);

    const result = await this.prisma.recommendation.deleteMany({
      where: {
        zoneId: {
          in: zoneIds,
        },
      },
    });

    if (result.count > 0) {
      this.logger.debug(`Invalidated ${result.count} cached recommendation(s) for field ${fieldId}`);
    }
  }


  /**
   * Invalidates cached recommendations for all zones in the farm.
   * Useful when farm-level data changes (e.g., market prices update).
   */
  async invalidateCacheForFarm(): Promise<void> {
    const farmId = this.getFarmId();

    // Get all zones in the farm
    const zones = await this.prisma.zone.findMany({
      where: {
        field: {
          farmId,
        },
      },
      select: {
        id: true,
      },
    });

    if (zones.length === 0) {
      return;
    }

    const zoneIds = zones.map((z) => z.id);

    const result = await this.prisma.recommendation.deleteMany({
      where: {
        zoneId: {
          in: zoneIds,
        },
      },
    });

    if (result.count > 0) {
      this.logger.debug(`Invalidated ${result.count} cached recommendation(s) for farm ${farmId}`);
    }
  }

  /**
   * Compares two sets of input data to determine if there are significant changes
   * that should invalidate the cache.
   * 
   * Significant changes include:
   * - Soil quality changes (pH, nutrients)
   * - Historical weather summary changes (>10% difference)
   * - Market price changes (>5% difference)
   * - New historical yield data
   */
  private hasInputDataChanged(
    cachedInputs: RecommendationInputsDto,
    currentInputs: RecommendationInputsDto,
  ): boolean {
    // Check soil quality changes
    if (this.hasSoilQualityChanged(cachedInputs.soilQuality, currentInputs.soilQuality)) {
      this.logger.debug('Soil quality data changed');
      return true;
    }

    // Check historical weather changes (>10% difference in key metrics)
    if (this.hasWeatherChanged(cachedInputs.historicalWeather, currentInputs.historicalWeather)) {
      this.logger.debug('Historical weather data changed significantly');
      return true;
    }

    // Check market price changes (>5% difference)
    if (this.hasMarketPricesChanged(cachedInputs.marketPrices, currentInputs.marketPrices)) {
      this.logger.debug('Market prices changed significantly');
      return true;
    }

    // Check for new historical yield data
    if (this.hasNewYieldData(cachedInputs.historicalYields, currentInputs.historicalYields)) {
      this.logger.debug('New historical yield data available');
      return true;
    }

    return false;
  }

  /**
   * Checks if soil quality data has changed.
   */
  private hasSoilQualityChanged(
    cached: RecommendationInputsDto['soilQuality'],
    current: RecommendationInputsDto['soilQuality'],
  ): boolean {
    // Check key soil metrics
    const metrics: (keyof RecommendationInputsDto['soilQuality'])[] = [
      'ph',
      'nitrogen',
      'phosphorus',
      'potassium',
      'organicMatter',
    ];

    for (const metric of metrics) {
      const cachedValue = cached[metric];
      const currentValue = current[metric];

      // If one has value and other doesn't, it's a change
      if ((cachedValue === undefined) !== (currentValue === undefined)) {
        return true;
      }

      // If both have values, check if they're different
      if (cachedValue !== undefined && currentValue !== undefined) {
        if (typeof cachedValue === 'number' && typeof currentValue === 'number') {
          // Allow small floating point differences
          if (Math.abs(cachedValue - currentValue) > 0.01) {
            return true;
          }
        }
      }
    }

    // Check texture and drainage class
    if (cached.texture !== current.texture || cached.drainageClass !== current.drainageClass) {
      return true;
    }

    return false;
  }


  /**
   * Checks if historical weather data has changed significantly (>10% difference).
   */
  private hasWeatherChanged(
    cached: RecommendationInputsDto['historicalWeather'],
    current: RecommendationInputsDto['historicalWeather'],
  ): boolean {
    const threshold = 0.1; // 10% change threshold

    // Check average temperature
    if (this.percentDifference(cached.avgTemperature, current.avgTemperature) > threshold) {
      return true;
    }

    // Check total precipitation
    if (this.percentDifference(cached.totalPrecipitation, current.totalPrecipitation) > threshold) {
      return true;
    }

    // Check growing degree days
    if (this.percentDifference(cached.growingDegreeDays, current.growingDegreeDays) > threshold) {
      return true;
    }

    // Check frost-free days
    if (this.percentDifference(cached.frostFreeDays, current.frostFreeDays) > threshold) {
      return true;
    }

    return false;
  }

  /**
   * Checks if market prices have changed significantly (>5% difference).
   */
  private hasMarketPricesChanged(
    cached: RecommendationInputsDto['marketPrices'],
    current: RecommendationInputsDto['marketPrices'],
  ): boolean {
    const threshold = 0.05; // 5% change threshold

    // Create maps for easy lookup
    const cachedPrices = new Map(cached.map((p) => [p.cropType, p.pricePerUnit]));
    const currentPrices = new Map(current.map((p) => [p.cropType, p.pricePerUnit]));

    // Check for new crop types
    for (const cropType of currentPrices.keys()) {
      if (!cachedPrices.has(cropType)) {
        return true;
      }
    }

    // Check for price changes
    for (const [cropType, cachedPrice] of cachedPrices) {
      const currentPrice = currentPrices.get(cropType);
      if (currentPrice === undefined) {
        continue; // Crop removed, not necessarily a significant change
      }

      if (this.percentDifference(cachedPrice, currentPrice) > threshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if there's new historical yield data.
   */
  private hasNewYieldData(
    cached: RecommendationInputsDto['historicalYields'],
    current: RecommendationInputsDto['historicalYields'],
  ): boolean {
    // If current has more yield records, there's new data
    if (current.length > cached.length) {
      return true;
    }

    // Create a set of cached yield identifiers
    const cachedYields = new Set(
      cached.map((y) => `${y.cropType}-${y.year}-${y.zoneId}`),
    );

    // Check if any current yields are not in cached
    for (const yield_ of current) {
      const key = `${yield_.cropType}-${yield_.year}-${yield_.zoneId}`;
      if (!cachedYields.has(key)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculates the percentage difference between two values.
   * Returns 0 if both values are 0 to avoid division by zero.
   */
  private percentDifference(a: number, b: number): number {
    if (a === 0 && b === 0) {
      return 0;
    }
    const avg = (Math.abs(a) + Math.abs(b)) / 2;
    if (avg === 0) {
      return 0;
    }
    return Math.abs(a - b) / avg;
  }

  /**
   * Verifies that a zone belongs to the current farm.
   */
  private async verifyZoneBelongsToFarm(zoneId: string, farmId: string): Promise<boolean> {
    const zone = await this.prisma.zone.findFirst({
      where: {
        id: zoneId,
        field: {
          farmId,
        },
      },
    });
    return zone !== null;
  }

  /**
   * Maps a Prisma Recommendation record to CropRecommendationDto.
   */
  private mapToDto(record: {
    id: string;
    zoneId: string;
    generatedAt: Date;
    validUntil: Date | null;
    recommendations: unknown;
    inputData: unknown;
    explanation: string | null;
  }): CropRecommendationDto {
    return {
      id: record.id,
      zoneId: record.zoneId,
      generatedAt: record.generatedAt.toISOString(),
      validUntil: record.validUntil?.toISOString() ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      recommendations: record.recommendations as CropSuggestionDto[],
      inputData: record.inputData as RecommendationInputsDto,
      explanation: record.explanation ?? '',
    };
  }
}

import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { WeatherDataDto } from './dto/weather.dto';

/**
 * Cache entry structure for weather data
 */
export interface CachedWeatherData {
  data: WeatherDataDto | WeatherDataDto[];
  cachedAt: string;
  source: string;
}

/**
 * Weather data with staleness indicator
 */
export interface WeatherDataWithStaleness {
  data: WeatherDataDto | WeatherDataDto[] | null;
  isStale: boolean;
  cachedAt: Date | null;
  source: string | null;
}

/**
 * Service responsible for caching weather data in Redis.
 * Implements Requirement 11.5: IF weather API is unavailable, THEN THE System
 * SHALL use cached data and display a staleness indicator.
 */
@Injectable()
export class WeatherCacheService {
  private readonly logger = new Logger(WeatherCacheService.name);
  
  // Cache TTL in seconds (1 hour for fresh data)
  private readonly CACHE_TTL = 3600;
  
  // Stale threshold in milliseconds (30 minutes - data older than this is considered stale)
  private readonly STALE_THRESHOLD_MS = 30 * 60 * 1000;
  
  // Extended TTL for fallback data (24 hours - keep data available for fallback)
  private readonly FALLBACK_TTL = 86400;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Generates a cache key for weather data.
   */
  private getCacheKey(farmId: string, type: 'latest' | 'history' | 'summary', suffix?: string): string {
    const base = `weather:${farmId}:${type}`;
    return suffix ? `${base}:${suffix}` : base;
  }

  /**
   * Caches the latest weather data for a farm.
   */
  async cacheLatestWeather(farmId: string, data: WeatherDataDto, source: string): Promise<void> {
    try {
      const key = this.getCacheKey(farmId, 'latest');
      const cacheEntry: CachedWeatherData = {
        data,
        cachedAt: new Date().toISOString(),
        source,
      };
      
      await this.redis.setex(key, this.FALLBACK_TTL, JSON.stringify(cacheEntry));
      this.logger.debug(`Cached latest weather for farm ${farmId}`);
    } catch (error) {
      this.logger.warn(`Failed to cache latest weather: ${error}`);
    }
  }

  /**
   * Retrieves cached latest weather data with staleness indicator.
   */
  async getCachedLatestWeather(farmId: string): Promise<WeatherDataWithStaleness> {
    try {
      const key = this.getCacheKey(farmId, 'latest');
      const cached = await this.redis.get(key);
      
      if (!cached) {
        return { data: null, isStale: false, cachedAt: null, source: null };
      }

      const entry: CachedWeatherData = JSON.parse(cached);
      const cachedAt = new Date(entry.cachedAt);
      const isStale = Date.now() - cachedAt.getTime() > this.STALE_THRESHOLD_MS;

      return {
        data: entry.data as WeatherDataDto,
        isStale,
        cachedAt,
        source: entry.source,
      };
    } catch (error) {
      this.logger.warn(`Failed to get cached latest weather: ${error}`);
      return { data: null, isStale: false, cachedAt: null, source: null };
    }
  }


  /**
   * Caches weather history data for a farm.
   */
  async cacheWeatherHistory(
    farmId: string,
    data: WeatherDataDto[],
    startDate?: Date,
    endDate?: Date,
  ): Promise<void> {
    try {
      const suffix = this.getHistorySuffix(startDate, endDate);
      const key = this.getCacheKey(farmId, 'history', suffix);
      const cacheEntry: CachedWeatherData = {
        data,
        cachedAt: new Date().toISOString(),
        source: 'database',
      };
      
      await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(cacheEntry));
      this.logger.debug(`Cached weather history for farm ${farmId}`);
    } catch (error) {
      this.logger.warn(`Failed to cache weather history: ${error}`);
    }
  }

  /**
   * Retrieves cached weather history with staleness indicator.
   */
  async getCachedWeatherHistory(
    farmId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<WeatherDataWithStaleness> {
    try {
      const suffix = this.getHistorySuffix(startDate, endDate);
      const key = this.getCacheKey(farmId, 'history', suffix);
      const cached = await this.redis.get(key);
      
      if (!cached) {
        return { data: null, isStale: false, cachedAt: null, source: null };
      }

      const entry: CachedWeatherData = JSON.parse(cached);
      const cachedAt = new Date(entry.cachedAt);
      const isStale = Date.now() - cachedAt.getTime() > this.STALE_THRESHOLD_MS;

      return {
        data: entry.data as WeatherDataDto[],
        isStale,
        cachedAt,
        source: entry.source,
      };
    } catch (error) {
      this.logger.warn(`Failed to get cached weather history: ${error}`);
      return { data: null, isStale: false, cachedAt: null, source: null };
    }
  }

  /**
   * Caches weather summary data for a farm.
   */
  async cacheWeatherSummary(
    farmId: string,
    startDate: Date,
    endDate: Date,
    summary: {
      avgTemperature: number | null;
      totalPrecipitation: number | null;
      avgHumidity: number | null;
      avgWindSpeed: number | null;
      recordCount: number;
    },
  ): Promise<void> {
    try {
      const suffix = `${startDate.toISOString()}_${endDate.toISOString()}`;
      const key = this.getCacheKey(farmId, 'summary', suffix);
      const cacheEntry = {
        data: summary,
        cachedAt: new Date().toISOString(),
        source: 'database',
      };
      
      await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(cacheEntry));
      this.logger.debug(`Cached weather summary for farm ${farmId}`);
    } catch (error) {
      this.logger.warn(`Failed to cache weather summary: ${error}`);
    }
  }

  /**
   * Retrieves cached weather summary with staleness indicator.
   */
  async getCachedWeatherSummary(
    farmId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    data: {
      avgTemperature: number | null;
      totalPrecipitation: number | null;
      avgHumidity: number | null;
      avgWindSpeed: number | null;
      recordCount: number;
    } | null;
    isStale: boolean;
    cachedAt: Date | null;
  }> {
    try {
      const suffix = `${startDate.toISOString()}_${endDate.toISOString()}`;
      const key = this.getCacheKey(farmId, 'summary', suffix);
      const cached = await this.redis.get(key);
      
      if (!cached) {
        return { data: null, isStale: false, cachedAt: null };
      }

      const entry = JSON.parse(cached);
      const cachedAt = new Date(entry.cachedAt);
      const isStale = Date.now() - cachedAt.getTime() > this.STALE_THRESHOLD_MS;

      return {
        data: entry.data,
        isStale,
        cachedAt,
      };
    } catch (error) {
      this.logger.warn(`Failed to get cached weather summary: ${error}`);
      return { data: null, isStale: false, cachedAt: null };
    }
  }

  /**
   * Invalidates all weather cache for a farm.
   */
  async invalidateCache(farmId: string): Promise<void> {
    try {
      const pattern = `weather:${farmId}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`Invalidated ${keys.length} weather cache entries for farm ${farmId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate weather cache: ${error}`);
    }
  }

  /**
   * Checks if Redis is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generates a suffix for history cache keys based on date range.
   */
  private getHistorySuffix(startDate?: Date, endDate?: Date): string {
    const start = startDate?.toISOString() ?? 'none';
    const end = endDate?.toISOString() ?? 'none';
    return `${start}_${end}`;
  }
}

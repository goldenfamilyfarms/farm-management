import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WeatherCacheService, WeatherDataWithStaleness } from './weather-cache.service';
import {
  WeatherDataDto,
  WeatherFetchResult,
  WeatherQueryParams,
  NoaaObservationsResponseSchema,
  NoaaStationResponseSchema,
  WeatherResponseWithStaleness,
  WeatherHistoryResponseWithStaleness,
  WeatherSummaryResponseWithStaleness,
} from './dto/weather.dto';

/**
 * Service responsible for fetching and storing weather data.
 * Implements Requirement 11.1: THE System SHALL fetch and store weather data
 * (temperature, precipitation, humidity, wind) for farm locations daily.
 * 
 * Implements Requirement 11.5: IF weather API is unavailable, THEN THE System
 * SHALL use cached data and display a staleness indicator.
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly noaaBaseUrl = 'https://api.weather.gov';
  private readonly userAgent: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Optional() private readonly cacheService?: WeatherCacheService,
  ) {
    // NOAA requires a User-Agent header with contact info
    this.userAgent = this.configService.get<string>(
      'WEATHER_USER_AGENT',
      'FarmManagementPlatform/1.0 (contact@goldenfamilyfarms.org)',
    );
  }

  /**
   * Fetches weather data from NOAA API for a farm location and stores it.
   * NOAA API is free and doesn't require an API key, just a User-Agent header.
   */
  async fetchAndStoreWeatherData(
    farmId: string,
    latitude: number,
    longitude: number,
  ): Promise<WeatherFetchResult> {
    try {
      // Step 1: Get the nearest weather station
      const station = await this.findNearestStation(latitude, longitude);
      if (!station) {
        return {
          success: false,
          recordsStored: 0,
          error: 'No weather station found near the specified location',
        };
      }

      this.logger.log(`Found weather station: ${station.name} (${station.id})`);

      // Step 2: Fetch observations from the station
      const observations = await this.fetchStationObservations(station.id);
      if (observations.length === 0) {
        return {
          success: false,
          recordsStored: 0,
          error: 'No weather observations available from the station',
        };
      }

      // Step 3: Store the weather data
      const recordsStored = await this.storeWeatherData(farmId, observations);

      return {
        success: true,
        recordsStored,
        source: `NOAA - ${station.name}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch weather data: ${errorMessage}`);
      return {
        success: false,
        recordsStored: 0,
        error: errorMessage,
      };
    }
  }


  /**
   * Finds the nearest NOAA weather station to the given coordinates.
   */
  private async findNearestStation(
    latitude: number,
    longitude: number,
  ): Promise<{ id: string; name: string } | null> {
    try {
      // NOAA API: Get the grid point for the location
      const pointUrl = `${this.noaaBaseUrl}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
      const pointResponse = await this.makeNoaaRequest(pointUrl);

      if (!pointResponse.ok) {
        this.logger.warn(`Failed to get grid point: ${pointResponse.status}`);
        return null;
      }

      const pointData = (await pointResponse.json()) as {
        properties?: { observationStations?: string };
      };
      const observationStationsUrl = pointData.properties?.observationStations;

      if (!observationStationsUrl) {
        this.logger.warn('No observation stations URL in point response');
        return null;
      }

      // Get the list of nearby stations
      const stationsResponse = await this.makeNoaaRequest(observationStationsUrl);
      if (!stationsResponse.ok) {
        this.logger.warn(`Failed to get stations: ${stationsResponse.status}`);
        return null;
      }

      const stationsData = await stationsResponse.json();
      const parsed = NoaaStationResponseSchema.safeParse(stationsData);

      if (!parsed.success || parsed.data.features.length === 0) {
        this.logger.warn('No stations found or invalid response');
        return null;
      }

      // Return the first (nearest) station
      const station = parsed.data.features[0].properties;
      return {
        id: station.stationIdentifier,
        name: station.name,
      };
    } catch (error) {
      this.logger.error(`Error finding nearest station: ${error}`);
      return null;
    }
  }

  /**
   * Fetches recent observations from a NOAA weather station.
   */
  private async fetchStationObservations(
    stationId: string,
  ): Promise<WeatherDataDto[]> {
    try {
      const observationsUrl = `${this.noaaBaseUrl}/stations/${stationId}/observations`;
      const response = await this.makeNoaaRequest(observationsUrl);

      if (!response.ok) {
        this.logger.warn(`Failed to fetch observations: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const parsed = NoaaObservationsResponseSchema.safeParse(data);

      if (!parsed.success) {
        this.logger.warn('Invalid observations response format');
        return [];
      }

      // Transform NOAA observations to our format
      return parsed.data.features.map((feature) => {
        const props = feature.properties;
        return {
          time: new Date(props.timestamp),
          farmId: '', // Will be set when storing
          temperature: this.convertCelsius(props.temperature?.value),
          precipitation: this.convertMm(props.precipitationLastHour?.value),
          humidity: props.relativeHumidity?.value ?? null,
          windSpeed: this.convertKmh(props.windSpeed?.value),
          conditions: props.textDescription ?? null,
          source: 'noaa',
        };
      });
    } catch (error) {
      this.logger.error(`Error fetching observations: ${error}`);
      return [];
    }
  }

  /**
   * Makes a request to the NOAA API with proper headers.
   */
  private async makeNoaaRequest(url: string): Promise<Response> {
    return fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/geo+json',
      },
    });
  }

  /**
   * Converts temperature from Celsius (NOAA default) to Celsius (our storage format).
   * NOAA returns temperature in Celsius, so we just validate and return.
   */
  private convertCelsius(value: number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    return Math.round(value * 100) / 100;
  }

  /**
   * Converts precipitation from mm (NOAA default) to mm (our storage format).
   */
  private convertMm(value: number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    return Math.round(value * 100) / 100;
  }

  /**
   * Converts wind speed from m/s (NOAA default) to km/h.
   */
  private convertKmh(value: number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    // m/s to km/h: multiply by 3.6
    return Math.round(value * 3.6 * 100) / 100;
  }


  /**
   * Stores weather data in the TimescaleDB hypertable.
   * Handles deduplication by checking for existing records at the same timestamp.
   */
  private async storeWeatherData(
    farmId: string,
    observations: WeatherDataDto[],
  ): Promise<number> {
    let recordsStored = 0;

    for (const obs of observations) {
      try {
        // Check for existing record at this timestamp to avoid duplicates
        const existing = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count
          FROM weather_data
          WHERE farm_id = ${farmId}::uuid
            AND time = ${obs.time}
        `;

        if (existing[0]?.count > 0) {
          continue; // Skip duplicate
        }

        // Insert the weather data
        await this.prisma.$executeRaw`
          INSERT INTO weather_data (
            time, farm_id, temperature, precipitation, humidity, wind_speed, conditions, source
          ) VALUES (
            ${obs.time},
            ${farmId}::uuid,
            ${obs.temperature},
            ${obs.precipitation},
            ${obs.humidity},
            ${obs.windSpeed},
            ${obs.conditions},
            ${obs.source}
          )
        `;

        recordsStored++;
      } catch (error) {
        this.logger.warn(`Failed to store weather record: ${error}`);
      }
    }

    this.logger.log(`Stored ${recordsStored} weather records for farm ${farmId}`);
    return recordsStored;
  }

  /**
   * Retrieves historical weather data for a farm within a date range.
   * Implements caching with fallback for Requirement 11.5.
   */
  async getWeatherHistory(params: WeatherQueryParams): Promise<WeatherDataDto[]> {
    const { farmId, startDate, endDate, limit = 100 } = params;

    const whereConditions: string[] = [`farm_id = '${farmId}'::uuid`];

    if (startDate) {
      whereConditions.push(`time >= '${startDate.toISOString()}'`);
    }
    if (endDate) {
      whereConditions.push(`time <= '${endDate.toISOString()}'`);
    }

    const whereClause = whereConditions.join(' AND ');

    const results = await this.prisma.$queryRaw<WeatherDataDto[]>`
      SELECT 
        time,
        farm_id as "farmId",
        temperature,
        precipitation,
        humidity,
        wind_speed as "windSpeed",
        conditions,
        source
      FROM weather_data
      WHERE ${this.prisma.$queryRawUnsafe(whereClause)}
      ORDER BY time DESC
      LIMIT ${limit}
    `;

    // Cache the results if available
    if (results.length > 0 && this.cacheService) {
      await this.cacheService.cacheWeatherHistory(farmId, results, startDate, endDate);
    }

    return results;
  }

  /**
   * Retrieves historical weather data with staleness indicator.
   * Implements Requirement 11.5: IF weather API is unavailable, THEN THE System
   * SHALL use cached data and display a staleness indicator.
   */
  async getWeatherHistoryWithStaleness(params: WeatherQueryParams): Promise<WeatherHistoryResponseWithStaleness> {
    const { farmId, startDate, endDate } = params;

    try {
      // Try to get fresh data from database
      const freshData = await this.getWeatherHistory(params);
      
      if (freshData.length > 0) {
        return {
          data: freshData,
          isStale: false,
          cachedAt: null,
          source: 'database',
        };
      }

      // If no fresh data, try cache fallback
      if (this.cacheService) {
        const cached = await this.cacheService.getCachedWeatherHistory(farmId, startDate, endDate);
        if (cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
          this.logger.debug(`Using cached weather history for farm ${farmId} (stale: ${cached.isStale})`);
          return {
            data: cached.data as WeatherDataDto[],
            isStale: cached.isStale,
            cachedAt: cached.cachedAt,
            source: cached.source ?? 'cache',
          };
        }
      }

      return {
        data: [],
        isStale: false,
        cachedAt: null,
        source: null,
      };
    } catch (error) {
      this.logger.error(`Error getting weather history: ${error}`);
      
      // On error, try cache fallback
      if (this.cacheService) {
        const cached = await this.cacheService.getCachedWeatherHistory(farmId, startDate, endDate);
        if (cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
          this.logger.debug(`Using cached weather history after error for farm ${farmId}`);
          return {
            data: cached.data as WeatherDataDto[],
            isStale: true,
            cachedAt: cached.cachedAt,
            source: cached.source ?? 'cache-fallback',
          };
        }
      }

      throw error;
    }
  }

  /**
   * Gets the latest weather data for a farm.
   * Implements caching with fallback for Requirement 11.5.
   */
  async getLatestWeather(farmId: string): Promise<WeatherDataDto | null> {
    const results = await this.prisma.$queryRaw<WeatherDataDto[]>`
      SELECT 
        time,
        farm_id as "farmId",
        temperature,
        precipitation,
        humidity,
        wind_speed as "windSpeed",
        conditions,
        source
      FROM weather_data
      WHERE farm_id = ${farmId}::uuid
      ORDER BY time DESC
      LIMIT 1
    `;

    const data = results[0] ?? null;

    // Cache the result if available
    if (data && this.cacheService) {
      await this.cacheService.cacheLatestWeather(farmId, data, data.source ?? 'database');
    }

    return data;
  }

  /**
   * Gets the latest weather data for a farm with staleness indicator.
   * Implements Requirement 11.5: IF weather API is unavailable, THEN THE System
   * SHALL use cached data and display a staleness indicator.
   */
  async getLatestWeatherWithStaleness(farmId: string): Promise<WeatherResponseWithStaleness> {
    try {
      // Try to get fresh data from database
      const freshData = await this.getLatestWeather(farmId);
      
      if (freshData) {
        return {
          data: freshData,
          isStale: false,
          cachedAt: null,
          source: freshData.source ?? 'database',
        };
      }

      // If no fresh data, try cache fallback
      if (this.cacheService) {
        const cached = await this.cacheService.getCachedLatestWeather(farmId);
        if (cached.data) {
          this.logger.debug(`Using cached weather data for farm ${farmId} (stale: ${cached.isStale})`);
          return {
            data: cached.data as WeatherDataDto,
            isStale: cached.isStale,
            cachedAt: cached.cachedAt,
            source: cached.source ?? 'cache',
          };
        }
      }

      return {
        data: null,
        isStale: false,
        cachedAt: null,
        source: null,
      };
    } catch (error) {
      this.logger.error(`Error getting latest weather: ${error}`);
      
      // On error, try cache fallback
      if (this.cacheService) {
        const cached = await this.cacheService.getCachedLatestWeather(farmId);
        if (cached.data) {
          this.logger.debug(`Using cached weather data after error for farm ${farmId}`);
          return {
            data: cached.data as WeatherDataDto,
            isStale: true, // Mark as stale since we couldn't get fresh data
            cachedAt: cached.cachedAt,
            source: cached.source ?? 'cache-fallback',
          };
        }
      }

      throw error;
    }
  }

  /**
   * Fetches weather data for all farms that have location data.
   * This method is intended to be called by a scheduled job.
   */
  async fetchWeatherForAllFarms(): Promise<{
    farmsProcessed: number;
    totalRecordsStored: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let farmsProcessed = 0;
    let totalRecordsStored = 0;

    // Get all farms with location data
    const farms = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; latitude: number; longitude: number }>
    >`
      SELECT 
        id,
        name,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude
      FROM farms
      WHERE location IS NOT NULL
    `;

    for (const farm of farms) {
      try {
        const result = await this.fetchAndStoreWeatherData(
          farm.id,
          farm.latitude,
          farm.longitude,
        );

        if (result.success) {
          totalRecordsStored += result.recordsStored;
          farmsProcessed++;
        } else {
          errors.push(`Farm ${farm.name}: ${result.error}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Farm ${farm.name}: ${errorMessage}`);
      }
    }

    return {
      farmsProcessed,
      totalRecordsStored,
      errors,
    };
  }

  /**
   * Gets weather summary statistics for a farm over a date range.
   * Implements caching with fallback for Requirement 11.5.
   */
  async getWeatherSummary(
    farmId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    avgTemperature: number | null;
    totalPrecipitation: number | null;
    avgHumidity: number | null;
    avgWindSpeed: number | null;
    recordCount: number;
  }> {
    const result = await this.prisma.$queryRaw<
      Array<{
        avg_temp: number | null;
        total_precip: number | null;
        avg_humidity: number | null;
        avg_wind: number | null;
        record_count: number;
      }>
    >`
      SELECT 
        AVG(temperature)::float as avg_temp,
        SUM(precipitation)::float as total_precip,
        AVG(humidity)::float as avg_humidity,
        AVG(wind_speed)::float as avg_wind,
        COUNT(*)::int as record_count
      FROM weather_data
      WHERE farm_id = ${farmId}::uuid
        AND time >= ${startDate}
        AND time <= ${endDate}
    `;

    const data = result[0];
    const summary = {
      avgTemperature: data?.avg_temp ?? null,
      totalPrecipitation: data?.total_precip ?? null,
      avgHumidity: data?.avg_humidity ?? null,
      avgWindSpeed: data?.avg_wind ?? null,
      recordCount: data?.record_count ?? 0,
    };

    // Cache the summary if it has data
    if (summary.recordCount > 0 && this.cacheService) {
      await this.cacheService.cacheWeatherSummary(farmId, startDate, endDate, summary);
    }

    return summary;
  }

  /**
   * Gets weather summary statistics with staleness indicator.
   * Implements Requirement 11.5: IF weather API is unavailable, THEN THE System
   * SHALL use cached data and display a staleness indicator.
   */
  async getWeatherSummaryWithStaleness(
    farmId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<WeatherSummaryResponseWithStaleness> {
    try {
      // Try to get fresh data from database
      const freshData = await this.getWeatherSummary(farmId, startDate, endDate);
      
      if (freshData.recordCount > 0) {
        return {
          data: freshData,
          isStale: false,
          cachedAt: null,
          source: 'database',
        };
      }

      // If no fresh data, try cache fallback
      if (this.cacheService) {
        const cached = await this.cacheService.getCachedWeatherSummary(farmId, startDate, endDate);
        if (cached.data) {
          this.logger.debug(`Using cached weather summary for farm ${farmId} (stale: ${cached.isStale})`);
          return {
            data: cached.data,
            isStale: cached.isStale,
            cachedAt: cached.cachedAt,
            source: 'cache',
          };
        }
      }

      return {
        data: freshData,
        isStale: false,
        cachedAt: null,
        source: null,
      };
    } catch (error) {
      this.logger.error(`Error getting weather summary: ${error}`);
      
      // On error, try cache fallback
      if (this.cacheService) {
        const cached = await this.cacheService.getCachedWeatherSummary(farmId, startDate, endDate);
        if (cached.data) {
          this.logger.debug(`Using cached weather summary after error for farm ${farmId}`);
          return {
            data: cached.data,
            isStale: true,
            cachedAt: cached.cachedAt,
            source: 'cache-fallback',
          };
        }
      }

      throw error;
    }
  }

  /**
   * Invalidates all weather cache for a farm.
   * Useful when new weather data is fetched.
   */
  async invalidateWeatherCache(farmId: string): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.invalidateCache(farmId);
    }
  }
}

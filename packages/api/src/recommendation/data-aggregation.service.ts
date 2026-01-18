import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import {
  SoilQualityDto,
  WeatherSummaryDto,
  WeatherForecastDto,
  MarketPriceDto,
  HistoricalYieldDto,
  RecommendationInputsDto,
  MissingDataDto,
  MissingDataType,
  AggregatedDataResponseDto,
} from './dto/recommendation.dto';
import { InsufficientDataException } from './exceptions';

/**
 * Service responsible for aggregating all data needed for crop recommendations.
 * Implements Requirement 4.1: WHEN a user requests recommendations for a zone,
 * THE Recommendation_Engine SHALL consider soil quality, historical weather,
 * forecasts, market prices, and past yields.
 */
@Injectable()
export class DataAggregationService {
  // Base temperature for growing degree days calculation (Celsius)
  private readonly BASE_TEMP_CELSIUS = 10;

  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Aggregates all data needed for generating crop recommendations for a zone.
   * This includes soil quality, historical weather, weather forecasts,
   * market prices, and historical yields.
   */
  async aggregateDataForZone(zoneId: string): Promise<AggregatedDataResponseDto> {
    const farmId = this.getFarmId();

    // Verify zone exists and get zone details with field info
    const zoneData = await this.getZoneWithField(zoneId, farmId);
    if (!zoneData) {
      throw new NotFoundException(`Zone with ID '${zoneId}' not found`);
    }

    const missingData: MissingDataDto[] = [];

    // Gather all data in parallel for efficiency
    const [soilQuality, historicalWeather, weatherForecast, marketPrices, historicalYields] =
      await Promise.all([
        this.getSoilQuality(zoneId, missingData),
        this.getHistoricalWeather(farmId, missingData),
        this.getWeatherForecast(farmId, missingData),
        this.getMarketPrices(farmId, missingData),
        this.getHistoricalYields(zoneId, farmId, missingData),
      ]);

    const inputs: RecommendationInputsDto = {
      soilQuality,
      historicalWeather,
      weatherForecast,
      marketPrices,
      historicalYields,
    };

    return {
      zoneId: zoneData.id,
      zoneName: zoneData.name,
      fieldId: zoneData.fieldId,
      fieldName: zoneData.fieldName,
      inputs,
      missingData,
      aggregatedAt: new Date().toISOString(),
    };
  }


  /**
   * Validates that sufficient data exists for generating recommendations.
   * Returns true if minimum required data is present, throws error otherwise.
   * Implements Requirement 4.5: IF the Recommendation_Engine cannot generate
   * recommendations due to insufficient data, THEN it SHALL return a clear
   * error message listing missing inputs.
   * 
   * Critical data (required for recommendations):
   * - soil_quality: Required for accurate crop suitability analysis
   * - historical_weather: Required for climate-based recommendations
   * 
   * Non-critical data (improves recommendations but not required):
   * - weather_forecast: Enhances planting window suggestions
   * - market_prices: Improves profitability estimates
   * - historical_yields: Improves yield predictions
   */
  validateSufficientData(aggregatedData: AggregatedDataResponseDto): boolean {
    // Check if there are any missing data items
    if (aggregatedData.missingData.length === 0) {
      return true;
    }

    // Identify critical missing data types that prevent recommendation generation
    const criticalTypes: MissingDataType[] = ['soil_quality', 'historical_weather'];
    const criticalMissing = aggregatedData.missingData.filter(
      (m) => criticalTypes.includes(m.type),
    );

    // If any critical data is missing, throw an exception with ALL missing inputs
    if (criticalMissing.length > 0) {
      throw new InsufficientDataException(aggregatedData.missingData);
    }

    return true;
  }

  /**
   * Detects all missing required inputs for generating recommendations.
   * Returns a list of all missing data types with descriptions.
   * Implements Requirement 4.5: Return error listing all missing input types.
   */
  detectMissingInputs(aggregatedData: AggregatedDataResponseDto): MissingDataDto[] {
    return aggregatedData.missingData;
  }

  /**
   * Checks if the aggregated data has sufficient information for recommendations.
   * Returns an object indicating whether recommendations can be generated
   * and lists any missing inputs.
   */
  checkDataSufficiency(aggregatedData: AggregatedDataResponseDto): {
    canGenerateRecommendations: boolean;
    missingInputs: MissingDataDto[];
    criticalMissing: MissingDataDto[];
    nonCriticalMissing: MissingDataDto[];
  } {
    const criticalTypes: MissingDataType[] = ['soil_quality', 'historical_weather'];
    
    const criticalMissing = aggregatedData.missingData.filter(
      (m) => criticalTypes.includes(m.type),
    );
    
    const nonCriticalMissing = aggregatedData.missingData.filter(
      (m) => !criticalTypes.includes(m.type),
    );

    return {
      canGenerateRecommendations: criticalMissing.length === 0,
      missingInputs: aggregatedData.missingData,
      criticalMissing,
      nonCriticalMissing,
    };
  }

  /**
   * Gets zone details with associated field information
   */
  private async getZoneWithField(
    zoneId: string,
    farmId: string,
  ): Promise<{ id: string; name: string; fieldId: string; fieldName: string } | null> {
    const result = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        field_id: string;
        field_name: string;
      }>
    >`
      SELECT 
        z.id,
        z.name,
        z.field_id,
        f.name as field_name
      FROM zones z
      JOIN fields f ON z.field_id = f.id
      WHERE z.id = ${zoneId}::uuid AND f.farm_id = ${farmId}::uuid
    `;

    if (result.length === 0) {
      return null;
    }

    return {
      id: result[0].id,
      name: result[0].name,
      fieldId: result[0].field_id,
      fieldName: result[0].field_name,
    };
  }

  /**
   * Retrieves soil quality data for a zone
   */
  private async getSoilQuality(
    zoneId: string,
    missingData: MissingDataDto[],
  ): Promise<SoilQualityDto> {
    const result = await this.prisma.$queryRaw<Array<{ soil_quality: SoilQualityDto }>>`
      SELECT soil_quality
      FROM zones
      WHERE id = ${zoneId}::uuid
    `;

    const soilQuality = result[0]?.soil_quality || {};

    // Check if soil quality data is meaningful
    const hasData =
      soilQuality.ph !== undefined ||
      soilQuality.nitrogen !== undefined ||
      soilQuality.phosphorus !== undefined ||
      soilQuality.potassium !== undefined ||
      soilQuality.organicMatter !== undefined;

    if (!hasData) {
      missingData.push({
        type: 'soil_quality',
        description: 'No soil quality data available for this zone',
        suggestion: 'Import soil test results to improve recommendation accuracy',
      });
    }

    return soilQuality;
  }


  /**
   * Retrieves and summarizes historical weather data for the farm location.
   * Calculates growing degree days and frost-free days from raw weather data.
   */
  private async getHistoricalWeather(
    farmId: string,
    missingData: MissingDataDto[],
  ): Promise<WeatherSummaryDto> {
    // Get weather data from the past year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const weatherData = await this.prisma.$queryRaw<
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
        AND time >= ${oneYearAgo}
    `;

    const data = weatherData[0];

    if (!data || data.record_count === 0) {
      missingData.push({
        type: 'historical_weather',
        description: 'No historical weather data available for this farm',
        suggestion: 'Weather data will be collected automatically over time',
      });

      return {
        avgTemperature: 0,
        totalPrecipitation: 0,
        growingDegreeDays: 0,
        frostFreeDays: 0,
      };
    }

    // Calculate growing degree days (GDD)
    const gddData = await this.calculateGrowingDegreeDays(farmId, oneYearAgo);

    // Calculate frost-free days
    const frostFreeDays = await this.calculateFrostFreeDays(farmId, oneYearAgo);

    return {
      avgTemperature: data.avg_temp ?? 0,
      totalPrecipitation: data.total_precip ?? 0,
      growingDegreeDays: gddData,
      frostFreeDays,
      avgHumidity: data.avg_humidity ?? undefined,
      avgWindSpeed: data.avg_wind ?? undefined,
    };
  }

  /**
   * Calculates growing degree days (GDD) from historical weather data.
   * GDD = sum of (daily avg temp - base temp) for days where avg temp > base temp
   */
  private async calculateGrowingDegreeDays(farmId: string, startDate: Date): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ gdd: number | null }>>`
      SELECT 
        SUM(
          CASE 
            WHEN temperature > ${this.BASE_TEMP_CELSIUS} 
            THEN temperature - ${this.BASE_TEMP_CELSIUS}
            ELSE 0 
          END
        )::float as gdd
      FROM weather_data
      WHERE farm_id = ${farmId}::uuid
        AND time >= ${startDate}
    `;

    return result[0]?.gdd ?? 0;
  }

  /**
   * Calculates the number of frost-free days (days where temp > 0°C)
   */
  private async calculateFrostFreeDays(farmId: string, startDate: Date): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ frost_free_days: number }>>`
      SELECT COUNT(DISTINCT DATE(time))::int as frost_free_days
      FROM weather_data
      WHERE farm_id = ${farmId}::uuid
        AND time >= ${startDate}
        AND temperature > 0
    `;

    return result[0]?.frost_free_days ?? 0;
  }


  /**
   * Retrieves weather forecast data for the next 7 days.
   * Note: In a real implementation, this would fetch from a weather API.
   * For now, we return any cached forecast data from the database.
   */
  private async getWeatherForecast(
    farmId: string,
    missingData: MissingDataDto[],
  ): Promise<WeatherForecastDto[]> {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Query for any future weather data (forecasts)
    const forecastData = await this.prisma.$queryRaw<
      Array<{
        time: Date;
        temperature: number | null;
        precipitation: number | null;
        humidity: number | null;
        conditions: string | null;
      }>
    >`
      SELECT 
        time,
        temperature,
        precipitation,
        humidity,
        conditions
      FROM weather_data
      WHERE farm_id = ${farmId}::uuid
        AND time >= ${now}
        AND time <= ${sevenDaysFromNow}
      ORDER BY time ASC
    `;

    if (forecastData.length === 0) {
      missingData.push({
        type: 'weather_forecast',
        description: 'No weather forecast data available',
        suggestion: 'Weather forecasts will be fetched from external API when configured',
      });

      return [];
    }

    // Group by date and calculate high/low temps
    const forecastByDate = new Map<string, WeatherForecastDto>();

    for (const record of forecastData) {
      const dateKey = record.time.toISOString().split('T')[0];
      const existing = forecastByDate.get(dateKey);

      if (!existing) {
        forecastByDate.set(dateKey, {
          date: dateKey,
          highTemp: record.temperature ?? 0,
          lowTemp: record.temperature ?? 0,
          precipitation: record.precipitation ?? 0,
          humidity: record.humidity ?? 0,
          conditions: record.conditions ?? 'unknown',
        });
      } else {
        // Update high/low temps
        if (record.temperature !== null) {
          existing.highTemp = Math.max(existing.highTemp, record.temperature);
          existing.lowTemp = Math.min(existing.lowTemp, record.temperature);
        }
        // Accumulate precipitation
        existing.precipitation += record.precipitation ?? 0;
        // Use latest conditions
        if (record.conditions) {
          existing.conditions = record.conditions;
        }
      }
    }

    return Array.from(forecastByDate.values());
  }

  /**
   * Retrieves current market prices for common crops.
   * Note: In a real implementation, this would fetch from a market data API.
   * For now, we use static reference prices that could be updated via admin interface.
   */
  private async getMarketPrices(
    farmId: string,
    missingData: MissingDataDto[],
  ): Promise<MarketPriceDto[]> {
    // Query for recent harvest revenues to derive market prices
    const recentPrices = await this.prisma.$queryRaw<
      Array<{
        crop_type: string;
        price_per_unit: number;
        unit: string;
        sale_date: Date;
      }>
    >`
      SELECT DISTINCT ON (crop_type)
        crop_type,
        price_per_unit::float,
        unit,
        sale_date
      FROM revenues
      WHERE farm_id = ${farmId}::uuid
        AND sale_date >= NOW() - INTERVAL '1 year'
      ORDER BY crop_type, sale_date DESC
    `;

    if (recentPrices.length === 0) {
      missingData.push({
        type: 'market_prices',
        description: 'No recent market price data available',
        suggestion: 'Record harvest sales to build market price history',
      });

      // Return default reference prices for common crops
      return this.getDefaultMarketPrices();
    }

    return recentPrices.map((price) => ({
      cropType: price.crop_type,
      pricePerUnit: price.price_per_unit,
      unit: price.unit,
      date: price.sale_date.toISOString(),
      source: 'farm_sales',
    }));
  }

  /**
   * Returns default market prices for common crops when no sales data exists
   */
  private getDefaultMarketPrices(): MarketPriceDto[] {
    const now = new Date().toISOString();
    return [
      { cropType: 'corn', pricePerUnit: 5.5, unit: 'bushel', date: now, source: 'reference' },
      { cropType: 'soybeans', pricePerUnit: 13.0, unit: 'bushel', date: now, source: 'reference' },
      { cropType: 'wheat', pricePerUnit: 7.0, unit: 'bushel', date: now, source: 'reference' },
      { cropType: 'cotton', pricePerUnit: 0.85, unit: 'lb', date: now, source: 'reference' },
      { cropType: 'rice', pricePerUnit: 15.0, unit: 'cwt', date: now, source: 'reference' },
    ];
  }


  /**
   * Retrieves historical yield data for the zone and similar zones.
   * This helps the recommendation engine understand what crops have
   * performed well in similar conditions.
   */
  private async getHistoricalYields(
    zoneId: string,
    farmId: string,
    missingData: MissingDataDto[],
  ): Promise<HistoricalYieldDto[]> {
    // Get harvests from this zone and calculate yield per acre
    const zoneYields = await this.prisma.$queryRaw<
      Array<{
        crop_type: string;
        year: number;
        total_quantity: number;
        unit: string;
        zone_id: string;
        zone_name: string;
        zone_acreage: number | null;
      }>
    >`
      SELECT 
        h.crop_type,
        EXTRACT(YEAR FROM h.harvest_date)::int as year,
        SUM(h.quantity)::float as total_quantity,
        h.unit,
        z.id as zone_id,
        z.name as zone_name,
        z.acreage::float as zone_acreage
      FROM harvests h
      JOIN zones z ON h.zone_id = z.id
      JOIN fields f ON z.field_id = f.id
      WHERE h.zone_id = ${zoneId}::uuid
        AND f.farm_id = ${farmId}::uuid
      GROUP BY h.crop_type, EXTRACT(YEAR FROM h.harvest_date), h.unit, z.id, z.name, z.acreage
      ORDER BY year DESC
    `;

    // Also get yields from other zones in the same farm for comparison
    const farmYields = await this.prisma.$queryRaw<
      Array<{
        crop_type: string;
        year: number;
        total_quantity: number;
        unit: string;
        zone_id: string;
        zone_name: string;
        zone_acreage: number | null;
      }>
    >`
      SELECT 
        h.crop_type,
        EXTRACT(YEAR FROM h.harvest_date)::int as year,
        SUM(h.quantity)::float as total_quantity,
        h.unit,
        z.id as zone_id,
        z.name as zone_name,
        z.acreage::float as zone_acreage
      FROM harvests h
      JOIN zones z ON h.zone_id = z.id
      JOIN fields f ON z.field_id = f.id
      WHERE h.zone_id != ${zoneId}::uuid
        AND f.farm_id = ${farmId}::uuid
      GROUP BY h.crop_type, EXTRACT(YEAR FROM h.harvest_date), h.unit, z.id, z.name, z.acreage
      ORDER BY year DESC
      LIMIT 50
    `;

    const allYields = [...zoneYields, ...farmYields];

    if (allYields.length === 0) {
      missingData.push({
        type: 'historical_yields',
        description: 'No historical yield data available for this zone or farm',
        suggestion: 'Record harvest data to build yield history for better recommendations',
      });

      return [];
    }

    return allYields.map((yield_) => ({
      cropType: yield_.crop_type,
      year: yield_.year,
      yieldPerAcre:
        yield_.zone_acreage && yield_.zone_acreage > 0
          ? yield_.total_quantity / yield_.zone_acreage
          : yield_.total_quantity,
      unit: yield_.unit,
      zoneId: yield_.zone_id,
      zoneName: yield_.zone_name,
    }));
  }

  /**
   * Gets a summary of what data is available vs missing for a zone.
   * Useful for UI to show data completeness before requesting recommendations.
   */
  async getDataAvailabilitySummary(zoneId: string): Promise<{
    zoneId: string;
    dataAvailability: Record<MissingDataType, boolean>;
    completenessScore: number;
  }> {
    const farmId = this.getFarmId();

    // Verify zone exists
    const zoneData = await this.getZoneWithField(zoneId, farmId);
    if (!zoneData) {
      throw new NotFoundException(`Zone with ID '${zoneId}' not found`);
    }

    const missingData: MissingDataDto[] = [];

    // Check each data type
    await Promise.all([
      this.getSoilQuality(zoneId, missingData),
      this.getHistoricalWeather(farmId, missingData),
      this.getWeatherForecast(farmId, missingData),
      this.getMarketPrices(farmId, missingData),
      this.getHistoricalYields(zoneId, farmId, missingData),
    ]);

    const missingTypes = new Set(missingData.map((m) => m.type));

    const dataAvailability: Record<MissingDataType, boolean> = {
      soil_quality: !missingTypes.has('soil_quality'),
      historical_weather: !missingTypes.has('historical_weather'),
      weather_forecast: !missingTypes.has('weather_forecast'),
      market_prices: !missingTypes.has('market_prices'),
      historical_yields: !missingTypes.has('historical_yields'),
    };

    const availableCount = Object.values(dataAvailability).filter(Boolean).length;
    const completenessScore = (availableCount / 5) * 100;

    return {
      zoneId,
      dataAvailability,
      completenessScore,
    };
  }
}

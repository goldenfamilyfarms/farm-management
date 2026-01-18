import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { WeatherService } from './weather.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Controller for weather data endpoints.
 * Provides access to weather data fetching and retrieval.
 * 
 * Implements Requirement 11.5: IF weather API is unavailable, THEN THE System
 * SHALL use cached data and display a staleness indicator.
 */
@Controller('weather')
export class WeatherController {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Fetches weather data for the current farm from NOAA API.
   * Requires the farm to have location data set.
   */
  @Post('fetch')
  @HttpCode(HttpStatus.OK)
  async fetchWeatherData() {
    const farmId = TenantContext.getFarmId();

    // Get farm location
    const farmLocation = await this.prisma.$queryRaw<
      Array<{ latitude: number; longitude: number }>
    >`
      SELECT 
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude
      FROM farms
      WHERE id = ${farmId}::uuid
        AND location IS NOT NULL
    `;

    if (farmLocation.length === 0) {
      throw new BadRequestException(
        'Farm location is not set. Please update farm settings with a valid location.',
      );
    }

    const { latitude, longitude } = farmLocation[0];
    return this.weatherService.fetchAndStoreWeatherData(farmId, latitude, longitude);
  }

  /**
   * Gets historical weather data for the current farm.
   * Returns staleness indicator when using cached data.
   */
  @Get('history')
  async getWeatherHistory(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('limit') limitStr?: string,
    @Query('withStaleness') withStaleness?: string,
  ) {
    const farmId = TenantContext.getFarmId();

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : 100;

    if (startDate && isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid startDate format');
    }
    if (endDate && isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid endDate format');
    }

    // If withStaleness is requested, return data with staleness indicator
    if (withStaleness === 'true') {
      return this.weatherService.getWeatherHistoryWithStaleness({
        farmId,
        startDate,
        endDate,
        limit,
      });
    }

    return this.weatherService.getWeatherHistory({
      farmId,
      startDate,
      endDate,
      limit,
    });
  }

  /**
   * Gets the latest weather data for the current farm.
   * Returns staleness indicator when using cached data.
   */
  @Get('latest')
  async getLatestWeather(
    @Query('withStaleness') withStaleness?: string,
  ) {
    const farmId = TenantContext.getFarmId();
    
    // If withStaleness is requested, return data with staleness indicator
    if (withStaleness === 'true') {
      return this.weatherService.getLatestWeatherWithStaleness(farmId);
    }

    return this.weatherService.getLatestWeather(farmId);
  }

  /**
   * Gets weather summary statistics for a date range.
   * Returns staleness indicator when using cached data.
   */
  @Get('summary')
  async getWeatherSummary(
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
    @Query('withStaleness') withStaleness?: string,
  ) {
    const farmId = TenantContext.getFarmId();

    if (!startDateStr || !endDateStr) {
      throw new BadRequestException('startDate and endDate are required');
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // If withStaleness is requested, return data with staleness indicator
    if (withStaleness === 'true') {
      return this.weatherService.getWeatherSummaryWithStaleness(farmId, startDate, endDate);
    }

    return this.weatherService.getWeatherSummary(farmId, startDate, endDate);
  }

  /**
   * Admin endpoint to fetch weather for all farms.
   * This would typically be called by a scheduled job.
   */
  @Post('fetch-all')
  @HttpCode(HttpStatus.OK)
  async fetchWeatherForAllFarms() {
    return this.weatherService.fetchWeatherForAllFarms();
  }
}

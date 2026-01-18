import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma';
import { RedisModule } from '../redis';
import { WeatherService } from './weather.service';
import { WeatherCacheService } from './weather-cache.service';
import { WeatherController } from './weather.controller';

/**
 * Weather module for fetching and storing weather data.
 * Implements Requirement 11.1: THE System SHALL fetch and store weather data
 * (temperature, precipitation, humidity, wind) for farm locations daily.
 * 
 * Implements Requirement 11.5: IF weather API is unavailable, THEN THE System
 * SHALL use cached data and display a staleness indicator.
 */
@Module({
  imports: [PrismaModule, ConfigModule, RedisModule],
  controllers: [WeatherController],
  providers: [WeatherService, WeatherCacheService],
  exports: [WeatherService, WeatherCacheService],
})
export class WeatherModule {}

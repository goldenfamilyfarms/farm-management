import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  /**
   * Ingest telemetry data from equipment
   * This endpoint is public as it's called by IoT devices
   * Authentication is handled via device certificates in production
   */
  @Post('ingest')
  @Public()
  @HttpCode(HttpStatus.OK)
  async ingest(@Body() payload: unknown) {
    return this.telemetryService.ingestReading(payload);
  }

  /**
   * Get telemetry readings for equipment
   */
  @Get('equipment/:equipmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'manager', 'worker', 'viewer')
  async getReadings(
    @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return this.telemetryService.getReadings(equipmentId, start, end);
  }

  /**
   * Get latest telemetry reading for equipment
   */
  @Get('equipment/:equipmentId/latest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'manager', 'worker', 'viewer')
  async getLatestReading(@Param('equipmentId', ParseUUIDPipe) equipmentId: string) {
    return this.telemetryService.getLatestReading(equipmentId);
  }
}

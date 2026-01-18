import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ZoneService } from './zone.service';
import {
  CreateZoneDto,
  UpdateZoneDto,
  UpdateZoneSoilQualityDto,
  ZoneResponseDto,
  BulkSoilQualityImportDto,
  SoilQualityImportResultDto,
} from './dto/zone.dto';

@Controller('zones')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  /**
   * Create a new zone within a field
   */
  @Post()
  async create(@Body() dto: CreateZoneDto): Promise<ZoneResponseDto> {
    return this.zoneService.create(dto);
  }

  /**
   * Get all zones for a specific field
   */
  @Get('field/:fieldId')
  async findAllByField(
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
  ): Promise<ZoneResponseDto[]> {
    return this.zoneService.findAllByField(fieldId);
  }

  /**
   * Get a single zone by ID
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ZoneResponseDto> {
    return this.zoneService.findOne(id);
  }

  /**
   * Update a zone
   */
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateZoneDto,
  ): Promise<ZoneResponseDto> {
    return this.zoneService.update(id, dto);
  }

  /**
   * Update soil quality data for a zone
   * Implements Requirement 3.4
   */
  @Patch(':id/soil-quality')
  async updateSoilQuality(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateZoneSoilQualityDto,
  ): Promise<ZoneResponseDto> {
    return this.zoneService.updateSoilQuality(id, dto);
  }

  /**
   * Bulk import soil quality data for multiple zones
   * Implements Requirement 3.4
   */
  @Post('soil-quality/import')
  async bulkImportSoilQuality(
    @Body() dto: BulkSoilQualityImportDto,
  ): Promise<SoilQualityImportResultDto> {
    return this.zoneService.bulkImportSoilQuality(dto);
  }

  /**
   * Delete a zone
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.zoneService.delete(id);
  }
}

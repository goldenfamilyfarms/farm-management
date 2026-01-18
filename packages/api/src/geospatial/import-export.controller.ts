import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Header,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ImportExportService } from './import-export.service';
import {
  GeoJSONFeatureCollectionDto,
  KMLImportDto,
} from './dto/import-export.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('fields')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  /**
   * Import fields from GeoJSON FeatureCollection
   */
  @Post('import/geojson')
  @Roles('owner', 'manager')
  async importGeoJSON(@Body() dto: GeoJSONFeatureCollectionDto) {
    return this.importExportService.importFromGeoJSON(dto);
  }

  /**
   * Import fields from KML format
   */
  @Post('import/kml')
  @Roles('owner', 'manager')
  async importKML(@Body() dto: KMLImportDto) {
    return this.importExportService.importFromKML(dto);
  }

  /**
   * Export all fields as GeoJSON FeatureCollection
   */
  @Get('export/geojson')
  @Roles('owner', 'manager', 'worker', 'viewer')
  @Header('Content-Type', 'application/geo+json')
  async exportGeoJSON(@Query('ids') ids?: string) {
    if (ids) {
      const fieldIds = ids.split(',').map(id => id.trim());
      return this.importExportService.exportFieldsToGeoJSON(fieldIds);
    }
    return this.importExportService.exportToGeoJSON();
  }

  /**
   * Export all fields as KML
   */
  @Get('export/kml')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async exportKML(
    @Query('ids') ids: string | undefined,
    @Res() res: Response,
  ) {
    let kml: string;
    
    if (ids) {
      const fieldIds = ids.split(',').map(id => id.trim());
      kml = await this.importExportService.exportFieldsToKML(fieldIds);
    } else {
      kml = await this.importExportService.exportToKML();
    }

    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', 'attachment; filename="fields.kml"');
    res.send(kml);
  }
}

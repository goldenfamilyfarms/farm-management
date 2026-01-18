import { Module } from '@nestjs/common';
import { FieldService } from './field.service';
import { FieldController } from './field.controller';
import { ZoneService } from './zone.service';
import { ZoneController } from './zone.controller';
import { PolygonValidationService } from './polygon-validation.service';
import { ImportExportService } from './import-export.service';
import { ImportExportController } from './import-export.controller';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FieldController, ZoneController, ImportExportController],
  providers: [FieldService, ZoneService, PolygonValidationService, ImportExportService],
  exports: [FieldService, ZoneService, PolygonValidationService, ImportExportService],
})
export class GeospatialModule {}

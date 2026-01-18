import { Module, forwardRef } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth';
import { ResourceModule } from '../resource/resource.module';

@Module({
  imports: [PrismaModule, AuthModule, forwardRef(() => ResourceModule)],
  controllers: [EquipmentController, TelemetryController],
  providers: [EquipmentService, TelemetryService],
  exports: [EquipmentService, TelemetryService],
})
export class TelemetryModule {}

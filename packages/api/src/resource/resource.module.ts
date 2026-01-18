import { Module } from '@nestjs/common';
import { ResourceApplicationService } from './resource-application.service';
import { ResourceApplicationController } from './resource-application.controller';
import { ResourceUsageService } from './resource-usage.service';
import { ResourceUsageController } from './resource-usage.controller';
import { ResourceThresholdService } from './resource-threshold.service';
import { ResourceThresholdController } from './resource-threshold.controller';
import { ResourceWarningService } from './resource-warning.service';
import { ResourceWarningController } from './resource-warning.controller';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    ResourceApplicationController,
    ResourceUsageController,
    ResourceThresholdController,
    ResourceWarningController,
  ],
  providers: [
    ResourceApplicationService,
    ResourceUsageService,
    ResourceThresholdService,
    ResourceWarningService,
  ],
  exports: [
    ResourceApplicationService,
    ResourceUsageService,
    ResourceThresholdService,
    ResourceWarningService,
  ],
})
export class ResourceModule {}

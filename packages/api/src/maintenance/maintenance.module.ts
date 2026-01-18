import { Module } from '@nestjs/common';
import { MaintenanceRecordService } from './maintenance-record.service';
import { MaintenanceRecordController } from './maintenance-record.controller';
import { ServiceReminderService } from './service-reminder.service';
import { ServiceReminderController } from './service-reminder.controller';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MaintenanceRecordController, ServiceReminderController],
  providers: [MaintenanceRecordService, ServiceReminderService],
  exports: [MaintenanceRecordService, ServiceReminderService],
})
export class MaintenanceModule {}

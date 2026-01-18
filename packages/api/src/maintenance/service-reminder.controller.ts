import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServiceReminderService } from './service-reminder.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('service-reminders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceReminderController {
  constructor(private readonly serviceReminderService: ServiceReminderService) {}

  @Get()
  @Roles('owner', 'manager', 'worker')
  async getServiceReminders() {
    return this.serviceReminderService.getServiceReminders();
  }

  @Get('equipment/:equipmentId')
  @Roles('owner', 'manager', 'worker')
  async getEquipmentReminder(@Param('equipmentId', ParseUUIDPipe) equipmentId: string) {
    return this.serviceReminderService.getEquipmentReminder(equipmentId);
  }

  @Get('equipment/:equipmentId/check')
  @Roles('owner', 'manager', 'worker')
  async checkServiceDue(@Param('equipmentId', ParseUUIDPipe) equipmentId: string) {
    const isDue = await this.serviceReminderService.checkServiceDue(equipmentId);
    return { equipmentId, serviceDue: isDue };
  }
}

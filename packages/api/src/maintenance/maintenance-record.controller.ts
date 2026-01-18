import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MaintenanceRecordService } from './maintenance-record.service';
import {
  CreateMaintenanceRecordDto,
  UpdateMaintenanceRecordDto,
  MaintenanceRecordQueryDto,
} from './dto/maintenance-record.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('maintenance-records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceRecordController {
  constructor(private readonly maintenanceRecordService: MaintenanceRecordService) {}

  @Post()
  @Roles('owner', 'manager')
  async create(@Body() dto: CreateMaintenanceRecordDto) {
    return this.maintenanceRecordService.create(dto);
  }

  @Get()
  @Roles('owner', 'manager', 'worker')
  async findAll(@Query() query: MaintenanceRecordQueryDto) {
    return this.maintenanceRecordService.findAll(query);
  }

  @Get('summary')
  @Roles('owner', 'manager')
  async getMaintenanceSummary() {
    return this.maintenanceRecordService.getMaintenanceSummary();
  }

  @Get('equipment/:equipmentId')
  @Roles('owner', 'manager', 'worker')
  async getEquipmentHistory(@Param('equipmentId', ParseUUIDPipe) equipmentId: string) {
    return this.maintenanceRecordService.getEquipmentHistory(equipmentId);
  }

  @Get('equipment/:equipmentId/downtime')
  @Roles('owner', 'manager')
  async getDowntimeAndCost(
    @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.maintenanceRecordService.getDowntimeAndCost(equipmentId, startDate, endDate);
  }

  @Get(':id')
  @Roles('owner', 'manager', 'worker')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.maintenanceRecordService.findOne(id);
  }

  @Put(':id')
  @Roles('owner', 'manager')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintenanceRecordDto,
  ) {
    return this.maintenanceRecordService.update(id, dto);
  }

  @Delete(':id')
  @Roles('owner', 'manager')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.maintenanceRecordService.delete(id);
    return { message: 'Maintenance record deleted successfully' };
  }
}

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
import { ScheduleService } from './schedule.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  ScheduleQueryDto,
} from './dto/schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @Roles('owner', 'manager')
  async create(@Body() dto: CreateScheduleDto) {
    return this.scheduleService.create(dto);
  }

  @Get()
  @Roles('owner', 'manager', 'worker')
  async findAll(@Query() query: ScheduleQueryDto) {
    return this.scheduleService.findAll(query);
  }

  @Get('worker/:workerId')
  @Roles('owner', 'manager', 'worker')
  async getWorkerSchedule(
    @Param('workerId', ParseUUIDPipe) workerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.scheduleService.getWorkerSchedule(workerId, startDate, endDate);
  }

  @Get('conflicts')
  @Roles('owner', 'manager')
  async detectConflicts(
    @Query('workerId') workerId: string,
    @Query('date') date: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    return this.scheduleService.detectConflicts(workerId, date, startTime, endTime);
  }

  @Get(':id')
  @Roles('owner', 'manager', 'worker')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.scheduleService.findOne(id);
  }

  @Put(':id')
  @Roles('owner', 'manager')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.scheduleService.update(id, dto);
  }

  @Delete(':id')
  @Roles('owner', 'manager')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.scheduleService.delete(id);
    return { message: 'Schedule deleted successfully' };
  }
}

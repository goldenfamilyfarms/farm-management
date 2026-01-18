import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TaskService } from './task.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  CompleteTaskDto,
  TaskQueryDto,
} from './dto/task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TaskStatus } from '@prisma/client';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @Roles('owner', 'manager')
  async create(@Body() dto: CreateTaskDto) {
    return this.taskService.create(dto);
  }

  @Get()
  @Roles('owner', 'manager', 'worker')
  async findAll(@Query() query: TaskQueryDto) {
    return this.taskService.findAll(query);
  }

  @Get('overdue')
  @Roles('owner', 'manager')
  async getOverdueTasks() {
    return this.taskService.getOverdueTasks();
  }

  @Get('worker/:workerId')
  @Roles('owner', 'manager', 'worker')
  async getTasksByWorker(@Param('workerId', ParseUUIDPipe) workerId: string) {
    return this.taskService.getTasksByWorker(workerId);
  }

  @Get(':id')
  @Roles('owner', 'manager', 'worker')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskService.findOne(id);
  }

  @Put(':id')
  @Roles('owner', 'manager')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.update(id, dto);
  }

  @Patch(':id/complete')
  @Roles('owner', 'manager', 'worker')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteTaskDto,
  ) {
    return this.taskService.complete(id, dto);
  }

  @Patch(':id/status')
  @Roles('owner', 'manager', 'worker')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: TaskStatus,
  ) {
    return this.taskService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles('owner', 'manager')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.taskService.delete(id);
    return { message: 'Task deleted successfully' };
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { WorkerService } from './worker.service';
import { CreateWorkerDto, UpdateWorkerDto } from './dto/worker.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('workers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post()
  @Roles('owner', 'manager')
  async create(@Body() dto: CreateWorkerDto) {
    return this.workerService.create(dto);
  }

  @Get()
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findAll() {
    return this.workerService.findAll();
  }

  @Get('active')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async getActiveWorkers() {
    return this.workerService.getActiveWorkers();
  }

  @Get(':id')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workerService.findOne(id);
  }

  @Get('user/:userId')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.workerService.findByUserId(userId);
  }

  @Put(':id')
  @Roles('owner', 'manager')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkerDto,
  ) {
    return this.workerService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('owner', 'manager')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.workerService.delete(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ResourceApplicationService } from './resource-application.service';
import {
  CreateResourceApplicationDto,
  UpdateResourceApplicationDto,
} from './dto/resource-application.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('resource-applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResourceApplicationController {
  constructor(
    private readonly resourceApplicationService: ResourceApplicationService,
  ) {}

  @Post()
  @Roles('owner', 'manager')
  async create(@Body() dto: CreateResourceApplicationDto) {
    return this.resourceApplicationService.create(dto);
  }

  @Get()
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findAll(
    @Query('fieldId') fieldId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.resourceApplicationService.findAll({
      fieldId,
      zoneId,
      resourceType,
      startDate,
      endDate,
    });
  }

  @Get(':id')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.resourceApplicationService.findOne(id);
  }

  @Put(':id')
  @Roles('owner', 'manager')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResourceApplicationDto,
  ) {
    return this.resourceApplicationService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('owner', 'manager')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.resourceApplicationService.delete(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ResourceThresholdService } from './resource-threshold.service';
import {
  CreateResourceThresholdDto,
  UpdateResourceThresholdDto,
} from './dto/resource-threshold.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { ResourceType } from '@prisma/client';

@Controller('resource-thresholds')
export class ResourceThresholdController {
  constructor(private readonly resourceThresholdService: ResourceThresholdService) {}

  @Post()
  @Roles('owner', 'manager')
  async create(@Body() dto: CreateResourceThresholdDto) {
    return this.resourceThresholdService.create(dto);
  }

  @Get()
  async findAll(
    @Query('resourceType') resourceType?: ResourceType,
    @Query('isActive') isActive?: string,
  ) {
    return this.resourceThresholdService.findAll({
      resourceType,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.resourceThresholdService.findOne(id);
  }

  @Put(':id')
  @Roles('owner', 'manager')
  async update(@Param('id') id: string, @Body() dto: UpdateResourceThresholdDto) {
    return this.resourceThresholdService.update(id, dto);
  }

  @Delete(':id')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.resourceThresholdService.delete(id);
  }
}

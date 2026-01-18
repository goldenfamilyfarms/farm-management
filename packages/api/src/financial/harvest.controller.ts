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
import { HarvestService } from './harvest.service';
import { CreateHarvestDto, UpdateHarvestDto } from './dto/harvest.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('harvests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HarvestController {
  constructor(private readonly harvestService: HarvestService) {}

  @Post()
  @Roles('owner', 'manager')
  async create(@Body() dto: CreateHarvestDto) {
    return this.harvestService.create(dto);
  }

  @Get()
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findAll(
    @Query('fieldId') fieldId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('cropType') cropType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.harvestService.findAll({
      fieldId,
      zoneId,
      cropType,
      startDate,
      endDate,
    });
  }

  @Get(':id')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.harvestService.findOne(id);
  }

  @Put(':id')
  @Roles('owner', 'manager')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHarvestDto,
  ) {
    return this.harvestService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('owner', 'manager')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.harvestService.delete(id);
  }
}

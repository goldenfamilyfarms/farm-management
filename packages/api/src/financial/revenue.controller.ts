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
  BadRequestException,
} from '@nestjs/common';
import { RevenueService, RevenueCalculationService } from './revenue.service';
import { CreateRevenueDto, UpdateRevenueDto } from './dto/revenue.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('revenues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RevenueController {
  constructor(
    private readonly revenueService: RevenueService,
    private readonly revenueCalculationService: RevenueCalculationService,
  ) {}

  @Post()
  @Roles('owner', 'manager')
  async create(@Body() dto: CreateRevenueDto) {
    return this.revenueService.create(dto);
  }

  @Get()
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findAll(
    @Query('fieldId') fieldId?: string,
    @Query('harvestId') harvestId?: string,
    @Query('cropType') cropType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.revenueService.findAll({
      fieldId,
      harvestId,
      cropType,
      startDate,
      endDate,
    });
  }

  @Get(':id')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.revenueService.findOne(id);
  }

  @Put(':id')
  @Roles('owner', 'manager')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRevenueDto,
  ) {
    return this.revenueService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('owner', 'manager')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.revenueService.delete(id);
  }

  @Get('per-acre/field/:fieldId')
  @Roles('owner', 'manager', 'viewer')
  async getRevenuePerAcre(
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.revenueCalculationService.getRevenuePerAcre(fieldId, { startDate, endDate });
  }

  @Get('per-acre/all-fields')
  @Roles('owner', 'manager', 'viewer')
  async getRevenuePerAcreAllFields(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.revenueCalculationService.getRevenuePerAcreAllFields({ startDate, endDate });
  }

  @Get('per-acre/crop/:cropType')
  @Roles('owner', 'manager', 'viewer')
  async getRevenuePerAcreByCrop(
    @Param('cropType') cropType: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.revenueCalculationService.getRevenuePerAcreByCrop(cropType, { startDate, endDate });
  }

  @Get('per-acre/zone/:zoneId')
  @Roles('owner', 'manager', 'viewer')
  async getRevenuePerZone(
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.revenueCalculationService.getRevenuePerZone(zoneId, { startDate, endDate });
  }
}

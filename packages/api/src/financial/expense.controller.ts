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
import { ExpenseService, CostCalculationService } from './expense.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExpenseCategory } from '@prisma/client';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpenseController {
  constructor(
    private readonly expenseService: ExpenseService,
    private readonly costCalculationService: CostCalculationService,
  ) {}

  @Post()
  @Roles('owner', 'manager')
  async create(@Body() dto: CreateExpenseDto) {
    return this.expenseService.create(dto);
  }

  @Get()
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findAll(
    @Query('fieldId') fieldId?: string,
    @Query('category') category?: ExpenseCategory,
    @Query('cropType') cropType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.expenseService.findAll({
      fieldId,
      category,
      cropType,
      startDate,
      endDate,
    });
  }

  @Get(':id')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.expenseService.findOne(id);
  }

  @Put(':id')
  @Roles('owner', 'manager')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenseService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('owner', 'manager')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.expenseService.delete(id);
  }

  @Get('cost-per-acre/field/:fieldId')
  @Roles('owner', 'manager', 'viewer')
  async getCostPerAcre(
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.costCalculationService.getCostPerAcre(fieldId, { startDate, endDate });
  }

  @Get('cost-per-acre/all-fields')
  @Roles('owner', 'manager', 'viewer')
  async getCostPerAcreAllFields(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.costCalculationService.getCostPerAcreAllFields({ startDate, endDate });
  }

  @Get('cost-per-acre/crop/:cropType')
  @Roles('owner', 'manager', 'viewer')
  async getCostPerAcreByCrop(
    @Param('cropType') cropType: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.costCalculationService.getCostPerAcreByCrop(cropType, { startDate, endDate });
  }
}

import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportService } from './report.service';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExpenseCategory } from '@prisma/client';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly exportService: ExportService,
  ) {}

  @Get('costs')
  @Roles('owner', 'manager', 'viewer')
  async generateCostReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.reportService.generateCostReport({ startDate, endDate });
  }

  @Get('costs/by-category/:category')
  @Roles('owner', 'manager', 'viewer')
  async generateCostReportByCategory(
    @Param('category') category: ExpenseCategory,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    
    const validCategories = Object.values(ExpenseCategory);
    if (!validCategories.includes(category)) {
      throw new BadRequestException(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }
    
    return this.reportService.generateCostReportByCategory(category, { startDate, endDate });
  }

  @Get('costs/by-field/:fieldId')
  @Roles('owner', 'manager', 'viewer')
  async generateCostReportByField(
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.reportService.generateCostReportByField(fieldId, { startDate, endDate });
  }

  @Get('costs/export/csv')
  @Roles('owner', 'manager', 'viewer')
  async exportCostReportCSV(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    
    const report = await this.reportService.generateCostReport({ startDate, endDate });
    const exportResult = this.exportService.exportCostReportToCSV(report);
    
    res.set({
      'Content-Type': exportResult.contentType,
      'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
    });
    
    return new StreamableFile(exportResult.data);
  }

  @Get('costs/export/excel')
  @Roles('owner', 'manager', 'viewer')
  async exportCostReportExcel(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    
    const report = await this.reportService.generateCostReport({ startDate, endDate });
    const exportResult = this.exportService.exportCostReportToExcel(report);
    
    res.set({
      'Content-Type': exportResult.contentType,
      'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
    });
    
    return new StreamableFile(exportResult.data);
  }

  @Get('costs/by-field/:fieldId/export/csv')
  @Roles('owner', 'manager', 'viewer')
  async exportCostReportByFieldCSV(
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    
    const report = await this.reportService.generateCostReportByField(fieldId, { startDate, endDate });
    const exportResult = this.exportService.exportCostReportToCSV(report);
    
    res.set({
      'Content-Type': exportResult.contentType,
      'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
    });
    
    return new StreamableFile(exportResult.data);
  }

  @Get('costs/by-category/:category/export/csv')
  @Roles('owner', 'manager', 'viewer')
  async exportCostReportByCategoryCSV(
    @Param('category') category: ExpenseCategory,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    
    const validCategories = Object.values(ExpenseCategory);
    if (!validCategories.includes(category)) {
      throw new BadRequestException(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }
    
    const report = await this.reportService.generateCostReportByCategory(category, { startDate, endDate });
    const exportResult = this.exportService.exportCostReportToCSV(report);
    
    res.set({
      'Content-Type': exportResult.contentType,
      'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
    });
    
    return new StreamableFile(exportResult.data);
  }
}

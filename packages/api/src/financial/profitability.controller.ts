import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ProfitabilityService, ProfitabilityAnalysisService } from './profitability.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('profitability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProfitabilityController {
  constructor(
    private readonly profitabilityService: ProfitabilityService,
    private readonly profitabilityAnalysisService: ProfitabilityAnalysisService,
  ) {}

  @Get('field/:fieldId')
  @Roles('owner', 'manager', 'viewer')
  async getProfitLossByField(
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.profitabilityService.getProfitLossByField(fieldId, { startDate, endDate });
  }

  @Get('all-fields')
  @Roles('owner', 'manager', 'viewer')
  async getProfitLossAllFields(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.profitabilityService.getProfitLossAllFields({ startDate, endDate });
  }

  @Get('crop/:cropType')
  @Roles('owner', 'manager', 'viewer')
  async getProfitLossByCrop(
    @Param('cropType') cropType: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.profitabilityService.getProfitLossByCrop(cropType, { startDate, endDate });
  }


  @Get('all-crops')
  @Roles('owner', 'manager', 'viewer')
  async getProfitLossAllCrops(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.profitabilityService.getProfitLossAllCrops({ startDate, endDate });
  }

  @Get('analysis/roi-by-zone')
  @Roles('owner', 'manager', 'viewer')
  async getROIByZone(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.profitabilityAnalysisService.getROIByZone({ startDate, endDate });
  }

  @Get('analysis/season-comparisons')
  @Roles('owner', 'manager', 'viewer')
  async getSeasonComparisons(
    @Query('years') yearsParam: string,
  ) {
    if (!yearsParam) {
      throw new BadRequestException('years query parameter is required (comma-separated list of years)');
    }
    const years = yearsParam.split(',').map((y: string) => parseInt(y.trim(), 10));
    if (years.some(isNaN)) {
      throw new BadRequestException('years must be a comma-separated list of valid years');
    }
    return this.profitabilityAnalysisService.getSeasonComparisons(years);
  }

  @Get('analysis/break-even')
  @Roles('owner', 'manager', 'viewer')
  async getBreakEvenAnalysis(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    return this.profitabilityAnalysisService.getBreakEvenAnalysis({ startDate, endDate });
  }

  @Get('analysis/full')
  @Roles('owner', 'manager', 'viewer')
  async getFullAnalysis(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('comparisonYears') comparisonYearsParam?: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate query parameters are required');
    }
    
    let comparisonYears: number[] | undefined;
    if (comparisonYearsParam) {
      comparisonYears = comparisonYearsParam.split(',').map((y: string) => parseInt(y.trim(), 10));
      if (comparisonYears.some(isNaN)) {
        throw new BadRequestException('comparisonYears must be a comma-separated list of valid years');
      }
    }
    
    return this.profitabilityAnalysisService.getFullAnalysis(
      { startDate, endDate },
      comparisonYears,
    );
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ProfitLossResult {
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number | null;
  revenuePerAcre: number | null;
  costPerAcre: number | null;
  profitPerAcre: number | null;
  acreage: number | null;
}

export interface FieldProfitLoss extends ProfitLossResult {
  fieldId: string;
  fieldName: string;
}

export interface CropProfitLoss extends ProfitLossResult {
  cropType: string;
}

@Injectable()
export class ProfitabilityService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Calculate profit/loss for a specific field
   */
  async getProfitLossByField(fieldId: string, dateRange: DateRange): Promise<FieldProfitLoss> {
    const farmId = this.getFarmId();

    // Get field with acreage
    const field = await this.prisma.field.findFirst({
      where: { id: fieldId, farmId },
      select: { id: true, name: true, acreage: true },
    });

    if (!field) {
      throw new NotFoundException(`Field with ID '${fieldId}' not found`);
    }

    // Get total revenue for the field
    const revenues = await this.prisma.revenue.findMany({
      where: {
        farmId,
        fieldId,
        saleDate: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
    });

    let totalRevenue = 0;
    for (const revenue of revenues) {
      totalRevenue += Number(revenue.totalAmount);
    }

    // Get total costs for the field
    const expenses = await this.prisma.expense.findMany({
      where: {
        farmId,
        fieldId,
        date: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
    });

    let totalCosts = 0;
    for (const expense of expenses) {
      totalCosts += Number(expense.amount);
    }

    // Calculate profit/loss
    const netProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null;

    // Calculate per-acre metrics
    const acreage = field.acreage ? Number(field.acreage) : null;
    let revenuePerAcre: number | null = null;
    let costPerAcre: number | null = null;
    let profitPerAcre: number | null = null;

    if (acreage && acreage > 0) {
      revenuePerAcre = totalRevenue / acreage;
      costPerAcre = totalCosts / acreage;
      profitPerAcre = netProfit / acreage;
    }

    return {
      fieldId: field.id,
      fieldName: field.name,
      totalRevenue,
      totalCosts,
      netProfit,
      profitMargin,
      revenuePerAcre,
      costPerAcre,
      profitPerAcre,
      acreage,
    };
  }


  /**
   * Calculate profit/loss for all fields
   */
  async getProfitLossAllFields(dateRange: DateRange): Promise<{
    fields: FieldProfitLoss[];
    totals: ProfitLossResult;
  }> {
    const farmId = this.getFarmId();

    // Get all fields
    const fields = await this.prisma.field.findMany({
      where: { farmId },
      select: { id: true, name: true, acreage: true },
    });

    const fieldResults: FieldProfitLoss[] = [];
    let totalRevenue = 0;
    let totalCosts = 0;
    let totalAcreage = 0;

    for (const field of fields) {
      const result = await this.getProfitLossByField(field.id, dateRange);
      fieldResults.push(result);
      totalRevenue += result.totalRevenue;
      totalCosts += result.totalCosts;
      if (result.acreage) {
        totalAcreage += result.acreage;
      }
    }

    const netProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null;

    let revenuePerAcre: number | null = null;
    let costPerAcre: number | null = null;
    let profitPerAcre: number | null = null;

    if (totalAcreage > 0) {
      revenuePerAcre = totalRevenue / totalAcreage;
      costPerAcre = totalCosts / totalAcreage;
      profitPerAcre = netProfit / totalAcreage;
    }

    return {
      fields: fieldResults,
      totals: {
        totalRevenue,
        totalCosts,
        netProfit,
        profitMargin,
        revenuePerAcre,
        costPerAcre,
        profitPerAcre,
        acreage: totalAcreage || null,
      },
    };
  }

  /**
   * Calculate profit/loss by crop type
   */
  async getProfitLossByCrop(cropType: string, dateRange: DateRange): Promise<CropProfitLoss> {
    const farmId = this.getFarmId();

    // Get total revenue for the crop type
    const revenues = await this.prisma.revenue.findMany({
      where: {
        farmId,
        cropType,
        saleDate: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
    });

    let totalRevenue = 0;
    for (const revenue of revenues) {
      totalRevenue += Number(revenue.totalAmount);
    }

    // Get total costs for the crop type
    const expenses = await this.prisma.expense.findMany({
      where: {
        farmId,
        cropType,
        date: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
    });

    let totalCosts = 0;
    for (const expense of expenses) {
      totalCosts += Number(expense.amount);
    }

    // Get acreage from plantings
    const plantings = await this.prisma.planting.findMany({
      where: {
        farmId,
        cropType,
        plantingDate: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
      select: { acreage: true },
    });

    let totalAcreage = 0;
    for (const planting of plantings) {
      if (planting.acreage) {
        totalAcreage += Number(planting.acreage);
      }
    }

    // Calculate profit/loss
    const netProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null;

    let revenuePerAcre: number | null = null;
    let costPerAcre: number | null = null;
    let profitPerAcre: number | null = null;

    if (totalAcreage > 0) {
      revenuePerAcre = totalRevenue / totalAcreage;
      costPerAcre = totalCosts / totalAcreage;
      profitPerAcre = netProfit / totalAcreage;
    }

    return {
      cropType,
      totalRevenue,
      totalCosts,
      netProfit,
      profitMargin,
      revenuePerAcre,
      costPerAcre,
      profitPerAcre,
      acreage: totalAcreage || null,
    };
  }

  /**
   * Calculate profit/loss for all crop types
   */
  async getProfitLossAllCrops(dateRange: DateRange): Promise<{
    crops: CropProfitLoss[];
    totals: ProfitLossResult;
  }> {
    const farmId = this.getFarmId();

    // Get all unique crop types from revenues and expenses
    const revenuesCrops = await this.prisma.revenue.findMany({
      where: {
        farmId,
        saleDate: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
      select: { cropType: true },
      distinct: ['cropType'],
    });

    const expensesCrops = await this.prisma.expense.findMany({
      where: {
        farmId,
        cropType: { not: null },
        date: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
      select: { cropType: true },
      distinct: ['cropType'],
    });

    const cropTypes = new Set<string>();
    revenuesCrops.forEach(r => cropTypes.add(r.cropType));
    expensesCrops.forEach(e => {
      if (e.cropType) cropTypes.add(e.cropType);
    });

    const cropResults: CropProfitLoss[] = [];
    let totalRevenue = 0;
    let totalCosts = 0;
    let totalAcreage = 0;

    for (const cropType of cropTypes) {
      const result = await this.getProfitLossByCrop(cropType, dateRange);
      cropResults.push(result);
      totalRevenue += result.totalRevenue;
      totalCosts += result.totalCosts;
      if (result.acreage) {
        totalAcreage += result.acreage;
      }
    }

    const netProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null;

    let revenuePerAcre: number | null = null;
    let costPerAcre: number | null = null;
    let profitPerAcre: number | null = null;

    if (totalAcreage > 0) {
      revenuePerAcre = totalRevenue / totalAcreage;
      costPerAcre = totalCosts / totalAcreage;
      profitPerAcre = netProfit / totalAcreage;
    }

    return {
      crops: cropResults,
      totals: {
        totalRevenue,
        totalCosts,
        netProfit,
        profitMargin,
        revenuePerAcre,
        costPerAcre,
        profitPerAcre,
        acreage: totalAcreage || null,
      },
    };
  }
}


export interface ZoneROI {
  zoneId: string;
  zoneName: string;
  fieldId: string;
  fieldName: string;
  investment: number;
  returns: number;
  roi: number | null;
  acreage: number | null;
}

export interface SeasonComparison {
  season: string;
  year: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number | null;
  changeFromPrevious: number | null;
}

export interface BreakEvenAnalysis {
  cropType: string;
  totalCosts: number;
  totalQuantitySold: number;
  unit: string;
  breakEvenPrice: number | null;
  currentAveragePrice: number | null;
  priceMargin: number | null;
}

export interface ProfitabilityAnalysis {
  roiByZone: ZoneROI[];
  seasonComparisons: SeasonComparison[];
  breakEvenAnalysis: BreakEvenAnalysis[];
}

@Injectable()
export class ProfitabilityAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Calculate ROI by zone
   */
  async getROIByZone(dateRange: DateRange): Promise<ZoneROI[]> {
    const farmId = this.getFarmId();

    // Get all zones with their fields
    const zones = await this.prisma.zone.findMany({
      where: {
        field: { farmId },
      },
      include: {
        field: { select: { id: true, name: true, farmId: true } },
      },
    });

    const results: ZoneROI[] = [];

    for (const zone of zones) {
      // Get harvests for this zone
      const harvests = await this.prisma.harvest.findMany({
        where: {
          farmId,
          zoneId: zone.id,
          harvestDate: {
            gte: new Date(dateRange.startDate),
            lte: new Date(dateRange.endDate),
          },
        },
        select: { id: true },
      });

      const harvestIds = harvests.map(h => h.id);

      // Get revenues linked to these harvests
      const revenues = await this.prisma.revenue.findMany({
        where: {
          farmId,
          harvestId: { in: harvestIds },
        },
      });

      let returns = 0;
      for (const revenue of revenues) {
        returns += Number(revenue.totalAmount);
      }

      // Get resource applications for this zone as investment
      const resourceApps = await this.prisma.resourceApplication.findMany({
        where: {
          farmId,
          zoneId: zone.id,
          date: {
            gte: new Date(dateRange.startDate),
            lte: new Date(dateRange.endDate),
          },
        },
      });

      // Estimate investment from resource applications (simplified)
      // In a real system, you'd have cost data for each resource type
      let investment = 0;
      for (const app of resourceApps) {
        // Simplified: assume $10 per unit as placeholder
        investment += Number(app.quantity) * 10;
      }

      // Calculate ROI
      let roi: number | null = null;
      if (investment > 0) {
        roi = ((returns - investment) / investment) * 100;
      }

      results.push({
        zoneId: zone.id,
        zoneName: zone.name,
        fieldId: zone.field.id,
        fieldName: zone.field.name,
        investment,
        returns,
        roi,
        acreage: zone.acreage ? Number(zone.acreage) : null,
      });
    }

    return results;
  }

  /**
   * Generate season-over-season comparisons
   */
  async getSeasonComparisons(years: number[]): Promise<SeasonComparison[]> {
    const farmId = this.getFarmId();
    const results: SeasonComparison[] = [];

    // Define seasons (simplified: spring, summer, fall, winter)
    const seasons = [
      { name: 'Spring', startMonth: 3, endMonth: 5 },
      { name: 'Summer', startMonth: 6, endMonth: 8 },
      { name: 'Fall', startMonth: 9, endMonth: 11 },
      { name: 'Winter', startMonth: 12, endMonth: 2 },
    ];

    let previousProfit: number | null = null;

    for (const year of years.sort()) {
      for (const season of seasons) {
        let startDate: Date;
        let endDate: Date;

        if (season.name === 'Winter') {
          // Winter spans two years
          startDate = new Date(year - 1, 11, 1); // December of previous year
          endDate = new Date(year, 1, 28); // February of current year
        } else {
          startDate = new Date(year, season.startMonth - 1, 1);
          endDate = new Date(year, season.endMonth, 0); // Last day of end month
        }

        // Get revenues for this season
        const revenues = await this.prisma.revenue.findMany({
          where: {
            farmId,
            saleDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        });

        let totalRevenue = 0;
        for (const revenue of revenues) {
          totalRevenue += Number(revenue.totalAmount);
        }

        // Get expenses for this season
        const expenses = await this.prisma.expense.findMany({
          where: {
            farmId,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        });

        let totalCosts = 0;
        for (const expense of expenses) {
          totalCosts += Number(expense.amount);
        }

        const netProfit = totalRevenue - totalCosts;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null;

        let changeFromPrevious: number | null = null;
        if (previousProfit !== null && previousProfit !== 0) {
          changeFromPrevious = ((netProfit - previousProfit) / Math.abs(previousProfit)) * 100;
        }

        results.push({
          season: season.name,
          year,
          totalRevenue,
          totalCosts,
          netProfit,
          profitMargin,
          changeFromPrevious,
        });

        previousProfit = netProfit;
      }
    }

    return results;
  }

  /**
   * Calculate break-even price for each crop type
   */
  async getBreakEvenAnalysis(dateRange: DateRange): Promise<BreakEvenAnalysis[]> {
    const farmId = this.getFarmId();

    // Get all unique crop types from revenues
    const revenuesCrops = await this.prisma.revenue.findMany({
      where: {
        farmId,
        saleDate: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
      select: { cropType: true },
      distinct: ['cropType'],
    });

    const results: BreakEvenAnalysis[] = [];

    for (const { cropType } of revenuesCrops) {
      // Get total costs for this crop
      const expenses = await this.prisma.expense.findMany({
        where: {
          farmId,
          cropType,
          date: {
            gte: new Date(dateRange.startDate),
            lte: new Date(dateRange.endDate),
          },
        },
      });

      let totalCosts = 0;
      for (const expense of expenses) {
        totalCosts += Number(expense.amount);
      }

      // Get total quantity sold and average price
      const revenues = await this.prisma.revenue.findMany({
        where: {
          farmId,
          cropType,
          saleDate: {
            gte: new Date(dateRange.startDate),
            lte: new Date(dateRange.endDate),
          },
        },
      });

      let totalQuantitySold = 0;
      let totalRevenueAmount = 0;
      let unit = '';

      for (const revenue of revenues) {
        totalQuantitySold += Number(revenue.quantity);
        totalRevenueAmount += Number(revenue.totalAmount);
        unit = revenue.unit; // Use the last unit (assuming consistent units)
      }

      // Calculate break-even price
      let breakEvenPrice: number | null = null;
      let currentAveragePrice: number | null = null;
      let priceMargin: number | null = null;

      if (totalQuantitySold > 0) {
        breakEvenPrice = totalCosts / totalQuantitySold;
        currentAveragePrice = totalRevenueAmount / totalQuantitySold;
        
        if (breakEvenPrice > 0) {
          priceMargin = ((currentAveragePrice - breakEvenPrice) / breakEvenPrice) * 100;
        }
      }

      results.push({
        cropType,
        totalCosts,
        totalQuantitySold,
        unit,
        breakEvenPrice,
        currentAveragePrice,
        priceMargin,
      });
    }

    return results;
  }

  /**
   * Get complete profitability analysis
   */
  async getFullAnalysis(dateRange: DateRange, comparisonYears?: number[]): Promise<ProfitabilityAnalysis> {
    const roiByZone = await this.getROIByZone(dateRange);
    
    // Default to current year and previous year if not specified
    const years = comparisonYears ?? [
      new Date().getFullYear() - 1,
      new Date().getFullYear(),
    ];
    const seasonComparisons = await this.getSeasonComparisons(years);
    
    const breakEvenAnalysis = await this.getBreakEvenAnalysis(dateRange);

    return {
      roiByZone,
      seasonComparisons,
      breakEvenAnalysis,
    };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { CreateRevenueDto, UpdateRevenueDto } from './dto/revenue.dto';

export interface RevenueFilters {
  fieldId?: string;
  harvestId?: string;
  cropType?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class RevenueService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  async create(dto: CreateRevenueDto) {
    const farmId = this.getFarmId();

    // Validate field exists and belongs to tenant
    const field = await this.prisma.field.findFirst({
      where: { id: dto.fieldId, farmId },
    });

    if (!field) {
      throw new BadRequestException(
        `Field with ID '${dto.fieldId}' not found or does not belong to this farm`,
      );
    }

    // Validate harvest exists and belongs to the farm if provided
    if (dto.harvestId) {
      const harvest = await this.prisma.harvest.findFirst({
        where: { id: dto.harvestId, farmId },
      });

      if (!harvest) {
        throw new BadRequestException(
          `Harvest with ID '${dto.harvestId}' not found or does not belong to this farm`,
        );
      }
    }

    // Calculate total amount
    const totalAmount = dto.quantity * dto.pricePerUnit;

    return this.prisma.revenue.create({
      data: {
        farmId,
        harvestId: dto.harvestId,
        fieldId: dto.fieldId,
        cropType: dto.cropType,
        quantity: dto.quantity,
        unit: dto.unit,
        pricePerUnit: dto.pricePerUnit,
        totalAmount,
        currency: dto.currency ?? 'USD',
        saleDate: new Date(dto.saleDate),
        buyer: dto.buyer,
        notes: dto.notes,
      },
      include: {
        field: { select: { id: true, name: true } },
        harvest: { select: { id: true, cropType: true, harvestDate: true } },
      },
    });
  }


  async findAll(filters?: RevenueFilters) {
    const farmId = this.getFarmId();

    const where: Record<string, unknown> = { farmId };

    if (filters?.fieldId) {
      where.fieldId = filters.fieldId;
    }

    if (filters?.harvestId) {
      where.harvestId = filters.harvestId;
    }

    if (filters?.cropType) {
      where.cropType = filters.cropType;
    }

    if (filters?.startDate || filters?.endDate) {
      where.saleDate = {};
      if (filters.startDate) {
        (where.saleDate as Record<string, Date>).gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        (where.saleDate as Record<string, Date>).lte = new Date(filters.endDate);
      }
    }

    return this.prisma.revenue.findMany({
      where,
      orderBy: { saleDate: 'desc' },
      include: {
        field: { select: { id: true, name: true } },
        harvest: { select: { id: true, cropType: true, harvestDate: true } },
      },
    });
  }

  async findOne(id: string) {
    const farmId = this.getFarmId();

    const revenue = await this.prisma.revenue.findFirst({
      where: { id, farmId },
      include: {
        field: { select: { id: true, name: true } },
        harvest: { select: { id: true, cropType: true, harvestDate: true } },
      },
    });

    if (!revenue) {
      throw new NotFoundException(`Revenue with ID '${id}' not found`);
    }

    return revenue;
  }

  async update(id: string, dto: UpdateRevenueDto) {
    const farmId = this.getFarmId();

    // Verify revenue exists and belongs to tenant
    const existing = await this.prisma.revenue.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Revenue with ID '${id}' not found`);
    }

    // Validate field if being updated
    if (dto.fieldId && dto.fieldId !== existing.fieldId) {
      const field = await this.prisma.field.findFirst({
        where: { id: dto.fieldId, farmId },
      });

      if (!field) {
        throw new BadRequestException(
          `Field with ID '${dto.fieldId}' not found or does not belong to this farm`,
        );
      }
    }

    // Validate harvest if being updated
    if (dto.harvestId && dto.harvestId !== existing.harvestId) {
      const harvest = await this.prisma.harvest.findFirst({
        where: { id: dto.harvestId, farmId },
      });

      if (!harvest) {
        throw new BadRequestException(
          `Harvest with ID '${dto.harvestId}' not found or does not belong to this farm`,
        );
      }
    }

    // Calculate total amount if quantity or pricePerUnit is updated
    const quantity = dto.quantity ?? Number(existing.quantity);
    const pricePerUnit = dto.pricePerUnit ?? Number(existing.pricePerUnit);
    const totalAmount = quantity * pricePerUnit;

    return this.prisma.revenue.update({
      where: { id },
      data: {
        harvestId: dto.harvestId,
        fieldId: dto.fieldId,
        cropType: dto.cropType,
        quantity: dto.quantity,
        unit: dto.unit,
        pricePerUnit: dto.pricePerUnit,
        totalAmount,
        currency: dto.currency,
        saleDate: dto.saleDate ? new Date(dto.saleDate) : undefined,
        buyer: dto.buyer,
        notes: dto.notes,
      },
      include: {
        field: { select: { id: true, name: true } },
        harvest: { select: { id: true, cropType: true, harvestDate: true } },
      },
    });
  }

  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    // Verify revenue exists and belongs to tenant
    const existing = await this.prisma.revenue.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Revenue with ID '${id}' not found`);
    }

    await this.prisma.revenue.delete({
      where: { id },
    });
  }
}


export interface RevenueBreakdown {
  totalRevenue: number;
  revenuePerAcre: number | null;
  acreage: number | null;
  byCrop: Record<string, number>;
  warning?: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

@Injectable()
export class RevenueCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Calculate revenue per acre for a specific field within a date range
   */
  async getRevenuePerAcre(fieldId: string, dateRange: DateRange): Promise<RevenueBreakdown> {
    const farmId = this.getFarmId();

    // Get field with acreage
    const field = await this.prisma.field.findFirst({
      where: { id: fieldId, farmId },
      select: { id: true, acreage: true },
    });

    if (!field) {
      throw new NotFoundException(`Field with ID '${fieldId}' not found`);
    }

    // Get all revenues for the field within date range
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

    // Calculate total revenue and breakdown by crop
    const byCrop: Record<string, number> = {};
    let totalRevenue = 0;

    for (const revenue of revenues) {
      const amount = Number(revenue.totalAmount);
      totalRevenue += amount;
      
      const cropType = revenue.cropType;
      byCrop[cropType] = (byCrop[cropType] || 0) + amount;
    }

    // Handle zero acreage edge case
    const acreage = field.acreage ? Number(field.acreage) : null;
    let revenuePerAcre: number | null = null;
    let warning: string | undefined;

    if (acreage === null || acreage === 0) {
      warning = 'Revenue per acre cannot be calculated: field acreage is zero or not set';
    } else {
      revenuePerAcre = totalRevenue / acreage;
    }

    return {
      totalRevenue,
      revenuePerAcre,
      acreage,
      byCrop,
      warning,
    };
  }

  /**
   * Calculate revenue per acre for all fields in the farm
   */
  async getRevenuePerAcreAllFields(dateRange: DateRange): Promise<Array<{
    fieldId: string;
    fieldName: string;
    revenueBreakdown: RevenueBreakdown;
  }>> {
    const farmId = this.getFarmId();

    // Get all fields for the farm
    const fields = await this.prisma.field.findMany({
      where: { farmId },
      select: { id: true, name: true, acreage: true },
    });

    const results = [];

    for (const field of fields) {
      // Get revenues for this field
      const revenues = await this.prisma.revenue.findMany({
        where: {
          farmId,
          fieldId: field.id,
          saleDate: {
            gte: new Date(dateRange.startDate),
            lte: new Date(dateRange.endDate),
          },
        },
      });

      const byCrop: Record<string, number> = {};
      let totalRevenue = 0;

      for (const revenue of revenues) {
        const amount = Number(revenue.totalAmount);
        totalRevenue += amount;
        
        const cropType = revenue.cropType;
        byCrop[cropType] = (byCrop[cropType] || 0) + amount;
      }

      const acreage = field.acreage ? Number(field.acreage) : null;
      let revenuePerAcre: number | null = null;
      let warning: string | undefined;

      if (acreage === null || acreage === 0) {
        warning = 'Revenue per acre cannot be calculated: field acreage is zero or not set';
      } else {
        revenuePerAcre = totalRevenue / acreage;
      }

      results.push({
        fieldId: field.id,
        fieldName: field.name,
        revenueBreakdown: {
          totalRevenue,
          revenuePerAcre,
          acreage,
          byCrop,
          warning,
        },
      });
    }

    return results;
  }

  /**
   * Calculate revenue per acre by crop type
   */
  async getRevenuePerAcreByCrop(cropType: string, dateRange: DateRange): Promise<RevenueBreakdown> {
    const farmId = this.getFarmId();

    // Get all revenues for the crop type within date range
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

    // Calculate total revenue
    let totalRevenue = 0;
    for (const revenue of revenues) {
      totalRevenue += Number(revenue.totalAmount);
    }

    // Get total acreage from plantings for this crop type
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

    let revenuePerAcre: number | null = null;
    let warning: string | undefined;

    if (totalAcreage === 0) {
      warning = 'Revenue per acre cannot be calculated: no planting acreage found for this crop type';
    } else {
      revenuePerAcre = totalRevenue / totalAcreage;
    }

    return {
      totalRevenue,
      revenuePerAcre,
      acreage: totalAcreage || null,
      byCrop: { [cropType]: totalRevenue },
      warning,
    };
  }

  /**
   * Calculate revenue per zone
   */
  async getRevenuePerZone(zoneId: string, dateRange: DateRange): Promise<RevenueBreakdown> {
    const farmId = this.getFarmId();

    // Get zone with acreage
    const zone = await this.prisma.zone.findFirst({
      where: { id: zoneId },
      include: { field: { select: { farmId: true } } },
    });

    if (!zone || zone.field.farmId !== farmId) {
      throw new NotFoundException(`Zone with ID '${zoneId}' not found`);
    }

    // Get harvests for this zone
    const harvests = await this.prisma.harvest.findMany({
      where: {
        farmId,
        zoneId,
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

    const byCrop: Record<string, number> = {};
    let totalRevenue = 0;

    for (const revenue of revenues) {
      const amount = Number(revenue.totalAmount);
      totalRevenue += amount;
      
      const cropType = revenue.cropType;
      byCrop[cropType] = (byCrop[cropType] || 0) + amount;
    }

    const acreage = zone.acreage ? Number(zone.acreage) : null;
    let revenuePerAcre: number | null = null;
    let warning: string | undefined;

    if (acreage === null || acreage === 0) {
      warning = 'Revenue per acre cannot be calculated: zone acreage is zero or not set';
    } else {
      revenuePerAcre = totalRevenue / acreage;
    }

    return {
      totalRevenue,
      revenuePerAcre,
      acreage,
      byCrop,
      warning,
    };
  }
}

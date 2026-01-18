import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { ExpenseCategory } from '@prisma/client';

export interface ExpenseFilters {
  fieldId?: string;
  category?: ExpenseCategory;
  cropType?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  private getUserId(): string {
    return TenantContext.getUserId();
  }

  async create(dto: CreateExpenseDto) {
    const farmId = this.getFarmId();
    const userId = this.getUserId();

    // Validate that at least one association exists (field or cropType)
    if (!dto.fieldId && !dto.cropType) {
      throw new BadRequestException(
        'Expense must have at least one association: fieldId or cropType',
      );
    }

    // Validate field exists and belongs to tenant if provided
    if (dto.fieldId) {
      const field = await this.prisma.field.findFirst({
        where: { id: dto.fieldId, farmId },
      });

      if (!field) {
        throw new BadRequestException(
          `Field with ID '${dto.fieldId}' not found or does not belong to this farm`,
        );
      }
    }

    return this.prisma.expense.create({
      data: {
        farmId,
        category: dto.category,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        date: new Date(dto.date),
        description: dto.description,
        fieldId: dto.fieldId,
        cropType: dto.cropType,
        vendor: dto.vendor,
        receiptUrl: dto.receiptUrl,
        createdBy: userId,
      },
      include: {
        field: {
          select: { id: true, name: true },
        },
      },
    });
  }


  async findAll(filters?: ExpenseFilters) {
    const farmId = this.getFarmId();

    const where: Record<string, unknown> = { farmId };

    if (filters?.fieldId) {
      where.fieldId = filters.fieldId;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.cropType) {
      where.cropType = filters.cropType;
    }

    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) {
        (where.date as Record<string, Date>).gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        (where.date as Record<string, Date>).lte = new Date(filters.endDate);
      }
    }

    return this.prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        field: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const farmId = this.getFarmId();

    const expense = await this.prisma.expense.findFirst({
      where: { id, farmId },
      include: {
        field: {
          select: { id: true, name: true },
        },
      },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with ID '${id}' not found`);
    }

    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto) {
    const farmId = this.getFarmId();

    // Verify expense exists and belongs to tenant
    const existing = await this.prisma.expense.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Expense with ID '${id}' not found`);
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

    // Ensure at least one association remains after update
    const newFieldId = dto.fieldId !== undefined ? dto.fieldId : existing.fieldId;
    const newCropType = dto.cropType !== undefined ? dto.cropType : existing.cropType;
    
    if (!newFieldId && !newCropType) {
      throw new BadRequestException(
        'Expense must have at least one association: fieldId or cropType',
      );
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        category: dto.category,
        amount: dto.amount,
        currency: dto.currency,
        date: dto.date ? new Date(dto.date) : undefined,
        description: dto.description,
        fieldId: dto.fieldId,
        cropType: dto.cropType,
        vendor: dto.vendor,
        receiptUrl: dto.receiptUrl,
      },
      include: {
        field: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    // Verify expense exists and belongs to tenant
    const existing = await this.prisma.expense.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Expense with ID '${id}' not found`);
    }

    await this.prisma.expense.delete({
      where: { id },
    });
  }
}


export interface CostBreakdown {
  totalCost: number;
  costPerAcre: number | null;
  acreage: number | null;
  byCategory: Record<string, number>;
  warning?: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

@Injectable()
export class CostCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Calculate cost per acre for a specific field within a date range
   * Handles zero acreage edge case by returning null for costPerAcre
   */
  async getCostPerAcre(fieldId: string, dateRange: DateRange): Promise<CostBreakdown> {
    const farmId = this.getFarmId();

    // Get field with acreage
    const field = await this.prisma.field.findFirst({
      where: { id: fieldId, farmId },
      select: { id: true, acreage: true },
    });

    if (!field) {
      throw new NotFoundException(`Field with ID '${fieldId}' not found`);
    }

    // Get all expenses for the field within date range
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

    // Calculate total cost and breakdown by category
    const byCategory: Record<string, number> = {};
    let totalCost = 0;

    for (const expense of expenses) {
      const amount = Number(expense.amount);
      totalCost += amount;
      
      const category = expense.category;
      byCategory[category] = (byCategory[category] || 0) + amount;
    }

    // Handle zero acreage edge case
    const acreage = field.acreage ? Number(field.acreage) : null;
    let costPerAcre: number | null = null;
    let warning: string | undefined;

    if (acreage === null || acreage === 0) {
      warning = 'Cost per acre cannot be calculated: field acreage is zero or not set';
    } else {
      costPerAcre = totalCost / acreage;
    }

    return {
      totalCost,
      costPerAcre,
      acreage,
      byCategory,
      warning,
    };
  }

  /**
   * Calculate cost per acre for all fields in the farm
   */
  async getCostPerAcreAllFields(dateRange: DateRange): Promise<Array<{
    fieldId: string;
    fieldName: string;
    costBreakdown: CostBreakdown;
  }>> {
    const farmId = this.getFarmId();

    // Get all fields for the farm
    const fields = await this.prisma.field.findMany({
      where: { farmId },
      select: { id: true, name: true, acreage: true },
    });

    const results = [];

    for (const field of fields) {
      // Get expenses for this field
      const expenses = await this.prisma.expense.findMany({
        where: {
          farmId,
          fieldId: field.id,
          date: {
            gte: new Date(dateRange.startDate),
            lte: new Date(dateRange.endDate),
          },
        },
      });

      const byCategory: Record<string, number> = {};
      let totalCost = 0;

      for (const expense of expenses) {
        const amount = Number(expense.amount);
        totalCost += amount;
        
        const category = expense.category;
        byCategory[category] = (byCategory[category] || 0) + amount;
      }

      const acreage = field.acreage ? Number(field.acreage) : null;
      let costPerAcre: number | null = null;
      let warning: string | undefined;

      if (acreage === null || acreage === 0) {
        warning = 'Cost per acre cannot be calculated: field acreage is zero or not set';
      } else {
        costPerAcre = totalCost / acreage;
      }

      results.push({
        fieldId: field.id,
        fieldName: field.name,
        costBreakdown: {
          totalCost,
          costPerAcre,
          acreage,
          byCategory,
          warning,
        },
      });
    }

    return results;
  }

  /**
   * Calculate cost per acre by crop type
   */
  async getCostPerAcreByCrop(cropType: string, dateRange: DateRange): Promise<CostBreakdown> {
    const farmId = this.getFarmId();

    // Get all expenses for the crop type within date range
    const expenses = await this.prisma.expense.findMany({
      where: {
        farmId,
        cropType,
        date: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
      include: {
        field: {
          select: { acreage: true },
        },
      },
    });

    // Calculate total cost and breakdown by category
    const byCategory: Record<string, number> = {};
    let totalCost = 0;
    const fieldIds = new Set<string>();

    for (const expense of expenses) {
      const amount = Number(expense.amount);
      totalCost += amount;
      
      const category = expense.category;
      byCategory[category] = (byCategory[category] || 0) + amount;
      
      if (expense.fieldId) {
        fieldIds.add(expense.fieldId);
      }
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

    let costPerAcre: number | null = null;
    let warning: string | undefined;

    if (totalAcreage === 0) {
      warning = 'Cost per acre cannot be calculated: no planting acreage found for this crop type';
    } else {
      costPerAcre = totalCost / totalAcreage;
    }

    return {
      totalCost,
      costPerAcre,
      acreage: totalAcreage || null,
      byCategory,
      warning,
    };
  }
}

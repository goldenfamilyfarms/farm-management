import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { ExpenseCategory } from '@prisma/client';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface CategoryBreakdown {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
  count: number;
}

export interface FieldBreakdown {
  fieldId: string;
  fieldName: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface TimePeriodBreakdown {
  period: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface CostReport {
  reportId: string;
  generatedAt: Date;
  dateRange: DateRange;
  totalCost: number;
  totalExpenseCount: number;
  byCategory: CategoryBreakdown[];
  byField: FieldBreakdown[];
  byTimePeriod: TimePeriodBreakdown[];
  expenses: ExpenseDetail[];
}

export interface ExpenseDetail {
  id: string;
  date: Date;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  fieldId: string | null;
  fieldName: string | null;
  cropType: string | null;
  vendor: string | null;
}

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Generate a comprehensive cost report with itemized breakdowns
   */
  async generateCostReport(dateRange: DateRange): Promise<CostReport> {
    const farmId = this.getFarmId();

    // Get all expenses within date range
    const expenses = await this.prisma.expense.findMany({
      where: {
        farmId,
        date: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
      include: {
        field: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    // Calculate total cost
    let totalCost = 0;
    for (const expense of expenses) {
      totalCost += Number(expense.amount);
    }

    // Generate breakdown by category
    const byCategory = this.generateCategoryBreakdown(expenses, totalCost);

    // Generate breakdown by field
    const byField = this.generateFieldBreakdown(expenses, totalCost);

    // Generate breakdown by time period (monthly)
    const byTimePeriod = this.generateTimePeriodBreakdown(expenses, totalCost, dateRange);

    // Map expenses to detail format
    const expenseDetails: ExpenseDetail[] = expenses.map(e => ({
      id: e.id,
      date: e.date,
      category: e.category,
      amount: Number(e.amount),
      description: e.description,
      fieldId: e.fieldId,
      fieldName: e.field?.name ?? null,
      cropType: e.cropType,
      vendor: e.vendor,
    }));

    return {
      reportId: `cost-report-${Date.now()}`,
      generatedAt: new Date(),
      dateRange,
      totalCost,
      totalExpenseCount: expenses.length,
      byCategory,
      byField,
      byTimePeriod,
      expenses: expenseDetails,
    };
  }


  private generateCategoryBreakdown(
    expenses: Array<{ category: ExpenseCategory; amount: unknown }>,
    totalCost: number,
  ): CategoryBreakdown[] {
    const categoryMap = new Map<ExpenseCategory, { amount: number; count: number }>();

    for (const expense of expenses) {
      const current = categoryMap.get(expense.category) ?? { amount: 0, count: 0 };
      current.amount += Number(expense.amount);
      current.count += 1;
      categoryMap.set(expense.category, current);
    }

    const result: CategoryBreakdown[] = [];
    for (const [category, data] of categoryMap) {
      result.push({
        category,
        amount: data.amount,
        percentage: totalCost > 0 ? (data.amount / totalCost) * 100 : 0,
        count: data.count,
      });
    }

    // Sort by amount descending
    return result.sort((a, b) => b.amount - a.amount);
  }

  private generateFieldBreakdown(
    expenses: Array<{ fieldId: string | null; field: { id: string; name: string } | null; amount: unknown }>,
    totalCost: number,
  ): FieldBreakdown[] {
    const fieldMap = new Map<string, { name: string; amount: number; count: number }>();

    for (const expense of expenses) {
      if (expense.fieldId && expense.field) {
        const current = fieldMap.get(expense.fieldId) ?? { name: expense.field.name, amount: 0, count: 0 };
        current.amount += Number(expense.amount);
        current.count += 1;
        fieldMap.set(expense.fieldId, current);
      }
    }

    const result: FieldBreakdown[] = [];
    for (const [fieldId, data] of fieldMap) {
      result.push({
        fieldId,
        fieldName: data.name,
        amount: data.amount,
        percentage: totalCost > 0 ? (data.amount / totalCost) * 100 : 0,
        count: data.count,
      });
    }

    // Sort by amount descending
    return result.sort((a, b) => b.amount - a.amount);
  }

  private generateTimePeriodBreakdown(
    expenses: Array<{ date: Date; amount: unknown }>,
    totalCost: number,
    dateRange: DateRange,
  ): TimePeriodBreakdown[] {
    const periodMap = new Map<string, { amount: number; count: number }>();

    for (const expense of expenses) {
      const date = new Date(expense.date);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const current = periodMap.get(period) ?? { amount: 0, count: 0 };
      current.amount += Number(expense.amount);
      current.count += 1;
      periodMap.set(period, current);
    }

    const result: TimePeriodBreakdown[] = [];
    for (const [period, data] of periodMap) {
      result.push({
        period,
        amount: data.amount,
        percentage: totalCost > 0 ? (data.amount / totalCost) * 100 : 0,
        count: data.count,
      });
    }

    // Sort by period ascending
    return result.sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Generate cost report filtered by category
   */
  async generateCostReportByCategory(
    category: ExpenseCategory,
    dateRange: DateRange,
  ): Promise<CostReport> {
    const farmId = this.getFarmId();

    const expenses = await this.prisma.expense.findMany({
      where: {
        farmId,
        category,
        date: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
      include: {
        field: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    let totalCost = 0;
    for (const expense of expenses) {
      totalCost += Number(expense.amount);
    }

    const byCategory = this.generateCategoryBreakdown(expenses, totalCost);
    const byField = this.generateFieldBreakdown(expenses, totalCost);
    const byTimePeriod = this.generateTimePeriodBreakdown(expenses, totalCost, dateRange);

    const expenseDetails: ExpenseDetail[] = expenses.map(e => ({
      id: e.id,
      date: e.date,
      category: e.category,
      amount: Number(e.amount),
      description: e.description,
      fieldId: e.fieldId,
      fieldName: e.field?.name ?? null,
      cropType: e.cropType,
      vendor: e.vendor,
    }));

    return {
      reportId: `cost-report-${category}-${Date.now()}`,
      generatedAt: new Date(),
      dateRange,
      totalCost,
      totalExpenseCount: expenses.length,
      byCategory,
      byField,
      byTimePeriod,
      expenses: expenseDetails,
    };
  }

  /**
   * Generate cost report filtered by field
   */
  async generateCostReportByField(
    fieldId: string,
    dateRange: DateRange,
  ): Promise<CostReport> {
    const farmId = this.getFarmId();

    const expenses = await this.prisma.expense.findMany({
      where: {
        farmId,
        fieldId,
        date: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
      include: {
        field: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    let totalCost = 0;
    for (const expense of expenses) {
      totalCost += Number(expense.amount);
    }

    const byCategory = this.generateCategoryBreakdown(expenses, totalCost);
    const byField = this.generateFieldBreakdown(expenses, totalCost);
    const byTimePeriod = this.generateTimePeriodBreakdown(expenses, totalCost, dateRange);

    const expenseDetails: ExpenseDetail[] = expenses.map(e => ({
      id: e.id,
      date: e.date,
      category: e.category,
      amount: Number(e.amount),
      description: e.description,
      fieldId: e.fieldId,
      fieldName: e.field?.name ?? null,
      cropType: e.cropType,
      vendor: e.vendor,
    }));

    return {
      reportId: `cost-report-field-${fieldId}-${Date.now()}`,
      generatedAt: new Date(),
      dateRange,
      totalCost,
      totalExpenseCount: expenses.length,
      byCategory,
      byField,
      byTimePeriod,
      expenses: expenseDetails,
    };
  }
}

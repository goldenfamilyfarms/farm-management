import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { TimeCardStatus } from '@prisma/client';

export interface LaborCostByField {
  fieldId: string;
  fieldName: string;
  totalHours: number;
  totalCost: number;
  workerCount: number;
}

export interface LaborCostByTask {
  taskId: string;
  taskTitle: string;
  fieldId: string | null;
  fieldName: string | null;
  totalHours: number;
  totalCost: number;
  workerCount: number;
}

export interface LaborCostSummary {
  dateRange: { startDate: Date; endDate: Date };
  totalHours: number;
  totalCost: number;
  byField: LaborCostByField[];
  byTask: LaborCostByTask[];
}

/**
 * Service for aggregating labor costs from time cards
 * Links time cards to tasks and fields for cost allocation
 * Implements Requirements 5.4
 */
@Injectable()
export class LaborCostService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Get labor cost summary for a date range
   * Aggregates approved time card hours and calculates costs
   */
  async getLaborCostSummary(startDate: string, endDate: string): Promise<LaborCostSummary> {
    const farmId = this.getFarmId();
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all approved time cards within the date range
    const timeCards = await this.prisma.timeCard.findMany({
      where: {
        farmId,
        status: TimeCardStatus.approved,
        clockIn: {
          gte: start,
          lte: end,
        },
      },
      include: {
        worker: true,
      },
    });

    // Get all tasks with their field associations
    const tasks = await this.prisma.task.findMany({
      where: {
        farmId,
        status: 'completed',
        completedAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        field: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate total hours and cost from time cards
    let totalHours = 0;
    let totalCost = 0;

    for (const tc of timeCards) {
      const hours = tc.totalHours ? Number(tc.totalHours) : 0;
      const hourlyRate = tc.worker.hourlyRate ? Number(tc.worker.hourlyRate) : 0;
      totalHours += hours;
      totalCost += hours * hourlyRate;
    }

    // Aggregate labor costs by field from tasks
    const byField = await this.aggregateLaborCostByField(farmId, start, end);

    // Aggregate labor costs by task
    const byTask = await this.aggregateLaborCostByTask(farmId, start, end);

    return {
      dateRange: { startDate: start, endDate: end },
      totalHours: Number(totalHours.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      byField,
      byTask,
    };
  }

  /**
   * Aggregate labor costs by field
   * Uses task field associations to allocate labor costs
   */
  private async aggregateLaborCostByField(
    farmId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<LaborCostByField[]> {
    // Get completed tasks with actual hours and field associations
    const tasks = await this.prisma.task.findMany({
      where: {
        farmId,
        fieldId: { not: null },
        status: 'completed',
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        field: {
          select: { id: true, name: true },
        },
      },
    });

    // Get workers for hourly rate lookup
    const workers = await this.prisma.worker.findMany({
      where: { farmId },
    });
    const workerRateMap = new Map(
      workers.map(w => [w.id, w.hourlyRate ? Number(w.hourlyRate) : 0])
    );

    // Aggregate by field
    const fieldMap = new Map<string, {
      fieldId: string;
      fieldName: string;
      totalHours: number;
      totalCost: number;
      workers: Set<string>;
    }>();

    for (const task of tasks) {
      if (!task.fieldId || !task.field) continue;

      const hours = task.actualHours ? Number(task.actualHours) : 0;
      const existing = fieldMap.get(task.fieldId);

      // Estimate cost using average hourly rate if no specific worker
      const avgRate = workers.length > 0
        ? workers.reduce((sum, w) => sum + (w.hourlyRate ? Number(w.hourlyRate) : 0), 0) / workers.length
        : 15; // Default rate

      if (existing) {
        existing.totalHours += hours;
        existing.totalCost += hours * avgRate;
        task.assignedTo.forEach(w => existing.workers.add(w));
      } else {
        fieldMap.set(task.fieldId, {
          fieldId: task.fieldId,
          fieldName: task.field.name,
          totalHours: hours,
          totalCost: hours * avgRate,
          workers: new Set(task.assignedTo),
        });
      }
    }

    return Array.from(fieldMap.values()).map(f => ({
      fieldId: f.fieldId,
      fieldName: f.fieldName,
      totalHours: Number(f.totalHours.toFixed(2)),
      totalCost: Number(f.totalCost.toFixed(2)),
      workerCount: f.workers.size,
    }));
  }

  /**
   * Aggregate labor costs by task
   */
  private async aggregateLaborCostByTask(
    farmId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<LaborCostByTask[]> {
    // Get completed tasks with actual hours
    const tasks = await this.prisma.task.findMany({
      where: {
        farmId,
        status: 'completed',
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        field: {
          select: { id: true, name: true },
        },
      },
    });

    // Get workers for hourly rate lookup
    const workers = await this.prisma.worker.findMany({
      where: { farmId },
    });

    // Calculate average hourly rate
    const avgRate = workers.length > 0
      ? workers.reduce((sum, w) => sum + (w.hourlyRate ? Number(w.hourlyRate) : 0), 0) / workers.length
      : 15;

    return tasks.map(task => {
      const hours = task.actualHours ? Number(task.actualHours) : 0;
      return {
        taskId: task.id,
        taskTitle: task.title,
        fieldId: task.fieldId,
        fieldName: task.field?.name ?? null,
        totalHours: Number(hours.toFixed(2)),
        totalCost: Number((hours * avgRate).toFixed(2)),
        workerCount: task.assignedTo.length,
      };
    });
  }

  /**
   * Get labor cost for a specific field
   */
  async getLaborCostForField(fieldId: string, startDate: string, endDate: string): Promise<LaborCostByField | null> {
    const farmId = this.getFarmId();
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get field
    const field = await this.prisma.field.findFirst({
      where: { id: fieldId, farmId },
      select: { id: true, name: true },
    });

    if (!field) {
      return null;
    }

    // Get completed tasks for this field
    const tasks = await this.prisma.task.findMany({
      where: {
        farmId,
        fieldId,
        status: 'completed',
        completedAt: {
          gte: start,
          lte: end,
        },
      },
    });

    // Get workers for hourly rate
    const workers = await this.prisma.worker.findMany({
      where: { farmId },
    });

    const avgRate = workers.length > 0
      ? workers.reduce((sum, w) => sum + (w.hourlyRate ? Number(w.hourlyRate) : 0), 0) / workers.length
      : 15;

    let totalHours = 0;
    const workerSet = new Set<string>();

    for (const task of tasks) {
      totalHours += task.actualHours ? Number(task.actualHours) : 0;
      task.assignedTo.forEach(w => workerSet.add(w));
    }

    return {
      fieldId: field.id,
      fieldName: field.name,
      totalHours: Number(totalHours.toFixed(2)),
      totalCost: Number((totalHours * avgRate).toFixed(2)),
      workerCount: workerSet.size,
    };
  }
}

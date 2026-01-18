import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import {
  DashboardDataDto,
  EquipmentStatsDto,
  WorkforceStatsDto,
  TaskStatsDto,
  FieldStatsDto,
  FinancialSummaryDto,
  ActivityItemDto,
} from './dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  async getDashboardData(): Promise<DashboardDataDto> {
    const farmId = this.getFarmId();

    const [equipment, workforce, tasks, fields, financial, recentActivity] =
      await Promise.all([
        this.getEquipmentStats(farmId),
        this.getWorkforceStats(farmId),
        this.getTaskStats(farmId),
        this.getFieldStats(farmId),
        this.getFinancialSummary(farmId),
        this.getRecentActivity(farmId),
      ]);

    return {
      equipment,
      workforce,
      tasks,
      fields,
      financial,
      recentActivity,
    };
  }

  private async getEquipmentStats(farmId: string): Promise<EquipmentStatsDto> {
    const equipmentCounts = await this.prisma.equipment.groupBy({
      by: ['status'],
      where: { farmId },
      _count: { id: true },
    });

    let total = 0;
    let active = 0;
    let inMaintenance = 0;
    let inactive = 0;

    for (const item of equipmentCounts) {
      const count = item._count.id;
      total += count;
      if (item.status === 'active') active = count;
      else if (item.status === 'maintenance') inMaintenance = count;
      else if (item.status === 'inactive') inactive = count;
    }

    return { total, active, inMaintenance, inactive };
  }

  private async getWorkforceStats(farmId: string): Promise<WorkforceStatsDto> {
    const totalWorkers = await this.prisma.worker.count({
      where: { farmId, endDate: null },
    });

    // Workers currently clocked in (have active time card)
    const clockedIn = await this.prisma.timeCard.count({
      where: {
        farmId,
        status: 'active',
        clockOut: null,
      },
    });

    // Workers who clocked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const clockedInToday = await this.prisma.timeCard.groupBy({
      by: ['workerId'],
      where: {
        farmId,
        clockIn: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return {
      totalWorkers,
      clockedIn,
      clockedInToday: clockedInToday.length,
    };
  }


  private async getTaskStats(farmId: string): Promise<TaskStatsDto> {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [pending, inProgress, completedToday, overdue] = await Promise.all([
      this.prisma.task.count({
        where: { farmId, status: 'pending' },
      }),
      this.prisma.task.count({
        where: { farmId, status: 'in_progress' },
      }),
      this.prisma.task.count({
        where: {
          farmId,
          status: 'completed',
          completedAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      this.prisma.task.count({
        where: {
          farmId,
          status: { notIn: ['completed', 'cancelled'] },
          dueDate: { lt: now },
        },
      }),
    ]);

    return { pending, inProgress, completedToday, overdue };
  }

  private async getFieldStats(farmId: string): Promise<FieldStatsDto> {
    const fields = await this.prisma.field.findMany({
      where: { farmId },
      select: { acreage: true },
    });

    const totalFields = fields.length;
    let totalAcreage = 0;
    for (const field of fields) {
      if (field.acreage) {
        totalAcreage += Number(field.acreage);
      }
    }

    const totalZones = await this.prisma.zone.count({
      where: { field: { farmId } },
    });

    return { totalFields, totalAcreage, totalZones };
  }

  private async getFinancialSummary(farmId: string): Promise<FinancialSummaryDto> {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // This month's revenue
    const thisMonthRevenues = await this.prisma.revenue.findMany({
      where: {
        farmId,
        saleDate: {
          gte: firstDayThisMonth,
          lt: firstDayNextMonth,
        },
      },
    });

    let monthlyRevenue = 0;
    for (const rev of thisMonthRevenues) {
      monthlyRevenue += Number(rev.totalAmount);
    }

    // This month's expenses
    const thisMonthExpenses = await this.prisma.expense.findMany({
      where: {
        farmId,
        date: {
          gte: firstDayThisMonth,
          lt: firstDayNextMonth,
        },
      },
    });

    let monthlyExpenses = 0;
    for (const exp of thisMonthExpenses) {
      monthlyExpenses += Number(exp.amount);
    }

    // Last month's revenue for comparison
    const lastMonthRevenues = await this.prisma.revenue.findMany({
      where: {
        farmId,
        saleDate: {
          gte: firstDayLastMonth,
          lt: firstDayThisMonth,
        },
      },
    });

    let lastMonthRevenue = 0;
    for (const rev of lastMonthRevenues) {
      lastMonthRevenue += Number(rev.totalAmount);
    }

    let revenueChangePercent: number | null = null;
    if (lastMonthRevenue > 0) {
      revenueChangePercent =
        ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    }

    return {
      monthlyRevenue,
      monthlyExpenses,
      monthlyProfit: monthlyRevenue - monthlyExpenses,
      revenueChangePercent,
    };
  }


  private async getRecentActivity(farmId: string): Promise<ActivityItemDto[]> {
    const activities: ActivityItemDto[] = [];
    const limit = 10;

    // Get recent completed tasks
    const recentTasks = await this.prisma.task.findMany({
      where: {
        farmId,
        status: 'completed',
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        field: { select: { name: true } },
        completer: { select: { profile: true } },
      },
    });

    for (const task of recentTasks) {
      const completerName = task.completer?.profile
        ? (task.completer.profile as { firstName?: string; lastName?: string })
            .firstName || 'Someone'
        : 'Someone';
      activities.push({
        type: 'task_completed',
        title: 'Task Completed',
        description: `${task.title}${task.field ? ` - ${task.field.name}` : ''} completed by ${completerName}`,
        timestamp: task.completedAt!,
        entityId: task.id,
      });
    }

    // Get recent maintenance alerts
    const recentAlerts = await this.prisma.maintenanceAlert.findMany({
      where: {
        equipment: { farmId },
        resolvedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        equipment: { select: { name: true } },
      },
    });

    for (const alert of recentAlerts) {
      activities.push({
        type: 'maintenance_alert',
        title: 'Maintenance Alert',
        description: `${alert.equipment.name}: ${alert.message}`,
        timestamp: alert.createdAt,
        entityId: alert.id,
      });
    }

    // Get recent clock-ins
    const recentClockIns = await this.prisma.timeCard.findMany({
      where: { farmId },
      orderBy: { clockIn: 'desc' },
      take: limit,
      include: {
        worker: {
          include: {
            user: { select: { profile: true } },
          },
        },
      },
    });

    for (const timeCard of recentClockIns) {
      const workerName = timeCard.worker?.user?.profile
        ? (timeCard.worker.user.profile as { firstName?: string; lastName?: string })
            .firstName || 'Worker'
        : 'Worker';
      const clockInTime = timeCard.clockIn.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

      activities.push({
        type: 'clock_in',
        title: 'Clock In',
        description: `${workerName} clocked in at ${clockInTime}`,
        timestamp: timeCard.clockIn,
        entityId: timeCard.id,
      });

      if (timeCard.clockOut) {
        const clockOutTime = timeCard.clockOut.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
        activities.push({
          type: 'clock_out',
          title: 'Clock Out',
          description: `${workerName} clocked out at ${clockOutTime}`,
          timestamp: timeCard.clockOut,
          entityId: timeCard.id,
        });
      }
    }

    // Get recent harvests
    const recentHarvests = await this.prisma.harvest.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        field: { select: { name: true } },
      },
    });

    for (const harvest of recentHarvests) {
      activities.push({
        type: 'harvest',
        title: 'Harvest Recorded',
        description: `${harvest.cropType}: ${harvest.quantity} ${harvest.unit} from ${harvest.field.name}`,
        timestamp: harvest.createdAt,
        entityId: harvest.id,
      });
    }

    // Sort all activities by timestamp and return top items
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return activities.slice(0, limit);
  }
}

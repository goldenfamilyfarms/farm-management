import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';

export interface ServiceReminder {
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  currentOperatingHours: number | null;
  nextServiceHours: number | null;
  nextServiceDate: Date | null;
  hoursUntilService: number | null;
  daysUntilService: number | null;
  isOverdue: boolean;
  reminderType: 'hours' | 'date' | 'both';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Service for generating maintenance service reminders
 * Implements Requirements 10.1
 */
@Injectable()
export class ServiceReminderService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Get all service reminders for equipment that needs maintenance
   * Implements Requirements 10.1
   */
  async getServiceReminders(): Promise<ServiceReminder[]> {
    const farmId = this.getFarmId();
    const now = new Date();

    // Get all equipment with their latest maintenance records
    const equipment = await this.prisma.equipment.findMany({
      where: { farmId },
      include: {
        maintenanceRecords: {
          orderBy: { performedAt: 'desc' },
          take: 1,
        },
        telemetryReadings: {
          orderBy: { time: 'desc' },
          take: 1,
          select: { operatingHours: true },
        },
      },
    });

    const reminders: ServiceReminder[] = [];

    for (const eq of equipment) {
      const latestMaintenance = eq.maintenanceRecords[0];
      const latestTelemetry = eq.telemetryReadings[0];

      const currentOperatingHours = latestTelemetry?.operatingHours
        ? Number(latestTelemetry.operatingHours)
        : null;

      const nextServiceHours = latestMaintenance?.nextServiceHours
        ? Number(latestMaintenance.nextServiceHours)
        : null;

      const nextServiceDate = latestMaintenance?.nextServiceDate ?? null;

      // Calculate hours until service
      let hoursUntilService: number | null = null;
      if (currentOperatingHours !== null && nextServiceHours !== null) {
        hoursUntilService = nextServiceHours - currentOperatingHours;
      }

      // Calculate days until service
      let daysUntilService: number | null = null;
      if (nextServiceDate) {
        const diffMs = nextServiceDate.getTime() - now.getTime();
        daysUntilService = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }

      // Determine if service is needed
      const isHoursOverdue = hoursUntilService !== null && hoursUntilService <= 0;
      const isDateOverdue = daysUntilService !== null && daysUntilService <= 0;
      const isOverdue = isHoursOverdue || isDateOverdue;

      // Only include equipment that needs attention
      const needsReminder =
        isOverdue ||
        (hoursUntilService !== null && hoursUntilService <= 50) ||
        (daysUntilService !== null && daysUntilService <= 14);

      if (needsReminder) {
        const reminderType = this.determineReminderType(hoursUntilService, daysUntilService);
        const priority = this.determinePriority(hoursUntilService, daysUntilService, isOverdue);

        reminders.push({
          equipmentId: eq.id,
          equipmentName: eq.name,
          equipmentType: eq.type,
          currentOperatingHours,
          nextServiceHours,
          nextServiceDate,
          hoursUntilService,
          daysUntilService,
          isOverdue,
          reminderType,
          priority,
        });
      }
    }

    // Sort by priority (critical first) then by urgency
    return reminders.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Sort by hours until service (most urgent first)
      if (a.hoursUntilService !== null && b.hoursUntilService !== null) {
        return a.hoursUntilService - b.hoursUntilService;
      }
      return 0;
    });
  }

  /**
   * Get service reminder for specific equipment
   */
  async getEquipmentReminder(equipmentId: string): Promise<ServiceReminder | null> {
    const farmId = this.getFarmId();
    const now = new Date();

    const equipment = await this.prisma.equipment.findFirst({
      where: { id: equipmentId, farmId },
      include: {
        maintenanceRecords: {
          orderBy: { performedAt: 'desc' },
          take: 1,
        },
        telemetryReadings: {
          orderBy: { time: 'desc' },
          take: 1,
          select: { operatingHours: true },
        },
      },
    });

    if (!equipment) {
      return null;
    }

    const latestMaintenance = equipment.maintenanceRecords[0];
    const latestTelemetry = equipment.telemetryReadings[0];

    const currentOperatingHours = latestTelemetry?.operatingHours
      ? Number(latestTelemetry.operatingHours)
      : null;

    const nextServiceHours = latestMaintenance?.nextServiceHours
      ? Number(latestMaintenance.nextServiceHours)
      : null;

    const nextServiceDate = latestMaintenance?.nextServiceDate ?? null;

    let hoursUntilService: number | null = null;
    if (currentOperatingHours !== null && nextServiceHours !== null) {
      hoursUntilService = nextServiceHours - currentOperatingHours;
    }

    let daysUntilService: number | null = null;
    if (nextServiceDate) {
      const diffMs = nextServiceDate.getTime() - now.getTime();
      daysUntilService = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    const isHoursOverdue = hoursUntilService !== null && hoursUntilService <= 0;
    const isDateOverdue = daysUntilService !== null && daysUntilService <= 0;
    const isOverdue = isHoursOverdue || isDateOverdue;

    const reminderType = this.determineReminderType(hoursUntilService, daysUntilService);
    const priority = this.determinePriority(hoursUntilService, daysUntilService, isOverdue);

    return {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      equipmentType: equipment.type,
      currentOperatingHours,
      nextServiceHours,
      nextServiceDate,
      hoursUntilService,
      daysUntilService,
      isOverdue,
      reminderType,
      priority,
    };
  }

  /**
   * Check if equipment needs service based on hours
   */
  async checkServiceDue(equipmentId: string): Promise<boolean> {
    const reminder = await this.getEquipmentReminder(equipmentId);
    if (!reminder) return false;

    return (
      reminder.isOverdue ||
      (reminder.hoursUntilService !== null && reminder.hoursUntilService <= 10) ||
      (reminder.daysUntilService !== null && reminder.daysUntilService <= 3)
    );
  }

  private determineReminderType(
    hoursUntilService: number | null,
    daysUntilService: number | null,
  ): 'hours' | 'date' | 'both' {
    if (hoursUntilService !== null && daysUntilService !== null) {
      return 'both';
    }
    if (hoursUntilService !== null) {
      return 'hours';
    }
    return 'date';
  }

  private determinePriority(
    hoursUntilService: number | null,
    daysUntilService: number | null,
    isOverdue: boolean,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (isOverdue) {
      return 'critical';
    }

    // Check hours-based urgency
    if (hoursUntilService !== null) {
      if (hoursUntilService <= 10) return 'high';
      if (hoursUntilService <= 25) return 'medium';
    }

    // Check date-based urgency
    if (daysUntilService !== null) {
      if (daysUntilService <= 3) return 'high';
      if (daysUntilService <= 7) return 'medium';
    }

    return 'low';
  }
}

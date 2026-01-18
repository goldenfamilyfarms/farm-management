import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { ResourceType, ResourceWarningSeverity } from '@prisma/client';
import { ResourceWarningQueryDto } from './dto/resource-warning.dto';
import { Decimal } from '@prisma/client/runtime/library';

export interface ThresholdCheckResult {
  exceeded: boolean;
  warning?: {
    resourceType: ResourceType;
    appliedQuantity: number;
    thresholdQuantity: number;
    unit: string;
    severity: ResourceWarningSeverity;
    message: string;
  };
}

@Injectable()
export class ResourceWarningService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Check if a resource application exceeds the configured threshold.
   * Implements Requirements 2.5: Generate warning when application exceeds threshold.
   */
  async checkThreshold(
    resourceType: ResourceType,
    quantity: number,
    unit: string,
  ): Promise<ThresholdCheckResult> {
    const farmId = this.getFarmId();

    // Find active threshold for this resource type and unit
    const threshold = await this.prisma.resourceThreshold.findFirst({
      where: {
        farmId,
        resourceType,
        unit,
        isActive: true,
      },
    });

    // No threshold configured, no warning needed
    if (!threshold) {
      return { exceeded: false };
    }

    const thresholdQuantity = threshold.maxQuantity.toNumber();

    // Check if quantity exceeds threshold
    if (quantity > thresholdQuantity) {
      const severity = this.calculateSeverity(quantity, thresholdQuantity);
      const percentOver = ((quantity - thresholdQuantity) / thresholdQuantity * 100).toFixed(1);

      return {
        exceeded: true,
        warning: {
          resourceType,
          appliedQuantity: quantity,
          thresholdQuantity,
          unit,
          severity,
          message: `Resource application of ${quantity} ${unit} exceeds threshold of ${thresholdQuantity} ${unit} by ${percentOver}%`,
        },
      };
    }

    return { exceeded: false };
  }

  /**
   * Create a warning record for a resource application that exceeded threshold.
   */
  async createWarning(
    resourceApplicationId: string,
    warning: NonNullable<ThresholdCheckResult['warning']>,
  ) {
    const farmId = this.getFarmId();

    return this.prisma.resourceWarning.create({
      data: {
        farmId,
        resourceApplicationId,
        resourceType: warning.resourceType,
        appliedQuantity: warning.appliedQuantity,
        thresholdQuantity: warning.thresholdQuantity,
        unit: warning.unit,
        severity: warning.severity,
        message: warning.message,
      },
    });
  }

  /**
   * Get all warnings for the current farm with optional filters.
   */
  async findAll(query: ResourceWarningQueryDto) {
    const farmId = this.getFarmId();

    const where: Record<string, unknown> = { farmId };

    if (query.resourceApplicationId) {
      where.resourceApplicationId = query.resourceApplicationId;
    }

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.acknowledged !== undefined) {
      if (query.acknowledged === 'true') {
        where.acknowledgedAt = { not: null };
      } else if (query.acknowledged === 'false') {
        where.acknowledgedAt = null;
      }
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(query.startDate);
      }
      if (query.endDate) {
        (where.createdAt as Record<string, Date>).lte = new Date(query.endDate);
      }
    }

    return this.prisma.resourceWarning.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        resourceApplication: {
          select: {
            id: true,
            fieldId: true,
            zoneId: true,
            date: true,
            field: {
              select: { id: true, name: true },
            },
            zone: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });
  }

  /**
   * Get a specific warning by ID.
   */
  async findOne(id: string) {
    const farmId = this.getFarmId();

    const warning = await this.prisma.resourceWarning.findFirst({
      where: { id, farmId },
      include: {
        resourceApplication: {
          select: {
            id: true,
            fieldId: true,
            zoneId: true,
            date: true,
            field: {
              select: { id: true, name: true },
            },
            zone: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!warning) {
      throw new NotFoundException(`Resource warning with ID '${id}' not found`);
    }

    return warning;
  }

  /**
   * Acknowledge a warning.
   */
  async acknowledge(id: string, userId: string) {
    const farmId = this.getFarmId();

    // Verify warning exists and belongs to tenant
    const existing = await this.prisma.resourceWarning.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Resource warning with ID '${id}' not found`);
    }

    return this.prisma.resourceWarning.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
    });
  }

  /**
   * Get count of unacknowledged warnings.
   */
  async getUnacknowledgedCount(): Promise<number> {
    const farmId = this.getFarmId();

    return this.prisma.resourceWarning.count({
      where: {
        farmId,
        acknowledgedAt: null,
      },
    });
  }

  /**
   * Calculate severity based on how much the quantity exceeds the threshold.
   */
  private calculateSeverity(
    quantity: number,
    threshold: number,
  ): ResourceWarningSeverity {
    const percentOver = ((quantity - threshold) / threshold) * 100;

    if (percentOver >= 50) {
      return ResourceWarningSeverity.high;
    } else if (percentOver >= 25) {
      return ResourceWarningSeverity.medium;
    } else {
      return ResourceWarningSeverity.low;
    }
  }
}

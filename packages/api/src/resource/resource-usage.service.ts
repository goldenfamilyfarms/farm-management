import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { ResourceType } from '@prisma/client';
import {
  ResourceUsageQueryDto,
  ResourceUsageSummary,
  ResourceUsageByField,
  ResourceUsageByZone,
  ResourceUsageByType,
} from './dto/resource-usage.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ResourceUsageService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Get aggregated resource usage summary with breakdowns by field, zone, and resource type.
   * Implements Requirements 2.3: Calculate total resource usage per field, per zone, and per crop type for any date range.
   */
  async getUsageSummary(query: ResourceUsageQueryDto): Promise<ResourceUsageSummary> {
    const farmId = this.getFarmId();

    const where = this.buildWhereClause(farmId, query);

    // Execute all aggregation queries in parallel
    const [byField, byZone, byResourceType, totalResult] = await Promise.all([
      this.aggregateByField(where),
      this.aggregateByZone(where),
      this.aggregateByResourceType(where),
      this.calculateTotal(where),
    ]);

    return {
      totalQuantity: totalResult,
      byField,
      byZone,
      byResourceType,
      dateRange: {
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
      },
    };
  }

  /**
   * Aggregate resource usage by field.
   */
  async aggregateByField(where: Record<string, unknown>): Promise<ResourceUsageByField[]> {
    const results = await this.prisma.resourceApplication.groupBy({
      by: ['fieldId', 'unit'],
      where,
      _sum: {
        quantity: true,
      },
    });

    // Get field names for the results
    const fieldIds = [...new Set(results.map((r) => r.fieldId))];
    const fields = await this.prisma.field.findMany({
      where: { id: { in: fieldIds } },
      select: { id: true, name: true },
    });

    const fieldMap = new Map(fields.map((f) => [f.id, f.name]));

    return results.map((r) => ({
      fieldId: r.fieldId,
      fieldName: fieldMap.get(r.fieldId) ?? 'Unknown',
      totalQuantity: this.decimalToNumber(r._sum.quantity),
      unit: r.unit,
    }));
  }

  /**
   * Aggregate resource usage by zone.
   */
  async aggregateByZone(where: Record<string, unknown>): Promise<ResourceUsageByZone[]> {
    // Filter to only records with zoneId
    const zoneWhere = { ...where, zoneId: { not: null } };

    const results = await this.prisma.resourceApplication.groupBy({
      by: ['zoneId', 'fieldId', 'unit'],
      where: zoneWhere,
      _sum: {
        quantity: true,
      },
    });

    // Get zone and field names
    const zoneIds = results.map((r) => r.zoneId).filter((id): id is string => id !== null);
    const fieldIds = [...new Set(results.map((r) => r.fieldId))];

    const [zones, fields] = await Promise.all([
      this.prisma.zone.findMany({
        where: { id: { in: zoneIds } },
        select: { id: true, name: true },
      }),
      this.prisma.field.findMany({
        where: { id: { in: fieldIds } },
        select: { id: true, name: true },
      }),
    ]);

    const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
    const fieldMap = new Map(fields.map((f) => [f.id, f.name]));

    return results
      .filter((r) => r.zoneId !== null)
      .map((r) => ({
        zoneId: r.zoneId!,
        zoneName: zoneMap.get(r.zoneId!) ?? 'Unknown',
        fieldId: r.fieldId,
        fieldName: fieldMap.get(r.fieldId) ?? 'Unknown',
        totalQuantity: this.decimalToNumber(r._sum.quantity),
        unit: r.unit,
      }));
  }

  /**
   * Aggregate resource usage by resource type.
   */
  async aggregateByResourceType(where: Record<string, unknown>): Promise<ResourceUsageByType[]> {
    const results = await this.prisma.resourceApplication.groupBy({
      by: ['resourceType', 'unit'],
      where,
      _sum: {
        quantity: true,
      },
    });

    return results.map((r) => ({
      resourceType: r.resourceType as ResourceType,
      totalQuantity: this.decimalToNumber(r._sum.quantity),
      unit: r.unit,
    }));
  }

  /**
   * Calculate total quantity across all matching records.
   */
  private async calculateTotal(where: Record<string, unknown>): Promise<number> {
    const result = await this.prisma.resourceApplication.aggregate({
      where,
      _sum: {
        quantity: true,
      },
    });

    return this.decimalToNumber(result._sum.quantity);
  }

  /**
   * Build the where clause for queries based on filters.
   */
  private buildWhereClause(
    farmId: string,
    query: ResourceUsageQueryDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = { farmId };

    if (query.fieldId) {
      where.fieldId = query.fieldId;
    }

    if (query.zoneId) {
      where.zoneId = query.zoneId;
    }

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        (where.date as Record<string, Date>).gte = new Date(query.startDate);
      }
      if (query.endDate) {
        (where.date as Record<string, Date>).lte = new Date(query.endDate);
      }
    }

    return where;
  }

  /**
   * Convert Prisma Decimal to number.
   */
  private decimalToNumber(value: Decimal | null): number {
    if (value === null) {
      return 0;
    }
    return value.toNumber();
  }
}

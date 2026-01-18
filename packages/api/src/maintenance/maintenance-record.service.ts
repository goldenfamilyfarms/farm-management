import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { MaintenanceType } from '@prisma/client';
import {
  CreateMaintenanceRecordDto,
  UpdateMaintenanceRecordDto,
  MaintenanceRecordQueryDto,
  MaintenanceRecordResponseDto,
  EquipmentMaintenanceSummary,
} from './dto/maintenance-record.dto';

/**
 * Service for managing maintenance records
 * Implements Requirements 10.2, 10.3, 10.5
 */
@Injectable()
export class MaintenanceRecordService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Create a new maintenance record
   * Implements Requirements 10.2
   */
  async create(dto: CreateMaintenanceRecordDto): Promise<MaintenanceRecordResponseDto> {
    const farmId = this.getFarmId();

    // Verify equipment exists and belongs to farm
    const equipment = await this.prisma.equipment.findFirst({
      where: { id: dto.equipmentId, farmId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID '${dto.equipmentId}' not found`);
    }

    const record = await this.prisma.maintenanceRecord.create({
      data: {
        equipmentId: dto.equipmentId,
        type: dto.type,
        description: dto.description,
        cost: dto.cost,
        performedAt: new Date(dto.performedAt),
        performedBy: dto.performedBy,
        notes: dto.notes,
        nextServiceHours: dto.nextServiceHours,
        nextServiceDate: dto.nextServiceDate ? new Date(dto.nextServiceDate) : null,
      },
      include: {
        equipment: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    return this.mapToResponseDto(record);
  }

  /**
   * Find all maintenance records with optional filters
   * Implements Requirements 10.3
   */
  async findAll(query?: MaintenanceRecordQueryDto): Promise<MaintenanceRecordResponseDto[]> {
    const farmId = this.getFarmId();

    // Build where clause with equipment farm filter
    const where: Record<string, unknown> = {
      equipment: { farmId },
    };

    if (query?.equipmentId) {
      where.equipmentId = query.equipmentId;
    }

    if (query?.type) {
      where.type = query.type;
    }

    if (query?.startDate || query?.endDate) {
      where.performedAt = {};
      if (query.startDate) {
        (where.performedAt as Record<string, unknown>).gte = new Date(query.startDate);
      }
      if (query.endDate) {
        (where.performedAt as Record<string, unknown>).lte = new Date(query.endDate);
      }
    }

    const records = await this.prisma.maintenanceRecord.findMany({
      where,
      include: {
        equipment: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { performedAt: 'desc' },
    });

    return records.map(r => this.mapToResponseDto(r));
  }

  /**
   * Find a maintenance record by ID
   */
  async findOne(id: string): Promise<MaintenanceRecordResponseDto> {
    const farmId = this.getFarmId();

    const record = await this.prisma.maintenanceRecord.findFirst({
      where: {
        id,
        equipment: { farmId },
      },
      include: {
        equipment: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Maintenance record with ID '${id}' not found`);
    }

    return this.mapToResponseDto(record);
  }

  /**
   * Get maintenance history for specific equipment
   * Implements Requirements 10.3
   */
  async getEquipmentHistory(equipmentId: string): Promise<MaintenanceRecordResponseDto[]> {
    const farmId = this.getFarmId();

    // Verify equipment exists
    const equipment = await this.prisma.equipment.findFirst({
      where: { id: equipmentId, farmId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID '${equipmentId}' not found`);
    }

    const records = await this.prisma.maintenanceRecord.findMany({
      where: { equipmentId },
      include: {
        equipment: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { performedAt: 'desc' },
    });

    return records.map(r => this.mapToResponseDto(r));
  }

  /**
   * Update a maintenance record
   */
  async update(id: string, dto: UpdateMaintenanceRecordDto): Promise<MaintenanceRecordResponseDto> {
    const farmId = this.getFarmId();

    // Verify record exists and belongs to farm
    const existing = await this.prisma.maintenanceRecord.findFirst({
      where: {
        id,
        equipment: { farmId },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Maintenance record with ID '${id}' not found`);
    }

    const record = await this.prisma.maintenanceRecord.update({
      where: { id },
      data: {
        type: dto.type,
        description: dto.description,
        cost: dto.cost,
        performedAt: dto.performedAt ? new Date(dto.performedAt) : undefined,
        performedBy: dto.performedBy,
        notes: dto.notes,
        nextServiceHours: dto.nextServiceHours,
        nextServiceDate: dto.nextServiceDate ? new Date(dto.nextServiceDate) : undefined,
      },
      include: {
        equipment: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    return this.mapToResponseDto(record);
  }

  /**
   * Delete a maintenance record
   */
  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    const record = await this.prisma.maintenanceRecord.findFirst({
      where: {
        id,
        equipment: { farmId },
      },
    });

    if (!record) {
      throw new NotFoundException(`Maintenance record with ID '${id}' not found`);
    }

    await this.prisma.maintenanceRecord.delete({
      where: { id },
    });
  }

  /**
   * Get maintenance summary for all equipment
   * Implements Requirements 10.5
   */
  async getMaintenanceSummary(): Promise<EquipmentMaintenanceSummary[]> {
    const farmId = this.getFarmId();

    // Get all equipment for the farm
    const equipment = await this.prisma.equipment.findMany({
      where: { farmId },
      select: { id: true, name: true },
    });

    const summaries: EquipmentMaintenanceSummary[] = [];

    for (const eq of equipment) {
      const records = await this.prisma.maintenanceRecord.findMany({
        where: { equipmentId: eq.id },
        orderBy: { performedAt: 'desc' },
      });

      let totalCost = 0;
      let totalDowntimeHours = 0;
      let lastMaintenanceDate: Date | null = null;
      let nextServiceDue: Date | null = null;
      let nextServiceHours: number | null = null;

      for (const record of records) {
        if (record.cost) {
          totalCost += Number(record.cost);
        }

        // Estimate downtime based on maintenance type
        const downtimeHours = this.estimateDowntime(record.type);
        totalDowntimeHours += downtimeHours;

        if (!lastMaintenanceDate && record.performedAt) {
          lastMaintenanceDate = record.performedAt;
        }

        // Get next service info from most recent record
        if (!nextServiceDue && record.nextServiceDate) {
          nextServiceDue = record.nextServiceDate;
        }
        if (!nextServiceHours && record.nextServiceHours) {
          nextServiceHours = Number(record.nextServiceHours);
        }
      }

      summaries.push({
        equipmentId: eq.id,
        equipmentName: eq.name,
        totalRecords: records.length,
        totalCost: Number(totalCost.toFixed(2)),
        totalDowntimeHours,
        lastMaintenanceDate,
        nextServiceDue,
        nextServiceHours,
      });
    }

    return summaries;
  }

  /**
   * Calculate downtime and cost for equipment
   * Implements Requirements 10.5
   */
  async getDowntimeAndCost(
    equipmentId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ totalDowntimeHours: number; totalCost: number }> {
    const farmId = this.getFarmId();

    // Verify equipment exists
    const equipment = await this.prisma.equipment.findFirst({
      where: { id: equipmentId, farmId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID '${equipmentId}' not found`);
    }

    const records = await this.prisma.maintenanceRecord.findMany({
      where: {
        equipmentId,
        performedAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });

    let totalCost = 0;
    let totalDowntimeHours = 0;

    for (const record of records) {
      if (record.cost) {
        totalCost += Number(record.cost);
      }
      totalDowntimeHours += this.estimateDowntime(record.type);
    }

    return {
      totalDowntimeHours,
      totalCost: Number(totalCost.toFixed(2)),
    };
  }

  /**
   * Estimate downtime hours based on maintenance type
   */
  private estimateDowntime(type: MaintenanceType): number {
    switch (type) {
      case MaintenanceType.scheduled:
        return 4; // 4 hours for scheduled maintenance
      case MaintenanceType.repair:
        return 8; // 8 hours for repairs
      case MaintenanceType.inspection:
        return 2; // 2 hours for inspections
      case MaintenanceType.emergency:
        return 24; // 24 hours for emergency repairs
      default:
        return 4;
    }
  }

  private mapToResponseDto(record: {
    id: string;
    equipmentId: string;
    type: MaintenanceType;
    description: string | null;
    cost: unknown;
    performedAt: Date;
    performedBy: string | null;
    notes: string | null;
    nextServiceHours: unknown;
    nextServiceDate: Date | null;
    createdAt: Date;
    equipment?: {
      id: string;
      name: string;
      type: string;
    };
  }): MaintenanceRecordResponseDto {
    return {
      id: record.id,
      equipmentId: record.equipmentId,
      type: record.type,
      description: record.description,
      cost: record.cost ? Number(record.cost) : null,
      performedAt: record.performedAt,
      performedBy: record.performedBy,
      notes: record.notes,
      nextServiceHours: record.nextServiceHours ? Number(record.nextServiceHours) : null,
      nextServiceDate: record.nextServiceDate,
      createdAt: record.createdAt,
      equipment: record.equipment,
    };
  }
}

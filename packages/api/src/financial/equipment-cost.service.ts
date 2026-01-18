import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { DateRange } from './expense.service';

export interface EquipmentCostConfig {
  equipmentId: string;
  purchasePrice: number;
  usefulLifeHours: number;
  salvageValue?: number;
}

export interface EquipmentCostAllocation {
  equipmentId: string;
  equipmentName: string;
  fieldId: string;
  fieldName: string;
  operatingHours: number;
  hourlyDepreciationRate: number;
  allocatedCost: number;
}

export interface EquipmentCostSummary {
  equipmentId: string;
  equipmentName: string;
  totalOperatingHours: number;
  hourlyDepreciationRate: number;
  totalAllocatedCost: number;
  allocationsByField: EquipmentCostAllocation[];
}

@Injectable()
export class EquipmentCostService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Calculate hourly depreciation rate for equipment
   * Formula: (Purchase Price - Salvage Value) / Useful Life Hours
   */
  calculateHourlyDepreciationRate(config: EquipmentCostConfig): number {
    const salvageValue = config.salvageValue ?? 0;
    const depreciableAmount = config.purchasePrice - salvageValue;
    
    if (config.usefulLifeHours <= 0) {
      return 0;
    }
    
    return depreciableAmount / config.usefulLifeHours;
  }

  /**
   * Get operating hours for equipment in a specific field during a date range
   * This queries telemetry readings that have location data within the field boundary
   */
  async getOperatingHoursInField(
    equipmentId: string,
    fieldId: string,
    dateRange: DateRange,
  ): Promise<number> {
    const farmId = this.getFarmId();

    // Verify equipment belongs to farm
    const equipment = await this.prisma.equipment.findFirst({
      where: { id: equipmentId, farmId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID '${equipmentId}' not found`);
    }

    // Get telemetry readings for the equipment in the date range
    // that have location data within the field boundary
    const result = await this.prisma.$queryRaw<Array<{ total_hours: number | null }>>`
      SELECT 
        COALESCE(MAX(tr.operating_hours) - MIN(tr.operating_hours), 0) as total_hours
      FROM telemetry_readings tr
      JOIN fields f ON ST_Contains(f.boundary::geometry, tr.location::geometry)
      WHERE tr.equipment_id = ${equipmentId}::uuid
        AND f.id = ${fieldId}::uuid
        AND f.farm_id = ${farmId}::uuid
        AND tr.time >= ${new Date(dateRange.startDate)}
        AND tr.time <= ${new Date(dateRange.endDate)}
        AND tr.operating_hours IS NOT NULL
    `;

    return result[0]?.total_hours ?? 0;
  }


  /**
   * Allocate equipment cost to a field based on operating hours
   */
  async allocateEquipmentCostToField(
    config: EquipmentCostConfig,
    fieldId: string,
    dateRange: DateRange,
  ): Promise<EquipmentCostAllocation> {
    const farmId = this.getFarmId();

    // Get equipment details
    const equipment = await this.prisma.equipment.findFirst({
      where: { id: config.equipmentId, farmId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID '${config.equipmentId}' not found`);
    }

    // Get field details
    const field = await this.prisma.field.findFirst({
      where: { id: fieldId, farmId },
    });

    if (!field) {
      throw new NotFoundException(`Field with ID '${fieldId}' not found`);
    }

    // Calculate hourly depreciation rate
    const hourlyDepreciationRate = this.calculateHourlyDepreciationRate(config);

    // Get operating hours in the field
    const operatingHours = await this.getOperatingHoursInField(
      config.equipmentId,
      fieldId,
      dateRange,
    );

    // Calculate allocated cost
    const allocatedCost = operatingHours * hourlyDepreciationRate;

    return {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      fieldId: field.id,
      fieldName: field.name,
      operatingHours,
      hourlyDepreciationRate,
      allocatedCost,
    };
  }

  /**
   * Get equipment cost allocation summary for all fields
   */
  async getEquipmentCostSummary(
    config: EquipmentCostConfig,
    dateRange: DateRange,
  ): Promise<EquipmentCostSummary> {
    const farmId = this.getFarmId();

    // Get equipment details
    const equipment = await this.prisma.equipment.findFirst({
      where: { id: config.equipmentId, farmId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID '${config.equipmentId}' not found`);
    }

    // Get all fields for the farm
    const fields = await this.prisma.field.findMany({
      where: { farmId },
      select: { id: true, name: true },
    });

    // Calculate hourly depreciation rate
    const hourlyDepreciationRate = this.calculateHourlyDepreciationRate(config);

    // Calculate allocation for each field
    const allocationsByField: EquipmentCostAllocation[] = [];
    let totalOperatingHours = 0;
    let totalAllocatedCost = 0;

    for (const field of fields) {
      const operatingHours = await this.getOperatingHoursInField(
        config.equipmentId,
        field.id,
        dateRange,
      );

      if (operatingHours > 0) {
        const allocatedCost = operatingHours * hourlyDepreciationRate;
        
        allocationsByField.push({
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          fieldId: field.id,
          fieldName: field.name,
          operatingHours,
          hourlyDepreciationRate,
          allocatedCost,
        });

        totalOperatingHours += operatingHours;
        totalAllocatedCost += allocatedCost;
      }
    }

    return {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      totalOperatingHours,
      hourlyDepreciationRate,
      totalAllocatedCost,
      allocationsByField,
    };
  }

  /**
   * Get total equipment costs allocated to a field from all equipment
   */
  async getTotalEquipmentCostForField(
    fieldId: string,
    equipmentConfigs: EquipmentCostConfig[],
    dateRange: DateRange,
  ): Promise<{
    fieldId: string;
    fieldName: string;
    totalAllocatedCost: number;
    allocations: EquipmentCostAllocation[];
  }> {
    const farmId = this.getFarmId();

    // Get field details
    const field = await this.prisma.field.findFirst({
      where: { id: fieldId, farmId },
    });

    if (!field) {
      throw new NotFoundException(`Field with ID '${fieldId}' not found`);
    }

    const allocations: EquipmentCostAllocation[] = [];
    let totalAllocatedCost = 0;

    for (const config of equipmentConfigs) {
      try {
        const allocation = await this.allocateEquipmentCostToField(
          config,
          fieldId,
          dateRange,
        );

        if (allocation.operatingHours > 0) {
          allocations.push(allocation);
          totalAllocatedCost += allocation.allocatedCost;
        }
      } catch (error) {
        // Skip equipment that doesn't exist
        continue;
      }
    }

    return {
      fieldId: field.id,
      fieldName: field.name,
      totalAllocatedCost,
      allocations,
    };
  }
}

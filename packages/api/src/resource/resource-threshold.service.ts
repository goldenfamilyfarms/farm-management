import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { ResourceType } from '@prisma/client';
import {
  CreateResourceThresholdDto,
  UpdateResourceThresholdDto,
} from './dto/resource-threshold.dto';

@Injectable()
export class ResourceThresholdService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Create a new resource threshold configuration.
   * Implements Requirements 2.5: Configure thresholds per resource type.
   */
  async create(dto: CreateResourceThresholdDto) {
    const farmId = this.getFarmId();

    // Check if threshold already exists for this resource type and unit
    const existing = await this.prisma.resourceThreshold.findFirst({
      where: {
        farmId,
        resourceType: dto.resourceType,
        unit: dto.unit,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Threshold for resource type '${dto.resourceType}' with unit '${dto.unit}' already exists`,
      );
    }

    return this.prisma.resourceThreshold.create({
      data: {
        farmId,
        resourceType: dto.resourceType,
        maxQuantity: dto.maxQuantity,
        unit: dto.unit,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * Get all resource thresholds for the current farm.
   */
  async findAll(filters?: { resourceType?: ResourceType; isActive?: boolean }) {
    const farmId = this.getFarmId();

    const where: Record<string, unknown> = { farmId };

    if (filters?.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.resourceThreshold.findMany({
      where,
      orderBy: { resourceType: 'asc' },
    });
  }

  /**
   * Get a specific resource threshold by ID.
   */
  async findOne(id: string) {
    const farmId = this.getFarmId();

    const threshold = await this.prisma.resourceThreshold.findFirst({
      where: { id, farmId },
    });

    if (!threshold) {
      throw new NotFoundException(`Resource threshold with ID '${id}' not found`);
    }

    return threshold;
  }

  /**
   * Get threshold for a specific resource type and unit.
   */
  async findByResourceTypeAndUnit(resourceType: ResourceType, unit: string) {
    const farmId = this.getFarmId();

    return this.prisma.resourceThreshold.findFirst({
      where: {
        farmId,
        resourceType,
        unit,
        isActive: true,
      },
    });
  }

  /**
   * Update a resource threshold.
   */
  async update(id: string, dto: UpdateResourceThresholdDto) {
    const farmId = this.getFarmId();

    // Verify threshold exists and belongs to tenant
    const existing = await this.prisma.resourceThreshold.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Resource threshold with ID '${id}' not found`);
    }

    // If unit is being changed, check for conflicts
    if (dto.unit && dto.unit !== existing.unit) {
      const conflict = await this.prisma.resourceThreshold.findFirst({
        where: {
          farmId,
          resourceType: existing.resourceType,
          unit: dto.unit,
          id: { not: id },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Threshold for resource type '${existing.resourceType}' with unit '${dto.unit}' already exists`,
        );
      }
    }

    return this.prisma.resourceThreshold.update({
      where: { id },
      data: {
        maxQuantity: dto.maxQuantity,
        unit: dto.unit,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Delete a resource threshold.
   */
  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    // Verify threshold exists and belongs to tenant
    const existing = await this.prisma.resourceThreshold.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Resource threshold with ID '${id}' not found`);
    }

    await this.prisma.resourceThreshold.delete({
      where: { id },
    });
  }
}

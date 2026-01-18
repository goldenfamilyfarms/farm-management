import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { CreateHarvestDto, UpdateHarvestDto } from './dto/harvest.dto';

export interface HarvestFilters {
  fieldId?: string;
  zoneId?: string;
  cropType?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class HarvestService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  async create(dto: CreateHarvestDto) {
    const farmId = this.getFarmId();

    // Validate field exists and belongs to tenant
    const field = await this.prisma.field.findFirst({
      where: { id: dto.fieldId, farmId },
    });

    if (!field) {
      throw new BadRequestException(
        `Field with ID '${dto.fieldId}' not found or does not belong to this farm`,
      );
    }

    // Validate zone exists and belongs to the field if provided
    if (dto.zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: dto.zoneId, fieldId: dto.fieldId },
      });

      if (!zone) {
        throw new BadRequestException(
          `Zone with ID '${dto.zoneId}' not found or does not belong to field '${dto.fieldId}'`,
        );
      }
    }

    // Validate planting exists and belongs to the farm if provided
    if (dto.plantingId) {
      const planting = await this.prisma.planting.findFirst({
        where: { id: dto.plantingId, farmId },
      });

      if (!planting) {
        throw new BadRequestException(
          `Planting with ID '${dto.plantingId}' not found or does not belong to this farm`,
        );
      }
    }

    return this.prisma.harvest.create({
      data: {
        farmId,
        fieldId: dto.fieldId,
        zoneId: dto.zoneId,
        plantingId: dto.plantingId,
        cropType: dto.cropType,
        quantity: dto.quantity,
        unit: dto.unit,
        qualityGrade: dto.qualityGrade,
        harvestDate: new Date(dto.harvestDate),
        notes: dto.notes,
      },
      include: {
        field: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
        planting: { select: { id: true, cropType: true, variety: true } },
      },
    });
  }


  async findAll(filters?: HarvestFilters) {
    const farmId = this.getFarmId();

    const where: Record<string, unknown> = { farmId };

    if (filters?.fieldId) {
      where.fieldId = filters.fieldId;
    }

    if (filters?.zoneId) {
      where.zoneId = filters.zoneId;
    }

    if (filters?.cropType) {
      where.cropType = filters.cropType;
    }

    if (filters?.startDate || filters?.endDate) {
      where.harvestDate = {};
      if (filters.startDate) {
        (where.harvestDate as Record<string, Date>).gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        (where.harvestDate as Record<string, Date>).lte = new Date(filters.endDate);
      }
    }

    return this.prisma.harvest.findMany({
      where,
      orderBy: { harvestDate: 'desc' },
      include: {
        field: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
        planting: { select: { id: true, cropType: true, variety: true } },
      },
    });
  }

  async findOne(id: string) {
    const farmId = this.getFarmId();

    const harvest = await this.prisma.harvest.findFirst({
      where: { id, farmId },
      include: {
        field: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
        planting: { select: { id: true, cropType: true, variety: true } },
        revenues: true,
      },
    });

    if (!harvest) {
      throw new NotFoundException(`Harvest with ID '${id}' not found`);
    }

    return harvest;
  }

  async update(id: string, dto: UpdateHarvestDto) {
    const farmId = this.getFarmId();

    // Verify harvest exists and belongs to tenant
    const existing = await this.prisma.harvest.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Harvest with ID '${id}' not found`);
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

    // Validate zone if being updated
    const targetFieldId = dto.fieldId ?? existing.fieldId;
    if (dto.zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: dto.zoneId, fieldId: targetFieldId },
      });

      if (!zone) {
        throw new BadRequestException(
          `Zone with ID '${dto.zoneId}' not found or does not belong to field '${targetFieldId}'`,
        );
      }
    }

    // Validate planting if being updated
    if (dto.plantingId) {
      const planting = await this.prisma.planting.findFirst({
        where: { id: dto.plantingId, farmId },
      });

      if (!planting) {
        throw new BadRequestException(
          `Planting with ID '${dto.plantingId}' not found or does not belong to this farm`,
        );
      }
    }

    return this.prisma.harvest.update({
      where: { id },
      data: {
        fieldId: dto.fieldId,
        zoneId: dto.zoneId,
        plantingId: dto.plantingId,
        cropType: dto.cropType,
        quantity: dto.quantity,
        unit: dto.unit,
        qualityGrade: dto.qualityGrade,
        harvestDate: dto.harvestDate ? new Date(dto.harvestDate) : undefined,
        notes: dto.notes,
      },
      include: {
        field: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
        planting: { select: { id: true, cropType: true, variety: true } },
      },
    });
  }

  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    // Verify harvest exists and belongs to tenant
    const existing = await this.prisma.harvest.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Harvest with ID '${id}' not found`);
    }

    // Check for related revenues
    const revenues = await this.prisma.revenue.findMany({
      where: { harvestId: id },
      select: { id: true },
    });

    if (revenues.length > 0) {
      throw new BadRequestException(
        `Cannot delete harvest with ID '${id}' because it has ${revenues.length} associated revenue record(s). Delete the revenues first.`,
      );
    }

    await this.prisma.harvest.delete({
      where: { id },
    });
  }
}

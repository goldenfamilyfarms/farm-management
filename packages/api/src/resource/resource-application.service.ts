import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import {
  CreateResourceApplicationDto,
  UpdateResourceApplicationDto,
} from './dto/resource-application.dto';
import { ResourceWarningService } from './resource-warning.service';

export interface ResourceApplicationResult {
  resourceApplication: Awaited<ReturnType<PrismaService['resourceApplication']['create']>>;
  warning?: Awaited<ReturnType<PrismaService['resourceWarning']['create']>>;
}

@Injectable()
export class ResourceApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resourceWarningService: ResourceWarningService,
  ) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  async create(dto: CreateResourceApplicationDto): Promise<ResourceApplicationResult> {
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

    // Check threshold before creating the resource application
    const thresholdCheck = await this.resourceWarningService.checkThreshold(
      dto.resourceType,
      dto.quantity,
      dto.unit,
    );

    // Create the resource application
    const resourceApplication = await this.prisma.resourceApplication.create({
      data: {
        farmId,
        fieldId: dto.fieldId,
        zoneId: dto.zoneId,
        resourceType: dto.resourceType,
        quantity: dto.quantity,
        unit: dto.unit,
        date: new Date(dto.date),
        notes: dto.notes,
      },
    });

    // If threshold was exceeded, create a warning
    let warning;
    if (thresholdCheck.exceeded && thresholdCheck.warning) {
      warning = await this.resourceWarningService.createWarning(
        resourceApplication.id,
        thresholdCheck.warning,
      );
    }

    return { resourceApplication, warning };
  }


  async findAll(filters?: { fieldId?: string; zoneId?: string; resourceType?: string; startDate?: string; endDate?: string }) {
    const farmId = this.getFarmId();

    const where: Record<string, unknown> = { farmId };

    if (filters?.fieldId) {
      where.fieldId = filters.fieldId;
    }

    if (filters?.zoneId) {
      where.zoneId = filters.zoneId;
    }

    if (filters?.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) {
        (where.date as Record<string, Date>).gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        (where.date as Record<string, Date>).lte = new Date(filters.endDate);
      }
    }

    return this.prisma.resourceApplication.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        field: {
          select: { id: true, name: true },
        },
        zone: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const farmId = this.getFarmId();

    const resourceApplication = await this.prisma.resourceApplication.findFirst({
      where: { id, farmId },
      include: {
        field: {
          select: { id: true, name: true },
        },
        zone: {
          select: { id: true, name: true },
        },
      },
    });

    if (!resourceApplication) {
      throw new NotFoundException(`Resource application with ID '${id}' not found`);
    }

    return resourceApplication;
  }

  async update(id: string, dto: UpdateResourceApplicationDto) {
    const farmId = this.getFarmId();

    // Verify resource application exists and belongs to tenant
    const existing = await this.prisma.resourceApplication.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Resource application with ID '${id}' not found`);
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

    return this.prisma.resourceApplication.update({
      where: { id },
      data: {
        fieldId: dto.fieldId,
        zoneId: dto.zoneId,
        resourceType: dto.resourceType,
        quantity: dto.quantity,
        unit: dto.unit,
        date: dto.date ? new Date(dto.date) : undefined,
        notes: dto.notes,
      },
    });
  }

  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    // Verify resource application exists and belongs to tenant
    const existing = await this.prisma.resourceApplication.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Resource application with ID '${id}' not found`);
    }

    await this.prisma.resourceApplication.delete({
      where: { id },
    });
  }
}

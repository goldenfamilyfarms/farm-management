import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { CreateEquipmentDto, UpdateEquipmentDto } from './dto/equipment.dto';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  async create(dto: CreateEquipmentDto) {
    const farmId = this.getFarmId();

    // Check for duplicate deviceId if provided
    if (dto.deviceId) {
      const existing = await this.prisma.equipment.findUnique({
        where: { deviceId: dto.deviceId },
      });
      if (existing) {
        throw new ConflictException(`Equipment with deviceId '${dto.deviceId}' already exists`);
      }
    }

    return this.prisma.equipment.create({
      data: {
        farmId,
        name: dto.name,
        type: dto.type,
        make: dto.make,
        model: dto.model,
        serialNumber: dto.serialNumber,
        deviceId: dto.deviceId,
        status: dto.status ?? 'active',
      },
    });
  }

  async findAll() {
    const farmId = this.getFarmId();
    return this.prisma.equipment.findMany({
      where: { farmId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const farmId = this.getFarmId();
    const equipment = await this.prisma.equipment.findFirst({
      where: { id, farmId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID '${id}' not found`);
    }

    return equipment;
  }

  async findByDeviceId(deviceId: string) {
    return this.prisma.equipment.findUnique({
      where: { deviceId },
    });
  }

  async update(id: string, dto: UpdateEquipmentDto) {
    const farmId = this.getFarmId();

    // Verify equipment exists and belongs to tenant
    const existing = await this.prisma.equipment.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Equipment with ID '${id}' not found`);
    }

    // Check for duplicate deviceId if being updated
    if (dto.deviceId && dto.deviceId !== existing.deviceId) {
      const duplicate = await this.prisma.equipment.findUnique({
        where: { deviceId: dto.deviceId },
      });
      if (duplicate) {
        throw new ConflictException(`Equipment with deviceId '${dto.deviceId}' already exists`);
      }
    }

    return this.prisma.equipment.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        make: dto.make,
        model: dto.model,
        serialNumber: dto.serialNumber,
        deviceId: dto.deviceId,
        status: dto.status,
      },
    });
  }

  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    // Verify equipment exists and belongs to tenant
    const existing = await this.prisma.equipment.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Equipment with ID '${id}' not found`);
    }

    await this.prisma.equipment.delete({
      where: { id },
    });
  }

  async updateLastTelemetryAt(id: string, timestamp: Date): Promise<void> {
    await this.prisma.equipment.update({
      where: { id },
      data: { lastTelemetryAt: timestamp },
    });
  }
}

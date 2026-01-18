import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { CreateWorkerDto, UpdateWorkerDto } from './dto/worker.dto';

@Injectable()
export class WorkerService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  async create(dto: CreateWorkerDto) {
    const farmId = this.getFarmId();

    // Verify the user exists and belongs to the same farm
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, farmId },
    });

    if (!user) {
      throw new BadRequestException(
        `User with ID '${dto.userId}' not found or does not belong to this farm`,
      );
    }

    // Check if worker already exists for this user
    const existingWorker = await this.prisma.worker.findUnique({
      where: { userId: dto.userId },
    });

    if (existingWorker) {
      throw new ConflictException(
        `Worker profile already exists for user '${dto.userId}'`,
      );
    }

    return this.prisma.worker.create({
      data: {
        userId: dto.userId,
        farmId,
        skills: dto.skills ?? [],
        certifications: dto.certifications ? JSON.parse(JSON.stringify(dto.certifications)) : [],
        hourlyRate: dto.hourlyRate,
        employmentType: dto.employmentType,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: true,
          },
        },
      },
    });
  }

  async findAll() {
    const farmId = this.getFarmId();
    return this.prisma.worker.findMany({
      where: { farmId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const farmId = this.getFarmId();
    const worker = await this.prisma.worker.findFirst({
      where: { id, farmId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: true,
          },
        },
      },
    });

    if (!worker) {
      throw new NotFoundException(`Worker with ID '${id}' not found`);
    }

    return worker;
  }

  async findByUserId(userId: string) {
    const farmId = this.getFarmId();
    const worker = await this.prisma.worker.findFirst({
      where: { userId, farmId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: true,
          },
        },
      },
    });

    if (!worker) {
      throw new NotFoundException(`Worker for user '${userId}' not found`);
    }

    return worker;
  }

  async update(id: string, dto: UpdateWorkerDto) {
    const farmId = this.getFarmId();

    // Verify worker exists and belongs to tenant
    const existing = await this.prisma.worker.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Worker with ID '${id}' not found`);
    }

    return this.prisma.worker.update({
      where: { id },
      data: {
        skills: dto.skills,
        certifications: dto.certifications ? JSON.parse(JSON.stringify(dto.certifications)) : undefined,
        hourlyRate: dto.hourlyRate,
        employmentType: dto.employmentType,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: true,
          },
        },
      },
    });
  }

  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    // Verify worker exists and belongs to tenant
    const existing = await this.prisma.worker.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Worker with ID '${id}' not found`);
    }

    await this.prisma.worker.delete({
      where: { id },
    });
  }

  async getActiveWorkers() {
    const farmId = this.getFarmId();
    const today = new Date();

    return this.prisma.worker.findMany({
      where: {
        farmId,
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  ScheduleQueryDto,
  ScheduleResponseDto,
  ScheduleConflict,
} from './dto/schedule.dto';

/**
 * Service for managing worker schedules
 * Implements Requirements 7.5
 */
@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Create a new schedule entry
   */
  async create(dto: CreateScheduleDto): Promise<ScheduleResponseDto> {
    const farmId = this.getFarmId();

    // Verify worker exists
    const worker = await this.prisma.worker.findFirst({
      where: { id: dto.workerId, farmId },
    });

    if (!worker) {
      throw new NotFoundException(`Worker with ID '${dto.workerId}' not found`);
    }

    // Validate time range
    if (!this.isValidTimeRange(dto.startTime, dto.endTime)) {
      throw new BadRequestException('End time must be after start time');
    }

    // Check for conflicts
    const conflicts = await this.detectConflicts(dto.workerId, dto.date, dto.startTime, dto.endTime);
    if (conflicts.length > 0) {
      throw new ConflictException({
        message: 'Schedule conflicts detected',
        conflicts,
      });
    }

    const schedule = await this.prisma.schedule.create({
      data: {
        farmId,
        workerId: dto.workerId,
        date: new Date(dto.date),
        startTime: dto.startTime,
        endTime: dto.endTime,
        role: dto.role,
        notes: dto.notes,
      },
      include: {
        worker: {
          include: {
            user: {
              select: {
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });

    return this.mapToResponseDto(schedule);
  }

  /**
   * Find all schedules with optional filters
   */
  async findAll(query?: ScheduleQueryDto): Promise<ScheduleResponseDto[]> {
    const farmId = this.getFarmId();

    const where: Record<string, unknown> = { farmId };

    if (query?.workerId) {
      where.workerId = query.workerId;
    }

    if (query?.startDate || query?.endDate) {
      where.date = {};
      if (query.startDate) {
        (where.date as Record<string, unknown>).gte = new Date(query.startDate);
      }
      if (query.endDate) {
        (where.date as Record<string, unknown>).lte = new Date(query.endDate);
      }
    }

    const schedules = await this.prisma.schedule.findMany({
      where,
      include: {
        worker: {
          include: {
            user: {
              select: {
                email: true,
                profile: true,
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return schedules.map(s => this.mapToResponseDto(s));
  }

  /**
   * Find a schedule by ID
   */
  async findOne(id: string): Promise<ScheduleResponseDto> {
    const farmId = this.getFarmId();

    const schedule = await this.prisma.schedule.findFirst({
      where: { id, farmId },
      include: {
        worker: {
          include: {
            user: {
              select: {
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID '${id}' not found`);
    }

    return this.mapToResponseDto(schedule);
  }

  /**
   * Get schedules for a specific worker
   */
  async getWorkerSchedule(
    workerId: string,
    startDate: string,
    endDate: string,
  ): Promise<ScheduleResponseDto[]> {
    const farmId = this.getFarmId();

    // Verify worker exists
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, farmId },
    });

    if (!worker) {
      throw new NotFoundException(`Worker with ID '${workerId}' not found`);
    }

    const schedules = await this.prisma.schedule.findMany({
      where: {
        farmId,
        workerId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        worker: {
          include: {
            user: {
              select: {
                email: true,
                profile: true,
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return schedules.map(s => this.mapToResponseDto(s));
  }

  /**
   * Update a schedule
   */
  async update(id: string, dto: UpdateScheduleDto): Promise<ScheduleResponseDto> {
    const farmId = this.getFarmId();

    // Verify schedule exists
    const existing = await this.prisma.schedule.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Schedule with ID '${id}' not found`);
    }

    const newDate = dto.date ?? existing.date.toISOString().split('T')[0];
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;

    // Validate time range
    if (!this.isValidTimeRange(newStartTime, newEndTime)) {
      throw new BadRequestException('End time must be after start time');
    }

    // Check for conflicts (excluding current schedule)
    const conflicts = await this.detectConflicts(
      existing.workerId,
      newDate,
      newStartTime,
      newEndTime,
      id,
    );

    if (conflicts.length > 0) {
      throw new ConflictException({
        message: 'Schedule conflicts detected',
        conflicts,
      });
    }

    const schedule = await this.prisma.schedule.update({
      where: { id },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        startTime: dto.startTime,
        endTime: dto.endTime,
        role: dto.role,
        notes: dto.notes,
      },
      include: {
        worker: {
          include: {
            user: {
              select: {
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });

    return this.mapToResponseDto(schedule);
  }

  /**
   * Delete a schedule
   */
  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    const schedule = await this.prisma.schedule.findFirst({
      where: { id, farmId },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID '${id}' not found`);
    }

    await this.prisma.schedule.delete({
      where: { id },
    });
  }

  /**
   * Detect schedule conflicts for a worker
   */
  async detectConflicts(
    workerId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeScheduleId?: string,
  ): Promise<ScheduleConflict[]> {
    const farmId = this.getFarmId();
    const scheduleDate = new Date(date);
    scheduleDate.setHours(0, 0, 0, 0);

    // Get all schedules for this worker on this date
    const existingSchedules = await this.prisma.schedule.findMany({
      where: {
        farmId,
        workerId,
        date: scheduleDate,
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      },
    });

    const conflicts: ScheduleConflict[] = [];

    for (const existing of existingSchedules) {
      if (this.timesOverlap(startTime, endTime, existing.startTime, existing.endTime)) {
        conflicts.push({
          existingScheduleId: existing.id,
          date: existing.date,
          existingStartTime: existing.startTime,
          existingEndTime: existing.endTime,
          newStartTime: startTime,
          newEndTime: endTime,
        });
      }
    }

    return conflicts;
  }

  /**
   * Check if two time ranges overlap
   */
  private timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    const toMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);

    // Two ranges overlap if one starts before the other ends
    return s1 < e2 && s2 < e1;
  }

  /**
   * Validate that end time is after start time
   */
  private isValidTimeRange(startTime: string, endTime: string): boolean {
    const toMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    return toMinutes(endTime) > toMinutes(startTime);
  }

  private mapToResponseDto(schedule: {
    id: string;
    farmId: string;
    workerId: string;
    date: Date;
    startTime: string;
    endTime: string;
    role: string | null;
    notes: string | null;
    createdAt: Date;
    worker?: {
      id: string;
      userId: string;
      user?: {
        email: string;
        profile: unknown;
      };
    };
  }): ScheduleResponseDto {
    return {
      id: schedule.id,
      farmId: schedule.farmId,
      workerId: schedule.workerId,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      role: schedule.role,
      notes: schedule.notes,
      createdAt: schedule.createdAt,
      worker: schedule.worker,
    };
  }
}

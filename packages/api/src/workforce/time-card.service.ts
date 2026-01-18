import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { ClockInDto, TimeCardQueryDto } from './dto/time-card.dto';
import { TimeCardStatus } from '@prisma/client';

export interface PayrollSummary {
  payPeriod: { startDate: Date; endDate: Date };
  workers: WorkerPayrollEntry[];
  totalHours: number;
  totalCost: number;
}

export interface WorkerPayrollEntry {
  workerId: string;
  workerName: string;
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number;
  totalPay: number;
  timeCardCount: number;
}

@Injectable()
export class TimeCardService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Clock in a worker - creates a new time card with active status
   * Records timestamp, worker_id, and status as per Requirements 7.1
   * Flags for review if outside scheduled hours as per Requirements 7.5
   */
  async clockIn(dto: ClockInDto) {
    const farmId = this.getFarmId();

    // Verify the worker exists and belongs to the same farm
    const worker = await this.prisma.worker.findFirst({
      where: { id: dto.workerId, farmId },
    });

    if (!worker) {
      throw new NotFoundException(
        `Worker with ID '${dto.workerId}' not found`,
      );
    }

    // Check for existing active time card (duplicate clock-in prevention)
    const activeTimeCard = await this.prisma.timeCard.findFirst({
      where: {
        workerId: dto.workerId,
        farmId,
        status: TimeCardStatus.active,
      },
    });

    if (activeTimeCard) {
      throw new ConflictException(
        `Worker already has an active time card (ID: ${activeTimeCard.id}). Please clock out first.`,
      );
    }

    const clockInTime = new Date();

    // Check if clock-in is outside scheduled hours (Requirements 7.5)
    const flaggedForReview = await this.isOutsideScheduledHours(dto.workerId, clockInTime);

    // Build location point if coordinates provided
    let locationQuery = '';
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      locationQuery = `ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography`;
    }

    // Create time card with clock-in timestamp, worker_id, and status
    if (locationQuery) {
      const result = await this.prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO time_cards (id, farm_id, worker_id, clock_in, status, notes, clock_in_location, flagged_for_review, created_at)
        VALUES (
          gen_random_uuid(),
          ${farmId}::uuid,
          ${dto.workerId}::uuid,
          ${clockInTime},
          'active',
          ${dto.notes || null},
          ${this.prisma.$queryRawUnsafe(locationQuery)},
          ${flaggedForReview},
          NOW()
        )
        RETURNING id
      `;
      return this.findOne(result[0].id);
    }

    // Create without location
    const timeCard = await this.prisma.timeCard.create({
      data: {
        farmId,
        workerId: dto.workerId,
        clockIn: clockInTime,
        status: TimeCardStatus.active,
        notes: dto.notes,
        flaggedForReview,
      },
      include: {
        worker: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });

    return timeCard;
  }

  /**
   * Check if a clock-in time is outside the worker's scheduled hours
   * Returns true if outside schedule (should be flagged for review)
   * Returns false if within schedule or no schedule exists
   */
  private async isOutsideScheduledHours(workerId: string, clockInTime: Date): Promise<boolean> {
    const farmId = this.getFarmId();

    // Get the schedule for this worker on the clock-in date
    const clockInDate = new Date(clockInTime);
    clockInDate.setHours(0, 0, 0, 0);

    const schedule = await this.prisma.schedule.findFirst({
      where: {
        workerId,
        farmId,
        date: clockInDate,
      },
    });

    // If no schedule exists for this day, don't flag (worker may be unscheduled)
    if (!schedule) {
      return false;
    }

    // Parse schedule times (format: "HH:mm")
    const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
    const [endHour, endMinute] = schedule.endTime.split(':').map(Number);

    // Create Date objects for schedule start and end times
    const scheduleStart = new Date(clockInDate);
    scheduleStart.setHours(startHour, startMinute, 0, 0);

    const scheduleEnd = new Date(clockInDate);
    scheduleEnd.setHours(endHour, endMinute, 0, 0);

    // Allow 15 minutes grace period before scheduled start
    const gracePeriodMs = 15 * 60 * 1000;
    const earliestAllowed = new Date(scheduleStart.getTime() - gracePeriodMs);

    // Check if clock-in is outside the allowed window
    const isOutside = clockInTime < earliestAllowed || clockInTime > scheduleEnd;

    return isOutside;
  }


  /**
   * Clock out a worker - updates time card with clock-out time and calculates total hours
   * Calculates total_hours as (clock_out - clock_in) as per Requirements 7.2
   */
  async clockOut(timeCardId: string, dto?: { latitude?: number; longitude?: number; notes?: string }) {
    const farmId = this.getFarmId();

    // Find the time card
    const timeCard = await this.prisma.timeCard.findFirst({
      where: { id: timeCardId, farmId },
    });

    if (!timeCard) {
      throw new NotFoundException(`Time card with ID '${timeCardId}' not found`);
    }

    // Verify the time card is active
    if (timeCard.status !== TimeCardStatus.active) {
      throw new BadRequestException(
        `Cannot clock out: Time card is not active (current status: ${timeCard.status})`,
      );
    }

    const clockOutTime = new Date();
    const clockInTime = new Date(timeCard.clockIn);

    // Calculate total hours as (clock_out - clock_in) in hours
    const diffMs = clockOutTime.getTime() - clockInTime.getTime();
    const totalHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));

    // Build location point if coordinates provided
    if (dto?.latitude !== undefined && dto?.longitude !== undefined) {
      await this.prisma.$executeRaw`
        UPDATE time_cards
        SET 
          clock_out = ${clockOutTime},
          total_hours = ${totalHours},
          status = 'pending_approval',
          clock_out_location = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography,
          notes = COALESCE(${dto.notes || null}, notes)
        WHERE id = ${timeCardId}::uuid
      `;
      return this.findOne(timeCardId);
    }

    // Update without location
    const updatedTimeCard = await this.prisma.timeCard.update({
      where: { id: timeCardId },
      data: {
        clockOut: clockOutTime,
        totalHours,
        status: TimeCardStatus.pending_approval,
        notes: dto?.notes || timeCard.notes,
      },
      include: {
        worker: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });

    return updatedTimeCard;
  }

  /**
   * Get active time card for a worker
   */
  async getActiveTimeCard(workerId: string) {
    const farmId = this.getFarmId();

    const timeCard = await this.prisma.timeCard.findFirst({
      where: {
        workerId,
        farmId,
        status: TimeCardStatus.active,
      },
      include: {
        worker: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });

    return timeCard;
  }

  /**
   * Find a time card by ID
   */
  async findOne(id: string) {
    const farmId = this.getFarmId();

    const timeCard = await this.prisma.timeCard.findFirst({
      where: { id, farmId },
      include: {
        worker: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });

    if (!timeCard) {
      throw new NotFoundException(`Time card with ID '${id}' not found`);
    }

    return timeCard;
  }

  /**
   * Find all time cards with optional filters
   */
  async findAll(query?: TimeCardQueryDto) {
    const farmId = this.getFarmId();

    const where: Record<string, unknown> = { farmId };

    if (query?.workerId) {
      where.workerId = query.workerId;
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.startDate || query?.endDate) {
      where.clockIn = {};
      if (query.startDate) {
        (where.clockIn as Record<string, unknown>).gte = new Date(query.startDate);
      }
      if (query.endDate) {
        (where.clockIn as Record<string, unknown>).lte = new Date(query.endDate);
      }
    }

    return this.prisma.timeCard.findMany({
      where,
      include: {
        worker: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: true,
              },
            },
          },
        },
      },
      orderBy: { clockIn: 'desc' },
    });
  }

  /**
   * Get time cards for a specific worker
   */
  async findByWorkerId(workerId: string) {
    const farmId = this.getFarmId();

    // Verify worker exists
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, farmId },
    });

    if (!worker) {
      throw new NotFoundException(`Worker with ID '${workerId}' not found`);
    }

    return this.prisma.timeCard.findMany({
      where: { workerId, farmId },
      include: {
        worker: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: true,
              },
            },
          },
        },
      },
      orderBy: { clockIn: 'desc' },
    });
  }

  /**
   * Delete a time card (only if active and not approved)
   */
  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    const timeCard = await this.prisma.timeCard.findFirst({
      where: { id, farmId },
    });

    if (!timeCard) {
      throw new NotFoundException(`Time card with ID '${id}' not found`);
    }

    if (timeCard.status === TimeCardStatus.approved) {
      throw new BadRequestException('Cannot delete an approved time card');
    }

    await this.prisma.timeCard.delete({
      where: { id },
    });
  }

  /**
   * Approve a time card
   */
  async approveTimeCard(timeCardId: string, approverId: string) {
    const farmId = this.getFarmId();

    const timeCard = await this.prisma.timeCard.findFirst({
      where: { id: timeCardId, farmId },
    });

    if (!timeCard) {
      throw new NotFoundException(`Time card with ID '${timeCardId}' not found`);
    }

    if (timeCard.status !== TimeCardStatus.pending_approval) {
      throw new BadRequestException(
        `Cannot approve: Time card status is '${timeCard.status}', expected 'pending_approval'`,
      );
    }

    return this.prisma.timeCard.update({
      where: { id: timeCardId },
      data: {
        status: TimeCardStatus.approved,
        approvedBy: approverId,
        approvedAt: new Date(),
      },
      include: {
        worker: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Reject a time card
   */
  async rejectTimeCard(timeCardId: string, approverId: string, reason?: string) {
    const farmId = this.getFarmId();

    const timeCard = await this.prisma.timeCard.findFirst({
      where: { id: timeCardId, farmId },
    });

    if (!timeCard) {
      throw new NotFoundException(`Time card with ID '${timeCardId}' not found`);
    }

    if (timeCard.status !== TimeCardStatus.pending_approval) {
      throw new BadRequestException(
        `Cannot reject: Time card status is '${timeCard.status}', expected 'pending_approval'`,
      );
    }

    return this.prisma.timeCard.update({
      where: { id: timeCardId },
      data: {
        status: TimeCardStatus.rejected,
        approvedBy: approverId,
        approvedAt: new Date(),
        notes: reason ? `Rejected: ${reason}` : timeCard.notes,
      },
      include: {
        worker: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get payroll summary for a pay period
   * Sums approved time card hours by worker and calculates total pay
   * Implements Requirements 7.6
   */
  async getPayrollSummary(startDate: string, endDate: string): Promise<PayrollSummary> {
    const farmId = this.getFarmId();
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all approved time cards within the pay period
    const timeCards = await this.prisma.timeCard.findMany({
      where: {
        farmId,
        status: TimeCardStatus.approved,
        clockIn: {
          gte: start,
          lte: end,
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
    });

    // Aggregate hours by worker
    const workerHoursMap = new Map<string, {
      workerId: string;
      workerName: string;
      hourlyRate: number;
      totalHours: number;
      timeCardCount: number;
    }>();

    for (const tc of timeCards) {
      const hours = tc.totalHours ? Number(tc.totalHours) : 0;
      const existing = workerHoursMap.get(tc.workerId);

      if (existing) {
        existing.totalHours += hours;
        existing.timeCardCount += 1;
      } else {
        const profile = tc.worker.user.profile as { firstName?: string; lastName?: string } | null;
        const workerName = profile
          ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || tc.worker.user.email
          : tc.worker.userId;

        workerHoursMap.set(tc.workerId, {
          workerId: tc.workerId,
          workerName,
          hourlyRate: tc.worker.hourlyRate ? Number(tc.worker.hourlyRate) : 0,
          totalHours: hours,
          timeCardCount: 1,
        });
      }
    }

    // Calculate pay for each worker (overtime after 40 hours/week)
    const workers: WorkerPayrollEntry[] = [];
    let totalHours = 0;
    let totalCost = 0;

    for (const data of workerHoursMap.values()) {
      const regularHours = Math.min(data.totalHours, 40);
      const overtimeHours = Math.max(data.totalHours - 40, 0);
      const regularPay = regularHours * data.hourlyRate;
      const overtimePay = overtimeHours * data.hourlyRate * 1.5;
      const workerTotalPay = regularPay + overtimePay;

      workers.push({
        workerId: data.workerId,
        workerName: data.workerName,
        regularHours,
        overtimeHours,
        hourlyRate: data.hourlyRate,
        totalPay: Number(workerTotalPay.toFixed(2)),
        timeCardCount: data.timeCardCount,
      });

      totalHours += data.totalHours;
      totalCost += workerTotalPay;
    }

    return {
      payPeriod: { startDate: start, endDate: end },
      workers,
      totalHours: Number(totalHours.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
    };
  }
}

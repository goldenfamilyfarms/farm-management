import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { TaskStatus, TaskPriority } from '@prisma/client';
import {
  CreateTaskDto,
  UpdateTaskDto,
  CompleteTaskDto,
  TaskQueryDto,
  TaskResponseDto,
} from './dto/task.dto';

/**
 * Service for managing tasks
 * Implements Requirements 8.1, 8.2, 8.4, 8.5
 */
@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  private getUserId(): string {
    return TenantContext.getUserId();
  }

  /**
   * Create a new task
   * Implements Requirements 8.1
   */
  async create(dto: CreateTaskDto): Promise<TaskResponseDto> {
    const farmId = this.getFarmId();
    const userId = this.getUserId();

    // Validate field exists if provided
    if (dto.fieldId) {
      const field = await this.prisma.field.findFirst({
        where: { id: dto.fieldId, farmId },
      });
      if (!field) {
        throw new NotFoundException(`Field with ID '${dto.fieldId}' not found`);
      }
    }

    // Validate zone exists and belongs to field if provided
    if (dto.zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: dto.zoneId, fieldId: dto.fieldId },
      });
      if (!zone) {
        throw new NotFoundException(`Zone with ID '${dto.zoneId}' not found or does not belong to the specified field`);
      }
    }

    // Validate assigned workers exist
    if (dto.assignedTo.length === 0) {
      throw new BadRequestException('At least one worker must be assigned to the task');
    }

    for (const workerId of dto.assignedTo) {
      const worker = await this.prisma.worker.findFirst({
        where: { id: workerId, farmId },
      });
      if (!worker) {
        throw new NotFoundException(`Worker with ID '${workerId}' not found`);
      }
    }

    const task = await this.prisma.task.create({
      data: {
        farmId,
        title: dto.title,
        description: dto.description,
        fieldId: dto.fieldId,
        zoneId: dto.zoneId,
        assignedTo: dto.assignedTo,
        priority: dto.priority ?? TaskPriority.medium,
        status: TaskStatus.pending,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        estimatedHours: dto.estimatedHours,
        createdBy: userId,
      },
      include: {
        field: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
    });

    return this.mapToResponseDto(task);
  }

  /**
   * Find all tasks with optional filters
   */
  async findAll(query?: TaskQueryDto): Promise<TaskResponseDto[]> {
    const farmId = this.getFarmId();

    const where: Record<string, unknown> = { farmId };

    if (query?.fieldId) {
      where.fieldId = query.fieldId;
    }

    if (query?.zoneId) {
      where.zoneId = query.zoneId;
    }

    if (query?.assignedTo) {
      where.assignedTo = { has: query.assignedTo };
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.priority) {
      where.priority = query.priority;
    }

    if (query?.dueBefore || query?.dueAfter) {
      where.dueDate = {};
      if (query.dueBefore) {
        (where.dueDate as Record<string, unknown>).lte = new Date(query.dueBefore);
      }
      if (query.dueAfter) {
        (where.dueDate as Record<string, unknown>).gte = new Date(query.dueAfter);
      }
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        field: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return tasks.map(t => this.mapToResponseDto(t));
  }

  /**
   * Find a task by ID
   */
  async findOne(id: string): Promise<TaskResponseDto> {
    const farmId = this.getFarmId();

    const task = await this.prisma.task.findFirst({
      where: { id, farmId },
      include: {
        field: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID '${id}' not found`);
    }

    return this.mapToResponseDto(task);
  }

  /**
   * Update a task
   */
  async update(id: string, dto: UpdateTaskDto): Promise<TaskResponseDto> {
    const farmId = this.getFarmId();

    // Verify task exists
    const existing = await this.prisma.task.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Task with ID '${id}' not found`);
    }

    // Validate field if being updated
    if (dto.fieldId) {
      const field = await this.prisma.field.findFirst({
        where: { id: dto.fieldId, farmId },
      });
      if (!field) {
        throw new NotFoundException(`Field with ID '${dto.fieldId}' not found`);
      }
    }

    // Validate zone if being updated
    if (dto.zoneId) {
      const fieldId = dto.fieldId ?? existing.fieldId;
      const zone = await this.prisma.zone.findFirst({
        where: { id: dto.zoneId, fieldId: fieldId ?? undefined },
      });
      if (!zone) {
        throw new NotFoundException(`Zone with ID '${dto.zoneId}' not found`);
      }
    }

    // Validate assigned workers if being updated
    if (dto.assignedTo) {
      for (const workerId of dto.assignedTo) {
        const worker = await this.prisma.worker.findFirst({
          where: { id: workerId, farmId },
        });
        if (!worker) {
          throw new NotFoundException(`Worker with ID '${workerId}' not found`);
        }
      }
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        fieldId: dto.fieldId,
        zoneId: dto.zoneId,
        assignedTo: dto.assignedTo,
        priority: dto.priority,
        status: dto.status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        estimatedHours: dto.estimatedHours,
      },
      include: {
        field: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
    });

    return this.mapToResponseDto(task);
  }

  /**
   * Complete a task
   * Implements Requirements 8.2
   */
  async complete(id: string, dto: CompleteTaskDto): Promise<TaskResponseDto> {
    const farmId = this.getFarmId();
    const userId = this.getUserId();

    // Verify task exists
    const existing = await this.prisma.task.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Task with ID '${id}' not found`);
    }

    if (existing.status === TaskStatus.completed) {
      throw new BadRequestException('Task is already completed');
    }

    if (existing.status === TaskStatus.cancelled) {
      throw new BadRequestException('Cannot complete a cancelled task');
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.completed,
        completedAt: new Date(),
        completedBy: userId,
        completionNotes: dto.completionNotes,
        actualHours: dto.actualHours,
        attachments: dto.attachments ?? existing.attachments,
      },
      include: {
        field: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
    });

    return this.mapToResponseDto(task);
  }

  /**
   * Get overdue tasks
   * Implements Requirements 8.4
   */
  async getOverdueTasks(): Promise<TaskResponseDto[]> {
    const farmId = this.getFarmId();
    const now = new Date();

    const tasks = await this.prisma.task.findMany({
      where: {
        farmId,
        status: { not: TaskStatus.completed },
        dueDate: { lt: now },
      },
      include: {
        field: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return tasks.map(t => this.mapToResponseDto(t));
  }

  /**
   * Get tasks by worker
   */
  async getTasksByWorker(workerId: string): Promise<TaskResponseDto[]> {
    const farmId = this.getFarmId();

    // Verify worker exists
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, farmId },
    });

    if (!worker) {
      throw new NotFoundException(`Worker with ID '${workerId}' not found`);
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        farmId,
        assignedTo: { has: workerId },
      },
      include: {
        field: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
    });

    return tasks.map(t => this.mapToResponseDto(t));
  }

  /**
   * Delete a task
   */
  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    const task = await this.prisma.task.findFirst({
      where: { id, farmId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID '${id}' not found`);
    }

    await this.prisma.task.delete({
      where: { id },
    });
  }

  /**
   * Update task status
   */
  async updateStatus(id: string, status: TaskStatus): Promise<TaskResponseDto> {
    const farmId = this.getFarmId();

    const existing = await this.prisma.task.findFirst({
      where: { id, farmId },
    });

    if (!existing) {
      throw new NotFoundException(`Task with ID '${id}' not found`);
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: { status },
      include: {
        field: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
    });

    return this.mapToResponseDto(task);
  }

  private mapToResponseDto(task: {
    id: string;
    farmId: string;
    title: string;
    description: string | null;
    fieldId: string | null;
    zoneId: string | null;
    assignedTo: string[];
    priority: TaskPriority;
    status: TaskStatus;
    dueDate: Date | null;
    completedAt: Date | null;
    completedBy: string | null;
    completionNotes: string | null;
    attachments: string[];
    estimatedHours: unknown;
    actualHours: unknown;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    field?: { id: string; name: string } | null;
    zone?: { id: string; name: string } | null;
  }): TaskResponseDto {
    return {
      id: task.id,
      farmId: task.farmId,
      title: task.title,
      description: task.description,
      fieldId: task.fieldId,
      zoneId: task.zoneId,
      assignedTo: task.assignedTo,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      completedBy: task.completedBy,
      completionNotes: task.completionNotes,
      attachments: task.attachments,
      estimatedHours: task.estimatedHours ? Number(task.estimatedHours) : null,
      actualHours: task.actualHours ? Number(task.actualHours) : null,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      field: task.field,
      zone: task.zone,
    };
  }
}

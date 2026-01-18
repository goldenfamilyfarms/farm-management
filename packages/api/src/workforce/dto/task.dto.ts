import { IsString, IsOptional, IsArray, IsEnum, IsDateString, IsNumber, IsUUID } from 'class-validator';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  assignedTo!: string[];

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  estimatedHours?: number;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assignedTo?: string[];

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  estimatedHours?: number;
}

export class CompleteTaskDto {
  @IsOptional()
  @IsString()
  completionNotes?: string;

  @IsOptional()
  @IsNumber()
  actualHours?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class TaskQueryDto {
  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString()
  dueBefore?: string;

  @IsOptional()
  @IsDateString()
  dueAfter?: string;
}

export interface TaskResponseDto {
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
  estimatedHours: number | null;
  actualHours: number | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  field?: {
    id: string;
    name: string;
  } | null;
  zone?: {
    id: string;
    name: string;
  } | null;
}

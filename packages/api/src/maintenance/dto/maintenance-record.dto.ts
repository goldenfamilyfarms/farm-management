import { IsString, IsOptional, IsNumber, IsDateString, IsUUID, IsEnum } from 'class-validator';
import { MaintenanceType } from '@prisma/client';

export class CreateMaintenanceRecordDto {
  @IsUUID()
  equipmentId!: string;

  @IsEnum(MaintenanceType)
  type!: MaintenanceType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsDateString()
  performedAt!: string;

  @IsOptional()
  @IsString()
  performedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  nextServiceHours?: number;

  @IsOptional()
  @IsDateString()
  nextServiceDate?: string;
}

export class UpdateMaintenanceRecordDto {
  @IsOptional()
  @IsEnum(MaintenanceType)
  type?: MaintenanceType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsDateString()
  performedAt?: string;

  @IsOptional()
  @IsString()
  performedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  nextServiceHours?: number;

  @IsOptional()
  @IsDateString()
  nextServiceDate?: string;
}

export class MaintenanceRecordQueryDto {
  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @IsOptional()
  @IsEnum(MaintenanceType)
  type?: MaintenanceType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export interface MaintenanceRecordResponseDto {
  id: string;
  equipmentId: string;
  type: MaintenanceType;
  description: string | null;
  cost: number | null;
  performedAt: Date;
  performedBy: string | null;
  notes: string | null;
  nextServiceHours: number | null;
  nextServiceDate: Date | null;
  createdAt: Date;
  equipment?: {
    id: string;
    name: string;
    type: string;
  };
}

export interface EquipmentMaintenanceSummary {
  equipmentId: string;
  equipmentName: string;
  totalRecords: number;
  totalCost: number;
  totalDowntimeHours: number;
  lastMaintenanceDate: Date | null;
  nextServiceDue: Date | null;
  nextServiceHours: number | null;
}

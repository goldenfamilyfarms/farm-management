import { IsString, IsEnum, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { EquipmentType, EquipmentStatus } from '@prisma/client';

export class CreateEquipmentDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsEnum(EquipmentType)
  type!: EquipmentType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  make?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;

  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;
}

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEnum(EquipmentType)
  type?: EquipmentType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  make?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;

  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;
}

export interface EquipmentResponseDto {
  id: string;
  farmId: string;
  name: string;
  type: EquipmentType;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  deviceId: string | null;
  status: EquipmentStatus;
  lastTelemetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

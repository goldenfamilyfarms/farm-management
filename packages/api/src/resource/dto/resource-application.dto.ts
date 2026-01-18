import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ResourceType } from '@prisma/client';

export class CreateResourceApplicationDto {
  @IsUUID()
  fieldId!: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsEnum(ResourceType)
  resourceType!: ResourceType;

  @IsNumber()
  @Min(0.01, { message: 'quantity must be greater than 0' })
  quantity!: number;

  @IsString()
  @MaxLength(20)
  unit!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateResourceApplicationDto {
  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsEnum(ResourceType)
  resourceType?: ResourceType;

  @IsOptional()
  @IsNumber()
  @Min(0.01, { message: 'quantity must be greater than 0' })
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export interface ResourceApplicationResponseDto {
  id: string;
  farmId: string;
  fieldId: string;
  zoneId: string | null;
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  date: Date;
  notes: string | null;
  createdAt: Date;
}

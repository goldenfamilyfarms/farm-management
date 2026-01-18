import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';
import { ResourceType } from '@prisma/client';

export class CreateResourceThresholdDto {
  @IsEnum(ResourceType)
  resourceType!: ResourceType;

  @IsNumber()
  @Min(0.01, { message: 'maxQuantity must be greater than 0' })
  maxQuantity!: number;

  @IsString()
  @MaxLength(20)
  unit!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateResourceThresholdDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01, { message: 'maxQuantity must be greater than 0' })
  maxQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export interface ResourceThresholdResponseDto {
  id: string;
  farmId: string;
  resourceType: ResourceType;
  maxQuantity: number;
  unit: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

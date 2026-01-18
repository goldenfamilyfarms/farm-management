import { IsOptional, IsUUID, IsDateString } from 'class-validator';
import { ResourceType, ResourceWarningSeverity } from '@prisma/client';

export class ResourceWarningQueryDto {
  @IsOptional()
  @IsUUID()
  resourceApplicationId?: string;

  @IsOptional()
  resourceType?: ResourceType;

  @IsOptional()
  severity?: ResourceWarningSeverity;

  @IsOptional()
  acknowledged?: string; // 'true' or 'false'

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export interface ResourceWarningResponseDto {
  id: string;
  farmId: string;
  resourceApplicationId: string;
  resourceType: ResourceType;
  appliedQuantity: number;
  thresholdQuantity: number;
  unit: string;
  severity: ResourceWarningSeverity;
  message: string;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  createdAt: Date;
}

export interface ResourceWarningWithApplicationDto extends ResourceWarningResponseDto {
  resourceApplication: {
    id: string;
    fieldId: string;
    zoneId: string | null;
    date: Date;
    field: {
      id: string;
      name: string;
    };
    zone: {
      id: string;
      name: string;
    } | null;
  };
}

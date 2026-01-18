import { IsOptional, IsDateString, IsUUID, IsEnum } from 'class-validator';
import { ResourceType } from '@prisma/client';

export class ResourceUsageQueryDto {
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
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export interface ResourceUsageByField {
  fieldId: string;
  fieldName: string;
  totalQuantity: number;
  unit: string;
}

export interface ResourceUsageByZone {
  zoneId: string;
  zoneName: string;
  fieldId: string;
  fieldName: string;
  totalQuantity: number;
  unit: string;
}

export interface ResourceUsageByType {
  resourceType: ResourceType;
  totalQuantity: number;
  unit: string;
}

export interface ResourceUsageSummary {
  totalQuantity: number;
  byField: ResourceUsageByField[];
  byZone: ResourceUsageByZone[];
  byResourceType: ResourceUsageByType[];
  dateRange: {
    startDate: string | null;
    endDate: string | null;
  };
}

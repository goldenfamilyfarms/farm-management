import {
  IsString,
  IsOptional,
  IsNumber,
  IsDate,
  IsUUID,
  ValidateNested,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GeoPolygonDto } from './field.dto';

/**
 * Soil quality data structure matching the design document
 */
export class SoilQualityDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(14)
  ph?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  organicMatter?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nitrogen?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  phosphorus?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  potassium?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  texture?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  drainageClass?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  testDate?: Date;
}

/**
 * DTO for creating a zone
 */
export class CreateZoneDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsUUID()
  fieldId!: string;

  @ValidateNested()
  @Type(() => GeoPolygonDto)
  boundary!: GeoPolygonDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SoilQualityDto)
  soilQuality?: SoilQualityDto;
}

/**
 * DTO for updating a zone
 */
export class UpdateZoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPolygonDto)
  boundary?: GeoPolygonDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SoilQualityDto)
  soilQuality?: SoilQualityDto;
}

/**
 * DTO for updating zone soil quality
 */
export class UpdateZoneSoilQualityDto {
  @ValidateNested()
  @Type(() => SoilQualityDto)
  soilQuality!: SoilQualityDto;
}

/**
 * DTO for bulk importing soil quality data for multiple zones
 */
export class SoilQualityImportItemDto {
  @IsUUID()
  zoneId!: string;

  @ValidateNested()
  @Type(() => SoilQualityDto)
  soilQuality!: SoilQualityDto;
}

export class BulkSoilQualityImportDto {
  @ValidateNested({ each: true })
  @Type(() => SoilQualityImportItemDto)
  items!: SoilQualityImportItemDto[];
}

/**
 * Response DTO for zone
 */
export interface ZoneResponseDto {
  id: string;
  fieldId: string;
  name: string;
  boundary: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  acreage: number | null;
  soilQuality: SoilQualityDto;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of bulk soil quality import
 */
export interface SoilQualityImportResultDto {
  updated: number;
  failed: number;
  zones: Array<{
    id: string;
    name: string;
  }>;
  errors: Array<{
    zoneId: string;
    error: string;
  }>;
}

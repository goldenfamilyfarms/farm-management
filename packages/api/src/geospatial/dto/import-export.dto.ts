import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * GeoJSON Feature for field import
 */
export class GeoJSONFeatureDto {
  @IsString()
  type!: 'Feature';

  @IsObject()
  geometry!: {
    type: 'Polygon';
    coordinates: number[][][];
  };

  @IsOptional()
  @IsObject()
  properties?: {
    name?: string;
    soilType?: string;
    irrigationType?: string;
    [key: string]: unknown;
  };
}

/**
 * GeoJSON FeatureCollection for importing multiple fields
 */
export class GeoJSONFeatureCollectionDto {
  @IsString()
  type!: 'FeatureCollection';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeoJSONFeatureDto)
  features!: GeoJSONFeatureDto[];
}

/**
 * KML import DTO - accepts raw KML string
 */
export class KMLImportDto {
  @IsString()
  kml!: string;
}

/**
 * Response for import operations
 */
export interface ImportResultDto {
  imported: number;
  failed: number;
  fields: Array<{
    id: string;
    name: string;
  }>;
  errors: Array<{
    index: number;
    name?: string;
    error: string;
  }>;
}

/**
 * GeoJSON Feature for export
 */
export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    id: string;
    name: string;
    acreage: number | null;
    soilType: string | null;
    irrigationType: string | null;
    farmId: string;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * GeoJSON FeatureCollection for export
 */
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

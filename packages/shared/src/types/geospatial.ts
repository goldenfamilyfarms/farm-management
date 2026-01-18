// Geospatial types for fields and zones

import type { GeoPolygon } from './common.js';

export interface SoilQuality {
  ph?: number;
  organicMatter?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  texture?: string;
  drainageClass?: string;
  testDate?: Date;
}

export interface Field {
  id: string;
  farmId: string;
  name: string;
  boundary: GeoPolygon;
  acreage: number;
  soilType?: string;
  irrigationType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Zone {
  id: string;
  fieldId: string;
  name: string;
  boundary: GeoPolygon;
  acreage: number;
  soilQuality: SoilQuality;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFieldInput {
  name: string;
  boundary: GeoPolygon;
  soilType?: string;
  irrigationType?: string;
}

export interface CreateZoneInput {
  name: string;
  boundary: GeoPolygon;
  soilQuality?: SoilQuality;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FieldWithZones extends Field {
  zones: Zone[];
}

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// Define types locally to avoid import resolution issues
export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

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

export interface FieldWithZones {
  id: string;
  farmId: string;
  name: string;
  boundary: GeoPolygon;
  acreage: number;
  soilType?: string;
  irrigationType?: string;
  createdAt: Date;
  updatedAt: Date;
  zones: Zone[];
}

export interface EquipmentPosition {
  id: string;
  name: string;
  type: string;
  status: string;
  location: {
    latitude: number;
    longitude: number;
  } | null;
  lastTelemetryAt: string | null;
}

export function useFields() {
  return useQuery<FieldWithZones[]>({
    queryKey: ['fields'],
    queryFn: () => apiClient.get<FieldWithZones[]>('/fields'),
    staleTime: 60000, // 1 minute
  });
}

export function useEquipmentPositions() {
  return useQuery<EquipmentPosition[]>({
    queryKey: ['equipment-positions'],
    queryFn: () => apiClient.get<EquipmentPosition[]>('/equipment'),
    staleTime: 30000, // 30 seconds
    refetchInterval: 30000, // Refetch every 30 seconds for real-time positions
  });
}

/**
 * Get a color based on soil quality metrics
 * Uses a simple heuristic based on pH and organic matter
 */
export function getSoilQualityColor(soilQuality: SoilQuality | null | undefined): string {
  if (!soilQuality) {
    return '#9CA3AF'; // Gray for unknown
  }

  const { ph, organicMatter, nitrogen } = soilQuality;

  // Calculate a simple quality score
  let score = 0;
  let factors = 0;

  // pH: optimal range is 6.0-7.0
  if (ph !== undefined) {
    if (ph >= 6.0 && ph <= 7.0) {
      score += 1;
    } else if (ph >= 5.5 && ph <= 7.5) {
      score += 0.7;
    } else {
      score += 0.3;
    }
    factors++;
  }

  // Organic matter: higher is generally better (up to ~5%)
  if (organicMatter !== undefined) {
    if (organicMatter >= 3) {
      score += 1;
    } else if (organicMatter >= 2) {
      score += 0.7;
    } else {
      score += 0.4;
    }
    factors++;
  }

  // Nitrogen: moderate levels are good
  if (nitrogen !== undefined) {
    if (nitrogen >= 20 && nitrogen <= 50) {
      score += 1;
    } else if (nitrogen >= 10 && nitrogen <= 70) {
      score += 0.7;
    } else {
      score += 0.4;
    }
    factors++;
  }

  if (factors === 0) {
    return '#9CA3AF'; // Gray for no data
  }

  const avgScore = score / factors;

  // Return color based on score
  if (avgScore >= 0.8) {
    return '#22C55E'; // Green - excellent
  } else if (avgScore >= 0.6) {
    return '#84CC16'; // Lime - good
  } else if (avgScore >= 0.4) {
    return '#EAB308'; // Yellow - moderate
  } else {
    return '#F97316'; // Orange - needs attention
  }
}

/**
 * Get equipment marker color based on status
 */
export function getEquipmentStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return '#22C55E'; // Green
    case 'maintenance':
      return '#EAB308'; // Yellow
    case 'inactive':
      return '#9CA3AF'; // Gray
    default:
      return '#6B7280'; // Default gray
  }
}

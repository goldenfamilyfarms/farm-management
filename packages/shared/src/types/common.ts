// Common types used across the platform

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  path: string;
  requestId: string;
}

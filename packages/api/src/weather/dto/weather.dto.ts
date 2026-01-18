import { z } from 'zod';

/**
 * Schema for weather data from external API
 */
export const WeatherDataSchema = z.object({
  temperature: z.number().nullable().optional(),
  precipitation: z.number().nullable().optional(),
  humidity: z.number().nullable().optional(),
  windSpeed: z.number().nullable().optional(),
  conditions: z.string().nullable().optional(),
});

export type WeatherDataInput = z.infer<typeof WeatherDataSchema>;

/**
 * Schema for NOAA API response (simplified)
 * NOAA returns data in a specific format that we need to transform
 */
export const NoaaObservationSchema = z.object({
  timestamp: z.string(),
  temperature: z.object({
    value: z.number().nullable(),
    unitCode: z.string(),
  }).nullable().optional(),
  relativeHumidity: z.object({
    value: z.number().nullable(),
    unitCode: z.string(),
  }).nullable().optional(),
  windSpeed: z.object({
    value: z.number().nullable(),
    unitCode: z.string(),
  }).nullable().optional(),
  precipitationLastHour: z.object({
    value: z.number().nullable(),
    unitCode: z.string(),
  }).nullable().optional(),
  textDescription: z.string().nullable().optional(),
});

export type NoaaObservation = z.infer<typeof NoaaObservationSchema>;

/**
 * Schema for NOAA API observations response
 */
export const NoaaObservationsResponseSchema = z.object({
  features: z.array(z.object({
    properties: NoaaObservationSchema,
  })),
});

export type NoaaObservationsResponse = z.infer<typeof NoaaObservationsResponseSchema>;

/**
 * Schema for NOAA station lookup response
 */
export const NoaaStationResponseSchema = z.object({
  features: z.array(z.object({
    properties: z.object({
      stationIdentifier: z.string(),
      name: z.string(),
    }),
  })),
});

export type NoaaStationResponse = z.infer<typeof NoaaStationResponseSchema>;

/**
 * DTO for stored weather data
 */
export interface WeatherDataDto {
  time: Date;
  farmId: string;
  temperature: number | null;
  precipitation: number | null;
  humidity: number | null;
  windSpeed: number | null;
  conditions: string | null;
  source: string | null;
}

/**
 * DTO for weather fetch result
 */
export interface WeatherFetchResult {
  success: boolean;
  recordsStored: number;
  error?: string;
  source?: string;
}

/**
 * DTO for weather query parameters
 */
export interface WeatherQueryParams {
  farmId: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/**
 * Configuration for weather API
 */
export interface WeatherApiConfig {
  provider: 'noaa' | 'openweathermap';
  apiKey?: string;
  baseUrl: string;
  userAgent: string;
}

/**
 * Response with staleness indicator for latest weather
 * Implements Requirement 11.5: staleness indicator when using cached data
 */
export interface WeatherResponseWithStaleness {
  data: WeatherDataDto | null;
  isStale: boolean;
  cachedAt: Date | null;
  source: string | null;
}

/**
 * Response with staleness indicator for weather history
 * Implements Requirement 11.5: staleness indicator when using cached data
 */
export interface WeatherHistoryResponseWithStaleness {
  data: WeatherDataDto[];
  isStale: boolean;
  cachedAt: Date | null;
  source: string | null;
}

/**
 * Response with staleness indicator for weather summary
 * Implements Requirement 11.5: staleness indicator when using cached data
 */
export interface WeatherSummaryResponseWithStaleness {
  data: {
    avgTemperature: number | null;
    totalPrecipitation: number | null;
    avgHumidity: number | null;
    avgWindSpeed: number | null;
    recordCount: number;
  };
  isStale: boolean;
  cachedAt: Date | null;
  source: string | null;
}

import { z } from 'zod';

// Zod schema for telemetry payload validation
export const TelemetryPayloadSchema = z.object({
  deviceId: z.string().min(1, 'deviceId is required'),
  timestamp: z.string().datetime({ message: 'timestamp must be a valid ISO 8601 date string' }),
  readings: z.object({
    operatingHours: z.number().min(0).optional(),
    fuelLevel: z.number().min(0).max(100).optional(),
    speed: z.number().min(0).optional(),
    engineRpm: z.number().int().min(0).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    faultCodes: z.array(z.string()).optional(),
    dispensing: z.object({
      type: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
      fieldId: z.string().uuid().optional(),
      zoneId: z.string().uuid().optional(),
    }).optional(),
  }),
  metadata: z.record(z.unknown()).optional(),
});

export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;

export interface TelemetryReadingResponse {
  time: Date;
  equipmentId: string;
  operatingHours: number | null;
  fuelLevel: number | null;
  speed: number | null;
  engineRpm: number | null;
  faultCodes: string[];
  resourceDispensed: unknown | null;
  rawData: unknown | null;
}

export interface TelemetryIngestionResult {
  success: boolean;
  reading?: TelemetryReadingResponse;
  error?: string;
  isDuplicate?: boolean;
}

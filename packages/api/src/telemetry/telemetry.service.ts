import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentService } from './equipment.service';
import { TelemetryPayloadSchema, TelemetryPayload, TelemetryIngestionResult } from './dto/telemetry.dto';
import { ZodError } from 'zod';
import { ResourceType } from '@prisma/client';

// Deduplication window in milliseconds (5 seconds)
const DEDUP_WINDOW_MS = 5000;

// Map telemetry dispensing types to ResourceType enum
const RESOURCE_TYPE_MAP: Record<string, ResourceType> = {
  seed: 'seed',
  fertilizer: 'fertilizer',
  lime: 'lime',
  pesticide: 'pesticide',
  herbicide: 'herbicide',
  fuel: 'fuel',
};

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly equipmentService: EquipmentService,
  ) {}

  /**
   * Ingest a telemetry reading from equipment
   * Validates payload, checks for duplicates, stores reading, and triggers alerts for fault codes
   */
  async ingestReading(payload: unknown): Promise<TelemetryIngestionResult> {
    // Validate payload schema
    let validatedPayload: TelemetryPayload;
    try {
      validatedPayload = TelemetryPayloadSchema.parse(payload);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        this.logger.warn(`Invalid telemetry payload: ${errorMessages}`);
        return {
          success: false,
          error: `Validation failed: ${errorMessages}`,
        };
      }
      throw error;
    }

    // Find equipment by deviceId
    const equipment = await this.equipmentService.findByDeviceId(validatedPayload.deviceId);
    if (!equipment) {
      this.logger.warn(`Equipment not found for deviceId: ${validatedPayload.deviceId}`);
      return {
        success: false,
        error: `Equipment with deviceId '${validatedPayload.deviceId}' not found`,
      };
    }

    const timestamp = new Date(validatedPayload.timestamp);

    // Check for duplicate within 5-second window
    const isDuplicate = await this.checkDuplicate(equipment.id, timestamp);
    if (isDuplicate) {
      this.logger.debug(`Duplicate telemetry reading detected for equipment ${equipment.id}`);
      return {
        success: true,
        isDuplicate: true,
      };
    }

    // Prepare resource dispensed data if present
    const resourceDispensed = validatedPayload.readings.dispensing
      ? {
          resourceType: validatedPayload.readings.dispensing.type,
          quantity: validatedPayload.readings.dispensing.quantity,
          unit: validatedPayload.readings.dispensing.unit,
          fieldId: validatedPayload.readings.dispensing.fieldId,
          zoneId: validatedPayload.readings.dispensing.zoneId,
        }
      : null;

    // Store the telemetry reading using raw SQL for TimescaleDB hypertable
    const reading = await this.storeTelemetryReading({
      time: timestamp,
      equipmentId: equipment.id,
      operatingHours: validatedPayload.readings.operatingHours ?? null,
      fuelLevel: validatedPayload.readings.fuelLevel ?? null,
      speed: validatedPayload.readings.speed ?? null,
      engineRpm: validatedPayload.readings.engineRpm ?? null,
      latitude: validatedPayload.readings.latitude ?? null,
      longitude: validatedPayload.readings.longitude ?? null,
      faultCodes: validatedPayload.readings.faultCodes ?? [],
      resourceDispensed,
      rawData: validatedPayload,
    });

    // Update equipment's last telemetry timestamp
    await this.equipmentService.updateLastTelemetryAt(equipment.id, timestamp);

    // Check for fault codes and create maintenance alerts
    if (validatedPayload.readings.faultCodes && validatedPayload.readings.faultCodes.length > 0) {
      await this.createMaintenanceAlert(equipment.id, validatedPayload.readings.faultCodes);
    }

    // Create resource application record if dispensing data is present with a fieldId
    if (validatedPayload.readings.dispensing && validatedPayload.readings.dispensing.fieldId) {
      await this.createResourceApplicationFromTelemetry(
        equipment.farmId,
        validatedPayload.readings.dispensing,
        timestamp,
      );
    }

    return {
      success: true,
      reading: {
        time: reading.time,
        equipmentId: reading.equipmentId,
        operatingHours: reading.operatingHours,
        fuelLevel: reading.fuelLevel,
        speed: reading.speed,
        engineRpm: reading.engineRpm,
        faultCodes: reading.faultCodes,
        resourceDispensed: reading.resourceDispensed,
        rawData: reading.rawData,
      },
    };
  }

  /**
   * Check if a duplicate reading exists within the deduplication window
   */
  private async checkDuplicate(equipmentId: string, timestamp: Date): Promise<boolean> {
    const windowStart = new Date(timestamp.getTime() - DEDUP_WINDOW_MS);
    const windowEnd = new Date(timestamp.getTime() + DEDUP_WINDOW_MS);

    const existing = await this.prisma.telemetryReading.findFirst({
      where: {
        equipmentId,
        time: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
    });

    return existing !== null;
  }

  /**
   * Store telemetry reading to the database
   */
  private async storeTelemetryReading(data: {
    time: Date;
    equipmentId: string;
    operatingHours: number | null;
    fuelLevel: number | null;
    speed: number | null;
    engineRpm: number | null;
    latitude: number | null;
    longitude: number | null;
    faultCodes: string[];
    resourceDispensed: unknown | null;
    rawData: unknown;
  }) {
    // Use raw SQL for location point if coordinates are provided
    if (data.latitude !== null && data.longitude !== null) {
      await this.prisma.$executeRaw`
        INSERT INTO telemetry_readings (
          time, equipment_id, location, operating_hours, fuel_level, 
          speed, engine_rpm, fault_codes, resource_dispensed, raw_data
        ) VALUES (
          ${data.time}, 
          ${data.equipmentId}::uuid, 
          ST_SetSRID(ST_MakePoint(${data.longitude}, ${data.latitude}), 4326)::geography,
          ${data.operatingHours},
          ${data.fuelLevel},
          ${data.speed},
          ${data.engineRpm},
          ${data.faultCodes},
          ${JSON.stringify(data.resourceDispensed)}::jsonb,
          ${JSON.stringify(data.rawData)}::jsonb
        )
      `;
    } else {
      await this.prisma.$executeRaw`
        INSERT INTO telemetry_readings (
          time, equipment_id, operating_hours, fuel_level, 
          speed, engine_rpm, fault_codes, resource_dispensed, raw_data
        ) VALUES (
          ${data.time}, 
          ${data.equipmentId}::uuid, 
          ${data.operatingHours},
          ${data.fuelLevel},
          ${data.speed},
          ${data.engineRpm},
          ${data.faultCodes},
          ${JSON.stringify(data.resourceDispensed)}::jsonb,
          ${JSON.stringify(data.rawData)}::jsonb
        )
      `;
    }

    // Return the stored reading
    return {
      time: data.time,
      equipmentId: data.equipmentId,
      operatingHours: data.operatingHours,
      fuelLevel: data.fuelLevel,
      speed: data.speed,
      engineRpm: data.engineRpm,
      faultCodes: data.faultCodes,
      resourceDispensed: data.resourceDispensed,
      rawData: data.rawData,
    };
  }

  /**
   * Create a maintenance alert for fault codes
   */
  async createMaintenanceAlert(equipmentId: string, faultCodes: string[]): Promise<void> {
    const severity = this.determineSeverity(faultCodes);
    const message = `Fault codes detected: ${faultCodes.join(', ')}`;

    await this.prisma.maintenanceAlert.create({
      data: {
        equipmentId,
        type: 'fault_code',
        severity,
        message,
        faultCodes,
      },
    });

    this.logger.log(`Maintenance alert created for equipment ${equipmentId}: ${message}`);
  }

  /**
   * Create a resource application record from telemetry dispensing data
   * This is called automatically when telemetry contains resource dispensing information
   */
  private async createResourceApplicationFromTelemetry(
    farmId: string,
    dispensing: {
      type: string;
      quantity: number;
      unit: string;
      fieldId?: string;
      zoneId?: string;
    },
    timestamp: Date,
  ): Promise<void> {
    // fieldId is required for creating a resource application
    if (!dispensing.fieldId) {
      this.logger.warn('Cannot create resource application: fieldId is required');
      return;
    }

    // Map the dispensing type to ResourceType enum
    const resourceType = RESOURCE_TYPE_MAP[dispensing.type.toLowerCase()];
    if (!resourceType) {
      this.logger.warn(`Unknown resource type in telemetry: ${dispensing.type}`);
      return;
    }

    // Verify the field exists and belongs to the farm
    const field = await this.prisma.field.findFirst({
      where: { id: dispensing.fieldId, farmId },
    });

    if (!field) {
      this.logger.warn(
        `Field ${dispensing.fieldId} not found or does not belong to farm ${farmId}`,
      );
      return;
    }

    // Verify zone exists and belongs to the field if provided
    if (dispensing.zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: dispensing.zoneId, fieldId: dispensing.fieldId },
      });

      if (!zone) {
        this.logger.warn(
          `Zone ${dispensing.zoneId} not found or does not belong to field ${dispensing.fieldId}`,
        );
        return;
      }
    }

    // Create the resource application record
    await this.prisma.resourceApplication.create({
      data: {
        farmId,
        fieldId: dispensing.fieldId,
        zoneId: dispensing.zoneId,
        resourceType,
        quantity: dispensing.quantity,
        unit: dispensing.unit,
        date: timestamp,
        notes: 'Automatically created from equipment telemetry',
      },
    });

    this.logger.log(
      `Resource application created from telemetry: ${dispensing.quantity} ${dispensing.unit} of ${resourceType} to field ${dispensing.fieldId}`,
    );
  }

  /**
   * Determine alert severity based on fault codes
   * This is a simplified implementation - in production, you'd have a fault code database
   */
  private determineSeverity(faultCodes: string[]): 'low' | 'medium' | 'high' | 'critical' {
    // Critical codes typically start with 'E' (engine) or 'C' (critical)
    if (faultCodes.some(code => code.startsWith('E') || code.startsWith('C'))) {
      return 'critical';
    }
    // High severity for transmission or hydraulic issues
    if (faultCodes.some(code => code.startsWith('T') || code.startsWith('H'))) {
      return 'high';
    }
    // Medium for sensor issues
    if (faultCodes.some(code => code.startsWith('S'))) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get telemetry readings for equipment within a time range
   */
  async getReadings(
    equipmentId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<unknown[]> {
    const readings = await this.prisma.telemetryReading.findMany({
      where: {
        equipmentId,
        time: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { time: 'desc' },
    });

    return readings;
  }

  /**
   * Get the latest telemetry reading for equipment
   */
  async getLatestReading(equipmentId: string): Promise<unknown | null> {
    const reading = await this.prisma.telemetryReading.findFirst({
      where: { equipmentId },
      orderBy: { time: 'desc' },
    });

    return reading;
  }
}

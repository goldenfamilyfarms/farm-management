// Equipment and telemetry types

import type { GeoPoint } from './common.js';

export type EquipmentType = 'tractor' | 'harvester' | 'sprayer' | 'irrigation' | 'planter' | 'other';
export type EquipmentStatus = 'active' | 'maintenance' | 'inactive';
export type ResourceType = 'seed' | 'fertilizer' | 'lime' | 'pesticide' | 'herbicide' | 'fuel';

export interface Equipment {
  id: string;
  farmId: string;
  name: string;
  type: EquipmentType;
  make: string;
  model: string;
  serialNumber: string;
  deviceId: string;
  status: EquipmentStatus;
  lastTelemetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceDispensing {
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  fieldId?: string;
  zoneId?: string;
}

export interface TelemetryReading {
  id: string;
  equipmentId: string;
  timestamp: Date;
  location?: GeoPoint;
  operatingHours: number;
  fuelLevel?: number;
  speed?: number;
  engineRpm?: number;
  faultCodes?: string[];
  resourceDispensed?: ResourceDispensing;
  rawData: Record<string, unknown>;
}

export interface TelemetryPayload {
  deviceId: string;
  timestamp: string;
  readings: {
    operatingHours?: number;
    fuelLevel?: number;
    speed?: number;
    engineRpm?: number;
    latitude?: number;
    longitude?: number;
    faultCodes?: string[];
    dispensing?: {
      type: string;
      quantity: number;
      unit: string;
    };
  };
  metadata?: Record<string, unknown>;
}

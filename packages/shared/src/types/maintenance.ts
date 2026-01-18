// Equipment maintenance types

export type MaintenanceType = 'scheduled' | 'repair' | 'inspection' | 'emergency';

export interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  type: MaintenanceType;
  description: string;
  cost: number;
  performedAt: Date;
  performedBy: string;
  notes?: string;
  nextServiceHours?: number;
  nextServiceDate?: Date;
}

export interface MaintenanceAlert {
  id: string;
  equipmentId: string;
  type: 'fault_code' | 'service_due' | 'inspection_due';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  faultCodes?: string[];
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
}

export interface CreateMaintenanceRecordInput {
  equipmentId: string;
  type: MaintenanceType;
  description: string;
  cost: number;
  performedAt: Date;
  performedBy: string;
  notes?: string;
  nextServiceHours?: number;
  nextServiceDate?: Date;
}

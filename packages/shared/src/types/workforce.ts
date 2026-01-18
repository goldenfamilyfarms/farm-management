// Workforce management types

import type { GeoPoint, DateRange } from './common.js';

export type TimeCardStatus = 'active' | 'pending_approval' | 'approved' | 'rejected';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type EmploymentType = 'full_time' | 'part_time' | 'seasonal' | 'contractor';

export interface Certification {
  name: string;
  issuedBy: string;
  issuedDate: Date;
  expiryDate?: Date;
}

export interface Worker {
  id: string;
  userId: string;
  farmId: string;
  skills: string[];
  certifications: Certification[];
  hourlyRate: number;
  employmentType: EmploymentType;
  startDate: Date;
  endDate?: Date;
}

export interface TimeCard {
  id: string;
  farmId: string;
  workerId: string;
  clockIn: Date;
  clockOut?: Date;
  clockInLocation?: GeoPoint;
  clockOutLocation?: GeoPoint;
  totalHours?: number;
  status: TimeCardStatus;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
}

export interface Task {
  id: string;
  farmId: string;
  title: string;
  description: string;
  fieldId?: string;
  zoneId?: string;
  assignedTo: string[];
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: Date;
  completedAt?: Date;
  completedBy?: string;
  completionNotes?: string;
  attachments?: string[];
  estimatedHours?: number;
  actualHours?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Schedule {
  id: string;
  farmId: string;
  workerId: string;
  date: Date;
  startTime: string;
  endTime: string;
  role?: string;
  notes?: string;
}

export interface PayrollSummary {
  payPeriod: DateRange;
  workers: WorkerPayrollEntry[];
  totalHours: number;
  totalCost: number;
}

export interface WorkerPayrollEntry {
  workerId: string;
  workerName: string;
  regularHours: number;
  overtimeHours: number;
  totalPay: number;
  timeCards: TimeCard[];
}

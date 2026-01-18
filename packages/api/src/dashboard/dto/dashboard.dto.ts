export interface EquipmentStatsDto {
  total: number;
  active: number;
  inMaintenance: number;
  inactive: number;
}

export interface WorkforceStatsDto {
  totalWorkers: number;
  clockedIn: number;
  clockedInToday: number;
}

export interface TaskStatsDto {
  pending: number;
  inProgress: number;
  completedToday: number;
  overdue: number;
}

export interface FieldStatsDto {
  totalFields: number;
  totalAcreage: number;
  totalZones: number;
}

export interface FinancialSummaryDto {
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  revenueChangePercent: number | null;
}

export interface ActivityItemDto {
  type: 'task_completed' | 'maintenance_alert' | 'clock_in' | 'clock_out' | 'harvest' | 'expense';
  title: string;
  description: string;
  timestamp: Date;
  entityId?: string;
}

export interface DashboardDataDto {
  equipment: EquipmentStatsDto;
  workforce: WorkforceStatsDto;
  tasks: TaskStatsDto;
  fields: FieldStatsDto;
  financial: FinancialSummaryDto;
  recentActivity: ActivityItemDto[];
}

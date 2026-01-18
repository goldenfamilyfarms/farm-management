import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface EquipmentStats {
  total: number;
  active: number;
  inMaintenance: number;
  inactive: number;
}

export interface WorkforceStats {
  totalWorkers: number;
  clockedIn: number;
  clockedInToday: number;
}

export interface TaskStats {
  pending: number;
  inProgress: number;
  completedToday: number;
  overdue: number;
}

export interface FieldStats {
  totalFields: number;
  totalAcreage: number;
  totalZones: number;
}

export interface FinancialSummary {
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  revenueChangePercent: number | null;
}

export interface ActivityItem {
  type: 'task_completed' | 'maintenance_alert' | 'clock_in' | 'clock_out' | 'harvest' | 'expense';
  title: string;
  description: string;
  timestamp: string;
  entityId?: string;
}

export interface DashboardData {
  equipment: EquipmentStats;
  workforce: WorkforceStats;
  tasks: TaskStats;
  fields: FieldStats;
  financial: FinancialSummary;
  recentActivity: ActivityItem[];
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardData>('/dashboard'),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}

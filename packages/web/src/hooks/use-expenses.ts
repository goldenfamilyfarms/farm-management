import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/use-toast';

export type ExpenseCategory =
  | 'seed'
  | 'fertilizer'
  | 'chemicals'
  | 'fuel'
  | 'labor'
  | 'equipment_maintenance'
  | 'equipment_depreciation'
  | 'land_rent'
  | 'utilities'
  | 'insurance'
  | 'other';

export interface Expense {
  id: string;
  farmId: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  date: string;
  description: string | null;
  fieldId: string | null;
  cropType: string | null;
  vendor: string | null;
  receiptUrl: string | null;
  createdBy: string;
  createdAt: string;
  field?: {
    id: string;
    name: string;
  } | null;
}

export interface CreateExpenseDto {
  category: ExpenseCategory;
  amount: number;
  currency?: string;
  date: string;
  description?: string;
  fieldId?: string;
  cropType?: string;
  vendor?: string;
  receiptUrl?: string;
}

export interface UpdateExpenseDto {
  category?: ExpenseCategory;
  amount?: number;
  currency?: string;
  date?: string;
  description?: string;
  fieldId?: string;
  cropType?: string;
  vendor?: string;
  receiptUrl?: string;
}

export interface ExpenseFilters {
  fieldId?: string;
  category?: ExpenseCategory;
  cropType?: string;
  startDate?: string;
  endDate?: string;
}

export interface CategoryBreakdown {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
  count: number;
}

export interface FieldBreakdown {
  fieldId: string;
  fieldName: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface TimePeriodBreakdown {
  period: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface CostReport {
  reportId: string;
  generatedAt: string;
  dateRange: { startDate: string; endDate: string };
  totalCost: number;
  totalExpenseCount: number;
  byCategory: CategoryBreakdown[];
  byField: FieldBreakdown[];
  byTimePeriod: TimePeriodBreakdown[];
  expenses: Expense[];
}

// Category display names and colors
export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; color: string }> = {
  seed: { label: 'Seed', color: '#22C55E' },
  fertilizer: { label: 'Fertilizer', color: '#84CC16' },
  chemicals: { label: 'Chemicals', color: '#EAB308' },
  fuel: { label: 'Fuel', color: '#F97316' },
  labor: { label: 'Labor', color: '#3B82F6' },
  equipment_maintenance: { label: 'Equipment Maintenance', color: '#8B5CF6' },
  equipment_depreciation: { label: 'Equipment Depreciation', color: '#A855F7' },
  land_rent: { label: 'Land Rent', color: '#EC4899' },
  utilities: { label: 'Utilities', color: '#14B8A6' },
  insurance: { label: 'Insurance', color: '#6366F1' },
  other: { label: 'Other', color: '#6B7280' },
};

/**
 * Hook to fetch all expenses with optional filters
 */
export function useExpenses(filters?: ExpenseFilters) {
  const params = new URLSearchParams();
  if (filters?.fieldId) params.append('fieldId', filters.fieldId);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.cropType) params.append('cropType', filters.cropType);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);

  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery<Expense[]>({
    queryKey: ['expenses', filters],
    queryFn: () => apiClient.get<Expense[]>(`/expenses${queryString}`),
  });
}

/**
 * Hook to fetch a single expense by ID
 */
export function useExpense(expenseId: string | undefined) {
  return useQuery<Expense>({
    queryKey: ['expenses', expenseId],
    queryFn: () => apiClient.get<Expense>(`/expenses/${expenseId}`),
    enabled: !!expenseId,
  });
}

/**
 * Hook to fetch cost report with breakdowns
 */
export function useCostReport(startDate: string, endDate: string) {
  return useQuery<CostReport>({
    queryKey: ['cost-report', startDate, endDate],
    queryFn: () =>
      apiClient.get<CostReport>(`/reports/costs?startDate=${startDate}&endDate=${endDate}`),
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Hook to create a new expense
 */
export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (dto: CreateExpenseDto) => apiClient.post<Expense>('/expenses', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cost-report'] });
      toast({
        title: 'Expense Created',
        description: 'The expense has been recorded successfully.',
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message || 'Failed to create expense.',
      });
    },
  });
}

/**
 * Hook to update an expense
 */
export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateExpenseDto }) =>
      apiClient.put<Expense>(`/expenses/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cost-report'] });
      toast({
        title: 'Expense Updated',
        description: 'The expense has been updated successfully.',
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update expense.',
      });
    },
  });
}

/**
 * Hook to delete an expense
 */
export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cost-report'] });
      toast({
        title: 'Expense Deleted',
        description: 'The expense has been deleted.',
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: error.message || 'Failed to delete expense.',
      });
    },
  });
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

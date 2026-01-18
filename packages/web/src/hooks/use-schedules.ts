import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/use-toast';
import { Worker } from './use-time-clock';

export interface Schedule {
  id: string;
  farmId: string;
  workerId: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string | null;
  notes: string | null;
  createdAt: string;
  worker?: {
    id: string;
    userId: string;
    user?: {
      email: string;
      profile: {
        firstName?: string;
        lastName?: string;
      };
    };
  };
}

export interface CreateScheduleDto {
  workerId: string;
  date: string;
  startTime: string;
  endTime: string;
  role?: string;
  notes?: string;
}

export interface UpdateScheduleDto {
  date?: string;
  startTime?: string;
  endTime?: string;
  role?: string;
  notes?: string;
}

export interface ScheduleConflict {
  existingScheduleId: string;
  date: string;
  existingStartTime: string;
  existingEndTime: string;
  newStartTime: string;
  newEndTime: string;
}

/**
 * Hook to fetch schedules within a date range
 */
export function useSchedules(startDate: string, endDate: string) {
  return useQuery<Schedule[]>({
    queryKey: ['schedules', startDate, endDate],
    queryFn: () =>
      apiClient.get<Schedule[]>(
        `/schedules?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Hook to fetch schedules for a specific worker
 */
export function useWorkerSchedules(
  workerId: string | undefined,
  startDate: string,
  endDate: string
) {
  return useQuery<Schedule[]>({
    queryKey: ['schedules', 'worker', workerId, startDate, endDate],
    queryFn: () =>
      apiClient.get<Schedule[]>(
        `/schedules/worker/${workerId}?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!workerId && !!startDate && !!endDate,
  });
}

/**
 * Hook to fetch all workers
 */
export function useWorkers() {
  return useQuery<Worker[]>({
    queryKey: ['workers'],
    queryFn: () => apiClient.get<Worker[]>('/workers'),
  });
}

/**
 * Hook to create a new schedule
 */
export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (dto: CreateScheduleDto) =>
      apiClient.post<Schedule>('/schedules', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({
        title: 'Schedule Created',
        description: 'The shift has been scheduled successfully.',
      });
    },
    onError: (error: Error & { message?: string; conflicts?: ScheduleConflict[] }) => {
      const message = error.message || 'Failed to create schedule.';
      toast({
        variant: 'destructive',
        title: 'Schedule Creation Failed',
        description: message.includes('conflict')
          ? 'This shift conflicts with an existing schedule.'
          : message,
      });
    },
  });
}

/**
 * Hook to update an existing schedule
 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateScheduleDto }) =>
      apiClient.put<Schedule>(`/schedules/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({
        title: 'Schedule Updated',
        description: 'The shift has been updated successfully.',
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update schedule.',
      });
    },
  });
}

/**
 * Hook to delete a schedule
 */
export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({
        title: 'Schedule Deleted',
        description: 'The shift has been removed.',
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: error.message || 'Failed to delete schedule.',
      });
    },
  });
}

/**
 * Utility function to get the start and end of a week
 */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day; // Adjust to Sunday
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Utility function to get the start and end of a month
 */
export function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Format date to YYYY-MM-DD string
 */
export function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

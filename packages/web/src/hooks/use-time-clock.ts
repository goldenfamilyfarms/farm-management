import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/use-toast';

export type TimeCardStatus = 'active' | 'pending_approval' | 'approved' | 'rejected';

export interface Worker {
  id: string;
  userId: string;
  farmId: string;
  skills: string[];
  hourlyRate: number | null;
  employmentType: string;
  startDate: string;
  endDate: string | null;
  user?: {
    id: string;
    email: string;
    role: string;
    profile: {
      firstName?: string;
      lastName?: string;
    };
  };
}

export interface TimeCard {
  id: string;
  farmId: string;
  workerId: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number | null;
  status: TimeCardStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  flaggedForReview: boolean;
  createdAt: string;
  worker?: Worker;
}

interface ClockInDto {
  workerId: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

interface ClockOutDto {
  latitude?: number;
  longitude?: number;
  notes?: string;
}

/**
 * Hook to get the current worker profile for the logged-in user
 */
export function useCurrentWorker(userId: string | undefined) {
  return useQuery<Worker>({
    queryKey: ['worker', 'user', userId],
    queryFn: () => apiClient.get<Worker>(`/workers/user/${userId}`),
    enabled: !!userId,
    retry: false,
  });
}

/**
 * Hook to get the active time card for a worker
 */
export function useActiveTimeCard(workerId: string | undefined) {
  return useQuery<TimeCard | null>({
    queryKey: ['time-cards', 'active', workerId],
    queryFn: async () => {
      try {
        return await apiClient.get<TimeCard>(`/time-cards/active/${workerId}`);
      } catch {
        // No active time card returns 404, which is expected
        return null;
      }
    },
    enabled: !!workerId,
    refetchInterval: 30000, // Refetch every 30 seconds to keep shift time updated
  });
}

/**
 * Hook to get recent time cards for a worker
 */
export function useRecentTimeCards(workerId: string | undefined, limit: number = 5) {
  return useQuery<TimeCard[]>({
    queryKey: ['time-cards', 'worker', workerId, limit],
    queryFn: async () => {
      const cards = await apiClient.get<TimeCard[]>(`/time-cards/worker/${workerId}`);
      return cards.slice(0, limit);
    },
    enabled: !!workerId,
  });
}

/**
 * Hook to clock in a worker
 */
export function useClockIn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (dto: ClockInDto) => apiClient.post<TimeCard>('/time-cards/clock-in', dto),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({
        title: 'Clocked In',
        description: `You clocked in at ${new Date(data.clockIn).toLocaleTimeString()}`,
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        variant: 'destructive',
        title: 'Clock In Failed',
        description: error.message || 'Failed to clock in. Please try again.',
      });
    },
  });
}

/**
 * Hook to clock out a worker
 */
export function useClockOut() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ timeCardId, dto }: { timeCardId: string; dto?: ClockOutDto }) =>
      apiClient.post<TimeCard>(`/time-cards/${timeCardId}/clock-out`, dto || {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const hours = data.totalHours?.toFixed(2) || '0';
      toast({
        title: 'Clocked Out',
        description: `You worked ${hours} hours this shift`,
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        variant: 'destructive',
        title: 'Clock Out Failed',
        description: error.message || 'Failed to clock out. Please try again.',
      });
    },
  });
}

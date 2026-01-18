import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/use-toast';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Task {
  id: string;
  farmId: string;
  title: string;
  description: string | null;
  fieldId: string | null;
  zoneId: string | null;
  assignedTo: string[];
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  completedBy: string | null;
  completionNotes: string | null;
  attachments: string[];
  estimatedHours: number | null;
  actualHours: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  field?: {
    id: string;
    name: string;
  } | null;
  zone?: {
    id: string;
    name: string;
  } | null;
}

interface TaskQueryParams {
  status?: TaskStatus;
  priority?: TaskPriority;
  fieldId?: string;
  assignedTo?: string;
}

interface CompleteTaskDto {
  completionNotes?: string;
  actualHours?: number;
}

/**
 * Hook to fetch all tasks with optional filters
 */
export function useTasks(params?: TaskQueryParams) {
  const queryString = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';

  return useQuery<Task[]>({
    queryKey: ['tasks', params],
    queryFn: () => apiClient.get<Task[]>(`/tasks${queryString}`),
  });
}

/**
 * Hook to fetch a single task by ID
 */
export function useTask(taskId: string | undefined) {
  return useQuery<Task>({
    queryKey: ['tasks', taskId],
    queryFn: () => apiClient.get<Task>(`/tasks/${taskId}`),
    enabled: !!taskId,
  });
}

/**
 * Hook to update task status (for drag-and-drop)
 */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      apiClient.patch<Task>(`/tasks/${taskId}/status`, { status }),
    onMutate: async ({ taskId, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks', undefined]);

      // Optimistically update
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(['tasks', undefined], 
          previousTasks.map(task => 
            task.id === taskId ? { ...task, status } : task
          )
        );
      }

      return { previousTasks };
    },
    onError: (error: Error & { message?: string }, _variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', undefined], context.previousTasks);
      }
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update task status.',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/**
 * Hook to complete a task
 */
export function useCompleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ taskId, dto }: { taskId: string; dto?: CompleteTaskDto }) =>
      apiClient.patch<Task>(`/tasks/${taskId}/complete`, dto || {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: 'Task Completed',
        description: `"${data.title}" has been marked as complete.`,
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        variant: 'destructive',
        title: 'Completion Failed',
        description: error.message || 'Failed to complete task.',
      });
    },
  });
}

/**
 * Hook to update a task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: Partial<Task> }) =>
      apiClient.put<Task>(`/tasks/${taskId}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: 'Task Updated',
        description: `"${data.title}" has been updated.`,
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update task.',
      });
    },
  });
}

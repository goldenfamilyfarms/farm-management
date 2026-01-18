import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Task, TaskPriority, TaskStatus, useCompleteTask, useUpdateTaskStatus } from '@/hooks/use-tasks';
import { Calendar, Clock, MapPin, User, CheckCircle2, AlertCircle } from 'lucide-react';

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityConfig: Record<TaskPriority, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'warning' }> = {
  low: { label: 'Low', variant: 'secondary' },
  medium: { label: 'Medium', variant: 'default' },
  high: { label: 'High', variant: 'warning' },
  urgent: { label: 'Urgent', variant: 'destructive' },
};

const statusConfig: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  in_progress: { label: 'In Progress', variant: 'default' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
};

function formatDateTime(dateString: string | null): string {
  if (!dateString) return 'Not set';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not set';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (!dueDate || status === 'completed' || status === 'cancelled') return false;
  return new Date(dueDate) < new Date();
}

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  const [completionNotes, setCompletionNotes] = useState('');
  const [actualHours, setActualHours] = useState('');
  const completeTask = useCompleteTask();
  const updateStatus = useUpdateTaskStatus();

  if (!task) return null;

  const priority = priorityConfig[task.priority];
  const status = statusConfig[task.status];
  const overdue = isOverdue(task.dueDate, task.status);

  const handleComplete = () => {
    completeTask.mutate(
      {
        taskId: task.id,
        dto: {
          completionNotes: completionNotes || undefined,
          actualHours: actualHours ? parseFloat(actualHours) : undefined,
        },
      },
      {
        onSuccess: () => {
          setCompletionNotes('');
          setActualHours('');
          onOpenChange(false);
        },
      }
    );
  };

  const handleStartTask = () => {
    updateStatus.mutate(
      { taskId: task.id, status: 'in_progress' },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <DialogTitle className="text-xl">{task.title}</DialogTitle>
              <DialogDescription className="mt-1">
                Created {formatDateTime(task.createdAt)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Priority Badges */}
          <div className="flex items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant={priority.variant}>{priority.label}</Badge>
            {overdue && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Overdue
              </Badge>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-sm font-medium mb-1">Description</h4>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
          )}

          <Separator />

          {/* Task Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Due Date</p>
                <p className={`font-medium ${overdue ? 'text-destructive' : ''}`}>
                  {formatDate(task.dueDate)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Estimated Hours</p>
                <p className="font-medium">
                  {task.estimatedHours ? `${task.estimatedHours}h` : 'Not set'}
                </p>
              </div>
            </div>

            {task.field && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Field</p>
                  <p className="font-medium">{task.field.name}</p>
                </div>
              </div>
            )}

            {task.zone && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Zone</p>
                  <p className="font-medium">{task.zone.name}</p>
                </div>
              </div>
            )}

            {task.assignedTo.length > 0 && (
              <div className="flex items-center gap-2 col-span-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Assigned To</p>
                  <p className="font-medium">{task.assignedTo.length} worker(s)</p>
                </div>
              </div>
            )}
          </div>

          {/* Completion Info (if completed) */}
          {task.status === 'completed' && (
            <>
              <Separator />
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Completed</span>
                </div>
                <div className="text-sm text-green-600 space-y-1">
                  <p>Completed on: {formatDateTime(task.completedAt)}</p>
                  {task.actualHours && <p>Actual hours: {task.actualHours}h</p>}
                  {task.completionNotes && <p>Notes: {task.completionNotes}</p>}
                </div>
              </div>
            </>
          )}

          {/* Completion Form (if not completed) */}
          {task.status !== 'completed' && task.status !== 'cancelled' && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Complete Task</h4>
                <div className="space-y-2">
                  <Label htmlFor="actualHours">Actual Hours</Label>
                  <Input
                    id="actualHours"
                    type="number"
                    step="0.5"
                    placeholder="Enter hours worked"
                    value={actualHours}
                    onChange={(e) => setActualHours(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="completionNotes">Completion Notes</Label>
                  <Input
                    id="completionNotes"
                    placeholder="Add any notes about the completed work"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {task.status === 'pending' && (
            <Button onClick={handleStartTask} disabled={updateStatus.isPending}>
              Start Task
            </Button>
          )}
          {(task.status === 'pending' || task.status === 'in_progress') && (
            <Button
              onClick={handleComplete}
              disabled={completeTask.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark Complete
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Schedule,
  CreateScheduleDto,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useWorkers,
} from '@/hooks/use-schedules';
import { Worker } from '@/hooks/use-time-clock';

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: Schedule | null;
  selectedDate?: Date;
  selectedWorkerId?: string;
}

function getWorkerName(worker: Worker): string {
  if (worker.user?.profile) {
    const { firstName, lastName } = worker.user.profile;
    if (firstName || lastName) {
      return `${firstName || ''} ${lastName || ''}`.trim();
    }
  }
  return worker.user?.email || 'Unknown Worker';
}

export function ScheduleDialog({
  open,
  onOpenChange,
  schedule,
  selectedDate,
  selectedWorkerId,
}: ScheduleDialogProps) {
  const { data: workers = [] } = useWorkers();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();

  const [workerId, setWorkerId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');

  const isEditing = !!schedule;
  const isLoading =
    createSchedule.isPending ||
    updateSchedule.isPending ||
    deleteSchedule.isPending;

  // Reset form when dialog opens/closes or schedule changes
  useEffect(() => {
    if (open) {
      if (schedule) {
        setWorkerId(schedule.workerId);
        setDate(schedule.date.split('T')[0]);
        setStartTime(schedule.startTime);
        setEndTime(schedule.endTime);
        setRole(schedule.role || '');
        setNotes(schedule.notes || '');
      } else {
        setWorkerId(selectedWorkerId || '');
        setDate(
          selectedDate
            ? selectedDate.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]
        );
        setStartTime('08:00');
        setEndTime('17:00');
        setRole('');
        setNotes('');
      }
    }
  }, [open, schedule, selectedDate, selectedWorkerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workerId || !date || !startTime || !endTime) {
      return;
    }

    const dto: CreateScheduleDto = {
      workerId,
      date,
      startTime,
      endTime,
      role: role || undefined,
      notes: notes || undefined,
    };

    try {
      if (isEditing && schedule) {
        await updateSchedule.mutateAsync({
          id: schedule.id,
          dto: {
            date,
            startTime,
            endTime,
            role: role || undefined,
            notes: notes || undefined,
          },
        });
      } else {
        await createSchedule.mutateAsync(dto);
      }
      onOpenChange(false);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleDelete = async () => {
    if (!schedule) return;

    if (window.confirm('Are you sure you want to delete this shift?')) {
      try {
        await deleteSchedule.mutateAsync(schedule.id);
        onOpenChange(false);
      } catch {
        // Error is handled by the mutation
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Shift' : 'Schedule New Shift'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the shift details below.'
              : 'Fill in the details to schedule a new shift.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="worker">Worker</Label>
            <Select
              value={workerId}
              onValueChange={setWorkerId}
              disabled={isEditing}
            >
              <SelectTrigger id="worker">
                <SelectValue placeholder="Select a worker" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {getWorkerName(worker)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role (Optional)</Label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Field Work, Equipment Operator"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading}
                className="mr-auto"
              >
                {deleteSchedule.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !workerId}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

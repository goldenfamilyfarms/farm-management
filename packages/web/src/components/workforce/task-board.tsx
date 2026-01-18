import { useState, DragEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTasks, useUpdateTaskStatus, Task, TaskStatus, TaskPriority } from '@/hooks/use-tasks';
import { TaskDetailDialog } from './task-detail-dialog';
import { Calendar, Clock, MapPin, GripVertical } from 'lucide-react';

interface KanbanColumn {
  id: TaskStatus;
  title: string;
  color: string;
}

const columns: KanbanColumn[] = [
  { id: 'pending', title: 'Pending', color: 'bg-slate-100' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50' },
  { id: 'completed', title: 'Completed', color: 'bg-green-50' },
];

const priorityConfig: Record<TaskPriority, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'warning' }> = {
  low: { label: 'Low', variant: 'secondary' },
  medium: { label: 'Medium', variant: 'default' },
  high: { label: 'High', variant: 'warning' },
  urgent: { label: 'Urgent', variant: 'destructive' },
};

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (!dueDate || status === 'completed' || status === 'cancelled') return false;
  return new Date(dueDate) < new Date();
}

interface TaskCardProps {
  task: Task;
  onDragStart: (e: DragEvent<HTMLDivElement>, task: Task) => void;
  onClick: () => void;
}

function TaskCard({ task, onDragStart, onClick }: TaskCardProps) {
  const overdue = isOverdue(task.dueDate, task.status);
  const priority = priorityConfig[task.priority];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={onClick}
      className="bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-medium text-sm leading-tight truncate">{task.title}</h4>
            <Badge variant={priority.variant} className="flex-shrink-0 text-xs">
              {priority.label}
            </Badge>
          </div>
          
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {task.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {task.dueDate && (
              <span className={`flex items-center gap-1 ${overdue ? 'text-destructive font-medium' : ''}`}>
                <Calendar className="h-3 w-3" />
                {formatDate(task.dueDate)}
                {overdue && ' (Overdue)'}
              </span>
            )}
            
            {task.estimatedHours && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.estimatedHours}h
              </span>
            )}
            
            {task.field && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {task.field.name}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  column: KanbanColumn;
  tasks: Task[];
  onDragStart: (e: DragEvent<HTMLDivElement>, task: Task) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>, status: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
  isDragOver: boolean;
}

function KanbanColumnComponent({
  column,
  tasks,
  onDragStart,
  onDragOver,
  onDrop,
  onTaskClick,
  isDragOver,
}: KanbanColumnProps) {
  return (
    <div
      className={`flex flex-col rounded-lg ${column.color} min-h-[400px] ${
        isDragOver ? 'ring-2 ring-primary ring-offset-2' : ''
      }`}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, column.id)}
    >
      <div className="p-3 border-b bg-white/50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{column.title}</h3>
          <Badge variant="outline" className="text-xs">
            {tasks.length}
          </Badge>
        </div>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onDragStart={onDragStart}
            onClick={() => onTaskClick(task)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskBoard() {
  const { data: tasks = [], isLoading, error } = useTasks();
  const updateStatus = useUpdateTaskStatus();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, newStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (draggedTask && draggedTask.status !== newStatus) {
      updateStatus.mutate({ taskId: draggedTask.id, status: newStatus });
    }
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const getTasksByStatus = (status: TaskStatus): Task[] => {
    return tasks.filter((task) => task.status === status);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Task Board</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Task Board</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-destructive">
            Failed to load tasks. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Task Board</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
            onDragEnd={handleDragEnd}
          >
            {columns.map((column) => (
              <KanbanColumnComponent
                key={column.id}
                column={column}
                tasks={getTasksByStatus(column.id)}
                onDragStart={handleDragStart}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDrop={handleDrop}
                onTaskClick={handleTaskClick}
                isDragOver={dragOverColumn === column.id}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <TaskDetailDialog
        task={selectedTask}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Users,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useSchedules,
  useWorkers,
  Schedule,
  getWeekRange,
  getMonthRange,
  formatDateString,
} from '@/hooks/use-schedules';
import { Worker } from '@/hooks/use-time-clock';
import { ScheduleDialog } from './schedule-dialog';

type ViewMode = 'week' | 'month';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Generate a consistent color for each worker based on their ID
function getWorkerColor(workerId: string): string {
  const colors = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-green-100 text-green-800 border-green-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-cyan-100 text-cyan-800 border-cyan-200',
    'bg-yellow-100 text-yellow-800 border-yellow-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
  ];
  
  let hash = 0;
  for (let i = 0; i < workerId.length; i++) {
    hash = workerId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getWorkerName(worker?: Worker | Schedule['worker']): string {
  if (!worker) return 'Unknown';
  if ('user' in worker && worker.user?.profile) {
    const { firstName, lastName } = worker.user.profile as { firstName?: string; lastName?: string };
    if (firstName || lastName) {
      return `${firstName || ''} ${lastName || ''}`.trim();
    }
    return worker.user?.email || 'Unknown';
  }
  return 'Unknown';
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

interface ScheduleItemProps {
  schedule: Schedule;
  onClick: () => void;
  compact?: boolean;
}

function ScheduleItem({ schedule, onClick, compact = false }: ScheduleItemProps) {
  const colorClass = getWorkerColor(schedule.workerId);
  const workerName = getWorkerName(schedule.worker);

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`text-xs p-1 rounded border cursor-pointer hover:opacity-80 truncate ${colorClass}`}
        title={`${workerName}: ${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}`}
      >
        {workerName.split(' ')[0]}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`text-xs p-2 rounded border cursor-pointer hover:opacity-80 ${colorClass}`}
    >
      <div className="font-medium truncate">{workerName}</div>
      <div className="text-[10px] opacity-75">
        {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
      </div>
      {schedule.role && (
        <div className="text-[10px] opacity-75 truncate">{schedule.role}</div>
      )}
    </div>
  );
}

interface DayCellProps {
  date: Date;
  schedules: Schedule[];
  isToday: boolean;
  isCurrentMonth: boolean;
  onScheduleClick: (schedule: Schedule) => void;
  onAddClick: (date: Date) => void;
  viewMode: ViewMode;
}

function DayCell({
  date,
  schedules,
  isToday,
  isCurrentMonth,
  onScheduleClick,
  onAddClick,
  viewMode,
}: DayCellProps) {
  const isWeekView = viewMode === 'week';
  const maxVisible = isWeekView ? 10 : 3;
  const visibleSchedules = schedules.slice(0, maxVisible);
  const hiddenCount = schedules.length - maxVisible;

  return (
    <div
      className={`min-h-[100px] ${isWeekView ? 'min-h-[200px]' : ''} border-r border-b p-1 ${
        isCurrentMonth ? 'bg-white' : 'bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
            isToday
              ? 'bg-primary text-primary-foreground'
              : isCurrentMonth
              ? 'text-foreground'
              : 'text-muted-foreground'
          }`}
        >
          {date.getDate()}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onAddClick(date);
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className={`space-y-1 ${isWeekView ? '' : 'max-h-[80px] overflow-hidden'}`}>
        {visibleSchedules.map((schedule) => (
          <ScheduleItem
            key={schedule.id}
            schedule={schedule}
            onClick={() => onScheduleClick(schedule)}
            compact={!isWeekView}
          />
        ))}
        {hiddenCount > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            +{hiddenCount} more
          </div>
        )}
      </div>
    </div>
  );
}

export function ScheduleCalendar() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedWorker, setSelectedWorker] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const { data: workers = [] } = useWorkers();

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      return getWeekRange(currentDate);
    }
    return getMonthRange(currentDate);
  }, [viewMode, currentDate]);

  const { data: schedules = [], isLoading } = useSchedules(
    formatDateString(dateRange.start),
    formatDateString(dateRange.end)
  );

  // Filter schedules by selected worker
  const filteredSchedules = useMemo(() => {
    if (selectedWorker === 'all') return schedules;
    return schedules.filter((s) => s.workerId === selectedWorker);
  }, [schedules, selectedWorker]);

  // Group schedules by date
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    filteredSchedules.forEach((schedule) => {
      const dateKey = schedule.date.split('T')[0];
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(schedule);
    });
    return map;
  }, [filteredSchedules]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    
    if (viewMode === 'week') {
      const { start } = getWeekRange(currentDate);
      for (let i = 0; i < 7; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        days.push(day);
      }
    } else {
      // Month view - include days from previous/next month to fill the grid
      const { start, end } = getMonthRange(currentDate);
      const firstDayOfMonth = start.getDay();
      
      // Add days from previous month
      for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const day = new Date(start);
        day.setDate(start.getDate() - i - 1);
        days.push(day);
      }
      
      // Add days of current month
      const current = new Date(start);
      while (current <= end) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      
      // Add days from next month to complete the grid
      const remainingDays = 42 - days.length; // 6 rows * 7 days
      for (let i = 1; i <= remainingDays; i++) {
        const day = new Date(end);
        day.setDate(end.getDate() + i);
        days.push(day);
      }
    }
    
    return days;
  }, [viewMode, currentDate]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const handleScheduleClick = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setSelectedDate(undefined);
    setDialogOpen(true);
  };

  const handleAddClick = (date: Date) => {
    setSelectedSchedule(null);
    setSelectedDate(date);
    setDialogOpen(true);
  };

  const getHeaderTitle = () => {
    if (viewMode === 'week') {
      const { start, end } = getWeekRange(currentDate);
      const startMonth = MONTHS[start.getMonth()];
      const endMonth = MONTHS[end.getMonth()];
      
      if (start.getMonth() === end.getMonth()) {
        return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  // Worker availability summary
  const workerAvailability = useMemo(() => {
    const availability = new Map<string, number>();
    filteredSchedules.forEach((schedule) => {
      const current = availability.get(schedule.workerId) || 0;
      // Calculate hours
      const [startH, startM] = schedule.startTime.split(':').map(Number);
      const [endH, endM] = schedule.endTime.split(':').map(Number);
      const hours = (endH * 60 + endM - startH * 60 - startM) / 60;
      availability.set(schedule.workerId, current + hours);
    });
    return availability;
  }, [filteredSchedules]);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Schedule Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                <SelectTrigger className="w-[180px]">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Workers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workers</SelectItem>
                  {workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {getWorkerName(worker)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSchedule(null);
                  setSelectedDate(new Date());
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Shift
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={navigateToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold ml-2">{getHeaderTitle()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant={viewMode === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('week')}
              >
                Week
              </Button>
              <Button
                variant={viewMode === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('month')}
              >
                Month
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Calendar Grid */}
          {!isLoading && (
            <div className="border-l border-t rounded-lg overflow-hidden">
              {/* Day Headers */}
              <div className="grid grid-cols-7">
                {DAYS_OF_WEEK.map((day) => (
                  <div
                    key={day}
                    className="border-r border-b bg-muted/50 p-2 text-center text-sm font-medium"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((date, index) => {
                  const dateKey = formatDateString(date);
                  const daySchedules = schedulesByDate.get(dateKey) || [];
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                  const dateOnly = new Date(date);
                  dateOnly.setHours(0, 0, 0, 0);
                  const isToday = dateOnly.getTime() === today.getTime();

                  return (
                    <div key={index} className="group">
                      <DayCell
                        date={date}
                        schedules={daySchedules}
                        isToday={isToday}
                        isCurrentMonth={isCurrentMonth}
                        onScheduleClick={handleScheduleClick}
                        onAddClick={handleAddClick}
                        viewMode={viewMode}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Worker Availability Summary */}
          {!isLoading && workers.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Scheduled Hours This {viewMode === 'week' ? 'Week' : 'Month'}
              </h4>
              <div className="flex flex-wrap gap-2">
                {workers.map((worker) => {
                  const hours = workerAvailability.get(worker.id) || 0;
                  const colorClass = getWorkerColor(worker.id);
                  return (
                    <Badge
                      key={worker.id}
                      variant="outline"
                      className={`${colorClass} border`}
                    >
                      {getWorkerName(worker)}: {hours.toFixed(1)}h
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        schedule={selectedSchedule}
        selectedDate={selectedDate}
      />
    </>
  );
}

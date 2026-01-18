import { TimeClockWidget, TaskBoard, ScheduleCalendar } from '@/components/workforce';

export function WorkforcePage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workforce</h1>
        <p className="text-muted-foreground">
          Manage time tracking, tasks, and schedules
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Time Clock Widget */}
        <div className="lg:col-span-1">
          <TimeClockWidget />
        </div>

        {/* Task Board */}
        <div className="lg:col-span-2">
          <TaskBoard />
        </div>
      </div>

      {/* Schedule Calendar */}
      <ScheduleCalendar />
    </div>
  );
}

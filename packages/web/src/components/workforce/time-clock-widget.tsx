import { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  Square,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import {
  useCurrentWorker,
  useActiveTimeCard,
  useRecentTimeCards,
  useClockIn,
  useClockOut,
  TimeCard,
  TimeCardStatus,
} from '@/hooks/use-time-clock';

/**
 * Format a duration in milliseconds to a human-readable string
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format a date to a time string
 */
function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date to a date string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Get status badge color and icon
 */
function getStatusBadge(status: TimeCardStatus): {
  color: string;
  bgColor: string;
  icon: React.ElementType;
  label: string;
} {
  switch (status) {
    case 'active':
      return {
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        icon: Play,
        label: 'Active',
      };
    case 'pending_approval':
      return {
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
        icon: Clock,
        label: 'Pending',
      };
    case 'approved':
      return {
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
        icon: CheckCircle,
        label: 'Approved',
      };
    case 'rejected':
      return {
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        icon: XCircle,
        label: 'Rejected',
      };
    default:
      return {
        color: 'text-gray-700',
        bgColor: 'bg-gray-100',
        icon: Clock,
        label: status,
      };
  }
}

interface CurrentShiftDisplayProps {
  timeCard: TimeCard;
}

function CurrentShiftDisplay({ timeCard }: CurrentShiftDisplayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const clockInTime = new Date(timeCard.clockIn).getTime();
    
    const updateElapsed = () => {
      setElapsed(Date.now() - clockInTime);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [timeCard.clockIn]);

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-green-700">Currently Working</span>
        </div>
        <span className="text-xs text-green-600">
          Started at {formatTime(timeCard.clockIn)}
        </span>
      </div>
      <div className="flex items-center justify-center gap-2 py-2">
        <Timer className="h-6 w-6 text-green-600" />
        <span className="text-3xl font-bold text-green-700 font-mono">
          {formatDuration(elapsed)}
        </span>
      </div>
      {timeCard.flaggedForReview && (
        <div className="flex items-center gap-2 text-yellow-600 text-xs">
          <AlertCircle className="h-3 w-3" />
          <span>Flagged for review (outside scheduled hours)</span>
        </div>
      )}
    </div>
  );
}

interface TimeCardItemProps {
  timeCard: TimeCard;
}

function TimeCardItem({ timeCard }: TimeCardItemProps) {
  const status = getStatusBadge(timeCard.status);
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{formatDate(timeCard.clockIn)}</span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${status.bgColor} ${status.color}`}
          >
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {formatTime(timeCard.clockIn)}
          {timeCard.clockOut && ` - ${formatTime(timeCard.clockOut)}`}
        </div>
      </div>
      <div className="text-right">
        {timeCard.totalHours !== null ? (
          <span className="text-sm font-medium">{timeCard.totalHours.toFixed(2)}h</span>
        ) : (
          <span className="text-sm text-muted-foreground">In progress</span>
        )}
      </div>
    </div>
  );
}

export function TimeClockWidget() {
  const { user } = useAuthStore();
  
  // Get the worker profile for the current user
  const {
    data: worker,
    isLoading: isLoadingWorker,
    error: workerError,
  } = useCurrentWorker(user?.id);

  // Get the active time card for the worker
  const {
    data: activeTimeCard,
    isLoading: isLoadingActive,
  } = useActiveTimeCard(worker?.id);

  // Get recent time cards for the worker
  const {
    data: recentTimeCards,
    isLoading: isLoadingRecent,
  } = useRecentTimeCards(worker?.id, 5);

  // Clock in/out mutations
  const clockIn = useClockIn();
  const clockOut = useClockOut();

  const isLoading = isLoadingWorker || isLoadingActive;
  const isClockedIn = !!activeTimeCard;

  const handleClockIn = async () => {
    if (!worker) return;

    // Try to get current location
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: false,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {
        // Location not available, proceed without it
      }
    }

    clockIn.mutate({
      workerId: worker.id,
      latitude,
      longitude,
    });
  };

  const handleClockOut = async () => {
    if (!activeTimeCard) return;

    // Try to get current location
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: false,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {
        // Location not available, proceed without it
      }
    }

    clockOut.mutate({
      timeCardId: activeTimeCard.id,
      dto: { latitude, longitude },
    });
  };

  // If user doesn't have a worker profile, show a message
  if (workerError || (!isLoadingWorker && !worker)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Clock
          </CardTitle>
          <CardDescription>Track your work hours</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No worker profile found for your account.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Contact your manager to set up your worker profile.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Time Clock
        </CardTitle>
        <CardDescription>Track your work hours</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Current Shift Display */}
        {!isLoading && activeTimeCard && (
          <CurrentShiftDisplay timeCard={activeTimeCard} />
        )}

        {/* Clock In/Out Buttons */}
        {!isLoading && (
          <div className="flex gap-2">
            {!isClockedIn ? (
              <Button
                className="flex-1"
                onClick={handleClockIn}
                disabled={clockIn.isPending}
              >
                {clockIn.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Clock In
              </Button>
            ) : (
              <Button
                className="flex-1"
                variant="destructive"
                onClick={handleClockOut}
                disabled={clockOut.isPending}
              >
                {clockOut.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                Clock Out
              </Button>
            )}
          </div>
        )}

        {/* Recent Time Cards */}
        {!isLoading && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Recent Time Cards</h4>
            {isLoadingRecent ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : recentTimeCards && recentTimeCards.length > 0 ? (
              <div className="space-y-0">
                {recentTimeCards
                  .filter((tc) => tc.id !== activeTimeCard?.id)
                  .slice(0, 4)
                  .map((timeCard) => (
                    <TimeCardItem key={timeCard.id} timeCard={timeCard} />
                  ))}
                {recentTimeCards.filter((tc) => tc.id !== activeTimeCard?.id).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No previous time cards
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No time cards yet
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

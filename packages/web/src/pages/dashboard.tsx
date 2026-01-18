import { useNavigate } from 'react-router-dom';
import {
  Tractor,
  Users,
  DollarSign,
  Leaf,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  CheckCircle,
  Plus,
  ClipboardList,
  Wrench,
  MapPin,
  Loader2,
  RefreshCw,
  Wheat,
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
import { useDashboard, ActivityItem } from '@/hooks/use-dashboard';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
}

function StatCard({ title, value, description, icon: Icon, trend, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.isPositive ? '+' : ''}
                {trend.value.toFixed(1)}% from last month
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickActionProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline';
}

function QuickAction({ icon: Icon, label, onClick, variant = 'outline' }: QuickActionProps) {
  return (
    <Button
      variant={variant}
      className="flex flex-col items-center gap-2 h-auto py-4 px-6"
      onClick={onClick}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs">{label}</span>
    </Button>
  );
}


function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function getRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function getActivityIcon(type: ActivityItem['type']): { icon: React.ElementType; color: string } {
  switch (type) {
    case 'task_completed':
      return { icon: CheckCircle, color: 'text-green-500' };
    case 'maintenance_alert':
      return { icon: AlertTriangle, color: 'text-yellow-500' };
    case 'clock_in':
      return { icon: Clock, color: 'text-blue-500' };
    case 'clock_out':
      return { icon: Clock, color: 'text-gray-500' };
    case 'harvest':
      return { icon: Wheat, color: 'text-amber-500' };
    case 'expense':
      return { icon: DollarSign, color: 'text-red-500' };
    default:
      return { icon: CheckCircle, color: 'text-gray-500' };
  }
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, farm } = useAuthStore();
  const { data, isLoading, isError, refetch, isFetching } = useDashboard();

  const handleQuickAction = (path: string) => {
    navigate(path);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user?.profile?.firstName || 'User'}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening at {farm?.name || 'your farm'} today.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load dashboard data. Please try again.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Equipment"
          value={data?.equipment.active ?? 0}
          description={`${data?.equipment.inMaintenance ?? 0} in maintenance`}
          icon={Tractor}
          isLoading={isLoading}
        />
        <StatCard
          title="Workers On-Site"
          value={data?.workforce.clockedIn ?? 0}
          description={`${data?.workforce.clockedInToday ?? 0} clocked in today`}
          icon={Users}
          isLoading={isLoading}
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(data?.financial.monthlyRevenue ?? 0)}
          icon={DollarSign}
          trend={
            data?.financial.revenueChangePercent !== null
              ? {
                  value: data?.financial.revenueChangePercent ?? 0,
                  isPositive: (data?.financial.revenueChangePercent ?? 0) >= 0,
                }
              : undefined
          }
          isLoading={isLoading}
        />
        <StatCard
          title="Active Fields"
          value={data?.fields.totalFields ?? 0}
          description={`${formatNumber(data?.fields.totalAcreage ?? 0)} acres total`}
          icon={Leaf}
          isLoading={isLoading}
        />
      </div>


      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks you can perform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <QuickAction
              icon={Plus}
              label="Add Task"
              onClick={() => handleQuickAction('/workforce?action=new-task')}
            />
            <QuickAction
              icon={Clock}
              label="Clock In/Out"
              onClick={() => handleQuickAction('/workforce?tab=time')}
            />
            <QuickAction
              icon={ClipboardList}
              label="View Tasks"
              onClick={() => handleQuickAction('/workforce?tab=tasks')}
            />
            <QuickAction
              icon={Wrench}
              label="Maintenance"
              onClick={() => handleQuickAction('/maintenance')}
            />
            <QuickAction
              icon={MapPin}
              label="View Map"
              onClick={() => handleQuickAction('/fields')}
            />
            <QuickAction
              icon={DollarSign}
              label="Add Expense"
              onClick={() => handleQuickAction('/financial?action=new-expense')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity & Today's Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Activity */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest updates from your farm operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : data?.recentActivity && data.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {data.recentActivity.map((activity, index) => {
                  const { icon: ActivityIcon, color } = getActivityIcon(activity.type);
                  return (
                    <ActivityItemComponent
                      key={`${activity.type}-${activity.timestamp}-${index}`}
                      icon={ActivityIcon}
                      iconColor={color}
                      title={activity.title}
                      description={activity.description}
                      time={getRelativeTime(activity.timestamp)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity to display
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Overview */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Today&apos;s Overview</CardTitle>
            <CardDescription>Key metrics for today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <OverviewItem
                  label="Tasks Pending"
                  value={data?.tasks.pending ?? 0}
                  highlight={data?.tasks.overdue ? data.tasks.overdue > 0 : false}
                />
                <OverviewItem
                  label="Tasks In Progress"
                  value={data?.tasks.inProgress ?? 0}
                />
                <OverviewItem
                  label="Completed Today"
                  value={data?.tasks.completedToday ?? 0}
                />
                <OverviewItem
                  label="Overdue Tasks"
                  value={data?.tasks.overdue ?? 0}
                  highlight={(data?.tasks.overdue ?? 0) > 0}
                  highlightColor="text-red-600"
                />
                <div className="border-t pt-4 mt-4">
                  <OverviewItem
                    label="Equipment Running"
                    value={data?.equipment.active ?? 0}
                  />
                  <OverviewItem
                    label="Total Zones"
                    value={data?.fields.totalZones ?? 0}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


interface ActivityItemComponentProps {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  time: string;
}

function ActivityItemComponent({
  icon: Icon,
  iconColor,
  title,
  description,
  time,
}: ActivityItemComponentProps) {
  return (
    <div className="flex items-start gap-4">
      <div className={`mt-1 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium leading-none">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
  );
}

interface OverviewItemProps {
  label: string;
  value: number | string;
  highlight?: boolean;
  highlightColor?: string;
}

function OverviewItem({ label, value, highlight, highlightColor = 'text-yellow-600' }: OverviewItemProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-medium ${highlight ? highlightColor : ''}`}>{value}</span>
    </div>
  );
}

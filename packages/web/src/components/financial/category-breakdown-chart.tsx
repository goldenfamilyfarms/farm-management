import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  CategoryBreakdown,
  EXPENSE_CATEGORIES,
  useCostReport,
  formatCurrency,
} from '@/hooks/use-expenses';
import { PieChart, Loader2, TrendingUp, Calendar } from 'lucide-react';

// Get default date range (last 30 days)
function getDefaultDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export function CategoryBreakdownChart() {
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  const { data: report, isLoading } = useCostReport(startDate, endDate);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Expense Breakdown
            </CardTitle>
            <CardDescription>
              Expenses by category for the selected period
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36 h-8"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36 h-8"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : report && report.byCategory.length > 0 ? (
          <div className="space-y-6">
            {/* Total Summary */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(report.totalCost)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {report.totalExpenseCount} transactions
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {report.byCategory.length} categories
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Chart */}
            <div className="flex items-center gap-6">
              <DonutChart data={report.byCategory} total={report.totalCost} />
              <CategoryLegend data={report.byCategory} />
            </div>

            {/* Category Bars */}
            <div className="space-y-3">
              {report.byCategory.map((item) => (
                <CategoryBar key={item.category} item={item} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No expense data for this period</p>
            <p className="text-sm">
              Try selecting a different date range
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DonutChartProps {
  data: CategoryBreakdown[];
  total: number;
}

function DonutChart({ data, total }: DonutChartProps) {
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let currentOffset = 0;

  return (
    <div className="relative flex-shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        {/* Data segments */}
        {data.map((item) => {
          const segmentLength = (item.percentage / 100) * circumference;
          const offset = currentOffset;
          currentOffset += segmentLength;

          return (
            <circle
              key={item.category}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={EXPENSE_CATEGORIES[item.category].color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${center} ${center})`}
              className="transition-all duration-300"
            />
          );
        })}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted-foreground">Total</span>
        <span className="text-lg font-bold">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

interface CategoryLegendProps {
  data: CategoryBreakdown[];
}

function CategoryLegend({ data }: CategoryLegendProps) {
  // Show top 5 categories
  const topCategories = data.slice(0, 5);

  return (
    <div className="flex-1 space-y-2">
      {topCategories.map((item) => (
        <div key={item.category} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: EXPENSE_CATEGORIES[item.category].color }}
          />
          <span className="text-sm flex-1 truncate">
            {EXPENSE_CATEGORIES[item.category].label}
          </span>
          <span className="text-sm font-medium">
            {item.percentage.toFixed(1)}%
          </span>
        </div>
      ))}
      {data.length > 5 && (
        <p className="text-xs text-muted-foreground">
          +{data.length - 5} more categories
        </p>
      )}
    </div>
  );
}

interface CategoryBarProps {
  item: CategoryBreakdown;
}

function CategoryBar({ item }: CategoryBarProps) {
  const categoryInfo = EXPENSE_CATEGORIES[item.category];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: categoryInfo.color }}
          />
          <span>{categoryInfo.label}</span>
          <span className="text-muted-foreground">({item.count})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{formatCurrency(item.amount)}</span>
          <span className="text-muted-foreground w-12 text-right">
            {item.percentage.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${item.percentage}%`,
            backgroundColor: categoryInfo.color,
          }}
        />
      </div>
    </div>
  );
}

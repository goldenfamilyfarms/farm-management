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
  useProfitLossAllCrops,
  useProfitLossAllFields,
  formatPercentage,
  getProfitColor,
} from '@/hooks/use-profitability';
import { formatCurrency } from '@/hooks/use-expenses';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// Get default date range (current year)
function getDefaultDateRange() {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), 0, 1);
  const endDate = now;
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export function ProfitLossSummary() {
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  const { data: cropData, isLoading: cropLoading } = useProfitLossAllCrops(startDate, endDate);
  const { data: fieldData, isLoading: fieldLoading } = useProfitLossAllFields(startDate, endDate);

  const isLoading = cropLoading || fieldLoading;
  const totals = cropData?.totals;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Profit & Loss Summary
            </CardTitle>
            <CardDescription>
              Financial performance overview
            </CardDescription>
          </div>
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
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : totals ? (
          <div className="space-y-6">
            {/* Main Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SummaryCard
                title="Total Revenue"
                value={totals.totalRevenue}
                icon={<TrendingUp className="h-4 w-4" />}
                variant="revenue"
              />
              <SummaryCard
                title="Total Costs"
                value={totals.totalCosts}
                icon={<TrendingDown className="h-4 w-4" />}
                variant="cost"
              />
              <SummaryCard
                title="Net Profit"
                value={totals.netProfit}
                icon={
                  totals.netProfit >= 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )
                }
                variant="profit"
                showSign
              />
            </div>

            {/* Margin and Per-Acre Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Profit Margin"
                value={formatPercentage(totals.profitMargin)}
                isPositive={totals.profitMargin !== null && totals.profitMargin >= 0}
              />
              <MetricCard
                label="Revenue/Acre"
                value={
                  totals.revenuePerAcre !== null
                    ? formatCurrency(totals.revenuePerAcre)
                    : 'N/A'
                }
              />
              <MetricCard
                label="Cost/Acre"
                value={
                  totals.costPerAcre !== null
                    ? formatCurrency(totals.costPerAcre)
                    : 'N/A'
                }
              />
              <MetricCard
                label="Profit/Acre"
                value={
                  totals.profitPerAcre !== null
                    ? formatCurrency(totals.profitPerAcre)
                    : 'N/A'
                }
                isPositive={totals.profitPerAcre !== null && totals.profitPerAcre >= 0}
              />
            </div>

            {/* Breakdown Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By Crop */}
              {cropData && cropData.crops.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">By Crop Type</h4>
                  <div className="space-y-2">
                    {cropData.crops.map((crop) => (
                      <ProfitLossRow
                        key={crop.cropType}
                        label={crop.cropType}
                        revenue={crop.totalRevenue}
                        costs={crop.totalCosts}
                        profit={crop.netProfit}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* By Field */}
              {fieldData && fieldData.fields.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">By Field</h4>
                  <div className="space-y-2">
                    {fieldData.fields.map((field) => (
                      <ProfitLossRow
                        key={field.fieldId}
                        label={field.fieldName}
                        revenue={field.totalRevenue}
                        costs={field.totalCosts}
                        profit={field.netProfit}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No financial data for this period</p>
            <p className="text-sm">Try selecting a different date range</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant: 'revenue' | 'cost' | 'profit';
  showSign?: boolean;
}

function SummaryCard({ title, value, icon, variant, showSign }: SummaryCardProps) {
  const bgColor =
    variant === 'revenue'
      ? 'bg-green-50'
      : variant === 'cost'
      ? 'bg-red-50'
      : value >= 0
      ? 'bg-green-50'
      : 'bg-red-50';

  const textColor =
    variant === 'revenue'
      ? 'text-green-600'
      : variant === 'cost'
      ? 'text-red-600'
      : value >= 0
      ? 'text-green-600'
      : 'text-red-600';

  const iconColor =
    variant === 'revenue'
      ? 'text-green-500'
      : variant === 'cost'
      ? 'text-red-500'
      : value >= 0
      ? 'text-green-500'
      : 'text-red-500';

  return (
    <div className={`p-4 rounded-lg ${bgColor}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={iconColor}>{icon}</span>
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
      <p className={`text-2xl font-bold ${textColor}`}>
        {showSign && value > 0 ? '+' : ''}
        {formatCurrency(value)}
      </p>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  isPositive?: boolean;
}

function MetricCard({ label, value, isPositive }: MetricCardProps) {
  return (
    <div className="p-3 bg-muted/50 rounded-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p
        className={`text-lg font-semibold ${
          isPositive !== undefined
            ? isPositive
              ? 'text-green-600'
              : 'text-red-600'
            : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

interface ProfitLossRowProps {
  label: string;
  revenue: number;
  costs: number;
  profit: number;
}

function ProfitLossRow({ label, revenue, costs, profit }: ProfitLossRowProps) {
  return (
    <div className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
      <span className="font-medium truncate flex-1">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-green-600 w-20 text-right">
          {formatCurrency(revenue)}
        </span>
        <span className="text-red-600 w-20 text-right">
          {formatCurrency(costs)}
        </span>
        <span className={`w-20 text-right font-medium ${getProfitColor(profit)}`}>
          {profit >= 0 ? '+' : ''}
          {formatCurrency(profit)}
        </span>
      </div>
    </div>
  );
}

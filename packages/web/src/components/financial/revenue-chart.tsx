import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  useProfitLossAllCrops,
  useProfitLossAllFields,
  CropProfitLoss,
  FieldProfitLoss,
} from '@/hooks/use-profitability';
import { formatCurrency } from '@/hooks/use-expenses';
import { BarChart3, Loader2, Calendar, Wheat, MapPin } from 'lucide-react';

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

// Colors for chart bars
const CHART_COLORS = [
  '#22C55E', '#3B82F6', '#F97316', '#8B5CF6', '#EC4899',
  '#14B8A6', '#EAB308', '#6366F1', '#84CC16', '#A855F7',
];

type ViewMode = 'crop' | 'field';

export function RevenueChart() {
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [viewMode, setViewMode] = useState<ViewMode>('crop');

  const { data: cropData, isLoading: cropLoading } = useProfitLossAllCrops(startDate, endDate);
  const { data: fieldData, isLoading: fieldLoading } = useProfitLossAllFields(startDate, endDate);

  const isLoading = viewMode === 'crop' ? cropLoading : fieldLoading;
  const data = viewMode === 'crop' ? cropData?.crops : fieldData?.fields;
  const totals = viewMode === 'crop' ? cropData?.totals : fieldData?.totals;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Revenue Analysis
            </CardTitle>
            <CardDescription>
              Revenue breakdown by {viewMode === 'crop' ? 'crop type' : 'field'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-md border">
              <Button
                variant={viewMode === 'crop' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('crop')}
                className="rounded-r-none"
              >
                <Wheat className="h-4 w-4 mr-1" />
                By Crop
              </Button>
              <Button
                variant={viewMode === 'field' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('field')}
                className="rounded-l-none"
              >
                <MapPin className="h-4 w-4 mr-1" />
                By Field
              </Button>
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
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data && data.length > 0 ? (
          <div className="space-y-6">
            {/* Total Summary */}
            {totals && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(totals.totalRevenue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {totals.revenuePerAcre !== null
                        ? `${formatCurrency(totals.revenuePerAcre)}/acre`
                        : 'N/A per acre'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {totals.acreage ? `${totals.acreage.toFixed(1)} acres` : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bar Chart */}
            <div className="space-y-3">
              {viewMode === 'crop'
                ? (data as CropProfitLoss[]).map((item, index) => (
                    <RevenueBar
                      key={item.cropType}
                      label={item.cropType}
                      revenue={item.totalRevenue}
                      maxRevenue={totals?.totalRevenue || 1}
                      color={CHART_COLORS[index % CHART_COLORS.length]}
                      perAcre={item.revenuePerAcre}
                    />
                  ))
                : (data as FieldProfitLoss[]).map((item, index) => (
                    <RevenueBar
                      key={item.fieldId}
                      label={item.fieldName}
                      revenue={item.totalRevenue}
                      maxRevenue={totals?.totalRevenue || 1}
                      color={CHART_COLORS[index % CHART_COLORS.length]}
                      perAcre={item.revenuePerAcre}
                    />
                  ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No revenue data for this period</p>
            <p className="text-sm">Try selecting a different date range</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


interface RevenueBarProps {
  label: string;
  revenue: number;
  maxRevenue: number;
  color: string;
  perAcre: number | null;
}

function RevenueBar({ label, revenue, maxRevenue, color, perAcre }: RevenueBarProps) {
  const percentage = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-xs">
            {perAcre !== null ? `${formatCurrency(perAcre)}/acre` : ''}
          </span>
          <span className="font-medium w-24 text-right">
            {formatCurrency(revenue)}
          </span>
        </div>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

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
  useROIByZone,
  formatPercentage,
  ZoneROI,
} from '@/hooks/use-profitability';
import { formatCurrency } from '@/hooks/use-expenses';
import { Target, Loader2, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

export function ROIByZoneChart() {
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  const { data: zones, isLoading } = useROIByZone(startDate, endDate);

  // Sort zones by ROI (highest first)
  const sortedZones = zones
    ? [...zones].sort((a, b) => {
        if (a.roi === null && b.roi === null) return 0;
        if (a.roi === null) return 1;
        if (b.roi === null) return -1;
        return b.roi - a.roi;
      })
    : [];

  // Calculate summary stats
  const totalInvestment = sortedZones.reduce((sum, z) => sum + z.investment, 0);
  const totalReturns = sortedZones.reduce((sum, z) => sum + z.returns, 0);
  const overallROI =
    totalInvestment > 0
      ? ((totalReturns - totalInvestment) / totalInvestment) * 100
      : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              ROI by Zone
            </CardTitle>
            <CardDescription>
              Return on investment analysis by management zone
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
        ) : sortedZones.length > 0 ? (
          <div className="space-y-6">
            {/* Overall Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">
                  Total Investment
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalInvestment)}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">
                  Total Returns
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalReturns)}
                </p>
              </div>
              <div
                className={`p-4 rounded-lg ${
                  overallROI !== null && overallROI >= 0
                    ? 'bg-green-50'
                    : 'bg-red-50'
                }`}
              >
                <p className="text-sm text-muted-foreground mb-1">Overall ROI</p>
                <p
                  className={`text-2xl font-bold ${
                    overallROI !== null && overallROI >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {formatPercentage(overallROI)}
                </p>
              </div>
            </div>

            {/* Zone ROI Cards */}
            <div className="space-y-3">
              {sortedZones.map((zone) => (
                <ZoneROICard key={zone.zoneId} zone={zone} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No zone data available</p>
            <p className="text-sm">
              Create zones and record harvests to see ROI analysis
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


interface ZoneROICardProps {
  zone: ZoneROI;
}

function ZoneROICard({ zone }: ZoneROICardProps) {
  const roiColor =
    zone.roi === null
      ? 'text-muted-foreground'
      : zone.roi >= 0
      ? 'text-green-600'
      : 'text-red-600';

  const roiBgColor =
    zone.roi === null
      ? 'bg-muted'
      : zone.roi >= 20
      ? 'bg-green-100'
      : zone.roi >= 0
      ? 'bg-green-50'
      : zone.roi >= -20
      ? 'bg-red-50'
      : 'bg-red-100';

  const ROIIcon =
    zone.roi === null ? (
      <Minus className="h-4 w-4" />
    ) : zone.roi >= 0 ? (
      <TrendingUp className="h-4 w-4" />
    ) : (
      <TrendingDown className="h-4 w-4" />
    );

  // Calculate profit
  const profit = zone.returns - zone.investment;

  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
      {/* Zone Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{zone.zoneName}</span>
          <span className="text-xs text-muted-foreground">
            in {zone.fieldName}
          </span>
        </div>
        {zone.acreage && (
          <p className="text-xs text-muted-foreground">
            {zone.acreage.toFixed(1)} acres
          </p>
        )}
      </div>

      {/* Investment */}
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Investment</p>
        <p className="text-sm font-medium text-blue-600">
          {formatCurrency(zone.investment)}
        </p>
      </div>

      {/* Returns */}
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Returns</p>
        <p className="text-sm font-medium text-green-600">
          {formatCurrency(zone.returns)}
        </p>
      </div>

      {/* Profit */}
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Profit</p>
        <p
          className={`text-sm font-medium ${
            profit >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {profit >= 0 ? '+' : ''}
          {formatCurrency(profit)}
        </p>
      </div>

      {/* ROI Badge */}
      <div
        className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${roiBgColor}`}
      >
        <span className={roiColor}>{ROIIcon}</span>
        <span className={`text-sm font-bold ${roiColor}`}>
          {formatPercentage(zone.roi)}
        </span>
      </div>
    </div>
  );
}

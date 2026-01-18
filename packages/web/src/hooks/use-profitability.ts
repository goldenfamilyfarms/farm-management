import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface ProfitLossResult {
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number | null;
  revenuePerAcre: number | null;
  costPerAcre: number | null;
  profitPerAcre: number | null;
  acreage: number | null;
}

export interface FieldProfitLoss extends ProfitLossResult {
  fieldId: string;
  fieldName: string;
}

export interface CropProfitLoss extends ProfitLossResult {
  cropType: string;
}

export interface AllFieldsProfitLoss {
  fields: FieldProfitLoss[];
  totals: ProfitLossResult;
}

export interface AllCropsProfitLoss {
  crops: CropProfitLoss[];
  totals: ProfitLossResult;
}

export interface ZoneROI {
  zoneId: string;
  zoneName: string;
  fieldId: string;
  fieldName: string;
  investment: number;
  returns: number;
  roi: number | null;
  acreage: number | null;
}

export interface SeasonComparison {
  season: string;
  year: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number | null;
  changeFromPrevious: number | null;
}

export interface BreakEvenAnalysis {
  cropType: string;
  totalCosts: number;
  totalQuantitySold: number;
  unit: string;
  breakEvenPrice: number | null;
  currentAveragePrice: number | null;
  priceMargin: number | null;
}


export interface ProfitabilityAnalysis {
  roiByZone: ZoneROI[];
  seasonComparisons: SeasonComparison[];
  breakEvenAnalysis: BreakEvenAnalysis[];
}

/**
 * Hook to fetch profit/loss for all fields
 */
export function useProfitLossAllFields(startDate: string, endDate: string) {
  return useQuery<AllFieldsProfitLoss>({
    queryKey: ['profitability', 'all-fields', startDate, endDate],
    queryFn: () =>
      apiClient.get<AllFieldsProfitLoss>(
        `/profitability/all-fields?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Hook to fetch profit/loss for all crops
 */
export function useProfitLossAllCrops(startDate: string, endDate: string) {
  return useQuery<AllCropsProfitLoss>({
    queryKey: ['profitability', 'all-crops', startDate, endDate],
    queryFn: () =>
      apiClient.get<AllCropsProfitLoss>(
        `/profitability/all-crops?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Hook to fetch ROI by zone
 */
export function useROIByZone(startDate: string, endDate: string) {
  return useQuery<ZoneROI[]>({
    queryKey: ['profitability', 'roi-by-zone', startDate, endDate],
    queryFn: () =>
      apiClient.get<ZoneROI[]>(
        `/profitability/analysis/roi-by-zone?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Hook to fetch full profitability analysis
 */
export function useProfitabilityAnalysis(
  startDate: string,
  endDate: string,
  comparisonYears?: number[]
) {
  const yearsParam = comparisonYears?.join(',');
  const url = yearsParam
    ? `/profitability/analysis/full?startDate=${startDate}&endDate=${endDate}&comparisonYears=${yearsParam}`
    : `/profitability/analysis/full?startDate=${startDate}&endDate=${endDate}`;

  return useQuery<ProfitabilityAnalysis>({
    queryKey: ['profitability', 'analysis', startDate, endDate, comparisonYears],
    queryFn: () => apiClient.get<ProfitabilityAnalysis>(url),
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Format percentage
 */
export function formatPercentage(value: number | null): string {
  if (value === null) return 'N/A';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/**
 * Get color based on profit/loss value
 */
export function getProfitColor(value: number): string {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-muted-foreground';
}

/**
 * Get background color based on profit/loss value
 */
export function getProfitBgColor(value: number): string {
  if (value > 0) return 'bg-green-100';
  if (value < 0) return 'bg-red-100';
  return 'bg-muted';
}

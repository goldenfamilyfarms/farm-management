// ============================================
// Crop Recommendation Output Types
// ============================================

export interface RiskFactorDto {
  type: 'weather' | 'market' | 'soil' | 'pest' | 'disease';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation?: string;
}

export interface CropSuggestionDto {
  cropType: string;
  confidence: number; // 0-1
  expectedYieldRange: { min: number; max: number; unit: string };
  plantingWindow: { start: string; end: string };
  riskFactors: RiskFactorDto[];
  estimatedInputCosts: number;
  estimatedRevenue: number;
  reasoning: string;
}

export interface CropRecommendationDto {
  id: string;
  zoneId: string;
  generatedAt: string;
  validUntil: string;
  recommendations: CropSuggestionDto[];
  inputData: RecommendationInputsDto;
  explanation: string;
}

// ============================================
// Input Data Types for Recommendations
// ============================================

export interface SoilQualityDto {
  ph?: number;
  organicMatter?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  texture?: string;
  drainageClass?: string;
  testDate?: string;
}

export interface WeatherSummaryDto {
  avgTemperature: number;
  totalPrecipitation: number;
  growingDegreeDays: number;
  frostFreeDays: number;
  avgHumidity?: number;
  avgWindSpeed?: number;
}

export interface WeatherForecastDto {
  date: string;
  highTemp: number;
  lowTemp: number;
  precipitation: number;
  humidity: number;
  conditions: string;
}

export interface MarketPriceDto {
  cropType: string;
  pricePerUnit: number;
  unit: string;
  date: string;
  source?: string;
}

export interface HistoricalYieldDto {
  cropType: string;
  year: number;
  yieldPerAcre: number;
  unit: string;
  zoneId: string;
  zoneName?: string;
}

// ============================================
// Aggregated Input Data for Recommendations
// ============================================

export interface RecommendationInputsDto {
  soilQuality: SoilQualityDto;
  historicalWeather: WeatherSummaryDto;
  weatherForecast: WeatherForecastDto[];
  marketPrices: MarketPriceDto[];
  historicalYields: HistoricalYieldDto[];
}

// ============================================
// Missing Data Tracking
// ============================================

export type MissingDataType = 
  | 'soil_quality'
  | 'historical_weather'
  | 'weather_forecast'
  | 'market_prices'
  | 'historical_yields';

export interface MissingDataDto {
  type: MissingDataType;
  description: string;
  suggestion?: string;
}

// ============================================
// Response DTOs
// ============================================

export interface AggregatedDataResponseDto {
  zoneId: string;
  zoneName: string;
  fieldId: string;
  fieldName: string;
  inputs: RecommendationInputsDto;
  missingData: MissingDataDto[];
  aggregatedAt?: string;
}

export interface DataAggregationErrorDto {
  error: string;
  missingInputs: MissingDataDto[];
}

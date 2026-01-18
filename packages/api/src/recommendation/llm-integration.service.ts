import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  RecommendationInputsDto,
  CropSuggestionDto,
  CropRecommendationDto,
  RiskFactorDto,
} from './dto/recommendation.dto';

/**
 * Service responsible for integrating with Anthropic Claude API
 * to generate AI-powered crop recommendations.
 * 
 * Implements Requirements 4.2 and 4.3:
 * - THE Recommendation_Engine SHALL return crop suggestions with expected yield ranges,
 *   optimal planting windows, and risk assessments
 * - WHEN generating recommendations, THE Recommendation_Engine SHALL provide explanations
 *   for why each crop was suggested
 */
@Injectable()
export class LlmIntegrationService {
  private readonly logger = new Logger(LlmIntegrationService.name);
  private readonly anthropic: Anthropic;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not configured - LLM features will be unavailable');
    }

    this.anthropic = new Anthropic({
      apiKey: apiKey || 'dummy-key-for-initialization',
    });

    this.model = this.configService.get<string>('ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022';
  }

  /**
   * Generates crop recommendations using Claude API based on aggregated farm data.
   * 
   * @param zoneId - The zone ID for which recommendations are being generated
   * @param zoneName - The name of the zone
   * @param inputs - Aggregated data including soil quality, weather, market prices, and yields
   * @returns CropRecommendationDto with AI-generated crop suggestions
   */
  async generateRecommendations(
    zoneId: string,
    zoneName: string,
    inputs: RecommendationInputsDto,
  ): Promise<CropRecommendationDto> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    
    if (!apiKey) {
      throw new InternalServerErrorException(
        'LLM service not configured. Please set ANTHROPIC_API_KEY environment variable.',
      );
    }

    const prompt = this.buildPrompt(zoneName, inputs);
    
    try {
      this.logger.debug(`Generating recommendations for zone ${zoneId}`);
      
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: this.getSystemPrompt(),
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      const parsedResponse = this.parseResponse(content.text);
      
      const now = new Date();
      const validUntil = new Date(now);
      validUntil.setDate(validUntil.getDate() + 30); // Recommendations valid for 30 days

      return {
        id: this.generateId(),
        zoneId,
        generatedAt: now.toISOString(),
        validUntil: validUntil.toISOString(),
        recommendations: parsedResponse.suggestions,
        inputData: inputs,
        explanation: parsedResponse.explanation,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to generate recommendations: ${errorMessage}`, errorStack);
      
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        'Failed to generate crop recommendations. Please try again later.',
      );
    }
  }


  /**
   * Returns the system prompt that instructs Claude on how to generate recommendations.
   */
  private getSystemPrompt(): string {
    return `You are an expert agricultural advisor AI assistant. Your role is to analyze farm data and provide crop recommendations for specific zones.

When generating recommendations, you MUST:
1. Consider all provided data: soil quality, weather patterns, market prices, and historical yields
2. Provide 2-4 crop suggestions ranked by suitability
3. Include specific yield ranges based on the data
4. Specify optimal planting windows
5. Identify and assess risk factors
6. Explain your reasoning for each recommendation

Your response MUST be valid JSON matching this exact structure:
{
  "explanation": "Overall analysis summary explaining the key factors considered",
  "suggestions": [
    {
      "cropType": "crop name",
      "confidence": 0.0-1.0,
      "expectedYieldRange": { "min": number, "max": number, "unit": "bushels/acre or appropriate unit" },
      "plantingWindow": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
      "riskFactors": [
        {
          "type": "weather|market|soil|pest|disease",
          "severity": "low|medium|high",
          "description": "description of the risk",
          "mitigation": "optional mitigation strategy"
        }
      ],
      "estimatedInputCosts": number (USD per acre),
      "estimatedRevenue": number (USD per acre),
      "reasoning": "Detailed explanation for why this crop is recommended"
    }
  ]
}

Be precise with numbers and dates. Base your recommendations on the actual data provided.`;
  }

  /**
   * Builds a structured prompt with all aggregated data for the LLM.
   */
  private buildPrompt(zoneName: string, inputs: RecommendationInputsDto): string {
    const sections: string[] = [];

    sections.push(`# Crop Recommendation Request for Zone: ${zoneName}\n`);
    sections.push('Please analyze the following farm data and provide crop recommendations.\n');

    // Soil Quality Section
    sections.push('## Soil Quality Data');
    if (this.hasSoilData(inputs.soilQuality)) {
      sections.push(this.formatSoilQuality(inputs.soilQuality));
    } else {
      sections.push('No soil quality data available. Use general recommendations for the region.\n');
    }

    // Historical Weather Section
    sections.push('## Historical Weather Summary (Past Year)');
    sections.push(this.formatWeatherSummary(inputs.historicalWeather));

    // Weather Forecast Section
    sections.push('## Weather Forecast (Next 7 Days)');
    if (inputs.weatherForecast.length > 0) {
      sections.push(this.formatWeatherForecast(inputs.weatherForecast));
    } else {
      sections.push('No forecast data available.\n');
    }

    // Market Prices Section
    sections.push('## Current Market Prices');
    if (inputs.marketPrices.length > 0) {
      sections.push(this.formatMarketPrices(inputs.marketPrices));
    } else {
      sections.push('No market price data available.\n');
    }

    // Historical Yields Section
    sections.push('## Historical Yields');
    if (inputs.historicalYields.length > 0) {
      sections.push(this.formatHistoricalYields(inputs.historicalYields));
    } else {
      sections.push('No historical yield data available for this zone.\n');
    }

    sections.push('\n## Instructions');
    sections.push('Based on the above data, provide 2-4 crop recommendations with:');
    sections.push('- Expected yield ranges');
    sections.push('- Optimal planting windows');
    sections.push('- Risk assessments');
    sections.push('- Cost and revenue estimates');
    sections.push('- Clear reasoning for each recommendation');
    sections.push('\nRespond with valid JSON only.');

    return sections.join('\n');
  }

  /**
   * Checks if meaningful soil data exists.
   */
  private hasSoilData(soilQuality: RecommendationInputsDto['soilQuality']): boolean {
    return (
      soilQuality.ph !== undefined ||
      soilQuality.nitrogen !== undefined ||
      soilQuality.phosphorus !== undefined ||
      soilQuality.potassium !== undefined ||
      soilQuality.organicMatter !== undefined
    );
  }

  /**
   * Formats soil quality data for the prompt.
   */
  private formatSoilQuality(soil: RecommendationInputsDto['soilQuality']): string {
    const lines: string[] = [];
    
    if (soil.ph !== undefined) lines.push(`- pH: ${soil.ph}`);
    if (soil.nitrogen !== undefined) lines.push(`- Nitrogen (N): ${soil.nitrogen} ppm`);
    if (soil.phosphorus !== undefined) lines.push(`- Phosphorus (P): ${soil.phosphorus} ppm`);
    if (soil.potassium !== undefined) lines.push(`- Potassium (K): ${soil.potassium} ppm`);
    if (soil.organicMatter !== undefined) lines.push(`- Organic Matter: ${soil.organicMatter}%`);
    if (soil.texture) lines.push(`- Soil Texture: ${soil.texture}`);
    if (soil.drainageClass) lines.push(`- Drainage Class: ${soil.drainageClass}`);
    if (soil.testDate) lines.push(`- Test Date: ${soil.testDate}`);
    
    return lines.join('\n') + '\n';
  }

  /**
   * Formats weather summary for the prompt.
   */
  private formatWeatherSummary(weather: RecommendationInputsDto['historicalWeather']): string {
    const lines: string[] = [];
    
    lines.push(`- Average Temperature: ${weather.avgTemperature.toFixed(1)}°C`);
    lines.push(`- Total Precipitation: ${weather.totalPrecipitation.toFixed(1)} mm`);
    lines.push(`- Growing Degree Days: ${weather.growingDegreeDays.toFixed(0)}`);
    lines.push(`- Frost-Free Days: ${weather.frostFreeDays}`);
    
    if (weather.avgHumidity !== undefined) {
      lines.push(`- Average Humidity: ${weather.avgHumidity.toFixed(1)}%`);
    }
    if (weather.avgWindSpeed !== undefined) {
      lines.push(`- Average Wind Speed: ${weather.avgWindSpeed.toFixed(1)} km/h`);
    }
    
    return lines.join('\n') + '\n';
  }

  /**
   * Formats weather forecast for the prompt.
   */
  private formatWeatherForecast(forecast: RecommendationInputsDto['weatherForecast']): string {
    const lines = forecast.map(day => 
      `- ${day.date}: High ${day.highTemp}°C, Low ${day.lowTemp}°C, ` +
      `Precip ${day.precipitation}mm, ${day.conditions}`
    );
    return lines.join('\n') + '\n';
  }

  /**
   * Formats market prices for the prompt.
   */
  private formatMarketPrices(prices: RecommendationInputsDto['marketPrices']): string {
    const lines = prices.map(price => 
      `- ${price.cropType}: $${price.pricePerUnit.toFixed(2)}/${price.unit} (${price.source || 'market'})`
    );
    return lines.join('\n') + '\n';
  }

  /**
   * Formats historical yields for the prompt.
   */
  private formatHistoricalYields(yields: RecommendationInputsDto['historicalYields']): string {
    const lines = yields.map(y => 
      `- ${y.cropType} (${y.year}): ${y.yieldPerAcre.toFixed(1)} ${y.unit}/acre` +
      (y.zoneName ? ` in ${y.zoneName}` : '')
    );
    return lines.join('\n') + '\n';
  }


  /**
   * Parses the LLM response into structured crop suggestions.
   * Validates the response structure and provides defaults for missing fields.
   */
  private parseResponse(responseText: string): {
    explanation: string;
    suggestions: CropSuggestionDto[];
  } {
    try {
      // Extract JSON from the response (handle potential markdown code blocks)
      let jsonText = responseText.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      jsonText = jsonText.trim();

      const parsed = JSON.parse(jsonText);

      // Validate and transform the response
      const explanation = typeof parsed.explanation === 'string' 
        ? parsed.explanation 
        : 'Recommendations generated based on available farm data.';

      const suggestions: CropSuggestionDto[] = [];

      if (Array.isArray(parsed.suggestions)) {
        for (const suggestion of parsed.suggestions) {
          const validatedSuggestion = this.validateSuggestion(suggestion);
          if (validatedSuggestion) {
            suggestions.push(validatedSuggestion);
          }
        }
      }

      if (suggestions.length === 0) {
        throw new Error('No valid crop suggestions in response');
      }

      return { explanation, suggestions };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to parse LLM response: ${errorMessage}`);
      this.logger.debug(`Raw response: ${responseText}`);
      throw new Error('Failed to parse crop recommendations from AI response');
    }
  }

  /**
   * Validates and transforms a single crop suggestion from the LLM response.
   */
  private validateSuggestion(raw: unknown): CropSuggestionDto | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const suggestion = raw as Record<string, unknown>;

    // Required field: cropType
    if (typeof suggestion.cropType !== 'string' || !suggestion.cropType) {
      return null;
    }

    // Validate confidence (0-1)
    let confidence = 0.5;
    if (typeof suggestion.confidence === 'number') {
      confidence = Math.max(0, Math.min(1, suggestion.confidence));
    }

    // Validate yield range
    const yieldRange = this.validateYieldRange(suggestion.expectedYieldRange);

    // Validate planting window
    const plantingWindow = this.validatePlantingWindow(suggestion.plantingWindow);

    // Validate risk factors
    const riskFactors = this.validateRiskFactors(suggestion.riskFactors);

    // Validate costs and revenue
    const estimatedInputCosts = typeof suggestion.estimatedInputCosts === 'number'
      ? Math.max(0, suggestion.estimatedInputCosts)
      : 0;

    const estimatedRevenue = typeof suggestion.estimatedRevenue === 'number'
      ? Math.max(0, suggestion.estimatedRevenue)
      : 0;

    // Validate reasoning
    const reasoning = typeof suggestion.reasoning === 'string'
      ? suggestion.reasoning
      : 'Recommendation based on available data analysis.';

    return {
      cropType: suggestion.cropType,
      confidence,
      expectedYieldRange: yieldRange,
      plantingWindow,
      riskFactors,
      estimatedInputCosts,
      estimatedRevenue,
      reasoning,
    };
  }

  /**
   * Validates and transforms yield range from LLM response.
   */
  private validateYieldRange(raw: unknown): { min: number; max: number; unit: string } {
    const defaultRange = { min: 0, max: 0, unit: 'bushels/acre' };

    if (!raw || typeof raw !== 'object') {
      return defaultRange;
    }

    const range = raw as Record<string, unknown>;

    return {
      min: typeof range.min === 'number' ? Math.max(0, range.min) : 0,
      max: typeof range.max === 'number' ? Math.max(0, range.max) : 0,
      unit: typeof range.unit === 'string' ? range.unit : 'bushels/acre',
    };
  }

  /**
   * Validates and transforms planting window from LLM response.
   */
  private validatePlantingWindow(raw: unknown): { start: string; end: string } {
    const now = new Date();
    const defaultStart = now.toISOString().split('T')[0];
    const defaultEnd = new Date(now.setMonth(now.getMonth() + 2)).toISOString().split('T')[0];
    const defaultWindow = { start: defaultStart, end: defaultEnd };

    if (!raw || typeof raw !== 'object') {
      return defaultWindow;
    }

    const window = raw as Record<string, unknown>;

    const start = typeof window.start === 'string' && this.isValidDate(window.start)
      ? window.start
      : defaultStart;

    const end = typeof window.end === 'string' && this.isValidDate(window.end)
      ? window.end
      : defaultEnd;

    return { start, end };
  }

  /**
   * Validates a date string format (YYYY-MM-DD).
   */
  private isValidDate(dateStr: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      return false;
    }
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  /**
   * Validates and transforms risk factors from LLM response.
   */
  private validateRiskFactors(raw: unknown): RiskFactorDto[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const validTypes = ['weather', 'market', 'soil', 'pest', 'disease'] as const;
    const validSeverities = ['low', 'medium', 'high'] as const;

    return raw
      .filter((item): item is Record<string, unknown> => 
        item !== null && typeof item === 'object'
      )
      .map((item) => {
        const type = validTypes.includes(item.type as typeof validTypes[number])
          ? (item.type as RiskFactorDto['type'])
          : 'weather';

        const severity = validSeverities.includes(item.severity as typeof validSeverities[number])
          ? (item.severity as RiskFactorDto['severity'])
          : 'medium';

        return {
          type,
          severity,
          description: typeof item.description === 'string' 
            ? item.description 
            : 'Risk factor identified',
          mitigation: typeof item.mitigation === 'string' 
            ? item.mitigation 
            : undefined,
        };
      });
  }

  /**
   * Generates a unique ID for recommendations.
   */
  private generateId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

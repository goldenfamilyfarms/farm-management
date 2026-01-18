import { BadRequestException } from '@nestjs/common';
import { MissingDataDto } from '../dto/recommendation.dto';

/**
 * Exception thrown when there is insufficient data to generate crop recommendations.
 * Implements Requirement 4.5: IF the Recommendation_Engine cannot generate
 * recommendations due to insufficient data, THEN it SHALL return a clear
 * error message listing missing inputs.
 */
export class InsufficientDataException extends BadRequestException {
  constructor(missingInputs: MissingDataDto[]) {
    const missingTypes = missingInputs.map((m) => m.type).join(', ');
    super({
      statusCode: 400,
      error: 'Insufficient Data',
      message: `Cannot generate recommendations due to insufficient data. Missing inputs: ${missingTypes}`,
      missingInputs,
    });
  }
}

/**
 * Result of polygon validation
 */
export interface PolygonValidationResultDto {
  /**
   * Whether the polygon is valid
   */
  valid: boolean;

  /**
   * List of validation errors if the polygon is invalid
   */
  errors: string[];
}

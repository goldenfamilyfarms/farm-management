import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolygonValidationResultDto } from './dto/validation.dto';

// Re-export the type for convenience
export type { PolygonValidationResultDto as PolygonValidationResult };

/**
 * Service for validating GeoJSON polygons using PostGIS functions
 */
@Injectable()
export class PolygonValidationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Converts a GeoJSON polygon to PostGIS WKT format
   */
  private toWKT(boundary: { type: 'Polygon'; coordinates: number[][][] }): string {
    const coordString = boundary.coordinates[0]
      .map((coord) => `${coord[0]} ${coord[1]}`)
      .join(', ');
    return `POLYGON((${coordString}))`;
  }

  /**
   * Validates a polygon for geometric correctness using PostGIS ST_IsValid
   * Checks for:
   * - Self-intersection
   * - Ring closure
   * - Other geometric validity issues
   *
   * @param boundary - GeoJSON polygon to validate
   * @returns Validation result with errors if invalid
   */
  async validatePolygon(
    boundary: { type: 'Polygon'; coordinates: number[][][] },
  ): Promise<PolygonValidationResultDto> {
    const errors: string[] = [];

    // Basic structural validation
    if (!boundary || boundary.type !== 'Polygon') {
      return {
        valid: false,
        errors: ['Invalid geometry type: expected Polygon'],
      };
    }

    if (
      !boundary.coordinates ||
      !Array.isArray(boundary.coordinates) ||
      boundary.coordinates.length === 0
    ) {
      return {
        valid: false,
        errors: ['Polygon must have at least one ring of coordinates'],
      };
    }

    const ring = boundary.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4) {
      return {
        valid: false,
        errors: ['Polygon ring must have at least 4 coordinate pairs (including closing point)'],
      };
    }

    // Check if ring is closed (first and last points must be the same)
    const firstPoint = ring[0];
    const lastPoint = ring[ring.length - 1];
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      errors.push('Polygon ring is not closed: first and last coordinates must be identical');
    }

    const wkt = this.toWKT(boundary);

    try {
      // Use PostGIS ST_IsValid to check for self-intersection and other validity issues
      const result = await this.prisma.$queryRaw<
        Array<{
          is_valid: boolean;
          reason: string | null;
        }>
      >`
        SELECT 
          ST_IsValid(ST_GeomFromText(${wkt}, 4326)) as is_valid,
          ST_IsValidReason(ST_GeomFromText(${wkt}, 4326)) as reason
      `;

      if (result.length > 0) {
        const { is_valid, reason } = result[0];

        if (!is_valid) {
          // Parse the PostGIS validity reason to provide a user-friendly error
          const errorMessage = this.parseValidityReason(reason);
          errors.push(errorMessage);
        }
      }
    } catch (error) {
      // Handle SQL errors (e.g., malformed geometry)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to validate polygon geometry: ${errorMessage}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Parses PostGIS ST_IsValidReason output into a user-friendly error message
   */
  private parseValidityReason(reason: string | null): string {
    if (!reason) {
      return 'Polygon geometry is invalid';
    }

    // PostGIS returns reasons like "Self-intersection[x y]" or "Ring Self-intersection[x y]"
    if (reason.toLowerCase().includes('self-intersection')) {
      // Extract coordinates if present
      const coordMatch = reason.match(/\[([^\]]+)\]/);
      if (coordMatch) {
        return `Polygon has self-intersection at coordinates [${coordMatch[1]}]`;
      }
      return 'Polygon has self-intersection';
    }

    if (reason.toLowerCase().includes('ring')) {
      return `Polygon ring error: ${reason}`;
    }

    if (reason.toLowerCase().includes('hole')) {
      return `Polygon hole error: ${reason}`;
    }

    if (reason.toLowerCase().includes('duplicate')) {
      return `Polygon has duplicate points: ${reason}`;
    }

    // Return the raw reason if we can't parse it
    return `Polygon geometry is invalid: ${reason}`;
  }

  /**
   * Validates that a zone polygon is fully contained within a field polygon
   * Uses PostGIS ST_Contains
   *
   * @param fieldBoundary - The outer field polygon
   * @param zoneBoundary - The inner zone polygon to check
   * @returns Validation result
   */
  async validateZoneContainment(
    fieldBoundary: { type: 'Polygon'; coordinates: number[][][] },
    zoneBoundary: { type: 'Polygon'; coordinates: number[][][] },
  ): Promise<PolygonValidationResultDto> {
    // First validate both polygons individually
    const fieldValidation = await this.validatePolygon(fieldBoundary);
    if (!fieldValidation.valid) {
      return {
        valid: false,
        errors: fieldValidation.errors.map((e) => `Field boundary: ${e}`),
      };
    }

    const zoneValidation = await this.validatePolygon(zoneBoundary);
    if (!zoneValidation.valid) {
      return {
        valid: false,
        errors: zoneValidation.errors.map((e) => `Zone boundary: ${e}`),
      };
    }

    const fieldWkt = this.toWKT(fieldBoundary);
    const zoneWkt = this.toWKT(zoneBoundary);

    try {
      const result = await this.prisma.$queryRaw<Array<{ is_contained: boolean }>>`
        SELECT ST_Contains(
          ST_GeomFromText(${fieldWkt}, 4326),
          ST_GeomFromText(${zoneWkt}, 4326)
        ) as is_contained
      `;

      if (result.length > 0 && !result[0].is_contained) {
        return {
          valid: false,
          errors: ['Zone boundary must be fully contained within the field boundary'],
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        errors: [`Failed to validate zone containment: ${errorMessage}`],
      };
    }

    return {
      valid: true,
      errors: [],
    };
  }
}

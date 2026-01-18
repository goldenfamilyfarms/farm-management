import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { PolygonValidationService } from './polygon-validation.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Property 10: Zone containment validation
 * *For any* zone polygon and its parent field boundary, the zone SHALL only be
 * saved if the zone polygon is completely contained within the field boundary.
 * **Validates: Requirements 3.2**
 */

// Type for GeoJSON Polygon
type GeoPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

// Helper to create a simple rectangular polygon from bounds
function createRectangle(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number,
): GeoPolygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat], // Close the ring
      ],
    ],
  };
}

// Arbitrary for generating a field boundary (larger rectangle)
const fieldBoundaryArb = fc
  .record({
    minLon: fc.double({ min: -179, max: 178, noNaN: true }),
    minLat: fc.double({ min: -89, max: 88, noNaN: true }),
    width: fc.double({ min: 0.01, max: 1, noNaN: true }),
    height: fc.double({ min: 0.01, max: 1, noNaN: true }),
  })
  .map(({ minLon, minLat, width, height }) =>
    createRectangle(minLon, minLat, minLon + width, minLat + height),
  );

// Arbitrary for generating a zone that is CONTAINED within a field
// Zone is a smaller rectangle inside the field
const containedZoneArb = (field: GeoPolygon) => {
  const fieldCoords = field.coordinates[0];
  const minLon = Math.min(...fieldCoords.map((c) => c[0]));
  const maxLon = Math.max(...fieldCoords.map((c) => c[0]));
  const minLat = Math.min(...fieldCoords.map((c) => c[1]));
  const maxLat = Math.max(...fieldCoords.map((c) => c[1]));

  const fieldWidth = maxLon - minLon;
  const fieldHeight = maxLat - minLat;

  return fc
    .record({
      // Offset from field min corner (0-0.4 of field size)
      offsetLonRatio: fc.double({ min: 0.05, max: 0.4, noNaN: true }),
      offsetLatRatio: fc.double({ min: 0.05, max: 0.4, noNaN: true }),
      // Zone size as ratio of remaining space (0.1-0.5)
      widthRatio: fc.double({ min: 0.1, max: 0.5, noNaN: true }),
      heightRatio: fc.double({ min: 0.1, max: 0.5, noNaN: true }),
    })
    .map(({ offsetLonRatio, offsetLatRatio, widthRatio, heightRatio }) => {
      const zoneMinLon = minLon + fieldWidth * offsetLonRatio;
      const zoneMinLat = minLat + fieldHeight * offsetLatRatio;
      const zoneWidth = fieldWidth * widthRatio;
      const zoneHeight = fieldHeight * heightRatio;

      return createRectangle(
        zoneMinLon,
        zoneMinLat,
        zoneMinLon + zoneWidth,
        zoneMinLat + zoneHeight,
      );
    });
};

// Arbitrary for generating a zone that is NOT contained (extends outside field)
const nonContainedZoneArb = (field: GeoPolygon) => {
  const fieldCoords = field.coordinates[0];
  const minLon = Math.min(...fieldCoords.map((c) => c[0]));
  const maxLon = Math.max(...fieldCoords.map((c) => c[0]));
  const minLat = Math.min(...fieldCoords.map((c) => c[1]));
  const maxLat = Math.max(...fieldCoords.map((c) => c[1]));

  const fieldWidth = maxLon - minLon;
  const fieldHeight = maxLat - minLat;

  // Generate a zone that extends beyond the field boundary
  return fc
    .record({
      // Start inside the field
      startLonRatio: fc.double({ min: 0.3, max: 0.7, noNaN: true }),
      startLatRatio: fc.double({ min: 0.3, max: 0.7, noNaN: true }),
      // Extend beyond the field (1.5-2x the remaining distance)
      extendRatio: fc.double({ min: 1.5, max: 2, noNaN: true }),
    })
    .map(({ startLonRatio, startLatRatio, extendRatio }) => {
      const zoneMinLon = minLon + fieldWidth * startLonRatio;
      const zoneMinLat = minLat + fieldHeight * startLatRatio;
      // Extend beyond the field boundary
      const zoneMaxLon = maxLon + fieldWidth * (extendRatio - 1);
      const zoneMaxLat = maxLat + fieldHeight * (extendRatio - 1);

      return createRectangle(zoneMinLon, zoneMinLat, zoneMaxLon, zoneMaxLat);
    });
};

// Helper to create a mock PrismaService with specific behavior
function createMockPrisma(responses: Array<unknown>): Partial<PrismaService> {
  let callIndex = 0;
  return {
    $queryRaw: vi.fn().mockImplementation(() => {
      const response = responses[callIndex];
      callIndex++;
      return Promise.resolve(response);
    }),
  };
}

describe('PolygonValidationService', () => {
  describe('Property 10: Zone containment validation', () => {
    it('should validate that contained zones pass containment check for any valid field/zone pair', async () => {
      // Feature: farm-management-platform, Property 10: Zone containment validation
      await fc.assert(
        fc.asyncProperty(
          fieldBoundaryArb.chain((field) =>
            containedZoneArb(field).map((zone) => ({ field, zone })),
          ),
          async ({ field, zone }) => {
            // Create fresh mock for each iteration
            // Mock PostGIS ST_IsValid to return true for both polygons
            // Mock PostGIS ST_Contains to return true (zone is contained)
            const mockPrisma = createMockPrisma([
              [{ is_valid: true, reason: null }], // Field validation
              [{ is_valid: true, reason: null }], // Zone validation
              [{ is_contained: true }], // Containment check
            ]);

            const service = new PolygonValidationService(mockPrisma as PrismaService);
            const result = await service.validateZoneContainment(field, zone);

            // Zone should be valid (contained within field)
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          },
        ),
        { numRuns: 100, verbose: true },
      );
    });

    it('should reject zones that extend outside field boundary for any non-contained zone', async () => {
      // Feature: farm-management-platform, Property 10: Zone containment validation
      await fc.assert(
        fc.asyncProperty(
          fieldBoundaryArb.chain((field) =>
            nonContainedZoneArb(field).map((zone) => ({ field, zone })),
          ),
          async ({ field, zone }) => {
            // Create fresh mock for each iteration
            // Mock PostGIS ST_IsValid to return true for both polygons
            // Mock PostGIS ST_Contains to return false (zone extends outside)
            const mockPrisma = createMockPrisma([
              [{ is_valid: true, reason: null }], // Field validation
              [{ is_valid: true, reason: null }], // Zone validation
              [{ is_contained: false }], // Containment check
            ]);

            const service = new PolygonValidationService(mockPrisma as PrismaService);
            const result = await service.validateZoneContainment(field, zone);

            // Zone should be invalid (not contained within field)
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('contained');
          },
        ),
        { numRuns: 100, verbose: true },
      );
    });

    it('should reject zone when field boundary is invalid', async () => {
      // Feature: farm-management-platform, Property 10: Zone containment validation
      await fc.assert(
        fc.asyncProperty(
          fieldBoundaryArb.chain((field) =>
            containedZoneArb(field).map((zone) => ({ field, zone })),
          ),
          async ({ field, zone }) => {
            // Create fresh mock for each iteration
            // Mock PostGIS ST_IsValid to return false for field
            const mockPrisma = createMockPrisma([
              [{ is_valid: false, reason: 'Self-intersection[0 0]' }], // Field validation fails
            ]);

            const service = new PolygonValidationService(mockPrisma as PrismaService);
            const result = await service.validateZoneContainment(field, zone);

            // Should fail because field is invalid
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Field boundary');
          },
        ),
        { numRuns: 100, verbose: true },
      );
    });

    it('should reject zone when zone boundary is invalid', async () => {
      // Feature: farm-management-platform, Property 10: Zone containment validation
      await fc.assert(
        fc.asyncProperty(
          fieldBoundaryArb.chain((field) =>
            containedZoneArb(field).map((zone) => ({ field, zone })),
          ),
          async ({ field, zone }) => {
            // Create fresh mock for each iteration
            // Mock PostGIS ST_IsValid to return true for field, false for zone
            const mockPrisma = createMockPrisma([
              [{ is_valid: true, reason: null }], // Field validation passes
              [{ is_valid: false, reason: 'Self-intersection[0 0]' }], // Zone validation fails
            ]);

            const service = new PolygonValidationService(mockPrisma as PrismaService);
            const result = await service.validateZoneContainment(field, zone);

            // Should fail because zone is invalid
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Zone boundary');
          },
        ),
        { numRuns: 100, verbose: true },
      );
    });
  });
});

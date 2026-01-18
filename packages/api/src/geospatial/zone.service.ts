import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { PolygonValidationService } from './polygon-validation.service';
import {
  CreateZoneDto,
  UpdateZoneDto,
  UpdateZoneSoilQualityDto,
  ZoneResponseDto,
  SoilQualityDto,
  BulkSoilQualityImportDto,
  SoilQualityImportResultDto,
} from './dto/zone.dto';

// Conversion factor: square meters to acres
const SQ_METERS_TO_ACRES = 0.000247105;

@Injectable()
export class ZoneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly polygonValidationService: PolygonValidationService,
  ) {}

  private getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Converts a GeoJSON polygon to PostGIS geography format
   */
  private toPostGISGeography(boundary: { type: 'Polygon'; coordinates: number[][][] }): string {
    const coordString = boundary.coordinates[0]
      .map(coord => `${coord[0]} ${coord[1]}`)
      .join(', ');
    return `SRID=4326;POLYGON((${coordString}))`;
  }

  /**
   * Creates a new zone within a field
   */
  async create(dto: CreateZoneDto): Promise<ZoneResponseDto> {
    const farmId = this.getFarmId();

    // Verify field exists and belongs to tenant
    const field = await this.prisma.$queryRaw<Array<{ id: string; boundary_geojson: string }>>`
      SELECT id, ST_AsGeoJSON(boundary)::text as boundary_geojson
      FROM fields
      WHERE id = ${dto.fieldId}::uuid AND farm_id = ${farmId}::uuid
    `;

    if (field.length === 0) {
      throw new NotFoundException(`Field with ID '${dto.fieldId}' not found`);
    }

    // Validate zone polygon
    const validationResult = await this.polygonValidationService.validatePolygon(dto.boundary);
    if (!validationResult.valid) {
      throw new BadRequestException(validationResult.errors.join('; '));
    }

    // Validate zone is contained within field boundary
    const zoneWKT = this.toPostGISGeography(dto.boundary);
    const containmentCheck = await this.prisma.$queryRaw<Array<{ is_contained: boolean }>>`
      SELECT ST_Contains(
        boundary::geometry,
        ST_GeomFromText(${zoneWKT.replace('SRID=4326;', '')}, 4326)
      ) as is_contained
      FROM fields
      WHERE id = ${dto.fieldId}::uuid
    `;

    if (!containmentCheck[0]?.is_contained) {
      throw new BadRequestException('Zone boundary must be completely contained within the field boundary');
    }

    const soilQuality = dto.soilQuality || {};

    const result = await this.prisma.$queryRaw<Array<{
      id: string;
      field_id: string;
      name: string;
      boundary_geojson: string;
      acreage: number;
      soil_quality: SoilQualityDto;
      created_at: Date;
      updated_at: Date;
    }>>`
      INSERT INTO zones (id, field_id, name, boundary, acreage, soil_quality, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${dto.fieldId}::uuid,
        ${dto.name},
        ST_GeogFromText(${zoneWKT}),
        ST_Area(ST_GeogFromText(${zoneWKT})) * ${SQ_METERS_TO_ACRES},
        ${JSON.stringify(soilQuality)}::jsonb,
        NOW(),
        NOW()
      )
      RETURNING 
        id,
        field_id,
        name,
        ST_AsGeoJSON(boundary)::text as boundary_geojson,
        acreage::float,
        soil_quality,
        created_at,
        updated_at
    `;

    return this.mapToResponseDto(result[0]);
  }


  /**
   * Retrieves all zones for a field
   */
  async findAllByField(fieldId: string): Promise<ZoneResponseDto[]> {
    const farmId = this.getFarmId();

    // Verify field exists and belongs to tenant
    const field = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM fields WHERE id = ${fieldId}::uuid AND farm_id = ${farmId}::uuid
    `;

    if (field.length === 0) {
      throw new NotFoundException(`Field with ID '${fieldId}' not found`);
    }

    const result = await this.prisma.$queryRaw<Array<{
      id: string;
      field_id: string;
      name: string;
      boundary_geojson: string;
      acreage: number | null;
      soil_quality: SoilQualityDto;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT 
        id,
        field_id,
        name,
        ST_AsGeoJSON(boundary)::text as boundary_geojson,
        acreage::float,
        soil_quality,
        created_at,
        updated_at
      FROM zones
      WHERE field_id = ${fieldId}::uuid
      ORDER BY name ASC
    `;

    return result.map(zone => this.mapToResponseDto(zone));
  }

  /**
   * Retrieves a single zone by ID
   */
  async findOne(id: string): Promise<ZoneResponseDto> {
    const farmId = this.getFarmId();

    const result = await this.prisma.$queryRaw<Array<{
      id: string;
      field_id: string;
      name: string;
      boundary_geojson: string;
      acreage: number | null;
      soil_quality: SoilQualityDto;
      created_at: Date;
      updated_at: Date;
      farm_id: string;
    }>>`
      SELECT 
        z.id,
        z.field_id,
        z.name,
        ST_AsGeoJSON(z.boundary)::text as boundary_geojson,
        z.acreage::float,
        z.soil_quality,
        z.created_at,
        z.updated_at,
        f.farm_id
      FROM zones z
      JOIN fields f ON z.field_id = f.id
      WHERE z.id = ${id}::uuid AND f.farm_id = ${farmId}::uuid
    `;

    if (result.length === 0) {
      throw new NotFoundException(`Zone with ID '${id}' not found`);
    }

    return this.mapToResponseDto(result[0]);
  }

  /**
   * Updates a zone
   */
  async update(id: string, dto: UpdateZoneDto): Promise<ZoneResponseDto> {
    const farmId = this.getFarmId();

    // Verify zone exists and belongs to tenant
    const existing = await this.prisma.$queryRaw<Array<{ id: string; field_id: string }>>`
      SELECT z.id, z.field_id
      FROM zones z
      JOIN fields f ON z.field_id = f.id
      WHERE z.id = ${id}::uuid AND f.farm_id = ${farmId}::uuid
    `;

    if (existing.length === 0) {
      throw new NotFoundException(`Zone with ID '${id}' not found`);
    }

    if (dto.boundary) {
      // Validate polygon
      const validationResult = await this.polygonValidationService.validatePolygon(dto.boundary);
      if (!validationResult.valid) {
        throw new BadRequestException(validationResult.errors.join('; '));
      }

      // Validate containment
      const zoneWKT = this.toPostGISGeography(dto.boundary);
      const containmentCheck = await this.prisma.$queryRaw<Array<{ is_contained: boolean }>>`
        SELECT ST_Contains(
          boundary::geometry,
          ST_GeomFromText(${zoneWKT.replace('SRID=4326;', '')}, 4326)
        ) as is_contained
        FROM fields
        WHERE id = ${existing[0].field_id}::uuid
      `;

      if (!containmentCheck[0]?.is_contained) {
        throw new BadRequestException('Zone boundary must be completely contained within the field boundary');
      }

      const result = await this.prisma.$queryRaw<Array<{
        id: string;
        field_id: string;
        name: string;
        boundary_geojson: string;
        acreage: number | null;
        soil_quality: SoilQualityDto;
        created_at: Date;
        updated_at: Date;
      }>>`
        UPDATE zones
        SET 
          name = COALESCE(${dto.name ?? null}, name),
          boundary = ST_GeogFromText(${zoneWKT}),
          acreage = ST_Area(ST_GeogFromText(${zoneWKT})) * ${SQ_METERS_TO_ACRES},
          soil_quality = COALESCE(${dto.soilQuality ? JSON.stringify(dto.soilQuality) : null}::jsonb, soil_quality),
          updated_at = NOW()
        WHERE id = ${id}::uuid
        RETURNING 
          id,
          field_id,
          name,
          ST_AsGeoJSON(boundary)::text as boundary_geojson,
          acreage::float,
          soil_quality,
          created_at,
          updated_at
      `;

      return this.mapToResponseDto(result[0]);
    } else {
      const result = await this.prisma.$queryRaw<Array<{
        id: string;
        field_id: string;
        name: string;
        boundary_geojson: string;
        acreage: number | null;
        soil_quality: SoilQualityDto;
        created_at: Date;
        updated_at: Date;
      }>>`
        UPDATE zones
        SET 
          name = COALESCE(${dto.name ?? null}, name),
          soil_quality = COALESCE(${dto.soilQuality ? JSON.stringify(dto.soilQuality) : null}::jsonb, soil_quality),
          updated_at = NOW()
        WHERE id = ${id}::uuid
        RETURNING 
          id,
          field_id,
          name,
          ST_AsGeoJSON(boundary)::text as boundary_geojson,
          acreage::float,
          soil_quality,
          created_at,
          updated_at
      `;

      return this.mapToResponseDto(result[0]);
    }
  }


  /**
   * Updates soil quality data for a zone
   * Implements Requirement 3.4: WHEN soil test data is imported for a zone, 
   * THE Map_Service SHALL update the zone's soil quality attributes
   */
  async updateSoilQuality(id: string, dto: UpdateZoneSoilQualityDto): Promise<ZoneResponseDto> {
    const farmId = this.getFarmId();

    // Verify zone exists and belongs to tenant
    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT z.id
      FROM zones z
      JOIN fields f ON z.field_id = f.id
      WHERE z.id = ${id}::uuid AND f.farm_id = ${farmId}::uuid
    `;

    if (existing.length === 0) {
      throw new NotFoundException(`Zone with ID '${id}' not found`);
    }

    const result = await this.prisma.$queryRaw<Array<{
      id: string;
      field_id: string;
      name: string;
      boundary_geojson: string;
      acreage: number | null;
      soil_quality: SoilQualityDto;
      created_at: Date;
      updated_at: Date;
    }>>`
      UPDATE zones
      SET 
        soil_quality = ${JSON.stringify(dto.soilQuality)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING 
        id,
        field_id,
        name,
        ST_AsGeoJSON(boundary)::text as boundary_geojson,
        acreage::float,
        soil_quality,
        created_at,
        updated_at
    `;

    return this.mapToResponseDto(result[0]);
  }

  /**
   * Bulk import soil quality data for multiple zones
   * Implements Requirement 3.4: WHEN soil test data is imported for a zone,
   * THE Map_Service SHALL update the zone's soil quality attributes
   */
  async bulkImportSoilQuality(dto: BulkSoilQualityImportDto): Promise<SoilQualityImportResultDto> {
    const farmId = this.getFarmId();
    const result: SoilQualityImportResultDto = {
      updated: 0,
      failed: 0,
      zones: [],
      errors: [],
    };

    for (const item of dto.items) {
      try {
        // Verify zone exists and belongs to tenant
        const existing = await this.prisma.$queryRaw<Array<{ id: string; name: string }>>`
          SELECT z.id, z.name
          FROM zones z
          JOIN fields f ON z.field_id = f.id
          WHERE z.id = ${item.zoneId}::uuid AND f.farm_id = ${farmId}::uuid
        `;

        if (existing.length === 0) {
          result.failed++;
          result.errors.push({
            zoneId: item.zoneId,
            error: `Zone with ID '${item.zoneId}' not found`,
          });
          continue;
        }

        // Update soil quality
        await this.prisma.$executeRaw`
          UPDATE zones
          SET 
            soil_quality = ${JSON.stringify(item.soilQuality)}::jsonb,
            updated_at = NOW()
          WHERE id = ${item.zoneId}::uuid
        `;

        result.updated++;
        result.zones.push({
          id: item.zoneId,
          name: existing[0].name,
        });
      } catch (error) {
        result.failed++;
        result.errors.push({
          zoneId: item.zoneId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Deletes a zone by ID
   */
  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    // Verify zone exists and belongs to tenant
    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT z.id
      FROM zones z
      JOIN fields f ON z.field_id = f.id
      WHERE z.id = ${id}::uuid AND f.farm_id = ${farmId}::uuid
    `;

    if (existing.length === 0) {
      throw new NotFoundException(`Zone with ID '${id}' not found`);
    }

    await this.prisma.$executeRaw`
      DELETE FROM zones WHERE id = ${id}::uuid
    `;
  }

  /**
   * Maps raw database result to response DTO
   */
  private mapToResponseDto(zone: {
    id: string;
    field_id: string;
    name: string;
    boundary_geojson: string;
    acreage: number | null;
    soil_quality: SoilQualityDto;
    created_at: Date;
    updated_at: Date;
  }): ZoneResponseDto {
    const boundary = JSON.parse(zone.boundary_geojson);
    
    return {
      id: zone.id,
      fieldId: zone.field_id,
      name: zone.name,
      boundary: {
        type: 'Polygon',
        coordinates: boundary.coordinates,
      },
      acreage: zone.acreage,
      soilQuality: zone.soil_quality || {},
      createdAt: zone.created_at,
      updatedAt: zone.updated_at,
    };
  }
}

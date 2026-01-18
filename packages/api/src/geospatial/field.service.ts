import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';
import { CreateFieldDto, UpdateFieldDto, FieldResponseDto } from './dto/field.dto';
import { PolygonValidationService } from './polygon-validation.service';

// Conversion factor: square meters to acres
const SQ_METERS_TO_ACRES = 0.000247105;

@Injectable()
export class FieldService {
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
   * Creates a new field with boundary and calculates acreage using PostGIS ST_Area
   */
  async create(dto: CreateFieldDto): Promise<FieldResponseDto> {
    const farmId = this.getFarmId();

    // Validate polygon before creating
    const validationResult = await this.polygonValidationService.validatePolygon(dto.boundary);
    if (!validationResult.valid) {
      throw new BadRequestException(validationResult.errors.join('; '));
    }

    const geographyWKT = this.toPostGISGeography(dto.boundary);

    // Use raw SQL to insert with geography type and calculate acreage
    const result = await this.prisma.$queryRaw<Array<{
      id: string;
      farm_id: string;
      name: string;
      boundary_geojson: string;
      acreage: number;
      soil_type: string | null;
      irrigation_type: string | null;
      created_at: Date;
      updated_at: Date;
    }>>`
      INSERT INTO fields (id, farm_id, name, boundary, acreage, soil_type, irrigation_type, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${farmId}::uuid,
        ${dto.name},
        ST_GeogFromText(${geographyWKT}),
        ST_Area(ST_GeogFromText(${geographyWKT})) * ${SQ_METERS_TO_ACRES},
        ${dto.soilType ?? null},
        ${dto.irrigationType ?? null},
        NOW(),
        NOW()
      )
      RETURNING 
        id,
        farm_id,
        name,
        ST_AsGeoJSON(boundary)::text as boundary_geojson,
        acreage::float,
        soil_type,
        irrigation_type,
        created_at,
        updated_at
    `;

    const field = result[0];
    return this.mapToResponseDto(field);
  }


  /**
   * Retrieves all fields for the current tenant
   */
  async findAll(): Promise<FieldResponseDto[]> {
    const farmId = this.getFarmId();

    const result = await this.prisma.$queryRaw<Array<{
      id: string;
      farm_id: string;
      name: string;
      boundary_geojson: string;
      acreage: number | null;
      soil_type: string | null;
      irrigation_type: string | null;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT 
        id,
        farm_id,
        name,
        ST_AsGeoJSON(boundary)::text as boundary_geojson,
        acreage::float,
        soil_type,
        irrigation_type,
        created_at,
        updated_at
      FROM fields
      WHERE farm_id = ${farmId}::uuid
      ORDER BY name ASC
    `;

    return result.map(field => this.mapToResponseDto(field));
  }

  /**
   * Retrieves a single field by ID
   */
  async findOne(id: string): Promise<FieldResponseDto> {
    const farmId = this.getFarmId();

    const result = await this.prisma.$queryRaw<Array<{
      id: string;
      farm_id: string;
      name: string;
      boundary_geojson: string;
      acreage: number | null;
      soil_type: string | null;
      irrigation_type: string | null;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT 
        id,
        farm_id,
        name,
        ST_AsGeoJSON(boundary)::text as boundary_geojson,
        acreage::float,
        soil_type,
        irrigation_type,
        created_at,
        updated_at
      FROM fields
      WHERE id = ${id}::uuid AND farm_id = ${farmId}::uuid
    `;

    if (result.length === 0) {
      throw new NotFoundException(`Field with ID '${id}' not found`);
    }

    return this.mapToResponseDto(result[0]);
  }

  /**
   * Updates a field and recalculates acreage if boundary changes
   */
  async update(id: string, dto: UpdateFieldDto): Promise<FieldResponseDto> {
    const farmId = this.getFarmId();

    // Verify field exists and belongs to tenant
    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM fields WHERE id = ${id}::uuid AND farm_id = ${farmId}::uuid
    `;

    if (existing.length === 0) {
      throw new NotFoundException(`Field with ID '${id}' not found`);
    }

    // Build dynamic update query based on provided fields
    if (dto.boundary) {
      // Validate polygon before updating
      const validationResult = await this.polygonValidationService.validatePolygon(dto.boundary);
      if (!validationResult.valid) {
        throw new BadRequestException(validationResult.errors.join('; '));
      }

      const geographyWKT = this.toPostGISGeography(dto.boundary);
      
      const result = await this.prisma.$queryRaw<Array<{
        id: string;
        farm_id: string;
        name: string;
        boundary_geojson: string;
        acreage: number | null;
        soil_type: string | null;
        irrigation_type: string | null;
        created_at: Date;
        updated_at: Date;
      }>>`
        UPDATE fields
        SET 
          name = COALESCE(${dto.name ?? null}, name),
          boundary = ST_GeogFromText(${geographyWKT}),
          acreage = ST_Area(ST_GeogFromText(${geographyWKT})) * ${SQ_METERS_TO_ACRES},
          soil_type = COALESCE(${dto.soilType ?? null}, soil_type),
          irrigation_type = COALESCE(${dto.irrigationType ?? null}, irrigation_type),
          updated_at = NOW()
        WHERE id = ${id}::uuid AND farm_id = ${farmId}::uuid
        RETURNING 
          id,
          farm_id,
          name,
          ST_AsGeoJSON(boundary)::text as boundary_geojson,
          acreage::float,
          soil_type,
          irrigation_type,
          created_at,
          updated_at
      `;

      return this.mapToResponseDto(result[0]);
    } else {
      // Update without boundary change
      const result = await this.prisma.$queryRaw<Array<{
        id: string;
        farm_id: string;
        name: string;
        boundary_geojson: string;
        acreage: number | null;
        soil_type: string | null;
        irrigation_type: string | null;
        created_at: Date;
        updated_at: Date;
      }>>`
        UPDATE fields
        SET 
          name = COALESCE(${dto.name ?? null}, name),
          soil_type = COALESCE(${dto.soilType ?? null}, soil_type),
          irrigation_type = COALESCE(${dto.irrigationType ?? null}, irrigation_type),
          updated_at = NOW()
        WHERE id = ${id}::uuid AND farm_id = ${farmId}::uuid
        RETURNING 
          id,
          farm_id,
          name,
          ST_AsGeoJSON(boundary)::text as boundary_geojson,
          acreage::float,
          soil_type,
          irrigation_type,
          created_at,
          updated_at
      `;

      return this.mapToResponseDto(result[0]);
    }
  }


  /**
   * Deletes a field by ID
   */
  async delete(id: string): Promise<void> {
    const farmId = this.getFarmId();

    // Verify field exists and belongs to tenant
    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM fields WHERE id = ${id}::uuid AND farm_id = ${farmId}::uuid
    `;

    if (existing.length === 0) {
      throw new NotFoundException(`Field with ID '${id}' not found`);
    }

    // Check for related zones
    const zones = await this.prisma.zone.findMany({
      where: { fieldId: id },
      select: { id: true },
    });

    if (zones.length > 0) {
      throw new BadRequestException(
        `Cannot delete field with ID '${id}' because it has ${zones.length} associated zone(s). Delete the zones first.`,
      );
    }

    await this.prisma.$executeRaw`
      DELETE FROM fields WHERE id = ${id}::uuid AND farm_id = ${farmId}::uuid
    `;
  }

  /**
   * Retrieves a field with its zones
   */
  async findOneWithZones(id: string): Promise<FieldResponseDto & { zones: Array<{ id: string; name: string; acreage: number | null }> }> {
    const field = await this.findOne(id);

    const zones = await this.prisma.zone.findMany({
      where: { fieldId: id },
      select: {
        id: true,
        name: true,
        acreage: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      ...field,
      zones: zones.map(z => ({
        id: z.id,
        name: z.name,
        acreage: z.acreage ? Number(z.acreage) : null,
      })),
    };
  }

  /**
   * Maps raw database result to response DTO
   */
  private mapToResponseDto(field: {
    id: string;
    farm_id: string;
    name: string;
    boundary_geojson: string;
    acreage: number | null;
    soil_type: string | null;
    irrigation_type: string | null;
    created_at: Date;
    updated_at: Date;
  }): FieldResponseDto {
    const boundary = JSON.parse(field.boundary_geojson);
    
    return {
      id: field.id,
      farmId: field.farm_id,
      name: field.name,
      boundary: {
        type: 'Polygon',
        coordinates: boundary.coordinates,
      },
      acreage: field.acreage,
      soilType: field.soil_type,
      irrigationType: field.irrigation_type,
      createdAt: field.created_at,
      updatedAt: field.updated_at,
    };
  }
}

import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { FieldService } from './field.service';
import { PolygonValidationService } from './polygon-validation.service';
import {
  GeoJSONFeatureCollectionDto,
  KMLImportDto,
  ImportResultDto,
  GeoJSONFeatureCollection,
  GeoJSONFeature,
} from './dto/import-export.dto';
import { FieldResponseDto } from './dto/field.dto';

/**
 * Service for importing and exporting field data in GeoJSON and KML formats
 */
@Injectable()
export class ImportExportService {
  constructor(
    private readonly fieldService: FieldService,
    private readonly polygonValidationService: PolygonValidationService,
  ) {}

  /**
   * Import fields from a GeoJSON FeatureCollection
   * Each Feature with a Polygon geometry becomes a Field
   */
  async importFromGeoJSON(data: GeoJSONFeatureCollectionDto): Promise<ImportResultDto> {
    const result: ImportResultDto = {
      imported: 0,
      failed: 0,
      fields: [],
      errors: [],
    };

    if (!data.features || data.features.length === 0) {
      throw new BadRequestException('GeoJSON FeatureCollection must contain at least one feature');
    }

    for (let i = 0; i < data.features.length; i++) {
      const feature = data.features[i];
      
      try {
        // Validate feature structure
        if (feature.type !== 'Feature') {
          throw new Error(`Invalid feature type: expected 'Feature', got '${feature.type}'`);
        }

        if (!feature.geometry || feature.geometry.type !== 'Polygon') {
          throw new Error('Feature must have a Polygon geometry');
        }

        if (!feature.geometry.coordinates || !Array.isArray(feature.geometry.coordinates)) {
          throw new Error('Polygon geometry must have coordinates array');
        }

        // Extract field properties
        const name = feature.properties?.name || `Imported Field ${i + 1}`;
        const soilType = feature.properties?.soilType as string | undefined;
        const irrigationType = feature.properties?.irrigationType as string | undefined;

        // Create the field
        const field = await this.fieldService.create({
          name,
          boundary: {
            type: 'Polygon',
            coordinates: feature.geometry.coordinates,
          },
          soilType,
          irrigationType,
        });

        result.imported++;
        result.fields.push({ id: field.id, name: field.name });
      } catch (error) {
        result.failed++;
        result.errors.push({
          index: i,
          name: feature.properties?.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }


  /**
   * Import fields from KML format
   * Parses KML XML and extracts Placemark elements with Polygon geometries
   */
  async importFromKML(data: KMLImportDto): Promise<ImportResultDto> {
    const result: ImportResultDto = {
      imported: 0,
      failed: 0,
      fields: [],
      errors: [],
    };

    const kml = data.kml.trim();
    
    if (!kml) {
      throw new BadRequestException('KML content cannot be empty');
    }

    // Parse KML to extract Placemarks with Polygon geometries
    const placemarks = this.parseKMLPlacemarks(kml);

    if (placemarks.length === 0) {
      throw new BadRequestException('No valid Placemark elements with Polygon geometries found in KML');
    }

    for (let i = 0; i < placemarks.length; i++) {
      const placemark = placemarks[i];
      
      try {
        const field = await this.fieldService.create({
          name: placemark.name,
          boundary: {
            type: 'Polygon',
            coordinates: placemark.coordinates,
          },
          soilType: placemark.soilType,
          irrigationType: placemark.irrigationType,
        });

        result.imported++;
        result.fields.push({ id: field.id, name: field.name });
      } catch (error) {
        result.failed++;
        result.errors.push({
          index: i,
          name: placemark.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Parse KML XML and extract Placemark elements with Polygon geometries
   * Uses simple regex-based parsing for KML structure
   */
  private parseKMLPlacemarks(kml: string): Array<{
    name: string;
    coordinates: number[][][];
    soilType?: string;
    irrigationType?: string;
  }> {
    const placemarks: Array<{
      name: string;
      coordinates: number[][][];
      soilType?: string;
      irrigationType?: string;
    }> = [];

    // Extract all Placemark elements
    const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
    let placemarkMatch;
    let index = 0;

    while ((placemarkMatch = placemarkRegex.exec(kml)) !== null) {
      const placemarkContent = placemarkMatch[1];
      
      // Extract name
      const nameMatch = /<name[^>]*>([\s\S]*?)<\/name>/i.exec(placemarkContent);
      const name = nameMatch ? this.decodeXMLEntities(nameMatch[1].trim()) : `Imported Field ${index + 1}`;

      // Extract Polygon coordinates
      const polygonMatch = /<Polygon[^>]*>([\s\S]*?)<\/Polygon>/i.exec(placemarkContent);
      if (!polygonMatch) {
        index++;
        continue; // Skip placemarks without Polygon geometry
      }

      const polygonContent = polygonMatch[1];
      
      // Extract coordinates from outerBoundaryIs
      const outerBoundaryMatch = /<outerBoundaryIs[^>]*>([\s\S]*?)<\/outerBoundaryIs>/i.exec(polygonContent);
      if (!outerBoundaryMatch) {
        index++;
        continue;
      }

      const coordinatesMatch = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i.exec(outerBoundaryMatch[1]);
      if (!coordinatesMatch) {
        index++;
        continue;
      }

      const coordString = coordinatesMatch[1].trim();
      const coordinates = this.parseKMLCoordinates(coordString);
      
      if (coordinates.length < 4) {
        index++;
        continue; // Invalid polygon (needs at least 4 points including closing point)
      }

      // Extract extended data if present
      let soilType: string | undefined;
      let irrigationType: string | undefined;

      const extendedDataMatch = /<ExtendedData[^>]*>([\s\S]*?)<\/ExtendedData>/i.exec(placemarkContent);
      if (extendedDataMatch) {
        const extendedData = extendedDataMatch[1];
        
        const soilTypeMatch = /<Data\s+name=["']soilType["'][^>]*>[\s\S]*?<value[^>]*>([\s\S]*?)<\/value>/i.exec(extendedData);
        if (soilTypeMatch) {
          soilType = this.decodeXMLEntities(soilTypeMatch[1].trim());
        }

        const irrigationMatch = /<Data\s+name=["']irrigationType["'][^>]*>[\s\S]*?<value[^>]*>([\s\S]*?)<\/value>/i.exec(extendedData);
        if (irrigationMatch) {
          irrigationType = this.decodeXMLEntities(irrigationMatch[1].trim());
        }
      }

      placemarks.push({
        name,
        coordinates: [coordinates],
        soilType,
        irrigationType,
      });

      index++;
    }

    return placemarks;
  }

  /**
   * Parse KML coordinate string into GeoJSON coordinate array
   * KML format: "lon,lat,alt lon,lat,alt ..."
   * GeoJSON format: [[lon, lat], [lon, lat], ...]
   */
  private parseKMLCoordinates(coordString: string): number[][] {
    const coordinates: number[][] = [];
    
    // Split by whitespace and process each coordinate tuple
    const tuples = coordString.split(/\s+/).filter(t => t.length > 0);
    
    for (const tuple of tuples) {
      const parts = tuple.split(',');
      if (parts.length >= 2) {
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        
        if (!isNaN(lon) && !isNaN(lat)) {
          coordinates.push([lon, lat]);
        }
      }
    }

    return coordinates;
  }

  /**
   * Decode common XML entities
   */
  private decodeXMLEntities(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }


  /**
   * Export all fields for the current tenant as GeoJSON FeatureCollection
   */
  async exportToGeoJSON(): Promise<GeoJSONFeatureCollection> {
    const fields = await this.fieldService.findAll();
    
    return this.fieldsToGeoJSON(fields);
  }

  /**
   * Export specific fields by IDs as GeoJSON FeatureCollection
   */
  async exportFieldsToGeoJSON(fieldIds: string[]): Promise<GeoJSONFeatureCollection> {
    const fields: FieldResponseDto[] = [];
    
    for (const id of fieldIds) {
      try {
        const field = await this.fieldService.findOne(id);
        fields.push(field);
      } catch {
        // Skip fields that don't exist or aren't accessible
      }
    }

    return this.fieldsToGeoJSON(fields);
  }

  /**
   * Convert field entities to GeoJSON FeatureCollection
   */
  private fieldsToGeoJSON(fields: FieldResponseDto[]): GeoJSONFeatureCollection {
    const features: GeoJSONFeature[] = fields.map(field => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: field.boundary.coordinates,
      },
      properties: {
        id: field.id,
        name: field.name,
        acreage: field.acreage,
        soilType: field.soilType,
        irrigationType: field.irrigationType,
        farmId: field.farmId,
        createdAt: field.createdAt.toISOString(),
        updatedAt: field.updatedAt.toISOString(),
      },
    }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  /**
   * Export all fields for the current tenant as KML
   */
  async exportToKML(): Promise<string> {
    const fields = await this.fieldService.findAll();
    
    return this.fieldsToKML(fields);
  }

  /**
   * Export specific fields by IDs as KML
   */
  async exportFieldsToKML(fieldIds: string[]): Promise<string> {
    const fields: FieldResponseDto[] = [];
    
    for (const id of fieldIds) {
      try {
        const field = await this.fieldService.findOne(id);
        fields.push(field);
      } catch {
        // Skip fields that don't exist or aren't accessible
      }
    }

    return this.fieldsToKML(fields);
  }

  /**
   * Convert field entities to KML format
   */
  private fieldsToKML(fields: FieldResponseDto[]): string {
    const placemarks = fields.map(field => this.fieldToKMLPlacemark(field)).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Farm Fields Export</name>
    <description>Exported field boundaries</description>
${placemarks}
  </Document>
</kml>`;
  }

  /**
   * Convert a single field to KML Placemark element
   */
  private fieldToKMLPlacemark(field: FieldResponseDto): string {
    const coordinates = field.boundary.coordinates[0]
      .map(coord => `${coord[0]},${coord[1]},0`)
      .join(' ');

    const extendedData = this.buildKMLExtendedData(field);

    return `    <Placemark>
      <name>${this.encodeXMLEntities(field.name)}</name>
      <description>Field ID: ${field.id}</description>
${extendedData}
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordinates}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
  }

  /**
   * Build KML ExtendedData element for field properties
   */
  private buildKMLExtendedData(field: FieldResponseDto): string {
    const dataElements: string[] = [];

    dataElements.push(`        <Data name="id"><value>${field.id}</value></Data>`);
    dataElements.push(`        <Data name="farmId"><value>${field.farmId}</value></Data>`);
    
    if (field.acreage !== null) {
      dataElements.push(`        <Data name="acreage"><value>${field.acreage}</value></Data>`);
    }
    
    if (field.soilType) {
      dataElements.push(`        <Data name="soilType"><value>${this.encodeXMLEntities(field.soilType)}</value></Data>`);
    }
    
    if (field.irrigationType) {
      dataElements.push(`        <Data name="irrigationType"><value>${this.encodeXMLEntities(field.irrigationType)}</value></Data>`);
    }

    dataElements.push(`        <Data name="createdAt"><value>${field.createdAt.toISOString()}</value></Data>`);
    dataElements.push(`        <Data name="updatedAt"><value>${field.updatedAt.toISOString()}</value></Data>`);

    return `      <ExtendedData>\n${dataElements.join('\n')}\n      </ExtendedData>`;
  }

  /**
   * Encode special characters for XML
   */
  private encodeXMLEntities(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

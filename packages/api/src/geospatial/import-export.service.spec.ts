import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportExportService } from './import-export.service';
import { FieldService } from './field.service';
import { PolygonValidationService } from './polygon-validation.service';
import { BadRequestException } from '@nestjs/common';

describe('ImportExportService', () => {
  let service: ImportExportService;
  let fieldService: FieldService;
  let polygonValidationService: PolygonValidationService;

  const mockField = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    farmId: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Test Field',
    boundary: {
      type: 'Polygon' as const,
      coordinates: [[[-95.0, 40.0], [-95.0, 41.0], [-94.0, 41.0], [-94.0, 40.0], [-95.0, 40.0]]],
    },
    acreage: 100.5,
    soilType: 'loam',
    irrigationType: 'drip',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    fieldService = {
      create: vi.fn().mockResolvedValue(mockField),
      findAll: vi.fn().mockResolvedValue([mockField]),
      findOne: vi.fn().mockResolvedValue(mockField),
    } as unknown as FieldService;

    polygonValidationService = {
      validatePolygon: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    } as unknown as PolygonValidationService;

    service = new ImportExportService(fieldService, polygonValidationService);
  });

  describe('importFromGeoJSON', () => {
    it('should import valid GeoJSON FeatureCollection', async () => {
      const geojson = {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry: {
              type: 'Polygon' as const,
              coordinates: [[[-95.0, 40.0], [-95.0, 41.0], [-94.0, 41.0], [-94.0, 40.0], [-95.0, 40.0]]],
            },
            properties: {
              name: 'Test Field',
              soilType: 'loam',
              irrigationType: 'drip',
            },
          },
        ],
      };

      const result = await service.importFromGeoJSON(geojson);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.fields).toHaveLength(1);
      expect(result.fields[0].name).toBe('Test Field');
      expect(fieldService.create).toHaveBeenCalledWith({
        name: 'Test Field',
        boundary: {
          type: 'Polygon',
          coordinates: [[[-95.0, 40.0], [-95.0, 41.0], [-94.0, 41.0], [-94.0, 40.0], [-95.0, 40.0]]],
        },
        soilType: 'loam',
        irrigationType: 'drip',
      });
    });

    it('should throw error for empty FeatureCollection', async () => {
      const geojson = {
        type: 'FeatureCollection' as const,
        features: [],
      };

      await expect(service.importFromGeoJSON(geojson)).rejects.toThrow(BadRequestException);
    });

    it('should use default name when property name is missing', async () => {
      const geojson = {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry: {
              type: 'Polygon' as const,
              coordinates: [[[-95.0, 40.0], [-95.0, 41.0], [-94.0, 41.0], [-94.0, 40.0], [-95.0, 40.0]]],
            },
            properties: {},
          },
        ],
      };

      await service.importFromGeoJSON(geojson);

      expect(fieldService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Imported Field 1',
        }),
      );
    });

    it('should handle import errors gracefully', async () => {
      vi.mocked(fieldService.create).mockRejectedValueOnce(new Error('Database error'));

      const geojson = {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry: {
              type: 'Polygon' as const,
              coordinates: [[[-95.0, 40.0], [-95.0, 41.0], [-94.0, 41.0], [-94.0, 40.0], [-95.0, 40.0]]],
            },
            properties: { name: 'Failed Field' },
          },
        ],
      };

      const result = await service.importFromGeoJSON(geojson);

      expect(result.imported).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Database error');
    });
  });


  describe('importFromKML', () => {
    it('should import valid KML with Placemark', async () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Test Field</name>
      <ExtendedData>
        <Data name="soilType"><value>loam</value></Data>
        <Data name="irrigationType"><value>drip</value></Data>
      </ExtendedData>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>-95.0,40.0,0 -95.0,41.0,0 -94.0,41.0,0 -94.0,40.0,0 -95.0,40.0,0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

      const result = await service.importFromKML({ kml });

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.fields).toHaveLength(1);
      expect(fieldService.create).toHaveBeenCalledWith({
        name: 'Test Field',
        boundary: {
          type: 'Polygon',
          coordinates: [[[-95.0, 40.0], [-95.0, 41.0], [-94.0, 41.0], [-94.0, 40.0], [-95.0, 40.0]]],
        },
        soilType: 'loam',
        irrigationType: 'drip',
      });
    });

    it('should throw error for empty KML', async () => {
      await expect(service.importFromKML({ kml: '' })).rejects.toThrow(BadRequestException);
    });

    it('should throw error for KML without Placemarks', async () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Empty Document</name>
  </Document>
</kml>`;

      await expect(service.importFromKML({ kml })).rejects.toThrow(BadRequestException);
    });

    it('should skip Placemarks without Polygon geometry', async () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Point Feature</name>
      <Point>
        <coordinates>-95.0,40.0,0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Valid Polygon</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>-95.0,40.0,0 -95.0,41.0,0 -94.0,41.0,0 -94.0,40.0,0 -95.0,40.0,0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

      const result = await service.importFromKML({ kml });

      expect(result.imported).toBe(1);
      expect(result.fields[0].name).toBe('Test Field'); // From mock
    });
  });

  describe('exportToGeoJSON', () => {
    it('should export fields as GeoJSON FeatureCollection', async () => {
      const result = await service.exportToGeoJSON();

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('Feature');
      expect(result.features[0].geometry.type).toBe('Polygon');
      expect(result.features[0].geometry.coordinates).toEqual(mockField.boundary.coordinates);
      expect(result.features[0].properties.id).toBe(mockField.id);
      expect(result.features[0].properties.name).toBe(mockField.name);
      expect(result.features[0].properties.acreage).toBe(mockField.acreage);
      expect(result.features[0].properties.soilType).toBe(mockField.soilType);
    });

    it('should export empty FeatureCollection when no fields exist', async () => {
      vi.mocked(fieldService.findAll).mockResolvedValueOnce([]);

      const result = await service.exportToGeoJSON();

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(0);
    });
  });

  describe('exportToKML', () => {
    it('should export fields as valid KML', async () => {
      const result = await service.exportToKML();

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
      expect(result).toContain('<Placemark>');
      expect(result).toContain(`<name>${mockField.name}</name>`);
      expect(result).toContain('<Polygon>');
      expect(result).toContain('<coordinates>');
      expect(result).toContain('-95,40,0');
      expect(result).toContain('<Data name="soilType"><value>loam</value></Data>');
      expect(result).toContain('<Data name="irrigationType"><value>drip</value></Data>');
    });

    it('should export empty KML document when no fields exist', async () => {
      vi.mocked(fieldService.findAll).mockResolvedValueOnce([]);

      const result = await service.exportToKML();

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
      expect(result).not.toContain('<Placemark>');
    });
  });

  describe('exportFieldsToGeoJSON', () => {
    it('should export specific fields by IDs', async () => {
      const result = await service.exportFieldsToGeoJSON([mockField.id]);

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(fieldService.findOne).toHaveBeenCalledWith(mockField.id);
    });

    it('should skip non-existent field IDs', async () => {
      vi.mocked(fieldService.findOne).mockRejectedValueOnce(new Error('Not found'));

      const result = await service.exportFieldsToGeoJSON(['non-existent-id']);

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(0);
    });
  });

  describe('exportFieldsToKML', () => {
    it('should export specific fields by IDs as KML', async () => {
      const result = await service.exportFieldsToKML([mockField.id]);

      expect(result).toContain('<Placemark>');
      expect(result).toContain(`<name>${mockField.name}</name>`);
      expect(fieldService.findOne).toHaveBeenCalledWith(mockField.id);
    });
  });

  describe('XML entity encoding/decoding', () => {
    it('should properly encode XML entities in KML export', async () => {
      const fieldWithSpecialChars = {
        ...mockField,
        name: 'Field <with> "special" & \'chars\'',
      };
      vi.mocked(fieldService.findAll).mockResolvedValueOnce([fieldWithSpecialChars]);

      const result = await service.exportToKML();

      expect(result).toContain('Field &lt;with&gt; &quot;special&quot; &amp; &apos;chars&apos;');
    });

    it('should properly decode XML entities in KML import', async () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Field &lt;with&gt; &quot;special&quot; &amp; &apos;chars&apos;</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>-95.0,40.0,0 -95.0,41.0,0 -94.0,41.0,0 -94.0,40.0,0 -95.0,40.0,0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

      await service.importFromKML({ kml });

      expect(fieldService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Field <with> "special" & \'chars\'',
        }),
      );
    });
  });
});

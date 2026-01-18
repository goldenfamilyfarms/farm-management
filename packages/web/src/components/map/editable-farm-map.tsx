import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { Loader2 } from 'lucide-react';
import {
  useFields,
  useEquipmentPositions,
  getSoilQualityColor,
  getEquipmentStatusColor,
  type FieldWithZones,
  type EquipmentPosition,
  type GeoPolygon,
} from '@/hooks/use-map-data';
import { useCreateField, useUpdateField, useCreateZone, useUpdateZone } from '@/hooks/use-field-mutations';
import { MapLayerControls } from './map-layer-controls';
import { DrawingToolbar, type DrawingMode, type EntityType } from './drawing-toolbar';
import { FieldZoneDialog } from './field-zone-dialog';
import { useToast } from '@/components/ui/use-toast';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface EditableFarmMapProps {
  className?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
}

interface DrawingState {
  isDrawing: boolean;
  entityType: EntityType;
  editingId: string | null;
}

export function EditableFarmMap({
  className = '',
  initialCenter = [-98.5795, 39.8283],
  initialZoom = 12,
}: EditableFarmMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [layers, setLayers] = useState({
    fields: true,
    zones: true,
    equipment: true,
  });
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const [entityType, setEntityType] = useState<EntityType>('field');
  const [hasSelection, setHasSelection] = useState(false);
  const [hasDrawnFeature, setHasDrawnFeature] = useState(false);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    entityType: 'field',
    editingId: null,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawnPolygon, setDrawnPolygon] = useState<GeoPolygon | null>(null);

  const { data: fields, isLoading: fieldsLoading } = useFields();
  const { data: equipment, isLoading: equipmentLoading } = useEquipmentPositions();
  
  const createField = useCreateField();
  const updateField = useUpdateField();
  const createZone = useCreateZone();
  const updateZone = useUpdateZone();
  
  const { toast } = useToast();

  // Event handlers defined before useEffect to avoid dependency issues
  const handleDrawCreate = useCallback((e: { features: GeoJSON.Feature[] }) => {
    if (e.features.length > 0) {
      const feature = e.features[0];
      if (feature.geometry.type === 'Polygon') {
        setDrawnPolygon({
          type: 'Polygon',
          coordinates: feature.geometry.coordinates as number[][][],
        });
        setHasDrawnFeature(true);
      }
    }
  }, []);

  const handleDrawUpdate = useCallback((e: { features: GeoJSON.Feature[] }) => {
    if (e.features.length > 0) {
      const feature = e.features[0];
      if (feature.geometry.type === 'Polygon') {
        setDrawnPolygon({
          type: 'Polygon',
          coordinates: feature.geometry.coordinates as number[][][],
        });
      }
    }
  }, []);

  const handleDrawDelete = useCallback(() => {
    setDrawnPolygon(null);
    setHasDrawnFeature(false);
    setHasSelection(false);
  }, []);

  const handleSelectionChange = useCallback((e: { features: GeoJSON.Feature[] }) => {
    setHasSelection(e.features.length > 0);
  }, []);

  const handleModeChange = useCallback((e: { mode: string }) => {
    setDrawingMode(e.mode as DrawingMode);
  }, []);

  // Initialize map with draw controls
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!MAPBOX_TOKEN) {
      console.warn('Mapbox token not configured.');
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: initialCenter,
      zoom: initialZoom,
    });

    // Initialize MapboxDraw
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: 'simple_select',
      styles: [
        // Polygon fill
        {
          id: 'gl-draw-polygon-fill',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'fill-color': '#3B82F6',
            'fill-outline-color': '#3B82F6',
            'fill-opacity': 0.3,
          },
        },
        // Polygon outline
        {
          id: 'gl-draw-polygon-stroke-active',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#2563EB',
            'line-width': 2,
          },
        },
        // Vertex points
        {
          id: 'gl-draw-polygon-and-line-vertex-active',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
          paint: {
            'circle-radius': 6,
            'circle-color': '#fff',
            'circle-stroke-color': '#2563EB',
            'circle-stroke-width': 2,
          },
        },
        // Midpoints
        {
          id: 'gl-draw-polygon-midpoint',
          type: 'circle',
          filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
          paint: {
            'circle-radius': 4,
            'circle-color': '#2563EB',
          },
        },
      ],
    });

    map.current.addControl(draw.current);
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    // Listen for draw events
    map.current.on('draw.create', handleDrawCreate);
    map.current.on('draw.update', handleDrawUpdate);
    map.current.on('draw.delete', handleDrawDelete);
    map.current.on('draw.selectionchange', handleSelectionChange);
    map.current.on('draw.modechange', handleModeChange);

    return () => {
      map.current?.remove();
      map.current = null;
      draw.current = null;
    };
  }, [initialCenter, initialZoom, handleDrawCreate, handleDrawUpdate, handleDrawDelete, handleSelectionChange, handleModeChange]);


  // Add field boundaries to map
  const addFieldLayers = useCallback((fieldsData: FieldWithZones[]) => {
    if (!map.current || !mapLoaded) return;

    // Remove existing field layers if they exist
    if (map.current.getLayer('field-boundaries')) {
      map.current.removeLayer('field-boundaries');
    }
    if (map.current.getLayer('field-boundaries-outline')) {
      map.current.removeLayer('field-boundaries-outline');
    }
    if (map.current.getSource('fields')) {
      map.current.removeSource('fields');
    }

    const fieldFeatures = fieldsData.map((field) => ({
      type: 'Feature' as const,
      properties: {
        id: field.id,
        name: field.name,
        acreage: field.acreage,
        soilType: field.soilType,
        irrigationType: field.irrigationType,
      },
      geometry: field.boundary,
    }));

    map.current.addSource('fields', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: fieldFeatures,
      },
    });

    map.current.addLayer({
      id: 'field-boundaries',
      type: 'fill',
      source: 'fields',
      paint: {
        'fill-color': '#3B82F6',
        'fill-opacity': 0.2,
      },
      layout: {
        visibility: layers.fields ? 'visible' : 'none',
      },
    });

    map.current.addLayer({
      id: 'field-boundaries-outline',
      type: 'line',
      source: 'fields',
      paint: {
        'line-color': '#2563EB',
        'line-width': 2,
      },
      layout: {
        visibility: layers.fields ? 'visible' : 'none',
      },
    });

    // Click handler for editing existing fields
    map.current.on('click', 'field-boundaries', (e) => {
      if (drawingState.isDrawing) return;
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const props = feature.properties;

      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="p-2">
            <h3 class="font-bold text-sm">${props?.name || 'Unknown Field'}</h3>
            <p class="text-xs text-gray-600">Acreage: ${props?.acreage?.toFixed(1) || 'N/A'} acres</p>
            ${props?.soilType ? `<p class="text-xs text-gray-600">Soil: ${props.soilType}</p>` : ''}
            ${props?.irrigationType ? `<p class="text-xs text-gray-600">Irrigation: ${props.irrigationType}</p>` : ''}
            <button 
              class="mt-2 text-xs text-blue-600 hover:underline edit-field-btn"
              data-field-id="${props?.id}"
            >
              Edit Boundary
            </button>
          </div>
        `)
        .addTo(map.current!);
    });

    map.current.on('mouseenter', 'field-boundaries', () => {
      if (map.current && !drawingState.isDrawing) {
        map.current.getCanvas().style.cursor = 'pointer';
      }
    });
    map.current.on('mouseleave', 'field-boundaries', () => {
      if (map.current && !drawingState.isDrawing) {
        map.current.getCanvas().style.cursor = '';
      }
    });
  }, [mapLoaded, layers.fields, drawingState.isDrawing]);

  // Add zone overlays to map
  const addZoneLayers = useCallback((fieldsData: FieldWithZones[]) => {
    if (!map.current || !mapLoaded) return;

    if (map.current.getLayer('zone-boundaries')) {
      map.current.removeLayer('zone-boundaries');
    }
    if (map.current.getLayer('zone-boundaries-outline')) {
      map.current.removeLayer('zone-boundaries-outline');
    }
    if (map.current.getSource('zones')) {
      map.current.removeSource('zones');
    }

    const zoneFeatures = fieldsData.flatMap((field) =>
      (field.zones || []).map((zone) => ({
        type: 'Feature' as const,
        properties: {
          id: zone.id,
          name: zone.name,
          fieldId: zone.fieldId,
          acreage: zone.acreage,
          soilQuality: zone.soilQuality,
          color: getSoilQualityColor(zone.soilQuality),
        },
        geometry: zone.boundary,
      }))
    );

    if (zoneFeatures.length === 0) return;

    map.current.addSource('zones', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: zoneFeatures,
      },
    });

    map.current.addLayer({
      id: 'zone-boundaries',
      type: 'fill',
      source: 'zones',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.4,
      },
      layout: {
        visibility: layers.zones ? 'visible' : 'none',
      },
    });

    map.current.addLayer({
      id: 'zone-boundaries-outline',
      type: 'line',
      source: 'zones',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
      },
      layout: {
        visibility: layers.zones ? 'visible' : 'none',
      },
    });

    map.current.on('click', 'zone-boundaries', (e) => {
      if (drawingState.isDrawing) return;
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const props = feature.properties;
      const soilQuality = props?.soilQuality ? JSON.parse(props.soilQuality) : null;

      let soilInfo = '';
      if (soilQuality) {
        if (soilQuality.ph !== undefined) soilInfo += `<p class="text-xs">pH: ${soilQuality.ph}</p>`;
        if (soilQuality.organicMatter !== undefined) soilInfo += `<p class="text-xs">Organic Matter: ${soilQuality.organicMatter}%</p>`;
        if (soilQuality.nitrogen !== undefined) soilInfo += `<p class="text-xs">Nitrogen: ${soilQuality.nitrogen} ppm</p>`;
        if (soilQuality.texture) soilInfo += `<p class="text-xs">Texture: ${soilQuality.texture}</p>`;
      }

      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="p-2">
            <h3 class="font-bold text-sm">${props?.name || 'Unknown Zone'}</h3>
            <p class="text-xs text-gray-600">Acreage: ${props?.acreage?.toFixed(1) || 'N/A'} acres</p>
            ${soilInfo ? `<div class="mt-1 text-gray-600">${soilInfo}</div>` : ''}
            <button 
              class="mt-2 text-xs text-blue-600 hover:underline edit-zone-btn"
              data-zone-id="${props?.id}"
            >
              Edit Boundary
            </button>
          </div>
        `)
        .addTo(map.current!);
    });

    map.current.on('mouseenter', 'zone-boundaries', () => {
      if (map.current && !drawingState.isDrawing) {
        map.current.getCanvas().style.cursor = 'pointer';
      }
    });
    map.current.on('mouseleave', 'zone-boundaries', () => {
      if (map.current && !drawingState.isDrawing) {
        map.current.getCanvas().style.cursor = '';
      }
    });
  }, [mapLoaded, layers.zones, drawingState.isDrawing]);


  // Add equipment markers
  const addEquipmentMarkers = useCallback((equipmentData: EquipmentPosition[]) => {
    if (!map.current || !mapLoaded) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (!layers.equipment) return;

    equipmentData.forEach((equip) => {
      if (!equip.location) return;

      const color = getEquipmentStatusColor(equip.status);

      const el = document.createElement('div');
      el.className = 'equipment-marker';
      el.style.cssText = `
        width: 24px;
        height: 24px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      const icon = getEquipmentIcon(equip.type);
      el.innerHTML = `<span style="font-size: 12px; color: white;">${icon}</span>`;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([equip.location.longitude, equip.location.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div class="p-2">
              <h3 class="font-bold text-sm">${equip.name}</h3>
              <p class="text-xs text-gray-600">Type: ${equip.type}</p>
              <p class="text-xs text-gray-600">Status: <span style="color: ${color}; font-weight: 500;">${equip.status}</span></p>
              ${equip.lastTelemetryAt ? `<p class="text-xs text-gray-500">Last update: ${new Date(equip.lastTelemetryAt).toLocaleString()}</p>` : ''}
            </div>
          `)
        )
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [mapLoaded, layers.equipment]);

  function getEquipmentIcon(type: string): string {
    switch (type.toLowerCase()) {
      case 'tractor': return '🚜';
      case 'harvester': return '🌾';
      case 'sprayer': return '💧';
      case 'irrigation': return '🚿';
      case 'planter': return '🌱';
      default: return '⚙️';
    }
  }

  // Update layers when data changes
  useEffect(() => {
    if (fields && mapLoaded) {
      addFieldLayers(fields);
      addZoneLayers(fields);
    }
  }, [fields, mapLoaded, addFieldLayers, addZoneLayers]);

  useEffect(() => {
    if (equipment && mapLoaded) {
      addEquipmentMarkers(equipment);
    }
  }, [equipment, mapLoaded, addEquipmentMarkers]);

  // Handle layer visibility changes
  const handleLayerToggle = useCallback((layerName: keyof typeof layers) => {
    setLayers((prev) => {
      const newLayers = { ...prev, [layerName]: !prev[layerName] };

      if (map.current && mapLoaded) {
        if (layerName === 'fields') {
          const visibility = newLayers.fields ? 'visible' : 'none';
          if (map.current.getLayer('field-boundaries')) {
            map.current.setLayoutProperty('field-boundaries', 'visibility', visibility);
          }
          if (map.current.getLayer('field-boundaries-outline')) {
            map.current.setLayoutProperty('field-boundaries-outline', 'visibility', visibility);
          }
        }

        if (layerName === 'zones') {
          const visibility = newLayers.zones ? 'visible' : 'none';
          if (map.current.getLayer('zone-boundaries')) {
            map.current.setLayoutProperty('zone-boundaries', 'visibility', visibility);
          }
          if (map.current.getLayer('zone-boundaries-outline')) {
            map.current.setLayoutProperty('zone-boundaries-outline', 'visibility', visibility);
          }
        }

        if (layerName === 'equipment') {
          markersRef.current.forEach((marker) => {
            const el = marker.getElement();
            el.style.display = newLayers.equipment ? 'flex' : 'none';
          });
        }
      }

      return newLayers;
    });
  }, [mapLoaded]);

  // Fit map to field bounds
  useEffect(() => {
    if (!map.current || !mapLoaded || !fields || fields.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();

    fields.forEach((field) => {
      if (field.boundary?.coordinates?.[0]) {
        field.boundary.coordinates[0].forEach((coord) => {
          bounds.extend([coord[0], coord[1]]);
        });
      }
    });

    if (!bounds.isEmpty()) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 16,
      });
    }
  }, [fields, mapLoaded]);

  // Drawing mode handlers
  const handleModeChangeFromToolbar = useCallback((mode: DrawingMode) => {
    if (!draw.current) return;

    if (mode === 'draw_polygon') {
      draw.current.changeMode('draw_polygon');
      setDrawingState((prev) => ({ ...prev, isDrawing: true, entityType }));
    } else if (mode === 'simple_select') {
      draw.current.changeMode('simple_select');
    } else if (mode === 'direct_select') {
      draw.current.changeMode('direct_select');
    }
    setDrawingMode(mode);
  }, [entityType]);

  const handleEntityTypeChange = useCallback((type: EntityType) => {
    setEntityType(type);
    setDrawingState((prev) => ({ ...prev, entityType: type }));
  }, []);

  const handleDelete = useCallback(() => {
    if (!draw.current) return;
    draw.current.trash();
    setHasDrawnFeature(false);
    setHasSelection(false);
    setDrawnPolygon(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!drawnPolygon) {
      toast({
        title: 'No polygon drawn',
        description: 'Please draw a polygon before saving.',
        variant: 'destructive',
      });
      return;
    }
    setDialogOpen(true);
  }, [drawnPolygon, toast]);

  const handleCancel = useCallback(() => {
    if (draw.current) {
      draw.current.deleteAll();
      draw.current.changeMode('simple_select');
    }
    setDrawingState({ isDrawing: false, entityType: 'field', editingId: null });
    setDrawingMode('none');
    setHasDrawnFeature(false);
    setHasSelection(false);
    setDrawnPolygon(null);
  }, []);

  const handleDialogSave = useCallback(async (data: { name: string; soilType?: string; irrigationType?: string; fieldId?: string }) => {
    if (!drawnPolygon) return;

    try {
      if (drawingState.editingId) {
        // Update existing
        if (drawingState.entityType === 'field') {
          await updateField.mutateAsync({
            id: drawingState.editingId,
            data: { boundary: drawnPolygon },
          });
        } else {
          await updateZone.mutateAsync({
            id: drawingState.editingId,
            data: { boundary: drawnPolygon },
          });
        }
        toast({
          title: 'Boundary updated',
          description: `${drawingState.entityType === 'field' ? 'Field' : 'Zone'} boundary has been updated.`,
        });
      } else {
        // Create new based on entity type
        if (entityType === 'field') {
          await createField.mutateAsync({
            name: data.name,
            boundary: drawnPolygon,
            soilType: data.soilType,
            irrigationType: data.irrigationType,
          });
          toast({
            title: 'Field created',
            description: `Field "${data.name}" has been created.`,
          });
        } else {
          if (!data.fieldId) {
            toast({
              title: 'Error',
              description: 'Please select a parent field for the zone.',
              variant: 'destructive',
            });
            return;
          }
          await createZone.mutateAsync({
            name: data.name,
            fieldId: data.fieldId,
            boundary: drawnPolygon,
          });
          toast({
            title: 'Zone created',
            description: `Zone "${data.name}" has been created.`,
          });
        }
      }

      // Clean up
      if (draw.current) {
        draw.current.deleteAll();
        draw.current.changeMode('simple_select');
      }
      setDrawingState({ isDrawing: false, entityType: 'field', editingId: null });
      setDrawingMode('none');
      setHasDrawnFeature(false);
      setHasSelection(false);
      setDrawnPolygon(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save',
        variant: 'destructive',
      });
      throw error;
    }
  }, [drawnPolygon, drawingState, entityType, createField, updateField, createZone, updateZone, toast]);

  const isLoading = fieldsLoading || equipmentLoading;
  const isSaving = createField.isPending || updateField.isPending || createZone.isPending || updateZone.isPending;

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`relative bg-muted rounded-lg flex items-center justify-center ${className}`} style={{ minHeight: '400px' }}>
        <div className="text-center p-4">
          <p className="text-muted-foreground">Map not available</p>
          <p className="text-sm text-muted-foreground mt-1">
            Please configure VITE_MAPBOX_TOKEN environment variable
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ minHeight: '400px' }}>
      <div ref={mapContainer} className="absolute inset-0 rounded-lg overflow-hidden" />

      {(isLoading || !mapLoaded) && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading map...</span>
          </div>
        </div>
      )}

      {mapLoaded && (
        <>
          <MapLayerControls
            layers={layers}
            onToggle={handleLayerToggle}
            className="absolute top-4 left-4"
          />

          <DrawingToolbar
            mode={drawingMode}
            entityType={entityType}
            onModeChange={handleModeChangeFromToolbar}
            onEntityTypeChange={handleEntityTypeChange}
            onDelete={handleDelete}
            onSave={handleSave}
            onCancel={handleCancel}
            hasSelection={hasSelection}
            hasDrawnFeature={hasDrawnFeature}
            className="absolute top-4 left-56"
          />
        </>
      )}

      {mapLoaded && layers.zones && (
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <h4 className="text-xs font-semibold mb-2">Soil Quality</h4>
          <div className="space-y-1">
            <LegendItem color="#22C55E" label="Excellent" />
            <LegendItem color="#84CC16" label="Good" />
            <LegendItem color="#EAB308" label="Moderate" />
            <LegendItem color="#F97316" label="Needs Attention" />
            <LegendItem color="#9CA3AF" label="No Data" />
          </div>
        </div>
      )}

      <FieldZoneDialog
        type={entityType}
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleDialogSave}
        fields={fields?.map((f) => ({ id: f.id, name: f.name })) || []}
        isLoading={isSaving}
      />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

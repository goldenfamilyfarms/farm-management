import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2 } from 'lucide-react';
import {
  useFields,
  useEquipmentPositions,
  getSoilQualityColor,
  getEquipmentStatusColor,
  type FieldWithZones,
  type EquipmentPosition,
} from '@/hooks/use-map-data';
import { MapLayerControls } from './map-layer-controls';

// Mapbox access token - should be set via environment variable
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface FarmMapProps {
  className?: string;
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
}

export function FarmMap({
  className = '',
  initialCenter = [-98.5795, 39.8283], // Center of US as default
  initialZoom = 12,
}: FarmMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [layers, setLayers] = useState({
    fields: true,
    zones: true,
    equipment: true,
  });

  const { data: fields, isLoading: fieldsLoading } = useFields();
  const { data: equipment, isLoading: equipmentLoading } = useEquipmentPositions();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!MAPBOX_TOKEN) {
      console.warn('Mapbox token not configured. Set VITE_MAPBOX_TOKEN environment variable.');
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: initialCenter,
      zoom: initialZoom,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [initialCenter, initialZoom]);


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

    // Create GeoJSON from fields
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

    // Add fill layer for fields
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

    // Add outline layer for fields
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

    // Add click handler for fields
    map.current.on('click', 'field-boundaries', (e) => {
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
          </div>
        `)
        .addTo(map.current!);
    });

    // Change cursor on hover
    map.current.on('mouseenter', 'field-boundaries', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'field-boundaries', () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    });
  }, [mapLoaded, layers.fields]);


  // Add zone overlays to map with soil quality colors
  const addZoneLayers = useCallback((fieldsData: FieldWithZones[]) => {
    if (!map.current || !mapLoaded) return;

    // Remove existing zone layers if they exist
    if (map.current.getLayer('zone-boundaries')) {
      map.current.removeLayer('zone-boundaries');
    }
    if (map.current.getLayer('zone-boundaries-outline')) {
      map.current.removeLayer('zone-boundaries-outline');
    }
    if (map.current.getSource('zones')) {
      map.current.removeSource('zones');
    }

    // Collect all zones from all fields
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

    // Add fill layer for zones with soil quality colors
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

    // Add outline layer for zones
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

    // Add click handler for zones
    map.current.on('click', 'zone-boundaries', (e) => {
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
          </div>
        `)
        .addTo(map.current!);
    });

    // Change cursor on hover
    map.current.on('mouseenter', 'zone-boundaries', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'zone-boundaries', () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    });
  }, [mapLoaded, layers.zones]);


  // Add equipment markers to map
  const addEquipmentMarkers = useCallback((equipmentData: EquipmentPosition[]) => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (!layers.equipment) return;

    equipmentData.forEach((equip) => {
      if (!equip.location) return;

      const color = getEquipmentStatusColor(equip.status);

      // Create custom marker element
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

      // Add equipment icon based on type
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

  // Get equipment icon based on type
  function getEquipmentIcon(type: string): string {
    switch (type.toLowerCase()) {
      case 'tractor':
        return '🚜';
      case 'harvester':
        return '🌾';
      case 'sprayer':
        return '💧';
      case 'irrigation':
        return '🚿';
      case 'planter':
        return '🌱';
      default:
        return '⚙️';
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
        // Update field layer visibility
        if (layerName === 'fields') {
          const visibility = newLayers.fields ? 'visible' : 'none';
          if (map.current.getLayer('field-boundaries')) {
            map.current.setLayoutProperty('field-boundaries', 'visibility', visibility);
          }
          if (map.current.getLayer('field-boundaries-outline')) {
            map.current.setLayoutProperty('field-boundaries-outline', 'visibility', visibility);
          }
        }

        // Update zone layer visibility
        if (layerName === 'zones') {
          const visibility = newLayers.zones ? 'visible' : 'none';
          if (map.current.getLayer('zone-boundaries')) {
            map.current.setLayoutProperty('zone-boundaries', 'visibility', visibility);
          }
          if (map.current.getLayer('zone-boundaries-outline')) {
            map.current.setLayoutProperty('zone-boundaries-outline', 'visibility', visibility);
          }
        }

        // Update equipment markers visibility
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


  // Fit map to field bounds when fields load
  useEffect(() => {
    if (!map.current || !mapLoaded || !fields || fields.length === 0) return;

    // Calculate bounds from all field boundaries
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

  const isLoading = fieldsLoading || equipmentLoading;

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
      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0 rounded-lg overflow-hidden" />

      {/* Loading overlay */}
      {(isLoading || !mapLoaded) && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading map...</span>
          </div>
        </div>
      )}

      {/* Layer controls */}
      {mapLoaded && (
        <MapLayerControls
          layers={layers}
          onToggle={handleLayerToggle}
          className="absolute top-4 left-4"
        />
      )}

      {/* Legend */}
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
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

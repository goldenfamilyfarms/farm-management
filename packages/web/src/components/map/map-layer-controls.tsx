import { Layers, Map, Grid3X3, Tractor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface LayerState {
  fields: boolean;
  zones: boolean;
  equipment: boolean;
}

interface MapLayerControlsProps {
  layers: LayerState;
  onToggle: (layer: keyof LayerState) => void;
  className?: string;
}

export function MapLayerControls({ layers, onToggle, className = '' }: MapLayerControlsProps) {
  return (
    <Card className={`w-48 shadow-lg ${className}`}>
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Layers
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3 space-y-1">
        <LayerToggle
          icon={Map}
          label="Fields"
          active={layers.fields}
          onClick={() => onToggle('fields')}
        />
        <LayerToggle
          icon={Grid3X3}
          label="Zones"
          active={layers.zones}
          onClick={() => onToggle('zones')}
        />
        <LayerToggle
          icon={Tractor}
          label="Equipment"
          active={layers.equipment}
          onClick={() => onToggle('equipment')}
        />
      </CardContent>
    </Card>
  );
}

interface LayerToggleProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}

function LayerToggle({ icon: Icon, label, active, onClick }: LayerToggleProps) {
  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      className="w-full justify-start gap-2 h-8"
      onClick={onClick}
    >
      <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
      <span className={active ? '' : 'text-muted-foreground'}>{label}</span>
      <div
        className={`ml-auto w-2 h-2 rounded-full ${
          active ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      />
    </Button>
  );
}

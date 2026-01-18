import { Pencil, Square, Trash2, Check, X, Edit3, Map, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export type DrawingMode = 'none' | 'draw_polygon' | 'direct_select' | 'simple_select';
export type EntityType = 'field' | 'zone';

interface DrawingToolbarProps {
  mode: DrawingMode;
  entityType: EntityType;
  onModeChange: (mode: DrawingMode) => void;
  onEntityTypeChange: (type: EntityType) => void;
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
  hasSelection: boolean;
  hasDrawnFeature: boolean;
  className?: string;
}

export function DrawingToolbar({
  mode,
  entityType,
  onModeChange,
  onEntityTypeChange,
  onDelete,
  onSave,
  onCancel,
  hasSelection,
  hasDrawnFeature,
  className = '',
}: DrawingToolbarProps) {
  const isDrawing = mode === 'draw_polygon';
  const isEditing = mode === 'direct_select' || mode === 'simple_select';

  return (
    <Card className={`w-48 shadow-lg ${className}`}>
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          Drawing Tools
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3 space-y-1">
        {/* Entity Type Selection */}
        <div className="flex gap-1 mb-2 pb-2 border-b">
          <Button
            variant={entityType === 'field' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => onEntityTypeChange('field')}
            disabled={isDrawing || hasDrawnFeature}
          >
            <Map className="h-3 w-3 mr-1" />
            Field
          </Button>
          <Button
            variant={entityType === 'zone' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => onEntityTypeChange('zone')}
            disabled={isDrawing || hasDrawnFeature}
          >
            <Grid3X3 className="h-3 w-3 mr-1" />
            Zone
          </Button>
        </div>

        <Button
          variant={isDrawing ? 'secondary' : 'ghost'}
          size="sm"
          className="w-full justify-start gap-2 h-8"
          onClick={() => onModeChange(isDrawing ? 'simple_select' : 'draw_polygon')}
        >
          <Square className={`h-4 w-4 ${isDrawing ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={isDrawing ? '' : 'text-muted-foreground'}>
            {isDrawing ? 'Drawing...' : `Draw ${entityType === 'field' ? 'Field' : 'Zone'}`}
          </span>
        </Button>

        <Button
          variant={isEditing && hasSelection ? 'secondary' : 'ghost'}
          size="sm"
          className="w-full justify-start gap-2 h-8"
          onClick={() => onModeChange('simple_select')}
          disabled={!hasDrawnFeature}
        >
          <Edit3 className={`h-4 w-4 ${isEditing ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={isEditing ? '' : 'text-muted-foreground'}>Edit Boundary</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8"
          onClick={onDelete}
          disabled={!hasSelection}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
          <span className="text-muted-foreground">Delete Selected</span>
        </Button>

        <div className="border-t pt-2 mt-2 space-y-1">
          <Button
            variant="default"
            size="sm"
            className="w-full justify-start gap-2 h-8"
            onClick={onSave}
            disabled={!hasDrawnFeature}
          >
            <Check className="h-4 w-4" />
            <span>Save {entityType === 'field' ? 'Field' : 'Zone'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-8"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

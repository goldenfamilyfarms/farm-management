import { EditableFarmMap } from '@/components/map';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Plus } from 'lucide-react';

export function FieldsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fields & Zones</h1>
        <p className="text-muted-foreground">
          View and manage your farm fields, zones, and equipment locations.
        </p>
      </div>

      {/* Instructions Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Drawing Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>1. Select &quot;Field&quot; or &quot;Zone&quot; in the Drawing Tools panel</p>
            <p>2. Click &quot;Draw Field&quot; or &quot;Draw Zone&quot; to start drawing</p>
            <p>3. Click on the map to add vertices to your polygon</p>
            <p>4. Double-click or click the first point to complete the polygon</p>
            <p>5. Use &quot;Edit Boundary&quot; to modify existing shapes by dragging vertices</p>
            <p>6. Click &quot;Save&quot; to save your changes or &quot;Cancel&quot; to discard</p>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Map */}
      <Card>
        <CardHeader>
          <CardTitle>Farm Map</CardTitle>
          <CardDescription>
            Interactive map showing field boundaries, soil quality zones, and equipment positions.
            Use the drawing tools to create new fields/zones or edit existing boundaries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditableFarmMap className="h-[600px]" />
        </CardContent>
      </Card>
    </div>
  );
}

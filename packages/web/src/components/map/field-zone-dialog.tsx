import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const fieldSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  soilType: z.string().optional(),
  irrigationType: z.string().optional(),
});

const zoneSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  fieldId: z.string().min(1, 'Please select a field'),
});

type FieldFormData = z.infer<typeof fieldSchema>;
type ZoneFormData = z.infer<typeof zoneSchema>;

interface Field {
  id: string;
  name: string;
}

interface FieldZoneDialogProps {
  type: 'field' | 'zone';
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: FieldFormData | ZoneFormData) => Promise<void>;
  fields?: Field[];
  isLoading?: boolean;
}

export function FieldZoneDialog({
  type,
  isOpen,
  onClose,
  onSave,
  fields = [],
  isLoading = false,
}: FieldZoneDialogProps) {
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">
          {type === 'field' ? 'Create New Field' : 'Create New Zone'}
        </h2>

        {type === 'field' ? (
          <FieldForm
            onSave={onSave}
            onClose={onClose}
            isLoading={isLoading}
            error={error}
            setError={setError}
          />
        ) : (
          <ZoneForm
            onSave={onSave}
            onClose={onClose}
            fields={fields}
            isLoading={isLoading}
            error={error}
            setError={setError}
          />
        )}
      </div>
    </div>
  );
}

interface FieldFormProps {
  onSave: (data: FieldFormData) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

function FieldForm({ onSave, onClose, isLoading, error, setError }: FieldFormProps) {
  const form = useForm<FieldFormData>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      name: '',
      soilType: '',
      irrigationType: '',
    },
  });

  useEffect(() => {
    form.reset();
    setError(null);
  }, [form, setError]);

  const handleSubmit = async (data: FieldFormData) => {
    setError(null);
    try {
      await onSave(data);
      form.reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          placeholder="e.g., North Field"
          {...form.register('name')}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="soilType">Soil Type</Label>
        <Select
          onValueChange={(value) => form.setValue('soilType', value)}
          defaultValue=""
        >
          <SelectTrigger>
            <SelectValue placeholder="Select soil type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="clay">Clay</SelectItem>
            <SelectItem value="sandy">Sandy</SelectItem>
            <SelectItem value="loam">Loam</SelectItem>
            <SelectItem value="silt">Silt</SelectItem>
            <SelectItem value="peat">Peat</SelectItem>
            <SelectItem value="chalk">Chalk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="irrigationType">Irrigation Type</Label>
        <Select
          onValueChange={(value) => form.setValue('irrigationType', value)}
          defaultValue=""
        >
          <SelectTrigger>
            <SelectValue placeholder="Select irrigation type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="drip">Drip</SelectItem>
            <SelectItem value="sprinkler">Sprinkler</SelectItem>
            <SelectItem value="flood">Flood</SelectItem>
            <SelectItem value="center_pivot">Center Pivot</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Field
        </Button>
      </div>
    </form>
  );
}

interface ZoneFormProps {
  onSave: (data: ZoneFormData) => Promise<void>;
  onClose: () => void;
  fields: Field[];
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

function ZoneForm({ onSave, onClose, fields, isLoading, error, setError }: ZoneFormProps) {
  const form = useForm<ZoneFormData>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      name: '',
      fieldId: '',
    },
  });

  useEffect(() => {
    form.reset();
    setError(null);
  }, [form, setError]);

  const handleSubmit = async (data: ZoneFormData) => {
    setError(null);
    try {
      await onSave(data);
      form.reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Zone A"
          {...form.register('name')}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="fieldId">Parent Field *</Label>
        <Select
          onValueChange={(value) => form.setValue('fieldId', value)}
          defaultValue=""
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a field" />
          </SelectTrigger>
          <SelectContent>
            {fields.map((field) => (
              <SelectItem key={field.id} value={field.id}>
                {field.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.fieldId && (
          <p className="text-sm text-destructive">
            {form.formState.errors.fieldId.message}
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Zone
        </Button>
      </div>
    </form>
  );
}

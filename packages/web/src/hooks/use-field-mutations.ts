import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { GeoPolygon, FieldWithZones } from './use-map-data';

interface CreateFieldInput {
  name: string;
  boundary: GeoPolygon;
  soilType?: string;
  irrigationType?: string;
}

interface UpdateFieldInput {
  name?: string;
  boundary?: GeoPolygon;
  soilType?: string;
  irrigationType?: string;
}

interface CreateZoneInput {
  name: string;
  fieldId: string;
  boundary: GeoPolygon;
  soilQuality?: {
    ph?: number;
    organicMatter?: number;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    texture?: string;
    drainageClass?: string;
  };
}

interface UpdateZoneInput {
  name?: string;
  boundary?: GeoPolygon;
  soilQuality?: {
    ph?: number;
    organicMatter?: number;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    texture?: string;
    drainageClass?: string;
  };
}

export function useCreateField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFieldInput) =>
      apiClient.post<FieldWithZones>('/fields', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] });
    },
  });
}

export function useUpdateField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFieldInput }) =>
      apiClient.put<FieldWithZones>(`/fields/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] });
    },
  });
}

export function useDeleteField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/fields/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] });
    },
  });
}

export function useCreateZone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateZoneInput) =>
      apiClient.post('/zones', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] });
    },
  });
}

export function useUpdateZone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateZoneInput }) =>
      apiClient.put(`/zones/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] });
    },
  });
}

export function useDeleteZone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/zones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] });
    },
  });
}

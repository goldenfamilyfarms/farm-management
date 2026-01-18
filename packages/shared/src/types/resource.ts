// Resource tracking types

export type ResourceType = 'seed' | 'fertilizer' | 'lime' | 'pesticide' | 'herbicide' | 'fuel';

export interface ResourceApplication {
  id: string;
  farmId: string;
  fieldId: string;
  zoneId?: string;
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  date: Date;
  notes?: string;
  createdAt: Date;
}

export interface CreateResourceApplicationInput {
  fieldId: string;
  zoneId?: string;
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  date: string;
  notes?: string;
}

export interface UpdateResourceApplicationInput {
  fieldId?: string;
  zoneId?: string;
  resourceType?: ResourceType;
  quantity?: number;
  unit?: string;
  date?: string;
  notes?: string;
}

export interface ResourceUsageFilters {
  fieldId?: string;
  zoneId?: string;
  resourceType?: ResourceType;
  startDate?: string;
  endDate?: string;
}

export interface ResourceUsageSummary {
  totalQuantity: number;
  unit: string;
  byField: Record<string, number>;
  byZone: Record<string, number>;
  byResourceType: Record<ResourceType, number>;
}

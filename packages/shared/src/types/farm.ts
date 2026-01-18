// Farm and tenant types

import type { GeoPoint } from './common.js';

export interface FarmSettings {
  timezone: string;
  currency: string;
  units: 'imperial' | 'metric';
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  sms: boolean;
  push: boolean;
}

export interface Farm {
  id: string;
  name: string;
  location: GeoPoint;
  timezone: string;
  settings: FarmSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFarmInput {
  name: string;
  location: GeoPoint;
  timezone: string;
  settings?: Partial<FarmSettings>;
}

export interface UpdateFarmInput {
  name?: string;
  location?: GeoPoint;
  timezone?: string;
  settings?: Partial<FarmSettings>;
}

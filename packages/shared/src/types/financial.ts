// Financial tracking types

import type { DateRange } from './common.js';

export type ExpenseCategory =
  | 'seed'
  | 'fertilizer'
  | 'chemicals'
  | 'fuel'
  | 'labor'
  | 'equipment_maintenance'
  | 'equipment_depreciation'
  | 'land_rent'
  | 'utilities'
  | 'insurance'
  | 'other';

export type PlantingStatus = 'planned' | 'planted' | 'growing' | 'harvested' | 'failed';

export interface Expense {
  id: string;
  farmId: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  date: Date;
  description: string;
  fieldId?: string;
  cropType?: string;
  vendor?: string;
  receiptUrl?: string;
  createdBy: string;
  createdAt: Date;
}

export interface Revenue {
  id: string;
  farmId: string;
  cropType: string;
  fieldId: string;
  harvestId: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalAmount: number;
  currency: string;
  saleDate: Date;
  buyer?: string;
  notes?: string;
  createdAt: Date;
}

export interface Harvest {
  id: string;
  farmId: string;
  fieldId: string;
  zoneId?: string;
  cropType: string;
  plantingId: string;
  quantity: number;
  unit: string;
  qualityGrade?: string;
  harvestDate: Date;
  notes?: string;
}

export interface Planting {
  id: string;
  farmId: string;
  fieldId: string;
  zoneId?: string;
  cropType: string;
  variety?: string;
  plantingDate: Date;
  expectedHarvestDate?: Date;
  seedRate: number;
  seedUnit: string;
  acreage: number;
  status: PlantingStatus;
}

export interface CostBreakdown {
  totalCost: number;
  costPerAcre: number;
  byCategory: Record<ExpenseCategory, number>;
}

export interface ProfitabilityReport {
  cropType: string;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  revenuePerAcre: number;
  costPerAcre: number;
  breakEvenPrice: number;
}

export interface ZoneROI {
  zoneId: string;
  zoneName: string;
  investment: number;
  returns: number;
  roi: number;
}

export interface CreateExpenseInput {
  category: ExpenseCategory;
  amount: number;
  currency?: string;
  date: Date;
  description: string;
  fieldId?: string;
  cropType?: string;
  vendor?: string;
  receiptUrl?: string;
}

export interface CreateRevenueInput {
  cropType: string;
  fieldId: string;
  harvestId: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  saleDate: Date;
  buyer?: string;
  notes?: string;
}

export type ReportType = 'cost' | 'revenue' | 'profitability' | 'roi';

export interface FinancialReport {
  id: string;
  type: ReportType;
  dateRange: DateRange;
  generatedAt: Date;
  data: Record<string, unknown>;
}

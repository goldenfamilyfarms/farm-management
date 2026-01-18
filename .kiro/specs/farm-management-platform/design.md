# Design Document: Farm Management Platform

## Overview

This design describes a comprehensive agricultural technology platform built as a multi-tenant SaaS application. The system uses a microservices-inspired modular monolith architecture with clear domain boundaries, enabling future decomposition while maintaining development velocity.

The platform consists of six core domains: Telemetry, Geospatial, Recommendations, Financial, Workforce, and Core (auth/tenant management). Each domain owns its data and exposes well-defined APIs.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  React SPA (TypeScript)  │  PWA Service Worker  │  Mobile-Responsive UI     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
              ┌──────────┐    ┌──────────────┐   ┌──────────────┐
              │ REST API │    │  WebSocket   │   │   GraphQL    │
              │ Gateway  │    │   Server     │   │  (Optional)  │
              └──────────┘    └──────────────┘   └──────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Application Layer                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  Telemetry  │ │  Geospatial │ │Recommendation│ │  Financial  │           │
│  │   Module    │ │   Module    │ │   Module    │ │   Module    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐                                            │
│  │  Workforce  │ │    Core     │                                            │
│  │   Module    │ │   Module    │                                            │
│  └─────────────┘ └─────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Data Layer                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL + PostGIS  │  TimescaleDB  │  Redis  │  S3  │  Vector DB       │
└─────────────────────────────────────────────────────────────────────────────┘
```


### Technology Stack Decisions

**Frontend:**
- React 18+ with TypeScript
- shadcn/ui + Tailwind CSS for consistent, accessible UI
- TanStack Query for server state management
- Zustand for lightweight global state (auth, settings)
- React Hook Form + Zod for form handling and validation
- Mapbox GL JS for mapping (best balance of features, performance, and offline support)
- Socket.io client for real-time telemetry updates

**Backend:**
- Node.js with TypeScript
- NestJS framework (enterprise-grade, excellent TypeScript support, modular architecture)
- Prisma ORM for PostgreSQL
- Socket.io for WebSocket server
- Bull/BullMQ for background job processing
- Passport.js for authentication strategies

**Databases:**
- PostgreSQL 15+ with PostGIS extension (relational + geospatial)
- TimescaleDB extension for time-series telemetry data
- Redis for caching, sessions, and real-time pub/sub
- pgvector for RAG embeddings (keeps infrastructure simpler than separate vector DB)

**AWS Infrastructure:**
- ECS Fargate for containerized application (serverless containers, no EC2 management)
- RDS PostgreSQL with TimescaleDB and PostGIS
- ElastiCache Redis
- S3 for file storage and telemetry archives
- IoT Core for MQTT device connectivity
- Lambda for event-driven processing (telemetry transformation, scheduled jobs)
- API Gateway + ALB for traffic management
- CloudFront for static assets and map tiles
- Route 53 for DNS management (goldenfamilyfarms.org)
- ACM for SSL certificates
- Secrets Manager for credentials
- CloudWatch + X-Ray for observability

**Domain Configuration:**
- Primary domain: goldenfamilyfarms.org
- API subdomain: api.goldenfamilyfarms.org
- App subdomain: app.goldenfamilyfarms.org (or root domain)
- IoT endpoint: iot.goldenfamilyfarms.org

### Data Flow Architecture

```
Equipment/IoT Devices
        │
        ▼ (MQTT)
┌───────────────────┐
│   AWS IoT Core    │
└───────────────────┘
        │
        ▼ (IoT Rules)
┌───────────────────┐     ┌───────────────────┐
│  Lambda Function  │────▶│   TimescaleDB     │
│  (Transform/      │     │  (Telemetry)      │
│   Validate)       │     └───────────────────┘
└───────────────────┘
        │
        ▼ (Alerts)
┌───────────────────┐
│   SNS/WebSocket   │────▶ Real-time UI Updates
└───────────────────┘
```

## Components and Interfaces

### Core Module

Handles authentication, authorization, and multi-tenant management.

```typescript
// Core Domain Types
interface Farm {
  id: string;
  name: string;
  location: GeoPoint;
  timezone: string;
  settings: FarmSettings;
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  farmId: string;
  profile: UserProfile;
  createdAt: Date;
  updatedAt: Date;
}

type UserRole = 'owner' | 'manager' | 'worker' | 'viewer';

interface UserProfile {
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
}

// Auth Service Interface
interface AuthService {
  login(email: string, password: string): Promise<AuthTokens>;
  logout(userId: string): Promise<void>;
  refreshToken(refreshToken: string): Promise<AuthTokens>;
  validateToken(token: string): Promise<TokenPayload>;
  resetPassword(email: string): Promise<void>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface TokenPayload {
  userId: string;
  farmId: string;
  role: UserRole;
  iat: number;
  exp: number;
}
```


### Telemetry Module

Handles equipment data ingestion, processing, and storage.

```typescript
// Telemetry Domain Types
interface Equipment {
  id: string;
  farmId: string;
  name: string;
  type: EquipmentType;
  make: string;
  model: string;
  serialNumber: string;
  deviceId: string; // IoT device identifier
  status: EquipmentStatus;
  lastTelemetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type EquipmentType = 'tractor' | 'harvester' | 'sprayer' | 'irrigation' | 'planter' | 'other';
type EquipmentStatus = 'active' | 'maintenance' | 'inactive';

interface TelemetryReading {
  id: string;
  equipmentId: string;
  timestamp: Date;
  location?: GeoPoint;
  operatingHours: number;
  fuelLevel?: number;
  speed?: number;
  engineRpm?: number;
  faultCodes?: string[];
  resourceDispensed?: ResourceDispensing;
  rawData: Record<string, unknown>;
}

interface ResourceDispensing {
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  fieldId?: string;
  zoneId?: string;
}

type ResourceType = 'seed' | 'fertilizer' | 'lime' | 'pesticide' | 'herbicide' | 'fuel';

interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  type: MaintenanceType;
  description: string;
  cost: number;
  performedAt: Date;
  performedBy: string;
  notes?: string;
  nextServiceHours?: number;
  nextServiceDate?: Date;
}

type MaintenanceType = 'scheduled' | 'repair' | 'inspection' | 'emergency';

// Telemetry Service Interface
interface TelemetryService {
  ingestReading(deviceId: string, payload: TelemetryPayload): Promise<TelemetryReading>;
  getEquipmentReadings(equipmentId: string, timeRange: TimeRange): Promise<TelemetryReading[]>;
  getEquipmentStatus(equipmentId: string): Promise<EquipmentStatus>;
  getResourceUsage(farmId: string, filters: ResourceUsageFilters): Promise<ResourceUsageSummary>;
  createMaintenanceAlert(equipmentId: string, faultCodes: string[]): Promise<void>;
}

// Message Schema for MQTT
interface TelemetryPayload {
  deviceId: string;
  timestamp: string; // ISO 8601
  readings: {
    operatingHours?: number;
    fuelLevel?: number;
    speed?: number;
    engineRpm?: number;
    latitude?: number;
    longitude?: number;
    faultCodes?: string[];
    dispensing?: {
      type: string;
      quantity: number;
      unit: string;
    };
  };
  metadata?: Record<string, unknown>;
}
```

### Geospatial Module

Handles field boundaries, zones, and map visualization.

```typescript
// Geospatial Domain Types
interface Field {
  id: string;
  farmId: string;
  name: string;
  boundary: GeoPolygon;
  acreage: number;
  soilType?: string;
  irrigationType?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Zone {
  id: string;
  fieldId: string;
  name: string;
  boundary: GeoPolygon;
  acreage: number;
  soilQuality: SoilQuality;
  createdAt: Date;
  updatedAt: Date;
}

interface SoilQuality {
  ph?: number;
  organicMatter?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  texture?: string;
  drainageClass?: string;
  testDate?: Date;
}

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // GeoJSON format
}

// Geospatial Service Interface
interface GeospatialService {
  createField(farmId: string, data: CreateFieldInput): Promise<Field>;
  updateFieldBoundary(fieldId: string, boundary: GeoPolygon): Promise<Field>;
  createZone(fieldId: string, data: CreateZoneInput): Promise<Zone>;
  updateZoneSoilQuality(zoneId: string, soilData: SoilQuality): Promise<Zone>;
  importFromGeoJSON(farmId: string, geojson: GeoJSONFeatureCollection): Promise<Field[]>;
  importFromKML(farmId: string, kml: string): Promise<Field[]>;
  validatePolygon(polygon: GeoPolygon): ValidationResult;
  isPolygonContained(inner: GeoPolygon, outer: GeoPolygon): boolean;
  getFieldsWithZones(farmId: string): Promise<FieldWithZones[]>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```


### Recommendation Module

Handles AI-powered crop recommendations using LLM and RAG.

```typescript
// Recommendation Domain Types
interface CropRecommendation {
  id: string;
  zoneId: string;
  generatedAt: Date;
  validUntil: Date;
  recommendations: CropSuggestion[];
  inputData: RecommendationInputs;
  explanation: string;
}

interface CropSuggestion {
  cropType: string;
  confidence: number; // 0-1
  expectedYieldRange: { min: number; max: number; unit: string };
  plantingWindow: { start: Date; end: Date };
  riskFactors: RiskFactor[];
  estimatedInputCosts: number;
  estimatedRevenue: number;
  reasoning: string;
}

interface RiskFactor {
  type: 'weather' | 'market' | 'soil' | 'pest' | 'disease';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation?: string;
}

interface RecommendationInputs {
  soilQuality: SoilQuality;
  historicalWeather: WeatherSummary;
  weatherForecast: WeatherForecast[];
  marketPrices: MarketPrice[];
  historicalYields: HistoricalYield[];
}

interface WeatherSummary {
  avgTemperature: number;
  totalPrecipitation: number;
  growingDegreeDays: number;
  frostFreeDays: number;
}

interface WeatherForecast {
  date: Date;
  highTemp: number;
  lowTemp: number;
  precipitation: number;
  humidity: number;
  conditions: string;
}

interface MarketPrice {
  cropType: string;
  pricePerUnit: number;
  unit: string;
  date: Date;
  source: string;
}

interface HistoricalYield {
  cropType: string;
  year: number;
  yieldPerAcre: number;
  unit: string;
  zoneId: string;
}

// Recommendation Service Interface
interface RecommendationService {
  generateRecommendations(zoneId: string): Promise<CropRecommendation>;
  getCachedRecommendation(zoneId: string): Promise<CropRecommendation | null>;
  invalidateCache(zoneId: string): Promise<void>;
  getRecommendationHistory(zoneId: string): Promise<CropRecommendation[]>;
}

// LLM Integration
interface LLMProvider {
  generateCompletion(prompt: string, context: RAGContext): Promise<string>;
  embedText(text: string): Promise<number[]>;
}

interface RAGContext {
  relevantDocuments: Document[];
  farmData: FarmContextData;
}
```

### Financial Module

Handles cost tracking, revenue, and profitability analysis.

```typescript
// Financial Domain Types
interface Expense {
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

type ExpenseCategory = 
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

interface Revenue {
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

interface Harvest {
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

interface Planting {
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

type PlantingStatus = 'planned' | 'planted' | 'growing' | 'harvested' | 'failed';

// Financial Service Interface
interface FinancialService {
  recordExpense(data: CreateExpenseInput): Promise<Expense>;
  recordRevenue(data: CreateRevenueInput): Promise<Revenue>;
  getCostPerAcre(fieldId: string, dateRange: DateRange): Promise<CostBreakdown>;
  getCropProfitability(farmId: string, cropType: string, dateRange: DateRange): Promise<ProfitabilityReport>;
  getROIByZone(farmId: string, dateRange: DateRange): Promise<ZoneROI[]>;
  generateFinancialReport(farmId: string, reportType: ReportType, dateRange: DateRange): Promise<FinancialReport>;
  exportReport(reportId: string, format: 'csv' | 'xlsx'): Promise<Buffer>;
}

interface CostBreakdown {
  totalCost: number;
  costPerAcre: number;
  byCategory: Record<ExpenseCategory, number>;
}

interface ProfitabilityReport {
  cropType: string;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  revenuePerAcre: number;
  costPerAcre: number;
  breakEvenPrice: number;
}

interface ZoneROI {
  zoneId: string;
  zoneName: string;
  investment: number;
  returns: number;
  roi: number;
}
```


### Workforce Module

Handles time tracking, scheduling, and task management.

```typescript
// Workforce Domain Types
interface TimeCard {
  id: string;
  farmId: string;
  workerId: string;
  clockIn: Date;
  clockOut?: Date;
  clockInLocation?: GeoPoint;
  clockOutLocation?: GeoPoint;
  totalHours?: number;
  status: TimeCardStatus;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
}

type TimeCardStatus = 'active' | 'pending_approval' | 'approved' | 'rejected';

interface Task {
  id: string;
  farmId: string;
  title: string;
  description: string;
  fieldId?: string;
  zoneId?: string;
  assignedTo: string[];
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: Date;
  completedAt?: Date;
  completedBy?: string;
  completionNotes?: string;
  attachments?: string[];
  estimatedHours?: number;
  actualHours?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface Schedule {
  id: string;
  farmId: string;
  workerId: string;
  date: Date;
  startTime: string; // HH:mm format
  endTime: string;
  role?: string;
  notes?: string;
}

interface Worker {
  id: string;
  userId: string;
  farmId: string;
  skills: string[];
  certifications: Certification[];
  hourlyRate: number;
  employmentType: 'full_time' | 'part_time' | 'seasonal' | 'contractor';
  startDate: Date;
  endDate?: Date;
}

interface Certification {
  name: string;
  issuedBy: string;
  issuedDate: Date;
  expiryDate?: Date;
}

// Workforce Service Interface
interface WorkforceService {
  clockIn(workerId: string, location?: GeoPoint): Promise<TimeCard>;
  clockOut(timeCardId: string, location?: GeoPoint): Promise<TimeCard>;
  getActiveTimeCard(workerId: string): Promise<TimeCard | null>;
  approveTimeCard(timeCardId: string, approverId: string): Promise<TimeCard>;
  rejectTimeCard(timeCardId: string, approverId: string, reason: string): Promise<TimeCard>;
  getTimeCardsForPayroll(farmId: string, payPeriod: DateRange): Promise<PayrollSummary>;
  
  createTask(data: CreateTaskInput): Promise<Task>;
  updateTaskStatus(taskId: string, status: TaskStatus, notes?: string): Promise<Task>;
  assignTask(taskId: string, workerIds: string[]): Promise<Task>;
  getTasksByWorker(workerId: string, filters?: TaskFilters): Promise<Task[]>;
  getOverdueTasks(farmId: string): Promise<Task[]>;
  
  createSchedule(data: CreateScheduleInput): Promise<Schedule>;
  getWorkerSchedule(workerId: string, dateRange: DateRange): Promise<Schedule[]>;
  detectScheduleConflicts(workerId: string, newSchedule: CreateScheduleInput): Promise<Conflict[]>;
}

interface PayrollSummary {
  payPeriod: DateRange;
  workers: WorkerPayrollEntry[];
  totalHours: number;
  totalCost: number;
}

interface WorkerPayrollEntry {
  workerId: string;
  workerName: string;
  regularHours: number;
  overtimeHours: number;
  totalPay: number;
  timeCards: TimeCard[];
}
```

## Data Models

### Database Schema (PostgreSQL + PostGIS + TimescaleDB)

```sql
-- Core Tables
CREATE TABLE farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'manager', 'worker', 'viewer')),
  profile JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geospatial Tables
CREATE TABLE fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  name VARCHAR(255) NOT NULL,
  boundary GEOGRAPHY(POLYGON, 4326) NOT NULL,
  acreage DECIMAL(10, 2),
  soil_type VARCHAR(100),
  irrigation_type VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES fields(id),
  name VARCHAR(255) NOT NULL,
  boundary GEOGRAPHY(POLYGON, 4326) NOT NULL,
  acreage DECIMAL(10, 2),
  soil_quality JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment & Telemetry Tables
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  make VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  device_id VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'active',
  last_telemetry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TimescaleDB hypertable for telemetry
CREATE TABLE telemetry_readings (
  time TIMESTAMPTZ NOT NULL,
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  location GEOGRAPHY(POINT, 4326),
  operating_hours DECIMAL(10, 2),
  fuel_level DECIMAL(5, 2),
  speed DECIMAL(6, 2),
  engine_rpm INTEGER,
  fault_codes TEXT[],
  resource_dispensed JSONB,
  raw_data JSONB
);

SELECT create_hypertable('telemetry_readings', 'time');
```


```sql
-- Maintenance Tables
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  type VARCHAR(50) NOT NULL,
  description TEXT,
  cost DECIMAL(10, 2),
  performed_at TIMESTAMPTZ NOT NULL,
  performed_by VARCHAR(255),
  notes TEXT,
  next_service_hours DECIMAL(10, 2),
  next_service_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crop Management Tables
CREATE TABLE plantings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  field_id UUID NOT NULL REFERENCES fields(id),
  zone_id UUID REFERENCES zones(id),
  crop_type VARCHAR(100) NOT NULL,
  variety VARCHAR(100),
  planting_date DATE NOT NULL,
  expected_harvest_date DATE,
  seed_rate DECIMAL(10, 2),
  seed_unit VARCHAR(20),
  acreage DECIMAL(10, 2),
  status VARCHAR(20) DEFAULT 'planned',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE harvests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  field_id UUID NOT NULL REFERENCES fields(id),
  zone_id UUID REFERENCES zones(id),
  planting_id UUID REFERENCES plantings(id),
  crop_type VARCHAR(100) NOT NULL,
  quantity DECIMAL(12, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  quality_grade VARCHAR(20),
  harvest_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Tables
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  category VARCHAR(50) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  date DATE NOT NULL,
  description TEXT,
  field_id UUID REFERENCES fields(id),
  crop_type VARCHAR(100),
  vendor VARCHAR(255),
  receipt_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  harvest_id UUID REFERENCES harvests(id),
  field_id UUID NOT NULL REFERENCES fields(id),
  crop_type VARCHAR(100) NOT NULL,
  quantity DECIMAL(12, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  price_per_unit DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  sale_date DATE NOT NULL,
  buyer VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workforce Tables
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  farm_id UUID NOT NULL REFERENCES farms(id),
  skills TEXT[],
  certifications JSONB DEFAULT '[]',
  hourly_rate DECIMAL(8, 2),
  employment_type VARCHAR(20),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE time_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  worker_id UUID NOT NULL REFERENCES workers(id),
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  clock_in_location GEOGRAPHY(POINT, 4326),
  clock_out_location GEOGRAPHY(POINT, 4326),
  total_hours DECIMAL(5, 2),
  status VARCHAR(20) DEFAULT 'active',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  field_id UUID REFERENCES fields(id),
  zone_id UUID REFERENCES zones(id),
  assigned_to UUID[],
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  completion_notes TEXT,
  attachments TEXT[],
  estimated_hours DECIMAL(5, 2),
  actual_hours DECIMAL(5, 2),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  worker_id UUID NOT NULL REFERENCES workers(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weather Data Table
CREATE TABLE weather_data (
  time TIMESTAMPTZ NOT NULL,
  farm_id UUID NOT NULL REFERENCES farms(id),
  temperature DECIMAL(5, 2),
  precipitation DECIMAL(6, 2),
  humidity DECIMAL(5, 2),
  wind_speed DECIMAL(5, 2),
  conditions VARCHAR(100),
  source VARCHAR(50)
);

SELECT create_hypertable('weather_data', 'time');

-- Recommendations Table
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES zones(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  recommendations JSONB NOT NULL,
  input_data JSONB NOT NULL,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_farm ON users(farm_id);
CREATE INDEX idx_fields_farm ON fields(farm_id);
CREATE INDEX idx_zones_field ON zones(field_id);
CREATE INDEX idx_equipment_farm ON equipment(farm_id);
CREATE INDEX idx_equipment_device ON equipment(device_id);
CREATE INDEX idx_telemetry_equipment ON telemetry_readings(equipment_id, time DESC);
CREATE INDEX idx_expenses_farm_date ON expenses(farm_id, date);
CREATE INDEX idx_revenues_farm_date ON revenues(farm_id, sale_date);
CREATE INDEX idx_time_cards_worker ON time_cards(worker_id, clock_in);
CREATE INDEX idx_tasks_farm_status ON tasks(farm_id, status);
CREATE INDEX idx_tasks_assigned ON tasks USING GIN(assigned_to);
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Telemetry Properties

**Property 1: Valid telemetry messages are stored**
*For any* valid telemetry payload with correct schema (deviceId, timestamp, readings), the Telemetry_Service SHALL store the reading and return success.
**Validates: Requirements 1.1**

**Property 2: Invalid telemetry messages are rejected without crashing**
*For any* telemetry payload that fails schema validation, the Telemetry_Service SHALL return an error response and continue processing subsequent messages.
**Validates: Requirements 1.2**

**Property 3: Fault codes trigger maintenance alerts**
*For any* telemetry reading containing fault codes, the System SHALL create a corresponding maintenance alert with the fault code information.
**Validates: Requirements 1.4, 10.4**

**Property 4: Telemetry deduplication within time window**
*For any* two telemetry messages with the same deviceId and timestamps within 5 seconds, only one reading SHALL be stored in the database.
**Validates: Requirements 1.6**

### Resource Tracking Properties

**Property 5: Resource applications have required associations**
*For any* resource application record, it SHALL have non-null associations for field, date, quantity, and resource type.
**Validates: Requirements 2.1**

**Property 6: Telemetry dispensing creates resource records**
*For any* telemetry reading with resource dispensing data, a corresponding resource application record SHALL be created with matching quantity and type.
**Validates: Requirements 2.2**

**Property 7: Resource usage aggregation correctness**
*For any* set of resource application records within a date range, the calculated total usage SHALL equal the sum of individual quantities grouped by field, zone, or crop type.
**Validates: Requirements 2.3**

**Property 8: Threshold violations generate warnings**
*For any* resource application where quantity exceeds the configured threshold for that resource type, a warning notification SHALL be generated.
**Validates: Requirements 2.5**

### Geospatial Properties

**Property 9: Self-intersecting polygons are rejected**
*For any* polygon submitted as a field boundary, if the polygon self-intersects, the validation SHALL fail and the polygon SHALL NOT be saved.
**Validates: Requirements 3.1**

**Property 10: Zone containment validation**
*For any* zone polygon and its parent field boundary, the zone SHALL only be saved if the zone polygon is completely contained within the field boundary.
**Validates: Requirements 3.2**

**Property 11: GeoJSON/KML import round-trip**
*For any* valid GeoJSON or KML file containing field boundaries, importing then exporting SHALL produce geometrically equivalent boundaries.
**Validates: Requirements 3.5**

### Recommendation Properties

**Property 12: Recommendation output completeness**
*For any* successful recommendation request, each crop suggestion SHALL contain: crop type, expected yield range (min/max), planting window (start/end dates), risk factors, and explanation text.
**Validates: Requirements 4.2, 4.3**

**Property 13: Recommendation caching behavior**
*For any* zone with unchanged input data, requesting recommendations twice SHALL return cached results on the second request. After input data changes, the cache SHALL be invalidated.
**Validates: Requirements 4.4**

**Property 14: Insufficient data error messages**
*For any* recommendation request where required input data is missing, the error response SHALL list all missing input types.
**Validates: Requirements 4.5**

### Financial Properties

**Property 15: Expense categorization and association**
*For any* recorded expense, it SHALL have a valid category and at least one association (field or crop type).
**Validates: Requirements 5.1**

**Property 16: Cost per acre calculation**
*For any* field with recorded expenses and known acreage, cost per acre SHALL equal total expenses divided by acreage.
**Validates: Requirements 5.2**

**Property 17: Equipment cost allocation**
*For any* equipment operating in a field, allocated cost SHALL equal (operating hours × hourly depreciation rate) for the time period.
**Validates: Requirements 5.3**

**Property 18: Labor cost aggregation from time cards**
*For any* set of approved time cards linked to tasks in a field, total labor cost SHALL equal sum of (hours × hourly rate) for each time card.
**Validates: Requirements 5.4**

**Property 19: Cost report completeness**
*For any* cost report request, the generated report SHALL contain itemized breakdowns by category, by field, and by time period.
**Validates: Requirements 5.5**

**Property 20: Revenue record completeness**
*For any* harvest sale record, it SHALL contain: quantity, unit, price per unit, sale date, and calculated total amount.
**Validates: Requirements 6.1**

**Property 21: Revenue per acre calculation**
*For any* field with recorded revenue and known acreage, revenue per acre SHALL equal total revenue divided by acreage.
**Validates: Requirements 6.2**

**Property 22: Profit/loss calculation**
*For any* crop or field, profit/loss SHALL equal (total revenue - total allocated costs).
**Validates: Requirements 6.3**

**Property 23: Profitability analysis completeness**
*For any* profitability analysis request, the response SHALL contain ROI calculations, season comparisons (if data exists), and break-even price.
**Validates: Requirements 6.4**

**Property 24: Financial export round-trip**
*For any* financial report exported to CSV or Excel, re-importing the file SHALL produce data equivalent to the original report.
**Validates: Requirements 6.5**

### Workforce Properties

**Property 25: Clock-in record completeness**
*For any* clock-in event, the time card SHALL contain: timestamp, worker ID, and status set to 'active'.
**Validates: Requirements 7.1**

**Property 26: Hours calculation on clock-out**
*For any* clock-out event, total hours SHALL equal (clock-out timestamp - clock-in timestamp) converted to decimal hours.
**Validates: Requirements 7.2**

**Property 27: Duplicate clock-in prevention**
*For any* worker with an active (not clocked out) time card, attempting to clock in again SHALL fail with an error.
**Validates: Requirements 7.3**

**Property 28: Off-schedule clock-in flagging**
*For any* clock-in that occurs outside the worker's scheduled hours, the time card SHALL be flagged for review while still being created.
**Validates: Requirements 7.5**

**Property 29: Payroll hours aggregation**
*For any* worker and pay period, total hours SHALL equal the sum of all approved time card hours within that period.
**Validates: Requirements 7.6**

**Property 30: Task creation completeness**
*For any* created task, it SHALL contain: title, description, at least one assigned worker, priority, and status.
**Validates: Requirements 8.1**

**Property 31: Task completion recording**
*For any* task marked complete, it SHALL have: completion timestamp, completed-by user ID, and status set to 'completed'.
**Validates: Requirements 8.2**

**Property 32: Task hours linked to time cards**
*For any* task with actual hours recorded, those hours SHALL be traceable to specific time card entries.
**Validates: Requirements 8.5**

### Authentication Properties

**Property 33: JWT token contains required claims**
*For any* successful login, the issued JWT SHALL contain: userId, farmId, role, issued-at timestamp, and expiration timestamp.
**Validates: Requirements 9.1**

**Property 34: Role-based authorization enforcement**
*For any* API request, if the user's role does not have permission for the requested action, the response SHALL be 403 Forbidden.
**Validates: Requirements 9.2, 9.3**

**Property 35: Tenant data isolation**
*For any* data query, results SHALL only include records where farmId matches the authenticated user's farmId.
**Validates: Requirements 9.4**

**Property 36: Expired token rejection**
*For any* API request with an expired JWT token, the response SHALL be 401 Unauthorized.
**Validates: Requirements 9.5**

### Maintenance Properties

**Property 37: Service interval reminders**
*For any* equipment where current operating hours >= next service hours, a maintenance reminder SHALL be generated.
**Validates: Requirements 10.1**

**Property 38: Maintenance record completeness**
*For any* maintenance record, it SHALL contain: date, type, cost, and equipment ID.
**Validates: Requirements 10.2**

**Property 39: Downtime and cost calculation**
*For any* equipment, total downtime SHALL equal sum of maintenance durations, and total maintenance cost SHALL equal sum of maintenance record costs.
**Validates: Requirements 10.5**


## Error Handling

### API Error Response Format

```typescript
interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  path: string;
  requestId: string;
}

// Standard HTTP status codes used:
// 400 - Bad Request (validation errors)
// 401 - Unauthorized (missing/invalid token)
// 403 - Forbidden (insufficient permissions)
// 404 - Not Found
// 409 - Conflict (duplicate entries, state conflicts)
// 422 - Unprocessable Entity (business rule violations)
// 500 - Internal Server Error
// 503 - Service Unavailable (external service failures)
```

### Error Handling Strategies by Domain

**Telemetry Module:**
- Invalid message schema → Log error, reject message, continue processing
- Device not registered → Return 404, log for investigation
- Duplicate message → Silently deduplicate, return success
- Database write failure → Retry with exponential backoff, alert on persistent failure

**Geospatial Module:**
- Invalid polygon geometry → Return 422 with specific geometry error
- Zone outside field boundary → Return 422 with containment error
- Import parse failure → Return 400 with line/position of error

**Financial Module:**
- Negative amounts → Return 422 (expenses/revenue must be positive)
- Missing required associations → Return 400 with missing fields
- Division by zero (cost per acre with 0 acreage) → Return calculated as null with warning

**Workforce Module:**
- Duplicate clock-in → Return 409 with active time card ID
- Clock-out without clock-in → Return 404 (no active time card)
- Schedule conflict → Return 409 with conflicting schedule details

**Authentication Module:**
- Invalid credentials → Return 401 (generic message to prevent enumeration)
- Expired token → Return 401 with "token_expired" error code
- Insufficient permissions → Return 403 with required permission

### External Service Failures

```typescript
interface ExternalServiceConfig {
  retryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
  fallbackBehavior: 'cache' | 'error' | 'default';
}

// Weather API failure → Use cached data, mark as stale
// LLM API failure → Return error, suggest retry later
// IoT Core failure → Buffer locally, sync when available
```

## Testing Strategy

### Testing Framework Selection

- **Unit Tests**: Vitest (fast, TypeScript-native, Jest-compatible)
- **Property-Based Tests**: fast-check (TypeScript PBT library)
- **Integration Tests**: Vitest + Supertest for API testing
- **E2E Tests**: Playwright for frontend flows

### Unit Testing Approach

Unit tests focus on:
- Individual service methods with mocked dependencies
- Data transformation and validation functions
- Business logic calculations (cost allocation, hours calculation)
- Error handling paths

### Property-Based Testing Configuration

```typescript
import * as fc from 'fast-check';

// Configuration for all property tests
const PBT_CONFIG = {
  numRuns: 100,        // Minimum 100 iterations per property
  verbose: true,
  seed: Date.now(),    // Reproducible failures
};

// Example property test structure
describe('Telemetry Service', () => {
  it('Property 1: Valid telemetry messages are stored', () => {
    // Feature: farm-management-platform, Property 1: Valid telemetry messages are stored
    fc.assert(
      fc.property(
        validTelemetryPayloadArb,
        async (payload) => {
          const result = await telemetryService.ingestReading(payload);
          expect(result).toBeDefined();
          expect(result.equipmentId).toBe(payload.deviceId);
        }
      ),
      PBT_CONFIG
    );
  });
});
```

### Test Data Generators (Arbitraries)

```typescript
// Telemetry payload generator
const validTelemetryPayloadArb = fc.record({
  deviceId: fc.uuid(),
  timestamp: fc.date().map(d => d.toISOString()),
  readings: fc.record({
    operatingHours: fc.float({ min: 0, max: 50000 }),
    fuelLevel: fc.float({ min: 0, max: 100 }),
    speed: fc.float({ min: 0, max: 50 }),
    latitude: fc.float({ min: -90, max: 90 }),
    longitude: fc.float({ min: -180, max: 180 }),
  }),
});

// GeoJSON polygon generator (non-self-intersecting)
const validPolygonArb = fc.array(
  fc.tuple(fc.float({ min: -180, max: 180 }), fc.float({ min: -90, max: 90 })),
  { minLength: 4, maxLength: 20 }
).map(coords => ({
  type: 'Polygon' as const,
  coordinates: [[...coords, coords[0]]], // Close the ring
}));

// Financial record generators
const expenseArb = fc.record({
  category: fc.constantFrom('seed', 'fertilizer', 'chemicals', 'fuel', 'labor'),
  amount: fc.float({ min: 0.01, max: 1000000 }),
  date: fc.date(),
  fieldId: fc.uuid(),
});

// Time card generator
const timeCardArb = fc.record({
  workerId: fc.uuid(),
  clockIn: fc.date(),
  clockOut: fc.date(),
}).filter(tc => tc.clockOut > tc.clockIn);
```

### Integration Testing Strategy

- Test API endpoints with real database (test containers)
- Test WebSocket connections for telemetry
- Test authentication flows end-to-end
- Test multi-tenant isolation

### Test Coverage Goals

- Unit tests: 80% line coverage for business logic
- Property tests: All 39 correctness properties covered
- Integration tests: All API endpoints
- E2E tests: Critical user flows (login, clock in/out, create task)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'manager', 'worker', 'viewer');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('tractor', 'harvester', 'sprayer', 'irrigation', 'planter', 'other');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('active', 'maintenance', 'inactive');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('scheduled', 'repair', 'inspection', 'emergency');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('fault_code', 'service_due', 'inspection_due');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('seed', 'fertilizer', 'lime', 'pesticide', 'herbicide', 'fuel');

-- CreateEnum
CREATE TYPE "PlantingStatus" AS ENUM ('planned', 'planted', 'growing', 'harvested', 'failed');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('seed', 'fertilizer', 'chemicals', 'fuel', 'labor', 'equipment_maintenance', 'equipment_depreciation', 'land_rent', 'utilities', 'insurance', 'other');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time', 'seasonal', 'contractor');

-- CreateEnum
CREATE TYPE "TimeCardStatus" AS ENUM ('active', 'pending_approval', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- CreateTable: farms
CREATE TABLE "farms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "location" geography(Point, 4326),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable: users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "profile" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: fields
CREATE TABLE "fields" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "boundary" geography(Polygon, 4326) NOT NULL,
    "acreage" DECIMAL(10,2),
    "soil_type" VARCHAR(100),
    "irrigation_type" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable: zones
CREATE TABLE "zones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "field_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "boundary" geography(Polygon, 4326) NOT NULL,
    "acreage" DECIMAL(10,2),
    "soil_quality" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable: equipment
CREATE TABLE "equipment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "EquipmentType" NOT NULL,
    "make" VARCHAR(100),
    "model" VARCHAR(100),
    "serial_number" VARCHAR(100),
    "device_id" VARCHAR(100),
    "status" "EquipmentStatus" NOT NULL DEFAULT 'active',
    "last_telemetry_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: telemetry_readings (TimescaleDB hypertable)
CREATE TABLE "telemetry_readings" (
    "time" TIMESTAMPTZ NOT NULL,
    "equipment_id" UUID NOT NULL,
    "location" geography(Point, 4326),
    "operating_hours" DECIMAL(10,2),
    "fuel_level" DECIMAL(5,2),
    "speed" DECIMAL(6,2),
    "engine_rpm" INTEGER,
    "fault_codes" TEXT[],
    "resource_dispensed" JSONB,
    "raw_data" JSONB,

    CONSTRAINT "telemetry_readings_pkey" PRIMARY KEY ("time", "equipment_id")
);

-- Convert telemetry_readings to TimescaleDB hypertable
SELECT create_hypertable('telemetry_readings', 'time', if_not_exists => TRUE);

-- CreateTable: maintenance_records
CREATE TABLE "maintenance_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipment_id" UUID NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "description" TEXT,
    "cost" DECIMAL(10,2),
    "performed_at" TIMESTAMPTZ NOT NULL,
    "performed_by" VARCHAR(255),
    "notes" TEXT,
    "next_service_hours" DECIMAL(10,2),
    "next_service_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable: maintenance_alerts
CREATE TABLE "maintenance_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipment_id" UUID NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "fault_codes" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "acknowledged_at" TIMESTAMPTZ,
    "acknowledged_by" UUID,
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "maintenance_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: resource_applications
CREATE TABLE "resource_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "zone_id" UUID,
    "resource_type" "ResourceType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "resource_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: plantings
CREATE TABLE "plantings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "zone_id" UUID,
    "crop_type" VARCHAR(100) NOT NULL,
    "variety" VARCHAR(100),
    "planting_date" DATE NOT NULL,
    "expected_harvest_date" DATE,
    "seed_rate" DECIMAL(10,2),
    "seed_unit" VARCHAR(20),
    "acreage" DECIMAL(10,2),
    "status" "PlantingStatus" NOT NULL DEFAULT 'planned',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "plantings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: harvests
CREATE TABLE "harvests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "zone_id" UUID,
    "planting_id" UUID,
    "crop_type" VARCHAR(100) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "quality_grade" VARCHAR(20),
    "harvest_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "harvests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: expenses
CREATE TABLE "expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "date" DATE NOT NULL,
    "description" TEXT,
    "field_id" UUID,
    "crop_type" VARCHAR(100),
    "vendor" VARCHAR(255),
    "receipt_url" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: revenues
CREATE TABLE "revenues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "harvest_id" UUID,
    "field_id" UUID NOT NULL,
    "crop_type" VARCHAR(100) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "price_per_unit" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "sale_date" DATE NOT NULL,
    "buyer" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "revenues_pkey" PRIMARY KEY ("id")
);

-- CreateTable: workers
CREATE TABLE "workers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "farm_id" UUID NOT NULL,
    "skills" TEXT[],
    "certifications" JSONB DEFAULT '[]',
    "hourly_rate" DECIMAL(8,2),
    "employment_type" "EmploymentType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: time_cards
CREATE TABLE "time_cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "clock_in" TIMESTAMPTZ NOT NULL,
    "clock_out" TIMESTAMPTZ,
    "clock_in_location" geography(Point, 4326),
    "clock_out_location" geography(Point, 4326),
    "total_hours" DECIMAL(5,2),
    "status" "TimeCardStatus" NOT NULL DEFAULT 'active',
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "notes" TEXT,
    "flagged_for_review" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "time_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tasks
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "field_id" UUID,
    "zone_id" UUID,
    "assigned_to" UUID[],
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "due_date" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "completed_by" UUID,
    "completion_notes" TEXT,
    "attachments" TEXT[],
    "estimated_hours" DECIMAL(5,2),
    "actual_hours" DECIMAL(5,2),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: schedules
CREATE TABLE "schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "role" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: weather_data (TimescaleDB hypertable)
CREATE TABLE "weather_data" (
    "time" TIMESTAMPTZ NOT NULL,
    "farm_id" UUID NOT NULL,
    "temperature" DECIMAL(5,2),
    "precipitation" DECIMAL(6,2),
    "humidity" DECIMAL(5,2),
    "wind_speed" DECIMAL(5,2),
    "conditions" VARCHAR(100),
    "source" VARCHAR(50),

    CONSTRAINT "weather_data_pkey" PRIMARY KEY ("time", "farm_id")
);

-- Convert weather_data to TimescaleDB hypertable
SELECT create_hypertable('weather_data', 'time', if_not_exists => TRUE);

-- CreateTable: recommendations
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "zone_id" UUID NOT NULL,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "valid_until" TIMESTAMPTZ,
    "recommendations" JSONB NOT NULL,
    "input_data" JSONB NOT NULL,
    "explanation" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "idx_users_farm" ON "users"("farm_id");

CREATE INDEX "idx_fields_farm" ON "fields"("farm_id");

CREATE INDEX "idx_zones_field" ON "zones"("field_id");

CREATE UNIQUE INDEX "equipment_device_id_key" ON "equipment"("device_id");
CREATE INDEX "idx_equipment_farm" ON "equipment"("farm_id");
CREATE INDEX "idx_equipment_device" ON "equipment"("device_id");

CREATE INDEX "idx_telemetry_equipment" ON "telemetry_readings"("equipment_id", "time" DESC);

CREATE INDEX "idx_resource_applications_field_date" ON "resource_applications"("field_id", "date");

CREATE INDEX "idx_expenses_farm_date" ON "expenses"("farm_id", "date");

CREATE INDEX "idx_revenues_farm_date" ON "revenues"("farm_id", "sale_date");

CREATE UNIQUE INDEX "workers_user_id_key" ON "workers"("user_id");

CREATE INDEX "idx_time_cards_worker" ON "time_cards"("worker_id", "clock_in");

CREATE INDEX "idx_tasks_farm_status" ON "tasks"("farm_id", "status");
CREATE INDEX "idx_tasks_assigned" ON "tasks" USING GIN("assigned_to");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fields" ADD CONSTRAINT "fields_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "zones" ADD CONSTRAINT "zones_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipment" ADD CONSTRAINT "equipment_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "telemetry_readings" ADD CONSTRAINT "telemetry_readings_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "maintenance_alerts" ADD CONSTRAINT "maintenance_alerts_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_applications" ADD CONSTRAINT "resource_applications_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "resource_applications" ADD CONSTRAINT "resource_applications_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "plantings" ADD CONSTRAINT "plantings_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plantings" ADD CONSTRAINT "plantings_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plantings" ADD CONSTRAINT "plantings_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "harvests" ADD CONSTRAINT "harvests_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_planting_id_fkey" FOREIGN KEY ("planting_id") REFERENCES "plantings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "revenues" ADD CONSTRAINT "revenues_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_harvest_id_fkey" FOREIGN KEY ("harvest_id") REFERENCES "harvests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workers" ADD CONSTRAINT "workers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workers" ADD CONSTRAINT "workers_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_cards" ADD CONSTRAINT "time_cards_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "time_cards" ADD CONSTRAINT "time_cards_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "time_cards" ADD CONSTRAINT "time_cards_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedules" ADD CONSTRAINT "schedules_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "weather_data" ADD CONSTRAINT "weather_data_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

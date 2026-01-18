-- CreateEnum
CREATE TYPE "ResourceWarningSeverity" AS ENUM ('low', 'medium', 'high');

-- CreateTable: resource_thresholds
CREATE TABLE "resource_thresholds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "max_quantity" DECIMAL(12,2) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "resource_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable: resource_warnings
CREATE TABLE "resource_warnings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "resource_application_id" UUID NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "applied_quantity" DECIMAL(12,2) NOT NULL,
    "threshold_quantity" DECIMAL(12,2) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "severity" "ResourceWarningSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMPTZ,
    "acknowledged_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "resource_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resource_thresholds_farm_id_resource_type_unit_key" ON "resource_thresholds"("farm_id", "resource_type", "unit");
CREATE INDEX "idx_resource_thresholds_farm_type" ON "resource_thresholds"("farm_id", "resource_type");
CREATE INDEX "idx_resource_warnings_farm_created" ON "resource_warnings"("farm_id", "created_at");

-- AddForeignKey
ALTER TABLE "resource_warnings" ADD CONSTRAINT "resource_warnings_resource_application_id_fkey" FOREIGN KEY ("resource_application_id") REFERENCES "resource_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

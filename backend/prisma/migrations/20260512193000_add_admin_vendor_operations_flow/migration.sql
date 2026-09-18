-- CreateEnum
CREATE TYPE "QualityCheckStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QualityCheckOutcome" AS ENUM ('PASSED', 'REPAIR', 'DAMAGE');

-- CreateEnum
CREATE TYPE "TaskWorkflowStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaintenanceTaskType" AS ENUM ('CLEANING');

-- CreateTable
CREATE TABLE "OrderItemQualityCheck" (
    "id" BIGSERIAL NOT NULL,
    "orderItemId" BIGINT NOT NULL,
    "vendorId" BIGINT NOT NULL,
    "status" "QualityCheckStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" "QualityCheckOutcome",
    "damageType" TEXT,
    "estimatedCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "inspectedByAdminId" BIGINT,
    "inspectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemQualityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemMaintenanceTask" (
    "id" BIGSERIAL NOT NULL,
    "orderItemId" BIGINT NOT NULL,
    "vendorId" BIGINT NOT NULL,
    "taskType" "MaintenanceTaskType" NOT NULL DEFAULT 'CLEANING',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" "TaskWorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdByAdminId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemMaintenanceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemRepairTask" (
    "id" BIGSERIAL NOT NULL,
    "orderItemId" BIGINT NOT NULL,
    "vendorId" BIGINT NOT NULL,
    "issueType" TEXT NOT NULL,
    "estimatedCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "actualCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "expectedCompletion" TIMESTAMP(3),
    "status" "TaskWorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdByAdminId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemRepairTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemQualityCheck_orderItemId_key" ON "OrderItemQualityCheck"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemQualityCheck_vendorId_status_createdAt_idx" ON "OrderItemQualityCheck"("vendorId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemMaintenanceTask_orderItemId_key" ON "OrderItemMaintenanceTask"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemMaintenanceTask_vendorId_status_scheduledDate_idx" ON "OrderItemMaintenanceTask"("vendorId", "status", "scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemRepairTask_orderItemId_key" ON "OrderItemRepairTask"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemRepairTask_vendorId_status_expectedCompletion_idx" ON "OrderItemRepairTask"("vendorId", "status", "expectedCompletion");

-- AddForeignKey
ALTER TABLE "OrderItemQualityCheck" ADD CONSTRAINT "OrderItemQualityCheck_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemQualityCheck" ADD CONSTRAINT "OrderItemQualityCheck_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemMaintenanceTask" ADD CONSTRAINT "OrderItemMaintenanceTask_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemMaintenanceTask" ADD CONSTRAINT "OrderItemMaintenanceTask_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemRepairTask" ADD CONSTRAINT "OrderItemRepairTask_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemRepairTask" ADD CONSTRAINT "OrderItemRepairTask_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

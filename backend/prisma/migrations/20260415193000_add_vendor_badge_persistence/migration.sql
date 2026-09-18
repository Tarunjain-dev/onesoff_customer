-- CreateEnum
CREATE TYPE "BadgeAssignmentSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "BadgeRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minOrders" INTEGER NOT NULL,
    "minRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxLatePercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "maxDamagePercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "maxCancellationPercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "minRepeatCustomerPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPolicyViolations" INTEGER NOT NULL DEFAULT 9999,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BadgeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBadgeAssignment" (
    "vendorId" BIGINT NOT NULL,
    "badgeRuleId" TEXT NOT NULL,
    "source" "BadgeAssignmentSource" NOT NULL,
    "assignedByAdminId" BIGINT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEvaluatedAt" TIMESTAMP(3),
    "metricsSnapshot" JSONB,
    CONSTRAINT "VendorBadgeAssignment_pkey" PRIMARY KEY ("vendorId")
);

-- CreateTable
CREATE TABLE "VendorBadgeHistory" (
    "id" BIGSERIAL NOT NULL,
    "vendorId" BIGINT NOT NULL,
    "badgeRuleId" TEXT,
    "source" "BadgeAssignmentSource" NOT NULL,
    "assignedByAdminId" BIGINT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricsSnapshot" JSONB,
    CONSTRAINT "VendorBadgeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorBadgeAssignment_badgeRuleId_idx" ON "VendorBadgeAssignment"("badgeRuleId");

-- CreateIndex
CREATE INDEX "VendorBadgeHistory_vendorId_assignedAt_idx" ON "VendorBadgeHistory"("vendorId", "assignedAt");

-- CreateIndex
CREATE INDEX "VendorBadgeHistory_badgeRuleId_assignedAt_idx" ON "VendorBadgeHistory"("badgeRuleId", "assignedAt");

-- AddForeignKey
ALTER TABLE "VendorBadgeAssignment"
ADD CONSTRAINT "VendorBadgeAssignment_badgeRuleId_fkey"
FOREIGN KEY ("badgeRuleId") REFERENCES "BadgeRule"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBadgeAssignment"
ADD CONSTRAINT "VendorBadgeAssignment_vendorId_fkey"
FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBadgeHistory"
ADD CONSTRAINT "VendorBadgeHistory_badgeRuleId_fkey"
FOREIGN KEY ("badgeRuleId") REFERENCES "BadgeRule"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBadgeHistory"
ADD CONSTRAINT "VendorBadgeHistory_vendorId_fkey"
FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

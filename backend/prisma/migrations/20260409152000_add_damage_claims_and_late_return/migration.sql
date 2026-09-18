-- Add late return status in rental lifecycle
ALTER TYPE "OrderItemStatus" ADD VALUE IF NOT EXISTS 'LATE_RETURN';

-- Add damage-claim status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'DamageClaimStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "DamageClaimStatus" AS ENUM (
      'PENDING',
      'APPROVED_FULL',
      'APPROVED_PARTIAL',
      'REJECTED'
    );
  END IF;
END $$;

-- Create damage-claims table for vendor-raised claim workflow
CREATE TABLE IF NOT EXISTS "DamageClaim" (
  "id" BIGSERIAL NOT NULL,
  "orderItemId" BIGINT NOT NULL,
  "vendorId" BIGINT NOT NULL,
  "adminId" BIGINT,
  "damageType" TEXT NOT NULL,
  "repairCost" DECIMAL(65,30) NOT NULL,
  "photoProof" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "vendorNotes" TEXT,
  "status" "DamageClaimStatus" NOT NULL DEFAULT 'PENDING',
  "approvedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "adminNotes" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "DamageClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DamageClaim_orderItemId_key" ON "DamageClaim"("orderItemId");
CREATE INDEX IF NOT EXISTS "DamageClaim_vendorId_status_idx" ON "DamageClaim"("vendorId", "status");
CREATE INDEX IF NOT EXISTS "DamageClaim_status_createdAt_idx" ON "DamageClaim"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DamageClaim_orderItemId_fkey'
  ) THEN
    ALTER TABLE "DamageClaim"
      ADD CONSTRAINT "DamageClaim_orderItemId_fkey"
      FOREIGN KEY ("orderItemId")
      REFERENCES "OrderItem"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DamageClaim_vendorId_fkey'
  ) THEN
    ALTER TABLE "DamageClaim"
      ADD CONSTRAINT "DamageClaim_vendorId_fkey"
      FOREIGN KEY ("vendorId")
      REFERENCES "VendorProfile"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

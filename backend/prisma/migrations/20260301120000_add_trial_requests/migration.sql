DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrialRequestStatus') THEN
    CREATE TYPE "TrialRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "TrialRequest" (
  "id" BIGSERIAL NOT NULL,
  "customerId" BIGINT NOT NULL,
  "vendorId" BIGINT NOT NULL,
  "productId" BIGINT NOT NULL,
  "variantId" BIGINT,
  "preferredDate" TIMESTAMP(3),
  "status" "TrialRequestStatus" NOT NULL DEFAULT 'PENDING',
  "trialCode" TEXT,
  "rejectionReason" TEXT,
  "respondedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrialRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TrialRequest_trialCode_key" ON "TrialRequest"("trialCode");
CREATE INDEX IF NOT EXISTS "TrialRequest_vendorId_status_idx" ON "TrialRequest"("vendorId", "status");
CREATE INDEX IF NOT EXISTS "TrialRequest_customerId_status_idx" ON "TrialRequest"("customerId", "status");
CREATE INDEX IF NOT EXISTS "TrialRequest_productId_idx" ON "TrialRequest"("productId");

ALTER TABLE "TrialRequest"
  ADD CONSTRAINT "TrialRequest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrialRequest"
  ADD CONSTRAINT "TrialRequest_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrialRequest"
  ADD CONSTRAINT "TrialRequest_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrialRequest"
  ADD CONSTRAINT "TrialRequest_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment hardening: provider metadata + split amounts + refund tracking.
ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT 'INTERNAL',
ADD COLUMN IF NOT EXISTS "providerOrderId" TEXT,
ADD COLUMN IF NOT EXISTS "providerPaymentId" TEXT,
ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "rentalAmount" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "capturedAmount" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "refundedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "captureStatus" TEXT DEFAULT 'INITIATED',
ADD COLUMN IF NOT EXISTS "paymentMeta" JSONB;

UPDATE "Payment"
SET
  "totalAmount" = COALESCE("totalAmount", "amount"),
  "capturedAmount" = COALESCE("capturedAmount", "amount"),
  "provider" = COALESCE("provider", 'INTERNAL'),
  "currency" = COALESCE("currency", 'INR'),
  "captureStatus" = COALESCE(
    "captureStatus",
    CASE
      WHEN UPPER(COALESCE("status", '')) = 'PAID' THEN 'CAPTURED'
      ELSE 'INITIATED'
    END
  );

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerPaymentId_key"
ON "Payment"("providerPaymentId");

CREATE INDEX IF NOT EXISTS "Payment_providerOrderId_idx"
ON "Payment"("providerOrderId");

CREATE INDEX IF NOT EXISTS "Payment_orderId_status_idx"
ON "Payment"("orderId", "status");

-- Refund ledger table for partial/multiple safe refunds.
CREATE TABLE IF NOT EXISTS "Refund" (
  "id" BIGSERIAL NOT NULL,
  "paymentId" BIGINT NOT NULL,
  "orderId" BIGINT NOT NULL,
  "orderItemId" BIGINT,
  "amount" DECIMAL(65,30) NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "providerRefundId" TEXT,
  "idempotencyKey" TEXT,
  "providerResponse" JSONB,
  "processedByAdminId" BIGINT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Refund_providerRefundId_key"
ON "Refund"("providerRefundId");

CREATE UNIQUE INDEX IF NOT EXISTS "Refund_idempotencyKey_key"
ON "Refund"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "Refund_paymentId_createdAt_idx"
ON "Refund"("paymentId", "createdAt");

CREATE INDEX IF NOT EXISTS "Refund_orderId_createdAt_idx"
ON "Refund"("orderId", "createdAt");

CREATE INDEX IF NOT EXISTS "Refund_status_idx"
ON "Refund"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Refund_paymentId_fkey'
  ) THEN
    ALTER TABLE "Refund"
    ADD CONSTRAINT "Refund_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Refund_orderId_fkey'
  ) THEN
    ALTER TABLE "Refund"
    ADD CONSTRAINT "Refund_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Refund_orderItemId_fkey'
  ) THEN
    ALTER TABLE "Refund"
    ADD CONSTRAINT "Refund_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Outstanding recoveries when deductions exceed deposit.
CREATE TABLE IF NOT EXISTS "VendorDue" (
  "id" BIGSERIAL NOT NULL,
  "orderItemId" BIGINT NOT NULL,
  "customerId" BIGINT NOT NULL,
  "vendorId" BIGINT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "paymentLink" TEXT,
  "notes" TEXT,
  "resolvedByAdminId" BIGINT,
  "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorDue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VendorDue_customerId_status_createdAt_idx"
ON "VendorDue"("customerId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "VendorDue_vendorId_status_createdAt_idx"
ON "VendorDue"("vendorId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "VendorDue_orderItemId_idx"
ON "VendorDue"("orderItemId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'VendorDue_customerId_fkey'
  ) THEN
    ALTER TABLE "VendorDue"
    ADD CONSTRAINT "VendorDue_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'VendorDue_orderItemId_fkey'
  ) THEN
    ALTER TABLE "VendorDue"
    ADD CONSTRAINT "VendorDue_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'VendorDue_vendorId_fkey'
  ) THEN
    ALTER TABLE "VendorDue"
    ADD CONSTRAINT "VendorDue_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Settlement audit fields for manual monthly bank payouts.
ALTER TABLE "VendorSettlement"
ADD COLUMN IF NOT EXISTS "periodFrom" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "periodTo" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "rentalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lateFeeAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "damageAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "commissionAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "netPayable" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "transferMode" TEXT,
ADD COLUMN IF NOT EXISTS "transferReference" TEXT,
ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paidByAdminId" BIGINT,
ADD COLUMN IF NOT EXISTS "notes" TEXT;


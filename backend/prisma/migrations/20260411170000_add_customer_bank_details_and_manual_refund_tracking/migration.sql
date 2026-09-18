-- Create customer bank details table
CREATE TABLE "CustomerBankDetail" (
    "id" BIGSERIAL PRIMARY KEY,
    "customerId" BIGINT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "upiId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerBankDetail_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomerBankDetail_customerId_key"
ON "CustomerBankDetail"("customerId");

-- Track manual refund transfer metadata per order item
ALTER TABLE "OrderItem"
ADD COLUMN "refundTransferMode" TEXT,
ADD COLUMN "refundTransferReference" TEXT,
ADD COLUMN "refundTransferredAt" TIMESTAMP(3),
ADD COLUMN "refundTransferNotes" TEXT,
ADD COLUMN "refundProcessedByAdminId" BIGINT;

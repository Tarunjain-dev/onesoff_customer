-- Add explicit deposit split tracking on order items
ALTER TABLE "OrderItem"
ADD COLUMN "securityDepositRefunded" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "securityDepositHeld" DECIMAL(65,30) NOT NULL DEFAULT 0;


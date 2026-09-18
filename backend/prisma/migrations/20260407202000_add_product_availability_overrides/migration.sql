-- Calendar logic for vendor rental availability (blocked / maintenance)
CREATE TYPE "AvailabilityOverrideType" AS ENUM ('BLOCKED', 'MAINTENANCE');

CREATE TABLE "ProductAvailabilityOverride" (
  "id" BIGSERIAL NOT NULL,
  "vendorId" BIGINT NOT NULL,
  "productId" BIGINT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "type" "AvailabilityOverrideType" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductAvailabilityOverride_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProductAvailabilityOverride"
ADD CONSTRAINT "ProductAvailabilityOverride_vendorId_fkey"
FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductAvailabilityOverride"
ADD CONSTRAINT "ProductAvailabilityOverride_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProductAvailabilityOverride_vendorId_productId_date_key"
ON "ProductAvailabilityOverride"("vendorId", "productId", "date");

CREATE INDEX "ProductAvailabilityOverride_productId_date_idx"
ON "ProductAvailabilityOverride"("productId", "date");

CREATE INDEX "ProductAvailabilityOverride_vendorId_date_idx"
ON "ProductAvailabilityOverride"("vendorId", "date");


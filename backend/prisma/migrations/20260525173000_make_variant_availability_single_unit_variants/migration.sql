ALTER TABLE "ProductAvailabilityOverride"
ADD COLUMN "variantId" BIGINT;

ALTER TABLE "ProductAvailabilityOverride"
ADD CONSTRAINT "ProductAvailabilityOverride_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "ProductAvailabilityOverride_vendorId_productId_date_key";

CREATE UNIQUE INDEX "ProductAvailabilityOverride_vendorId_productId_variantId_date_key"
ON "ProductAvailabilityOverride"("vendorId", "productId", "variantId", "date");

CREATE INDEX "ProductAvailabilityOverride_productId_variantId_date_idx"
ON "ProductAvailabilityOverride"("productId", "variantId", "date");

CREATE INDEX "ProductAvailabilityOverride_variantId_date_idx"
ON "ProductAvailabilityOverride"("variantId", "date");

UPDATE "ProductVariant"
SET "quantity" = 1
WHERE "quantity" IS DISTINCT FROM 1;

-- Add missing Product fields used by the application (Men/Women, brand/type filters, GST, etc.)
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "productType" TEXT,
  ADD COLUMN IF NOT EXISTS "occasion" TEXT,
  ADD COLUMN IF NOT EXISTS "brand" TEXT,
  ADD COLUMN IF NOT EXISTS "gender" TEXT,
  ADD COLUMN IF NOT EXISTS "gst" DECIMAL(65,30);


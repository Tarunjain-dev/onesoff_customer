ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "shortDescription" TEXT,
ADD COLUMN IF NOT EXISTS "fullDescription" TEXT,
ADD COLUMN IF NOT EXISTS "descriptionSummary" TEXT,
ADD COLUMN IF NOT EXISTS "productDetailsFull" JSONB;

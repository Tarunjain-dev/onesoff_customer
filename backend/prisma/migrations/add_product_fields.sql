-- Add new fields to Product table
ALTER TABLE "Product" 
ADD COLUMN "productType" TEXT,
ADD COLUMN "occasion" TEXT,
ADD COLUMN "brand" TEXT,
ADD COLUMN "gender" TEXT,
ADD COLUMN "gst" DECIMAL(65,30);

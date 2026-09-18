ALTER TABLE "VendorProfile"
ADD COLUMN IF NOT EXISTS "commissionOverridePercentage" DECIMAL(65,30);

CREATE TABLE IF NOT EXISTS "PlatformSetting" (
  "id" TEXT NOT NULL,
  "defaultCommission" DECIMAL(65,30) NOT NULL DEFAULT 15,
  "goldVendorCommission" DECIMAL(65,30) NOT NULL DEFAULT 12,
  "silverVendorCommission" DECIMAL(65,30) NOT NULL DEFAULT 13,
  "platinumVendorCommission" DECIMAL(65,30) NOT NULL DEFAULT 10,
  "categoryCommission" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSetting" (
  "id",
  "defaultCommission",
  "goldVendorCommission",
  "silverVendorCommission",
  "platinumVendorCommission",
  "categoryCommission"
)
VALUES (
  'default',
  15,
  12,
  13,
  10,
  '[{"category":"Saree","commission":"15"},{"category":"Lehenga","commission":"18"},{"category":"Sherwani","commission":"15"},{"category":"Accessories","commission":"20"}]'::jsonb
)
ON CONFLICT ("id") DO NOTHING;

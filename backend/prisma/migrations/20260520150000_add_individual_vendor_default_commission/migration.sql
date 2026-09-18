ALTER TABLE "PlatformSetting"
ADD COLUMN IF NOT EXISTS "individualVendorDefaultCommission" DECIMAL NOT NULL DEFAULT 15;

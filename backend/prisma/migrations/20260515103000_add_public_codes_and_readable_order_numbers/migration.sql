ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "publicCode" TEXT;

UPDATE "User"
SET "publicCode" = CASE "role"
  WHEN 'CUSTOMER' THEN 'CUS-'
  WHEN 'VENDOR' THEN 'VND-'
  WHEN 'INDIVIDUAL_VENDOR' THEN 'IND-'
  WHEN 'ADMIN' THEN 'ADM-'
  WHEN 'ADMIN_AS_VENDOR' THEN 'AAV-'
  ELSE 'USR-'
END || LPAD(CAST("id" AS TEXT), 6, '0')
WHERE "publicCode" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_publicCode_key"
ON "User"("publicCode");

UPDATE "Order"
SET "orderNo" = 'ORD-' || TO_CHAR(COALESCE("createdAt", NOW()), 'YYMM') || '-' || LPAD(CAST("id" AS TEXT), 6, '0')
WHERE "orderNo" IS NULL
   OR "orderNo" !~ '^ORD-\d{4}-\d{6}$';

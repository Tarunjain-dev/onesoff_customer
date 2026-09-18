DO $$
BEGIN
  IF to_regclass('public."Cart"') IS NULL THEN
    CREATE TABLE "Cart" (
      "id" BIGSERIAL PRIMARY KEY,
      "userId" BIGINT NOT NULL,
      "productId" BIGINT NOT NULL,
      "variantId" BIGINT,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "rentalPeriod" TEXT,
      "issueDate" TEXT,
      "returnDate" TEXT,
      "size" TEXT,
      "color" TEXT,
      "imageUrl" TEXT
    );
  ELSE
    ALTER TABLE "Cart"
      ADD COLUMN IF NOT EXISTS "variantId" BIGINT,
      ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "rentalPeriod" TEXT,
      ADD COLUMN IF NOT EXISTS "issueDate" TEXT,
      ADD COLUMN IF NOT EXISTS "returnDate" TEXT,
      ADD COLUMN IF NOT EXISTS "size" TEXT,
      ADD COLUMN IF NOT EXISTS "color" TEXT,
      ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Cart_userId_idx" ON "Cart"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Cart_userId_productId_variantId_key"
  ON "Cart"("userId", "productId", "variantId");

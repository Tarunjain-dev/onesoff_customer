ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "cleaningBufferDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "alterationAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "damageWaiverAvailable" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum enum_values
    JOIN pg_type enum_types ON enum_types.oid = enum_values.enumtypid
    WHERE enum_types.typname = 'TrialRequestStatus'
      AND enum_values.enumlabel = 'NO_SHOW'
  ) THEN
    ALTER TYPE "TrialRequestStatus" ADD VALUE 'NO_SHOW';
  END IF;
END
$$;

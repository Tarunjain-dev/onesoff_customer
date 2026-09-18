DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'TrialRequestStatus'
      AND e.enumlabel = 'STARTED'
  ) THEN
    ALTER TYPE "TrialRequestStatus" ADD VALUE 'STARTED' AFTER 'ACCEPTED';
  END IF;
END $$;

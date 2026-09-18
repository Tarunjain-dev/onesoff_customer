-- Notifications: enums + device tokens + delivery logs

DO $$
BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'OTP',
    'TRIAL_BOOKED',
    'TRIAL_APPROVED',
    'TRIAL_REMINDER',
    'FINAL_REMINDER',
    'TRIAL_CANCELLED',
    'BOOKING_CANCELLED',
    'VENDOR_UNAVAILABLE',
    'RESCHEDULED',
    'ORDER_PLACED_VENDOR',
    'ORDER_ACCEPTED_CUSTOMER',
    'ORDER_REJECTED_CUSTOMER',
    'REVIEW_SUBMITTED',
    'REVIEW_INVALID_PRODUCT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('FCM', 'SMS', 'EMAIL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "UserDevice" (
  "id" BIGSERIAL NOT NULL,
  "userId" BIGINT NOT NULL,
  "fcmToken" TEXT NOT NULL,
  "platform" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserDevice_fcmToken_key" ON "UserDevice"("fcmToken");
CREATE INDEX IF NOT EXISTS "UserDevice_userId_idx" ON "UserDevice"("userId");
CREATE INDEX IF NOT EXISTS "UserDevice_isActive_idx" ON "UserDevice"("isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserDevice_userId_fkey'
  ) THEN
    ALTER TABLE "UserDevice"
      ADD CONSTRAINT "UserDevice_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "NotificationLog" (
  "id" BIGSERIAL NOT NULL,
  "userId" BIGINT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL,
  "title" TEXT,
  "message" TEXT NOT NULL,
  "provider" TEXT,
  "error" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotificationLog_userId_createdAt_idx" ON "NotificationLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationLog_type_idx" ON "NotificationLog"("type");
CREATE INDEX IF NOT EXISTS "NotificationLog_status_idx" ON "NotificationLog"("status");
CREATE INDEX IF NOT EXISTS "NotificationLog_channel_idx" ON "NotificationLog"("channel");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationLog_userId_fkey'
  ) THEN
    ALTER TABLE "NotificationLog"
      ADD CONSTRAINT "NotificationLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;


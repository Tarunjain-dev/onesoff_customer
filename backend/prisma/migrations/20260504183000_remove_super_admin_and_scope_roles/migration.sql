UPDATE "User"
SET "role" = 'ADMIN'
WHERE "role" = 'SUPER_ADMIN';

ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM (
  'ADMIN',
  'ADMIN_AS_VENDOR',
  'VENDOR',
  'INDIVIDUAL_VENDOR',
  'CUSTOMER'
);

ALTER TABLE "User"
ALTER COLUMN "role"
TYPE "UserRole"
USING ("role"::text::"UserRole");

DROP TYPE "UserRole_old";

DO $$
BEGIN
  CREATE TYPE "AgreementScope" AS ENUM ('GLOBAL', 'PANEL_SPECIFIC');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AgreementPanel" AS ENUM ('ADMIN', 'ADMIN_AS_VENDOR', 'VENDOR', 'INDIVIDUAL_VENDOR', 'CUSTOMER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AgreementHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'SOFT_DELETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Agreement" (
  "id" BIGSERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "scope" "AgreementScope" NOT NULL,
  "applicablePanels" "AgreementPanel"[] NOT NULL DEFAULT ARRAY[]::"AgreementPanel"[],
  "version" INTEGER NOT NULL DEFAULT 1,
  "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "deletedAt" TIMESTAMP(3),
  "createdByUserId" BIGINT,
  "updatedByUserId" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AgreementSection" (
  "id" BIGSERIAL PRIMARY KEY,
  "agreementId" BIGINT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgreementSection_agreementId_fkey"
    FOREIGN KEY ("agreementId")
    REFERENCES "Agreement"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AgreementPoint" (
  "id" BIGSERIAL PRIMARY KEY,
  "sectionId" BIGINT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgreementPoint_sectionId_fkey"
    FOREIGN KEY ("sectionId")
    REFERENCES "AgreementSection"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AgreementVersionHistory" (
  "id" BIGSERIAL PRIMARY KEY,
  "agreementId" BIGINT NOT NULL,
  "version" INTEGER NOT NULL,
  "action" "AgreementHistoryAction" NOT NULL,
  "changeSummary" TEXT,
  "snapshot" JSONB NOT NULL,
  "createdByUserId" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgreementVersionHistory_agreementId_fkey"
    FOREIGN KEY ("agreementId")
    REFERENCES "Agreement"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AgreementAcceptance" (
  "id" BIGSERIAL PRIMARY KEY,
  "agreementId" BIGINT NOT NULL,
  "userId" BIGINT NOT NULL,
  "userRole" "UserRole" NOT NULL,
  "acceptedVersion" INTEGER NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "AgreementAcceptance_agreementId_fkey"
    FOREIGN KEY ("agreementId")
    REFERENCES "Agreement"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgreementAcceptance_agreementId_userId_acceptedVersion_key"
  ON "AgreementAcceptance"("agreementId", "userId", "acceptedVersion");

CREATE INDEX IF NOT EXISTS "Agreement_scope_isDeleted_updatedAt_idx"
  ON "Agreement"("scope", "isDeleted", "updatedAt");

CREATE INDEX IF NOT EXISTS "Agreement_isDeleted_createdAt_idx"
  ON "Agreement"("isDeleted", "createdAt");

CREATE INDEX IF NOT EXISTS "AgreementSection_agreementId_sortOrder_idx"
  ON "AgreementSection"("agreementId", "sortOrder");

CREATE INDEX IF NOT EXISTS "AgreementSection_agreementId_isDeleted_idx"
  ON "AgreementSection"("agreementId", "isDeleted");

CREATE INDEX IF NOT EXISTS "AgreementPoint_sectionId_sortOrder_idx"
  ON "AgreementPoint"("sectionId", "sortOrder");

CREATE INDEX IF NOT EXISTS "AgreementPoint_sectionId_isDeleted_idx"
  ON "AgreementPoint"("sectionId", "isDeleted");

CREATE INDEX IF NOT EXISTS "AgreementVersionHistory_agreementId_createdAt_idx"
  ON "AgreementVersionHistory"("agreementId", "createdAt");

CREATE INDEX IF NOT EXISTS "AgreementVersionHistory_agreementId_version_idx"
  ON "AgreementVersionHistory"("agreementId", "version");

CREATE INDEX IF NOT EXISTS "AgreementAcceptance_agreementId_userId_acceptedAt_idx"
  ON "AgreementAcceptance"("agreementId", "userId", "acceptedAt");

CREATE INDEX IF NOT EXISTS "AgreementAcceptance_userId_acceptedAt_idx"
  ON "AgreementAcceptance"("userId", "acceptedAt");

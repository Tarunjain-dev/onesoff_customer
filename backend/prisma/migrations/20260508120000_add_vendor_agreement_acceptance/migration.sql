CREATE TABLE "VendorAgreementAcceptance" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "ownershipDeclarationAccepted" BOOLEAN,
    "acceptPlatformTerms" BOOLEAN,
    "acceptCommissionAgreement" BOOLEAN,
    "acceptCancellationPolicy" BOOLEAN,
    "acceptDepositRules" BOOLEAN,
    "shopAgreeOrderHandlingResponsibility" BOOLEAN,
    "shopAgreeQualityStandards" BOOLEAN,
    "shopAgreeReturnHandling" BOOLEAN,
    "individualAgreePassiveOwnershipModel" BOOLEAN,
    "individualAgreePlatformPricingControl" BOOLEAN,
    "individualAgreeRevenueShare" BOOLEAN,
    "individualAgreeMaintenanceDeductionRules" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorAgreementAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorAgreementAcceptance_userId_key" ON "VendorAgreementAcceptance"("userId");
CREATE INDEX "VendorAgreementAcceptance_userId_idx" ON "VendorAgreementAcceptance"("userId");

ALTER TABLE "VendorAgreementAcceptance"
ADD CONSTRAINT "VendorAgreementAcceptance_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

import { ValidationError } from '../utils/errors';
import prisma from '../config/db';
import { VendorProfileMediaService } from './VendorProfileMediaService';
import { S3Service } from './S3Service';
import {
  clearVendorAdminReviewNotes,
  getVendorOnboardingDetails,
  saveVendorAdminReviewNotes,
  saveVendorOnboardingDetails,
  VENDOR_DOCUMENT_FIELD_MAP,
  VendorAdminReviewNote,
  VendorDocumentKey
} from './vendorOnboardingStorage';

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const toNullableString = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNullableNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNullableBoolean = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return null;
};

const buildVendorProfileCoreData = (
  profileData: Record<string, unknown>,
  defaults: { shopName: string; ownerName: string }
) => {
  const shopName =
    toNullableString(profileData.shopName) ??
    toNullableString(profileData.businessName) ??
    defaults.shopName;
  const ownerName = toNullableString(profileData.ownerName) ?? defaults.ownerName;

  return {
    shopName,
    ownerName,
    businessName: toNullableString(profileData.businessName),
    businessType: toNullableString(profileData.businessType),
    gstNumber: toNullableString(profileData.gstNumber),
    address: toNullableString(profileData.address),
    city: toNullableString(profileData.city),
    state: toNullableString(profileData.state),
    pincode: toNullableString(profileData.pincode),
    phone: toNullableString(profileData.phone)
  };
};

const buildVendorBankData = (profileData: Record<string, unknown>) => ({
  accountHolder:
    toNullableString(profileData.accountHolder) ??
    toNullableString(profileData.bankAccountHolderName) ??
    null,
  bankName: toNullableString(profileData.bankName) ?? null,
  branchName: toNullableString(profileData.branchName) ?? null,
  accountNumber:
    toNullableString(profileData.accountNumber) ??
    toNullableString(profileData.bankAccountNumber) ??
    null,
  ifscCode:
    toNullableString(profileData.ifscCode) ??
    toNullableString(profileData.bankIfscCode) ??
    null,
  upiId: toNullableString(profileData.upiId) ?? null,
  payoutCycle: toNullableString(profileData.payoutCycle) ?? null
});

type VendorBankRecord = {
  accountHolder: string | null;
  bankName: string | null;
  branchName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  upiId: string | null;
  payoutCycle: string | null;
};

type VendorProfileExtraRecord = {
  tagline: string | null;
  rentalPolicyDays: number | null;
  defaultDepositPercent: number | null;
  lateFeePerDay: number | null;
  cancellationPolicyWindowHours: number | null;
  cleaningTurnaroundDays: number | null;
  bufferTime: number | null;
  maxRentalDays: number | null;
  minRentalDays: number | null;
  securityDepositMultiplier: number | null;
  autoCancellationHours: number | null;
  homeDeliveryApplicable: boolean | null;
  deliveryCharges: number | null;
  workingDays: string[] | null;
  openingTime: string | null;
  closingTime: string | null;
};


const VENDOR_AGREEMENT_FIELDS = [
  'ownershipDeclarationAccepted',
  'acceptPlatformTerms',
  'acceptCommissionAgreement',
  'acceptCancellationPolicy',
  'acceptDepositRules',
  'shopAgreeOrderHandlingResponsibility',
  'shopAgreeQualityStandards',
  'shopAgreeReturnHandling',
  'individualAgreePassiveOwnershipModel',
  'individualAgreePlatformPricingControl',
  'individualAgreeRevenueShare',
  'individualAgreeMaintenanceDeductionRules'
] as const;

type VendorAgreementField = (typeof VENDOR_AGREEMENT_FIELDS)[number];

type VendorAgreementRecord = Record<VendorAgreementField, boolean | null>;

const defaultVendorAgreementRecord = (): VendorAgreementRecord => ({
  ownershipDeclarationAccepted: null,
  acceptPlatformTerms: null,
  acceptCommissionAgreement: null,
  acceptCancellationPolicy: null,
  acceptDepositRules: null,
  shopAgreeOrderHandlingResponsibility: null,
  shopAgreeQualityStandards: null,
  shopAgreeReturnHandling: null,
  individualAgreePassiveOwnershipModel: null,
  individualAgreePlatformPricingControl: null,
  individualAgreeRevenueShare: null,
  individualAgreeMaintenanceDeductionRules: null
});

const normalizeVendorAgreementRecord = (
  source?: Record<string, unknown> | null
): VendorAgreementRecord => {
  const defaults = defaultVendorAgreementRecord();

  return VENDOR_AGREEMENT_FIELDS.reduce((acc, field) => {
    acc[field] = toNullableBoolean(source?.[field]) ?? defaults[field];
    return acc;
  }, {} as VendorAgreementRecord);
};

const hasVendorAgreementUpdates = (profileData: Record<string, unknown>) =>
  VENDOR_AGREEMENT_FIELDS.some((field) => hasOwn(profileData, field));

const hasVendorAgreementValue = (record: VendorAgreementRecord) =>
  VENDOR_AGREEMENT_FIELDS.some((field) => record[field] !== null);

const queryVendorAgreementRow = async (userIdBig: bigint) => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       "ownershipDeclarationAccepted",
       "acceptPlatformTerms",
       "acceptCommissionAgreement",
       "acceptCancellationPolicy",
       "acceptDepositRules",
       "shopAgreeOrderHandlingResponsibility",
       "shopAgreeQualityStandards",
       "shopAgreeReturnHandling",
       "individualAgreePassiveOwnershipModel",
       "individualAgreePlatformPricingControl",
       "individualAgreeRevenueShare",
       "individualAgreeMaintenanceDeductionRules"
     FROM "VendorAgreementAcceptance"
     WHERE "userId" = $1
     LIMIT 1`,
    userIdBig.toString()
  );

  return Array.isArray(rows) ? rows[0] ?? null : null;
};

const defaultVendorBankRecord = (): VendorBankRecord => ({
  accountHolder: null,
  bankName: null,
  branchName: null,
  accountNumber: null,
  ifscCode: null,
  upiId: null,
  payoutCycle: null
});

const defaultVendorProfileExtraRecord = (): VendorProfileExtraRecord => ({
  tagline: null,
  rentalPolicyDays: null,
  defaultDepositPercent: null,
  lateFeePerDay: null,
  cancellationPolicyWindowHours: null,
  cleaningTurnaroundDays: null,
  bufferTime: null,
  maxRentalDays: null,
  minRentalDays: null,
  securityDepositMultiplier: null,
  autoCancellationHours: null,
  homeDeliveryApplicable: false,
  deliveryCharges: 0,
  workingDays: null,
  openingTime: null,
  closingTime: null
});

const normalizeJsonStringArray = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        })()
      : value;

  const normalized = Array.isArray(parsed)
    ? parsed
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
    : [];

  return Array.isArray(parsed) || normalized.length > 0 ? normalized : null;
};

const normalizeVendorBankRecord = (
  source?: Record<string, unknown> | null
): VendorBankRecord => ({
  accountHolder: toNullableString(source?.accountHolder) ?? null,
  bankName: toNullableString(source?.bankName) ?? null,
  branchName: toNullableString(source?.branchName) ?? null,
  accountNumber: toNullableString(source?.accountNumber) ?? null,
  ifscCode: toNullableString(source?.ifscCode) ?? null,
  upiId: toNullableString(source?.upiId) ?? null,
  payoutCycle: toNullableString(source?.payoutCycle) ?? null
});

const normalizeVendorProfileExtraRecord = (
  source?: Record<string, unknown> | null
): VendorProfileExtraRecord => {
  const defaults = defaultVendorProfileExtraRecord();
  return {
    tagline: toNullableString(source?.tagline) ?? defaults.tagline,
    rentalPolicyDays: toNullableNumber(source?.rentalPolicyDays) ?? defaults.rentalPolicyDays,
    defaultDepositPercent:
      toNullableNumber(source?.defaultDepositPercent) ?? defaults.defaultDepositPercent,
    lateFeePerDay: toNullableNumber(source?.lateFeePerDay) ?? defaults.lateFeePerDay,
    cancellationPolicyWindowHours:
      toNullableNumber(source?.cancellationPolicyWindowHours) ??
      defaults.cancellationPolicyWindowHours,
    cleaningTurnaroundDays:
      toNullableNumber(source?.cleaningTurnaroundDays) ?? defaults.cleaningTurnaroundDays,
    bufferTime: toNullableNumber(source?.bufferTime) ?? defaults.bufferTime,
    maxRentalDays: toNullableNumber(source?.maxRentalDays) ?? defaults.maxRentalDays,
    minRentalDays: toNullableNumber(source?.minRentalDays) ?? defaults.minRentalDays,
    securityDepositMultiplier:
      toNullableNumber(source?.securityDepositMultiplier) ??
      defaults.securityDepositMultiplier,
    autoCancellationHours:
      toNullableNumber(source?.autoCancellationHours) ?? defaults.autoCancellationHours,
    homeDeliveryApplicable:
      toNullableBoolean(source?.homeDeliveryApplicable) ?? defaults.homeDeliveryApplicable,
    deliveryCharges: toNullableNumber(source?.deliveryCharges) ?? defaults.deliveryCharges,
    workingDays: normalizeJsonStringArray(source?.workingDays),
    openingTime: toNullableString(source?.openingTime) ?? defaults.openingTime,
    closingTime: toNullableString(source?.closingTime) ?? defaults.closingTime
  };
};

const hasVendorBankValue = (record: VendorBankRecord) =>
  Object.values(record).some((value) => value !== null);

const hasVendorProfileExtraValue = (record: VendorProfileExtraRecord) =>
  Boolean(
    record.tagline ||
      record.rentalPolicyDays !== null ||
      record.defaultDepositPercent !== null ||
      record.lateFeePerDay !== null ||
      record.cancellationPolicyWindowHours !== null ||
      record.cleaningTurnaroundDays !== null ||
      record.bufferTime !== null ||
      record.maxRentalDays !== null ||
      record.minRentalDays !== null ||
      record.securityDepositMultiplier !== null ||
      record.autoCancellationHours !== null ||
      record.homeDeliveryApplicable !== null ||
      record.deliveryCharges !== null ||
      (record.workingDays && record.workingDays.length > 0) ||
      record.openingTime ||
      record.closingTime
  );

const queryVendorRegistrationDetailRow = async (userIdBig: bigint) => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT *
     FROM "VendorRegistrationDetail"
     WHERE "userId" = $1
     LIMIT 1`,
    userIdBig.toString()
  );

  return Array.isArray(rows) ? rows[0] ?? null : null;
};

const upsertVendorRegistrationBankDetails = async (
  userIdBig: bigint,
  bankDetails: VendorBankRecord
) => {
  await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "VendorRegistrationDetail" (
       "userId",
       "accountHolder",
       "bankName",
       "branchName",
       "accountNumber",
       "ifscCode",
       "upiId",
       "payoutCycle"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8
     )
     ON CONFLICT ("userId") DO UPDATE SET
       "accountHolder" = EXCLUDED."accountHolder",
       "bankName" = EXCLUDED."bankName",
       "branchName" = EXCLUDED."branchName",
       "accountNumber" = EXCLUDED."accountNumber",
       "ifscCode" = EXCLUDED."ifscCode",
       "upiId" = EXCLUDED."upiId",
       "payoutCycle" = EXCLUDED."payoutCycle",
       "updatedAt" = CURRENT_TIMESTAMP`,
    userIdBig.toString(),
    bankDetails.accountHolder,
    bankDetails.bankName,
    bankDetails.branchName,
    bankDetails.accountNumber,
    bankDetails.ifscCode,
    bankDetails.upiId,
    bankDetails.payoutCycle
  );
};

const syncVendorProfileBankColumns = async (
  userIdBig: bigint,
  bankDetails: VendorBankRecord
) => {
  await prisma.vendorProfile.updateMany({
    where: { userId: userIdBig },
    data: {
      accountHolder: bankDetails.accountHolder,
      bankName: bankDetails.bankName,
      accountNumber: bankDetails.accountNumber,
      ifscCode: bankDetails.ifscCode,
      payoutCycle: bankDetails.payoutCycle
    }
  });
};

const saveVendorBankDetails = async (
  userId: string,
  profileData: Record<string, unknown>
) => {
  const userIdBig = BigInt(userId);
  const row = await queryVendorRegistrationDetailRow(userIdBig);
  const registrationDetailBank = normalizeVendorBankRecord(row);
  const vendorProfile = await prisma.vendorProfile.findFirst({
    where: { userId: userIdBig },
    select: {
      accountHolder: true,
      bankName: true,
      accountNumber: true,
      ifscCode: true,
      payoutCycle: true
    }
  });
  const vendorProfileBank = normalizeVendorBankRecord(vendorProfile as any);

  const existing: VendorBankRecord = {
    accountHolder:
      registrationDetailBank.accountHolder ??
      vendorProfileBank.accountHolder ??
      null,
    bankName:
      registrationDetailBank.bankName ??
      vendorProfileBank.bankName ??
      null,
    branchName: registrationDetailBank.branchName ?? null,
    accountNumber:
      registrationDetailBank.accountNumber ??
      vendorProfileBank.accountNumber ??
      null,
    ifscCode:
      registrationDetailBank.ifscCode ??
      vendorProfileBank.ifscCode ??
      null,
    upiId: registrationDetailBank.upiId ?? null,
    payoutCycle:
      registrationDetailBank.payoutCycle ??
      vendorProfileBank.payoutCycle ??
      null
  };

  const nextRecord: VendorBankRecord = {
    accountHolder: hasOwn(profileData, 'accountHolder')
      ? toNullableString(profileData.accountHolder) ?? null
      : hasOwn(profileData, 'bankAccountHolderName')
        ? toNullableString(profileData.bankAccountHolderName) ?? null
        : existing.accountHolder,
    bankName: hasOwn(profileData, 'bankName')
      ? toNullableString(profileData.bankName) ?? null
      : existing.bankName,
    branchName: hasOwn(profileData, 'branchName')
      ? toNullableString(profileData.branchName) ?? null
      : existing.branchName,
    accountNumber: hasOwn(profileData, 'accountNumber')
      ? toNullableString(profileData.accountNumber) ?? null
      : hasOwn(profileData, 'bankAccountNumber')
        ? toNullableString(profileData.bankAccountNumber) ?? null
        : existing.accountNumber,
    ifscCode: hasOwn(profileData, 'ifscCode')
      ? toNullableString(profileData.ifscCode) ?? null
      : hasOwn(profileData, 'bankIfscCode')
        ? toNullableString(profileData.bankIfscCode) ?? null
        : existing.ifscCode,
    upiId: hasOwn(profileData, 'upiId')
      ? toNullableString(profileData.upiId) ?? null
      : existing.upiId,
    payoutCycle: hasOwn(profileData, 'payoutCycle')
      ? toNullableString(profileData.payoutCycle) ?? null
      : existing.payoutCycle
  };

  await syncVendorProfileBankColumns(userIdBig, nextRecord);
  await upsertVendorRegistrationBankDetails(userIdBig, nextRecord);
  return nextRecord;
};

const getVendorBankDetails = async (userId: string) => {
  const userIdBig = BigInt(userId);
  const row = await queryVendorRegistrationDetailRow(userIdBig);
  const vendorProfile = await prisma.vendorProfile.findFirst({
    where: { userId: userIdBig },
    select: {
      accountHolder: true,
      bankName: true,
      accountNumber: true,
      ifscCode: true,
      payoutCycle: true
    }
  });

  const registrationDetailBank = normalizeVendorBankRecord(row);
  const vendorProfileBank = normalizeVendorBankRecord(vendorProfile as any);
  return {
    accountHolder:
      registrationDetailBank.accountHolder ??
      vendorProfileBank.accountHolder ??
      null,
    bankName:
      registrationDetailBank.bankName ??
      vendorProfileBank.bankName ??
      null,
    branchName: registrationDetailBank.branchName ?? null,
    accountNumber:
      registrationDetailBank.accountNumber ??
      vendorProfileBank.accountNumber ??
      null,
    ifscCode:
      registrationDetailBank.ifscCode ??
      vendorProfileBank.ifscCode ??
      null,
    upiId: registrationDetailBank.upiId ?? null,
    payoutCycle:
      registrationDetailBank.payoutCycle ??
      vendorProfileBank.payoutCycle ??
      null
  };
};

const upsertVendorRegistrationProfileExtras = async (
  userIdBig: bigint,
  profileExtras: VendorProfileExtraRecord
) => {
  await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "VendorRegistrationDetail" (
       "userId",
       "tagline",
       "rentalPolicyDays",
       "defaultDepositPercent",
       "lateFeePerDay",
       "cancellationPolicyWindowHours",
       "cleaningTurnaroundDays",
       "bufferTime",
       "maxRentalDays",
       "minRentalDays",
       "securityDepositMultiplier",
       "autoCancellationHours",
       "homeDeliveryApplicable",
       "deliveryCharges",
       "workingDays",
       "openingTime",
       "closingTime"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       CAST($15 AS jsonb),
       $16, $17
     )
     ON CONFLICT ("userId") DO UPDATE SET
       "tagline" = EXCLUDED."tagline",
       "rentalPolicyDays" = EXCLUDED."rentalPolicyDays",
       "defaultDepositPercent" = EXCLUDED."defaultDepositPercent",
       "lateFeePerDay" = EXCLUDED."lateFeePerDay",
       "cancellationPolicyWindowHours" = EXCLUDED."cancellationPolicyWindowHours",
       "cleaningTurnaroundDays" = EXCLUDED."cleaningTurnaroundDays",
       "bufferTime" = EXCLUDED."bufferTime",
       "maxRentalDays" = EXCLUDED."maxRentalDays",
       "minRentalDays" = EXCLUDED."minRentalDays",
       "securityDepositMultiplier" = EXCLUDED."securityDepositMultiplier",
       "autoCancellationHours" = EXCLUDED."autoCancellationHours",
       "homeDeliveryApplicable" = EXCLUDED."homeDeliveryApplicable",
       "deliveryCharges" = EXCLUDED."deliveryCharges",
       "workingDays" = EXCLUDED."workingDays",
       "openingTime" = EXCLUDED."openingTime",
       "closingTime" = EXCLUDED."closingTime",
       "updatedAt" = CURRENT_TIMESTAMP`,
    userIdBig.toString(),
    profileExtras.tagline,
    profileExtras.rentalPolicyDays,
    profileExtras.defaultDepositPercent,
    profileExtras.lateFeePerDay,
    profileExtras.cancellationPolicyWindowHours,
    profileExtras.cleaningTurnaroundDays,
    profileExtras.bufferTime,
    profileExtras.maxRentalDays,
    profileExtras.minRentalDays,
    profileExtras.securityDepositMultiplier,
    profileExtras.autoCancellationHours,
    profileExtras.homeDeliveryApplicable,
    profileExtras.deliveryCharges,
    JSON.stringify(profileExtras.workingDays || []),
    profileExtras.openingTime,
    profileExtras.closingTime
  );
};

const saveVendorProfileExtras = async (
  userId: string,
  profileData: Record<string, unknown>
) => {
  const userIdBig = BigInt(userId);
  const row = await queryVendorRegistrationDetailRow(userIdBig);
  const registrationDetailExtras = normalizeVendorProfileExtraRecord(row);
  const existing: VendorProfileExtraRecord = {
    tagline: registrationDetailExtras.tagline ?? null,
    rentalPolicyDays: registrationDetailExtras.rentalPolicyDays ?? null,
    defaultDepositPercent: registrationDetailExtras.defaultDepositPercent ?? null,
    lateFeePerDay: registrationDetailExtras.lateFeePerDay ?? null,
    cancellationPolicyWindowHours:
      registrationDetailExtras.cancellationPolicyWindowHours ?? null,
    cleaningTurnaroundDays:
      registrationDetailExtras.cleaningTurnaroundDays ?? null,
    bufferTime: registrationDetailExtras.bufferTime ?? null,
    maxRentalDays: registrationDetailExtras.maxRentalDays ?? null,
    minRentalDays: registrationDetailExtras.minRentalDays ?? null,
    securityDepositMultiplier:
      registrationDetailExtras.securityDepositMultiplier ?? null,
    autoCancellationHours: registrationDetailExtras.autoCancellationHours ?? null,
    homeDeliveryApplicable:
      registrationDetailExtras.homeDeliveryApplicable ?? false,
    deliveryCharges: registrationDetailExtras.deliveryCharges ?? 0,
    workingDays: registrationDetailExtras.workingDays ?? null,
    openingTime: registrationDetailExtras.openingTime ?? null,
    closingTime: registrationDetailExtras.closingTime ?? null
  };

  const rentalPolicyDays = toNullableNumber(profileData.rentalPolicyDays);
  const defaultDepositPercent = toNullableNumber(profileData.defaultDepositPercent);
  const lateFeePerDay = toNullableNumber(profileData.lateFeePerDay);
  const cancellationPolicyWindowHours = toNullableNumber(profileData.cancellationPolicyWindowHours);
  const cleaningTurnaroundDays = toNullableNumber(
    profileData.cleaningTurnaroundDays ?? profileData.cleaningBufferDuration
  );
  const bufferTime = toNullableNumber(
    profileData.bufferTime ?? profileData.cleaningBufferDuration
  );
  const maxRentalDays = toNullableNumber(profileData.maxRentalDays);
  const minRentalDays = toNullableNumber(profileData.minRentalDays);
  const securityDepositMultiplier = toNullableNumber(profileData.securityDepositMultiplier);
  const autoCancellationHours = toNullableNumber(profileData.autoCancellationHours);
  const homeDeliveryApplicable = toNullableBoolean(
    profileData.homeDeliveryApplicable ?? profileData.homeDeliveryAvailable
  );
  const deliveryChargesInput = toNullableNumber(profileData.deliveryCharges);
  const deliveryCharges =
    deliveryChargesInput === null ? null : Math.max(0, deliveryChargesInput);
  const defaultRentalDuration = toNullableNumber(profileData.defaultRentalDuration);
  const workingDays = Array.isArray(profileData.workingDays)
    ? (profileData.workingDays.length > 0 
        ? profileData.workingDays.filter((day: unknown) => typeof day === 'string')
        : [])
    : null;
  const openingTime =
    toNullableString(profileData.openingTime) ??
    toNullableString(profileData.operatingHours);
  const closingTime = toNullableString(profileData.closingTime);

  const nextRecord: VendorProfileExtraRecord = {
    tagline: toNullableString(profileData.tagline) ?? existing?.tagline ?? null,
    rentalPolicyDays:
      rentalPolicyDays ?? defaultRentalDuration ?? existing?.rentalPolicyDays ?? null,
    defaultDepositPercent: defaultDepositPercent ?? existing?.defaultDepositPercent ?? null,
    lateFeePerDay: lateFeePerDay ?? existing?.lateFeePerDay ?? null,
    cancellationPolicyWindowHours:
      cancellationPolicyWindowHours ?? existing?.cancellationPolicyWindowHours ?? null,
    cleaningTurnaroundDays: cleaningTurnaroundDays ?? existing?.cleaningTurnaroundDays ?? null,
    bufferTime: bufferTime ?? existing?.bufferTime ?? null,
    maxRentalDays: maxRentalDays ?? existing?.maxRentalDays ?? null,
    minRentalDays: minRentalDays ?? existing?.minRentalDays ?? null,
    securityDepositMultiplier: securityDepositMultiplier ?? existing?.securityDepositMultiplier ?? null,
    autoCancellationHours: autoCancellationHours ?? existing?.autoCancellationHours ?? null,
    homeDeliveryApplicable: homeDeliveryApplicable ?? existing?.homeDeliveryApplicable ?? false,
    deliveryCharges: deliveryCharges ?? existing?.deliveryCharges ?? 0,
    workingDays: workingDays !== null ? workingDays : (existing?.workingDays ?? null),
    openingTime: openingTime ?? existing?.openingTime ?? null,
    closingTime: closingTime ?? existing?.closingTime ?? null
  };

  await upsertVendorRegistrationProfileExtras(userIdBig, nextRecord);
  return nextRecord;
};

const getVendorProfileExtras = async (userId: string) => {
  const row = await queryVendorRegistrationDetailRow(BigInt(userId));
  return normalizeVendorProfileExtraRecord(row);
};

const saveVendorAgreementDetails = async (
  userId: string,
  profileData: Record<string, unknown>
) => {
  if (!hasVendorAgreementUpdates(profileData)) {
    return defaultVendorAgreementRecord();
  }

  let userIdBig: bigint;
  try {
    userIdBig = BigInt(userId);
  } catch {
    return defaultVendorAgreementRecord();
  }

  try {
    const existingRow = await queryVendorAgreementRow(userIdBig);
    const existingRecord = normalizeVendorAgreementRecord(existingRow);
    const nextRecord = VENDOR_AGREEMENT_FIELDS.reduce((acc, field) => {
      acc[field] = hasOwn(profileData, field)
        ? toNullableBoolean(profileData[field])
        : existingRecord[field];
      return acc;
    }, {} as VendorAgreementRecord);

    await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "VendorAgreementAcceptance" (
         "userId",
         "ownershipDeclarationAccepted",
         "acceptPlatformTerms",
         "acceptCommissionAgreement",
         "acceptCancellationPolicy",
         "acceptDepositRules",
         "shopAgreeOrderHandlingResponsibility",
         "shopAgreeQualityStandards",
         "shopAgreeReturnHandling",
         "individualAgreePassiveOwnershipModel",
         "individualAgreePlatformPricingControl",
         "individualAgreeRevenueShare",
         "individualAgreeMaintenanceDeductionRules"
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       )
       ON CONFLICT ("userId") DO UPDATE SET
         "ownershipDeclarationAccepted" = EXCLUDED."ownershipDeclarationAccepted",
         "acceptPlatformTerms" = EXCLUDED."acceptPlatformTerms",
         "acceptCommissionAgreement" = EXCLUDED."acceptCommissionAgreement",
         "acceptCancellationPolicy" = EXCLUDED."acceptCancellationPolicy",
         "acceptDepositRules" = EXCLUDED."acceptDepositRules",
         "shopAgreeOrderHandlingResponsibility" = EXCLUDED."shopAgreeOrderHandlingResponsibility",
         "shopAgreeQualityStandards" = EXCLUDED."shopAgreeQualityStandards",
         "shopAgreeReturnHandling" = EXCLUDED."shopAgreeReturnHandling",
         "individualAgreePassiveOwnershipModel" = EXCLUDED."individualAgreePassiveOwnershipModel",
         "individualAgreePlatformPricingControl" = EXCLUDED."individualAgreePlatformPricingControl",
         "individualAgreeRevenueShare" = EXCLUDED."individualAgreeRevenueShare",
         "individualAgreeMaintenanceDeductionRules" = EXCLUDED."individualAgreeMaintenanceDeductionRules",
         "updatedAt" = CURRENT_TIMESTAMP`,
      userIdBig.toString(),
      nextRecord.ownershipDeclarationAccepted,
      nextRecord.acceptPlatformTerms,
      nextRecord.acceptCommissionAgreement,
      nextRecord.acceptCancellationPolicy,
      nextRecord.acceptDepositRules,
      nextRecord.shopAgreeOrderHandlingResponsibility,
      nextRecord.shopAgreeQualityStandards,
      nextRecord.shopAgreeReturnHandling,
      nextRecord.individualAgreePassiveOwnershipModel,
      nextRecord.individualAgreePlatformPricingControl,
      nextRecord.individualAgreeRevenueShare,
      nextRecord.individualAgreeMaintenanceDeductionRules
    );

    return nextRecord;
  } catch (error) {
    if (isMissingTableError(error) || isDatabaseUnavailableError(error)) {
      return normalizeVendorAgreementRecord(profileData);
    }
    throw error;
  }
};

const getVendorAgreementDetails = async (
  userId: string,
  fallbackSource?: Record<string, unknown> | null
) => {
  const fallbackRecord = normalizeVendorAgreementRecord(fallbackSource);

  let userIdBig: bigint;
  try {
    userIdBig = BigInt(userId);
  } catch {
    return fallbackRecord;
  }

  try {
    const row = await queryVendorAgreementRow(userIdBig);
    if (row) {
      return normalizeVendorAgreementRecord(row);
    }

    if (hasVendorAgreementValue(fallbackRecord)) {
      await saveVendorAgreementDetails(
        userId,
        fallbackRecord as unknown as Record<string, unknown>
      );
    }
  } catch (error) {
    if (!isMissingTableError(error) && !isDatabaseUnavailableError(error)) {
      throw error;
    }
  }

  return fallbackRecord;
};

const mergeBankDetails = async <T extends Record<string, unknown>>(
  userId: string,
  profile: T
) => {
  const bankDetails = await getVendorBankDetails(userId);
  const onboardingDetails = await getVendorOnboardingDetails(userId);
  const onboardingDocumentUrlKeys = [
    'shopLogoUrl',
    'idProofUrl',
    'selfieUrl',
    'businessProofUrl',
    'storeInteriorPhotoUrl',
    'storeExteriorPhotoUrl',
    'outfitImageUrl'
  ] as const;
  const accessibleOnboardingDetails = { ...onboardingDetails } as Record<string, unknown>;

  await Promise.all(
    onboardingDocumentUrlKeys.map(async (key) => {
      const rawValue = typeof onboardingDetails?.[key] === 'string'
        ? String(onboardingDetails[key] || '').trim()
        : '';
      if (!rawValue) return;
      accessibleOnboardingDetails[key] = await S3Service.getAccessibleImageUrl(rawValue);
    })
  );

  const agreementDetails = await getVendorAgreementDetails(userId, onboardingDetails as any);
  const profileExtras = await getVendorProfileExtras(userId);
  const profileImageUrl = await VendorProfileMediaService.getProfileImage(userId);
  return {
    ...profile,
    ...bankDetails,
    ...accessibleOnboardingDetails,
    ...agreementDetails,
    ...profileExtras,
    profileImageUrl
  };
};

const ensureVendorProfileRecord = async (
  userId: string,
  profileData?: Record<string, unknown>
) => {
  const userIdBig = BigInt(userId);
  const existing = await prisma.vendorProfile.findFirst({
    where: { userId: userIdBig },
    include: { user: true }
  });

  if (existing) {
    return existing;
  }

  const user = await prisma.user.findUnique({
    where: { id: userIdBig },
    select: { id: true, name: true }
  });

  if (!user) {
    throw new ValidationError('Vendor user not found');
  }

  const defaults = {
    shopName:
      toNullableString(profileData?.shopName) ??
      toNullableString(profileData?.businessName) ??
      user.name?.trim() ??
      'My Store',
    ownerName:
      toNullableString(profileData?.ownerName) ??
      user.name?.trim() ??
      'Owner'
  };

  return prisma.vendorProfile.create({
    data: {
      userId: userIdBig,
      ...buildVendorProfileCoreData(profileData || {}, defaults)
    },
    include: { user: true }
  });
};

const isDatabaseUnavailableError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("can't reach database server") ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('prepared statement')
  );
};

const isMissingColumnError = (error: unknown) => {
  const code = (error as any)?.code;
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return code === 'P2022' || message.includes('does not exist in the current database');
};

const isMissingTableError = (error: unknown) => {
  const code = (error as any)?.code;
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return code === 'P2021' || (message.includes('relation') && message.includes('does not exist'));
};

export const VendorProfileService = {
  async getApplicationStatus(userId: string) {
    const profile = await VendorProfileService.getProfile(userId);
    const onboardingStatus = String((profile as any)?.user?.onboardingStatus || 'PENDING').toUpperCase();
    const onboardingDetails = await getVendorOnboardingDetails(userId);

    const status =
      onboardingStatus === 'APPROVED'
        ? 'approved'
        : onboardingStatus === 'REJECTED'
          ? 'rejected'
          : 'pending';

    const adminNotes = (onboardingDetails.adminReviewNotes || []).map(note => ({
      id: note.id,
      documentKey: note.documentKey,
      documentLabel: note.documentLabel,
      message: note.message,
      adminName: note.adminName || undefined,
      createdAt: note.createdAt
    }));

    const flaggedDocuments = (onboardingDetails.adminReviewNotes || []).map(note => {
      const fieldConfig = VENDOR_DOCUMENT_FIELD_MAP[note.documentKey];
      return {
        documentKey: note.documentKey,
        documentLabel: note.documentLabel,
        message: note.message,
        adminName: note.adminName || undefined,
        currentDocumentUrl: fieldConfig ? ((onboardingDetails as any)[fieldConfig.urlField] || '') : ''
      };
    });

    const flaggedDocumentsWithAccessibleUrls = await Promise.all(
      flaggedDocuments.map(async document => ({
        ...document,
        currentDocumentUrl: document.currentDocumentUrl
          ? await S3Service.getAccessibleImageUrl(document.currentDocumentUrl)
          : ''
      }))
    );

    return {
      status,
      onboardingStatus,
      shopName: String((profile as any)?.shopName || (profile as any)?.businessName || (profile as any)?.ownerName || ''),
      adminNotes,
      flaggedDocuments: flaggedDocumentsWithAccessibleUrls,
      lastReviewRequestedAt: onboardingDetails.lastReviewRequestedAt || null,
      lastResubmittedAt: onboardingDetails.lastResubmittedAt || null,
      canAccessDashboard: onboardingStatus === 'APPROVED'
    };
  },

  async getOperationalSettings(userId: string) {
    const profileExtras = await getVendorProfileExtras(userId);

    return {
      lateFeePerDay: Math.max(0, Number(profileExtras.lateFeePerDay || 0)),
      homeDeliveryApplicable:
        profileExtras.homeDeliveryApplicable === true,
      deliveryCharges: Math.max(0, Number(profileExtras.deliveryCharges || 0))
    };
  },

  async getOperationalSettingsByVendorProfileId(vendorProfileId: bigint) {
    const vendor = await prisma.vendorProfile.findUnique({
      where: { id: vendorProfileId },
      select: { userId: true }
    });

    if (!vendor?.userId) {
      return {
        lateFeePerDay: 0,
        homeDeliveryApplicable: false,
        deliveryCharges: 0
      };
    }

    return VendorProfileService.getOperationalSettings(String(vendor.userId));
  },

  async createProfile(userId: string, profileData: any) {
    const existingProfile = await prisma.vendorProfile.findFirst({
      where: { userId: BigInt(userId) }
    });

    if (existingProfile) throw new ValidationError('Vendor profile already exists');

    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { name: true }
    });

    const defaults = {
      shopName: user?.name?.trim() || 'My Store',
      ownerName: user?.name?.trim() || 'Owner'
    };

    const profile = await prisma.vendorProfile.create({
      data: {
        userId: BigInt(userId),
        ...buildVendorProfileCoreData(profileData, defaults)
      }
    });

    await saveVendorBankDetails(userId, profileData);
    await saveVendorProfileExtras(userId, profileData);
    await saveVendorOnboardingDetails(userId, profileData);
    await saveVendorAgreementDetails(userId, profileData);

    return mergeBankDetails(userId, profile);
  },

  async getProfile(userId: string) {
    let userIdBig: bigint;
    try {
      userIdBig = BigInt(userId);
    } catch {
      throw new ValidationError('Invalid user ID');
    }

    const profile = await ensureVendorProfileRecord(userId);
    return mergeBankDetails(userId, profile);
  },

  async updateProfile(userId: string, updateData: any) {
    const profile = await ensureVendorProfileRecord(userId, updateData);
    const defaults = {
      shopName: profile.shopName || profile.user?.name?.trim() || 'My Store',
      ownerName: profile.ownerName || profile.user?.name?.trim() || 'Owner'
    };

    const updated = await prisma.vendorProfile.update({
      where: { id: profile.id },
      data: buildVendorProfileCoreData(updateData, defaults)
    });

    await saveVendorBankDetails(userId, updateData);
    await saveVendorProfileExtras(userId, updateData);
    await saveVendorOnboardingDetails(userId, updateData);
    await saveVendorAgreementDetails(userId, updateData);

    return mergeBankDetails(userId, updated);
  },

  async requestDocumentResubmission(
    vendorId: string,
    reviewNotes: Array<{
      documentKey: string;
      message: string;
      adminName?: string | null;
    }>
  ) {
    const normalizedNotes: VendorAdminReviewNote[] = reviewNotes
      .map(note => {
        const documentKey = String(note.documentKey || '').trim() as VendorDocumentKey;
        const fieldConfig = VENDOR_DOCUMENT_FIELD_MAP[documentKey];
        const message = String(note.message || '').trim();

        if (!fieldConfig || !message) {
          return null;
        }

        return {
          id: `${documentKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          documentKey,
          documentLabel: fieldConfig.documentLabel,
          message,
          adminName: note.adminName ? String(note.adminName) : null,
          createdAt: new Date().toISOString()
        };
      })
      .filter((note): note is VendorAdminReviewNote => Boolean(note));

    if (normalizedNotes.length === 0) {
      throw new ValidationError('At least one document issue is required');
    }

    await saveVendorAdminReviewNotes(vendorId, normalizedNotes);
    await prisma.user.update({
      where: { id: BigInt(vendorId) },
      data: { onboardingStatus: 'REJECTED' as any }
    });

    return VendorProfileService.getApplicationStatus(vendorId);
  },

  async resubmitDocuments(
    userId: string,
    filesByDocumentKey: Partial<Record<VendorDocumentKey, Express.Multer.File>>
  ) {
    const onboardingDetails = await getVendorOnboardingDetails(userId);
    const requiredDocumentKeys = Array.from(
      new Set(
        (onboardingDetails.adminReviewNotes || []).map(note => note.documentKey)
      )
    );

    if (requiredDocumentKeys.length === 0) {
      throw new ValidationError('No document resubmission is currently required');
    }

    const missingDocumentKeys = requiredDocumentKeys.filter(key => !filesByDocumentKey[key]);
    if (missingDocumentKeys.length > 0) {
      throw new ValidationError('Please upload all requested documents before submitting');
    }

    const uploadedFieldData: Record<string, string> = {};

    for (const documentKey of requiredDocumentKeys) {
      const file = filesByDocumentKey[documentKey];
      const fieldConfig = VENDOR_DOCUMENT_FIELD_MAP[documentKey];
      if (!file || !fieldConfig) continue;

      const uploadedUrl = await S3Service.uploadDocument(file, 'vendor-onboarding');
      uploadedFieldData[String(fieldConfig.fileNameField)] = file.originalname;
      uploadedFieldData[String(fieldConfig.urlField)] = uploadedUrl;
    }

    await VendorProfileService.updateProfile(userId, uploadedFieldData);
    await clearVendorAdminReviewNotes(userId, { markResubmitted: true });
    await prisma.user.update({
      where: { id: BigInt(userId) },
      data: { onboardingStatus: 'PENDING' as any }
    });

    return VendorProfileService.getApplicationStatus(userId);
  }
};

import prisma from '../config/db';

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const toNullableString = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
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

const toStringArray = (value: unknown) => {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return Array.from(
    new Set(
      rawItems
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
    )
  );
};

const toNullableIsoString = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const parseJsonValue = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
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

const isMissingTableError = (error: unknown) => {
  const code = (error as any)?.code;
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return code === 'P2021' || (message.includes('relation') && message.includes('does not exist'));
};

export type VendorDocumentKey =
  | 'shopLogo'
  | 'idProof'
  | 'selfie'
  | 'businessProof'
  | 'storeInteriorPhoto'
  | 'storeExteriorPhoto'
  | 'outfitImage';

export type VendorAdminReviewNote = {
  id: string;
  documentKey: VendorDocumentKey;
  documentLabel: string;
  message: string;
  adminName: string | null;
  createdAt: string;
};

export const VENDOR_DOCUMENT_FIELD_MAP: Record<
  VendorDocumentKey,
  {
    documentLabel: string;
    fileNameField: keyof VendorOnboardingRecord;
    urlField: keyof VendorOnboardingRecord;
  }
> = {
  shopLogo: {
    documentLabel: 'Shop Logo',
    fileNameField: 'shopLogoFileName',
    urlField: 'shopLogoUrl'
  },
  idProof: {
    documentLabel: 'ID Proof',
    fileNameField: 'idProofFileName',
    urlField: 'idProofUrl'
  },
  selfie: {
    documentLabel: 'Selfie / Photo',
    fileNameField: 'selfieFileName',
    urlField: 'selfieUrl'
  },
  businessProof: {
    documentLabel: 'Business Proof',
    fileNameField: 'businessProofFileName',
    urlField: 'businessProofUrl'
  },
  storeInteriorPhoto: {
    documentLabel: 'Store Interior Photo',
    fileNameField: 'storeInteriorPhotoFileName',
    urlField: 'storeInteriorPhotoUrl'
  },
  storeExteriorPhoto: {
    documentLabel: 'Store Exterior Photo',
    fileNameField: 'storeExteriorPhotoFileName',
    urlField: 'storeExteriorPhotoUrl'
  },
  outfitImage: {
    documentLabel: 'Outfit Image',
    fileNameField: 'outfitImageFileName',
    urlField: 'outfitImageUrl'
  }
};

export type VendorOnboardingRecord = {
  vendorCategory: string | null;
  shortBrandDescription: string | null;
  operatingHours: string | null;
  googleBusinessProfileUrl: string | null;
  yearsInBusiness: number | null;
  storeType: string | null;
  workingDays: string[];
  trialAvailability: boolean | null;
  homeDeliveryAvailable: boolean | null;
  alterationSupportAvailable: boolean | null;
  occupation: string | null;
  ownsMultipleOutfits: boolean | null;
  preferredPickupMethod: string | null;
  idProofType: string | null;
  shopLogoFileName: string | null;
  shopLogoUrl: string | null;
  idProofFileName: string | null;
  idProofUrl: string | null;
  selfieFileName: string | null;
  selfieUrl: string | null;
  businessProofFileName: string | null;
  businessProofUrl: string | null;
  storeInteriorPhotoFileName: string | null;
  storeInteriorPhotoUrl: string | null;
  storeExteriorPhotoFileName: string | null;
  storeExteriorPhotoUrl: string | null;
  outfitImageFileName: string | null;
  outfitImageUrl: string | null;
  ownershipDeclarationAccepted: boolean | null;
  digitalConsentName: string | null;
  shopOutfitCount: number | null;
  shopCategoriesAvailable: string[];
  shopTargetAudience: string[];
  shopSizeRanges: string[];
  shopMinRentalPrice: number | null;
  shopMaxRentalPrice: number | null;
  shopInventoryVolume: number | null;
  outfitCategory: string | null;
  outfitSize: string | null;
  outfitBrand: string | null;
  outfitCondition: string | null;
  outfitOriginalPrice: number | null;
  outfitAgeOrPurchaseYear: string | null;
  outfitAlterationSupportAvailable: boolean | null;
  expectedPriceRange: string | null;
  individualGeneralAlterationSupport: boolean | null;
  defaultRentalDuration: number | null;
  cleaningBufferDuration: number | null;
  acceptPlatformTerms: boolean | null;
  acceptCommissionAgreement: boolean | null;
  acceptCancellationPolicy: boolean | null;
  acceptDepositRules: boolean | null;
  shopAgreeOrderHandlingResponsibility: boolean | null;
  shopAgreeQualityStandards: boolean | null;
  shopAgreeReturnHandling: boolean | null;
  individualAgreePassiveOwnershipModel: boolean | null;
  individualAgreePlatformPricingControl: boolean | null;
  individualAgreeRevenueShare: boolean | null;
  individualAgreeMaintenanceDeductionRules: boolean | null;
  adminReviewNotes: VendorAdminReviewNote[];
  lastReviewRequestedAt: string | null;
  lastResubmittedAt: string | null;
};

type VendorOnboardingStore = Record<string, VendorOnboardingRecord>;

const defaultRecord = (): VendorOnboardingRecord => ({
  vendorCategory: null,
  shortBrandDescription: null,
  operatingHours: null,
  googleBusinessProfileUrl: null,
  yearsInBusiness: null,
  storeType: null,
  workingDays: [],
  trialAvailability: null,
  homeDeliveryAvailable: null,
  alterationSupportAvailable: null,
  occupation: null,
  ownsMultipleOutfits: null,
  preferredPickupMethod: null,
  idProofType: null,
  shopLogoFileName: null,
  shopLogoUrl: null,
  idProofFileName: null,
  idProofUrl: null,
  selfieFileName: null,
  selfieUrl: null,
  businessProofFileName: null,
  businessProofUrl: null,
  storeInteriorPhotoFileName: null,
  storeInteriorPhotoUrl: null,
  storeExteriorPhotoFileName: null,
  storeExteriorPhotoUrl: null,
  outfitImageFileName: null,
  outfitImageUrl: null,
  ownershipDeclarationAccepted: null,
  digitalConsentName: null,
  shopOutfitCount: null,
  shopCategoriesAvailable: [],
  shopTargetAudience: [],
  shopSizeRanges: [],
  shopMinRentalPrice: null,
  shopMaxRentalPrice: null,
  shopInventoryVolume: null,
  outfitCategory: null,
  outfitSize: null,
  outfitBrand: null,
  outfitCondition: null,
  outfitOriginalPrice: null,
  outfitAgeOrPurchaseYear: null,
  outfitAlterationSupportAvailable: null,
  expectedPriceRange: null,
  individualGeneralAlterationSupport: null,
  defaultRentalDuration: null,
  cleaningBufferDuration: null,
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
  individualAgreeMaintenanceDeductionRules: null,
  adminReviewNotes: [],
  lastReviewRequestedAt: null,
  lastResubmittedAt: null
});

const resolveString = (
  data: Record<string, unknown>,
  key: string,
  existing: string | null
) => (hasOwn(data, key) ? toNullableString(data[key]) : existing);

const resolveNumber = (
  data: Record<string, unknown>,
  key: string,
  existing: number | null
) => (hasOwn(data, key) ? toNullableNumber(data[key]) : existing);

const resolveBoolean = (
  data: Record<string, unknown>,
  key: string,
  existing: boolean | null
) => (hasOwn(data, key) ? toNullableBoolean(data[key]) : existing);

const resolveStringArray = (
  data: Record<string, unknown>,
  key: string,
  existing: string[]
) => (hasOwn(data, key) ? toStringArray(data[key]) : existing);

const normalizeVendorAdminReviewNotes = (value: unknown): VendorAdminReviewNote[] => {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as Record<string, unknown>;
      const documentKey = String(candidate.documentKey || '').trim() as VendorDocumentKey;
      const documentLabel = String(candidate.documentLabel || '').trim();
      const message = String(candidate.message || '').trim();
      const createdAt = toNullableIsoString(candidate.createdAt);
      if (!documentKey || !documentLabel || !message || !createdAt) {
        return null;
      }

      return {
        id: String(candidate.id || `${documentKey}-${createdAt}`),
        documentKey,
        documentLabel,
        message,
        adminName: toNullableString(candidate.adminName),
        createdAt
      };
    })
    .filter((note): note is VendorAdminReviewNote => Boolean(note));
};

const hasMeaningfulOnboardingData = (record: VendorOnboardingRecord) =>
  Boolean(
    record.vendorCategory ||
      record.shortBrandDescription ||
      record.operatingHours ||
      record.googleBusinessProfileUrl ||
      record.yearsInBusiness !== null ||
      record.storeType ||
      record.workingDays.length ||
      record.trialAvailability !== null ||
      record.homeDeliveryAvailable !== null ||
      record.alterationSupportAvailable !== null ||
      record.occupation ||
      record.ownsMultipleOutfits !== null ||
      record.preferredPickupMethod ||
      record.idProofType ||
      record.shopLogoFileName ||
      record.shopLogoUrl ||
      record.idProofFileName ||
      record.idProofUrl ||
      record.selfieFileName ||
      record.selfieUrl ||
      record.businessProofFileName ||
      record.businessProofUrl ||
      record.storeInteriorPhotoFileName ||
      record.storeInteriorPhotoUrl ||
      record.storeExteriorPhotoFileName ||
      record.storeExteriorPhotoUrl ||
      record.outfitImageFileName ||
      record.outfitImageUrl ||
      record.ownershipDeclarationAccepted !== null ||
      record.digitalConsentName ||
      record.shopOutfitCount !== null ||
      record.shopCategoriesAvailable.length ||
      record.shopTargetAudience.length ||
      record.shopSizeRanges.length ||
      record.shopMinRentalPrice !== null ||
      record.shopMaxRentalPrice !== null ||
      record.shopInventoryVolume !== null ||
      record.outfitCategory ||
      record.outfitSize ||
      record.outfitBrand ||
      record.outfitCondition ||
      record.outfitOriginalPrice !== null ||
      record.outfitAgeOrPurchaseYear ||
      record.outfitAlterationSupportAvailable !== null ||
      record.expectedPriceRange ||
      record.individualGeneralAlterationSupport !== null ||
      record.defaultRentalDuration !== null ||
      record.cleaningBufferDuration !== null ||
      record.acceptPlatformTerms !== null ||
      record.acceptCommissionAgreement !== null ||
      record.acceptCancellationPolicy !== null ||
      record.acceptDepositRules !== null ||
      record.shopAgreeOrderHandlingResponsibility !== null ||
      record.shopAgreeQualityStandards !== null ||
      record.shopAgreeReturnHandling !== null ||
      record.individualAgreePassiveOwnershipModel !== null ||
      record.individualAgreePlatformPricingControl !== null ||
      record.individualAgreeRevenueShare !== null ||
      record.individualAgreeMaintenanceDeductionRules !== null ||
      record.adminReviewNotes.length ||
      record.lastReviewRequestedAt ||
      record.lastResubmittedAt
  );

const normalizeDbRecord = (
  row: Record<string, unknown> | null | undefined,
  fallback?: VendorOnboardingRecord
): VendorOnboardingRecord => {
  const defaults = fallback || defaultRecord();

  return {
    vendorCategory: toNullableString(row?.vendorCategory) ?? defaults.vendorCategory,
    shortBrandDescription:
      toNullableString(row?.shortBrandDescription) ?? defaults.shortBrandDescription,
    operatingHours: toNullableString(row?.operatingHours) ?? defaults.operatingHours,
    googleBusinessProfileUrl:
      toNullableString(row?.googleBusinessProfileUrl) ?? defaults.googleBusinessProfileUrl,
    yearsInBusiness: toNullableNumber(row?.yearsInBusiness) ?? defaults.yearsInBusiness,
    storeType: toNullableString(row?.storeType) ?? defaults.storeType,
    workingDays:
      toStringArray(parseJsonValue(row?.workingDays)).length > 0 || Array.isArray(parseJsonValue(row?.workingDays))
        ? toStringArray(parseJsonValue(row?.workingDays))
        : defaults.workingDays,
    trialAvailability: toNullableBoolean(row?.trialAvailability) ?? defaults.trialAvailability,
    homeDeliveryAvailable:
      toNullableBoolean(row?.homeDeliveryAvailable) ?? defaults.homeDeliveryAvailable,
    alterationSupportAvailable:
      toNullableBoolean(row?.alterationSupportAvailable) ?? defaults.alterationSupportAvailable,
    occupation: toNullableString(row?.occupation) ?? defaults.occupation,
    ownsMultipleOutfits:
      toNullableBoolean(row?.ownsMultipleOutfits) ?? defaults.ownsMultipleOutfits,
    preferredPickupMethod:
      toNullableString(row?.preferredPickupMethod) ?? defaults.preferredPickupMethod,
    idProofType: toNullableString(row?.idProofType) ?? defaults.idProofType,
    shopLogoFileName: toNullableString(row?.shopLogoFileName) ?? defaults.shopLogoFileName,
    shopLogoUrl: toNullableString(row?.shopLogoUrl) ?? defaults.shopLogoUrl,
    idProofFileName: toNullableString(row?.idProofFileName) ?? defaults.idProofFileName,
    idProofUrl: toNullableString(row?.idProofUrl) ?? defaults.idProofUrl,
    selfieFileName: toNullableString(row?.selfieFileName) ?? defaults.selfieFileName,
    selfieUrl: toNullableString(row?.selfieUrl) ?? defaults.selfieUrl,
    businessProofFileName:
      toNullableString(row?.businessProofFileName) ?? defaults.businessProofFileName,
    businessProofUrl: toNullableString(row?.businessProofUrl) ?? defaults.businessProofUrl,
    storeInteriorPhotoFileName:
      toNullableString(row?.storeInteriorPhotoFileName) ??
      defaults.storeInteriorPhotoFileName,
    storeInteriorPhotoUrl:
      toNullableString(row?.storeInteriorPhotoUrl) ?? defaults.storeInteriorPhotoUrl,
    storeExteriorPhotoFileName:
      toNullableString(row?.storeExteriorPhotoFileName) ??
      defaults.storeExteriorPhotoFileName,
    storeExteriorPhotoUrl:
      toNullableString(row?.storeExteriorPhotoUrl) ?? defaults.storeExteriorPhotoUrl,
    outfitImageFileName:
      toNullableString(row?.outfitImageFileName) ?? defaults.outfitImageFileName,
    outfitImageUrl: toNullableString(row?.outfitImageUrl) ?? defaults.outfitImageUrl,
    ownershipDeclarationAccepted:
      toNullableBoolean(row?.ownershipDeclarationAccepted) ??
      defaults.ownershipDeclarationAccepted,
    digitalConsentName:
      toNullableString(row?.digitalConsentName) ?? defaults.digitalConsentName,
    shopOutfitCount: toNullableNumber(row?.shopOutfitCount) ?? defaults.shopOutfitCount,
    shopCategoriesAvailable:
      toStringArray(parseJsonValue(row?.shopCategoriesAvailable)).length > 0 ||
      Array.isArray(parseJsonValue(row?.shopCategoriesAvailable))
        ? toStringArray(parseJsonValue(row?.shopCategoriesAvailable))
        : defaults.shopCategoriesAvailable,
    shopTargetAudience:
      toStringArray(parseJsonValue(row?.shopTargetAudience)).length > 0 ||
      Array.isArray(parseJsonValue(row?.shopTargetAudience))
        ? toStringArray(parseJsonValue(row?.shopTargetAudience))
        : defaults.shopTargetAudience,
    shopSizeRanges:
      toStringArray(parseJsonValue(row?.shopSizeRanges)).length > 0 ||
      Array.isArray(parseJsonValue(row?.shopSizeRanges))
        ? toStringArray(parseJsonValue(row?.shopSizeRanges))
        : defaults.shopSizeRanges,
    shopMinRentalPrice:
      toNullableNumber(row?.shopMinRentalPrice) ?? defaults.shopMinRentalPrice,
    shopMaxRentalPrice:
      toNullableNumber(row?.shopMaxRentalPrice) ?? defaults.shopMaxRentalPrice,
    shopInventoryVolume:
      toNullableNumber(row?.shopInventoryVolume) ?? defaults.shopInventoryVolume,
    outfitCategory: toNullableString(row?.outfitCategory) ?? defaults.outfitCategory,
    outfitSize: toNullableString(row?.outfitSize) ?? defaults.outfitSize,
    outfitBrand: toNullableString(row?.outfitBrand) ?? defaults.outfitBrand,
    outfitCondition: toNullableString(row?.outfitCondition) ?? defaults.outfitCondition,
    outfitOriginalPrice:
      toNullableNumber(row?.outfitOriginalPrice) ?? defaults.outfitOriginalPrice,
    outfitAgeOrPurchaseYear:
      toNullableString(row?.outfitAgeOrPurchaseYear) ?? defaults.outfitAgeOrPurchaseYear,
    outfitAlterationSupportAvailable:
      toNullableBoolean(row?.outfitAlterationSupportAvailable) ??
      defaults.outfitAlterationSupportAvailable,
    expectedPriceRange:
      toNullableString(row?.expectedPriceRange) ?? defaults.expectedPriceRange,
    individualGeneralAlterationSupport:
      toNullableBoolean(row?.individualGeneralAlterationSupport) ??
      defaults.individualGeneralAlterationSupport,
    defaultRentalDuration:
      toNullableNumber(row?.defaultRentalDuration) ?? defaults.defaultRentalDuration,
    cleaningBufferDuration:
      toNullableNumber(row?.cleaningBufferDuration) ?? defaults.cleaningBufferDuration,
    acceptPlatformTerms:
      toNullableBoolean(row?.acceptPlatformTerms) ?? defaults.acceptPlatformTerms,
    acceptCommissionAgreement:
      toNullableBoolean(row?.acceptCommissionAgreement) ??
      defaults.acceptCommissionAgreement,
    acceptCancellationPolicy:
      toNullableBoolean(row?.acceptCancellationPolicy) ?? defaults.acceptCancellationPolicy,
    acceptDepositRules:
      toNullableBoolean(row?.acceptDepositRules) ?? defaults.acceptDepositRules,
    shopAgreeOrderHandlingResponsibility:
      toNullableBoolean(row?.shopAgreeOrderHandlingResponsibility) ??
      defaults.shopAgreeOrderHandlingResponsibility,
    shopAgreeQualityStandards:
      toNullableBoolean(row?.shopAgreeQualityStandards) ??
      defaults.shopAgreeQualityStandards,
    shopAgreeReturnHandling:
      toNullableBoolean(row?.shopAgreeReturnHandling) ?? defaults.shopAgreeReturnHandling,
    individualAgreePassiveOwnershipModel:
      toNullableBoolean(row?.individualAgreePassiveOwnershipModel) ??
      defaults.individualAgreePassiveOwnershipModel,
    individualAgreePlatformPricingControl:
      toNullableBoolean(row?.individualAgreePlatformPricingControl) ??
      defaults.individualAgreePlatformPricingControl,
    individualAgreeRevenueShare:
      toNullableBoolean(row?.individualAgreeRevenueShare) ??
      defaults.individualAgreeRevenueShare,
    individualAgreeMaintenanceDeductionRules:
      toNullableBoolean(row?.individualAgreeMaintenanceDeductionRules) ??
      defaults.individualAgreeMaintenanceDeductionRules,
    adminReviewNotes:
      normalizeVendorAdminReviewNotes(row?.adminReviewNotes).length > 0 ||
      Array.isArray(parseJsonValue(row?.adminReviewNotes))
        ? normalizeVendorAdminReviewNotes(row?.adminReviewNotes)
        : defaults.adminReviewNotes,
    lastReviewRequestedAt:
      toNullableIsoString(row?.lastReviewRequestedAt) ?? defaults.lastReviewRequestedAt,
    lastResubmittedAt:
      toNullableIsoString(row?.lastResubmittedAt) ?? defaults.lastResubmittedAt
  };
};

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

const upsertVendorRegistrationOnboardingRecord = async (
  userId: string,
  record: VendorOnboardingRecord,
  options?: {
    openingTime?: string | null;
  }
) => {
  const userIdBig = BigInt(userId);

  await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "VendorRegistrationDetail" (
       "userId",
       "vendorCategory",
       "shortBrandDescription",
       "operatingHours",
       "googleBusinessProfileUrl",
       "yearsInBusiness",
       "storeType",
       "workingDays",
       "trialAvailability",
       "homeDeliveryAvailable",
       "alterationSupportAvailable",
       "occupation",
       "ownsMultipleOutfits",
       "preferredPickupMethod",
       "idProofType",
       "shopLogoFileName",
       "shopLogoUrl",
       "idProofFileName",
       "idProofUrl",
       "selfieFileName",
       "selfieUrl",
       "businessProofFileName",
       "businessProofUrl",
       "storeInteriorPhotoFileName",
       "storeInteriorPhotoUrl",
       "storeExteriorPhotoFileName",
       "storeExteriorPhotoUrl",
       "outfitImageFileName",
       "outfitImageUrl",
       "ownershipDeclarationAccepted",
       "digitalConsentName",
       "shopOutfitCount",
       "shopCategoriesAvailable",
       "shopTargetAudience",
       "shopSizeRanges",
       "shopMinRentalPrice",
       "shopMaxRentalPrice",
       "shopInventoryVolume",
       "outfitCategory",
       "outfitSize",
       "outfitBrand",
       "outfitCondition",
       "outfitOriginalPrice",
       "outfitAgeOrPurchaseYear",
       "outfitAlterationSupportAvailable",
       "expectedPriceRange",
       "individualGeneralAlterationSupport",
       "defaultRentalDuration",
       "cleaningBufferDuration",
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
       "individualAgreeMaintenanceDeductionRules",
       "adminReviewNotes",
       "lastReviewRequestedAt",
       "lastResubmittedAt",
       "openingTime"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       CAST($8 AS jsonb),
       $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
       $24, $25, $26, $27, $28, $29, $30, $31, $32,
       CAST($33 AS jsonb),
       CAST($34 AS jsonb),
       CAST($35 AS jsonb),
       $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49,
       $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60,
       CAST($61 AS jsonb),
       $62, $63, $64
     )
     ON CONFLICT ("userId") DO UPDATE SET
       "vendorCategory" = EXCLUDED."vendorCategory",
       "shortBrandDescription" = EXCLUDED."shortBrandDescription",
       "operatingHours" = EXCLUDED."operatingHours",
       "googleBusinessProfileUrl" = EXCLUDED."googleBusinessProfileUrl",
       "yearsInBusiness" = EXCLUDED."yearsInBusiness",
       "storeType" = EXCLUDED."storeType",
       "workingDays" = EXCLUDED."workingDays",
       "trialAvailability" = EXCLUDED."trialAvailability",
       "homeDeliveryAvailable" = EXCLUDED."homeDeliveryAvailable",
       "alterationSupportAvailable" = EXCLUDED."alterationSupportAvailable",
       "occupation" = EXCLUDED."occupation",
       "ownsMultipleOutfits" = EXCLUDED."ownsMultipleOutfits",
       "preferredPickupMethod" = EXCLUDED."preferredPickupMethod",
       "idProofType" = EXCLUDED."idProofType",
       "shopLogoFileName" = EXCLUDED."shopLogoFileName",
       "shopLogoUrl" = EXCLUDED."shopLogoUrl",
       "idProofFileName" = EXCLUDED."idProofFileName",
       "idProofUrl" = EXCLUDED."idProofUrl",
       "selfieFileName" = EXCLUDED."selfieFileName",
       "selfieUrl" = EXCLUDED."selfieUrl",
       "businessProofFileName" = EXCLUDED."businessProofFileName",
       "businessProofUrl" = EXCLUDED."businessProofUrl",
       "storeInteriorPhotoFileName" = EXCLUDED."storeInteriorPhotoFileName",
       "storeInteriorPhotoUrl" = EXCLUDED."storeInteriorPhotoUrl",
       "storeExteriorPhotoFileName" = EXCLUDED."storeExteriorPhotoFileName",
       "storeExteriorPhotoUrl" = EXCLUDED."storeExteriorPhotoUrl",
       "outfitImageFileName" = EXCLUDED."outfitImageFileName",
       "outfitImageUrl" = EXCLUDED."outfitImageUrl",
       "ownershipDeclarationAccepted" = EXCLUDED."ownershipDeclarationAccepted",
       "digitalConsentName" = EXCLUDED."digitalConsentName",
       "shopOutfitCount" = EXCLUDED."shopOutfitCount",
       "shopCategoriesAvailable" = EXCLUDED."shopCategoriesAvailable",
       "shopTargetAudience" = EXCLUDED."shopTargetAudience",
       "shopSizeRanges" = EXCLUDED."shopSizeRanges",
       "shopMinRentalPrice" = EXCLUDED."shopMinRentalPrice",
       "shopMaxRentalPrice" = EXCLUDED."shopMaxRentalPrice",
       "shopInventoryVolume" = EXCLUDED."shopInventoryVolume",
       "outfitCategory" = EXCLUDED."outfitCategory",
       "outfitSize" = EXCLUDED."outfitSize",
       "outfitBrand" = EXCLUDED."outfitBrand",
       "outfitCondition" = EXCLUDED."outfitCondition",
       "outfitOriginalPrice" = EXCLUDED."outfitOriginalPrice",
       "outfitAgeOrPurchaseYear" = EXCLUDED."outfitAgeOrPurchaseYear",
       "outfitAlterationSupportAvailable" = EXCLUDED."outfitAlterationSupportAvailable",
       "expectedPriceRange" = EXCLUDED."expectedPriceRange",
       "individualGeneralAlterationSupport" = EXCLUDED."individualGeneralAlterationSupport",
       "defaultRentalDuration" = EXCLUDED."defaultRentalDuration",
       "cleaningBufferDuration" = EXCLUDED."cleaningBufferDuration",
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
       "adminReviewNotes" = EXCLUDED."adminReviewNotes",
       "lastReviewRequestedAt" = EXCLUDED."lastReviewRequestedAt",
       "lastResubmittedAt" = EXCLUDED."lastResubmittedAt",
       "openingTime" = EXCLUDED."openingTime",
       "updatedAt" = CURRENT_TIMESTAMP`,
    userIdBig.toString(),
    record.vendorCategory,
    record.shortBrandDescription,
    record.operatingHours,
    record.googleBusinessProfileUrl,
    record.yearsInBusiness,
    record.storeType,
    JSON.stringify(record.workingDays || []),
    record.trialAvailability,
    record.homeDeliveryAvailable,
    record.alterationSupportAvailable,
    record.occupation,
    record.ownsMultipleOutfits,
    record.preferredPickupMethod,
    record.idProofType,
    record.shopLogoFileName,
    record.shopLogoUrl,
    record.idProofFileName,
    record.idProofUrl,
    record.selfieFileName,
    record.selfieUrl,
    record.businessProofFileName,
    record.businessProofUrl,
    record.storeInteriorPhotoFileName,
    record.storeInteriorPhotoUrl,
    record.storeExteriorPhotoFileName,
    record.storeExteriorPhotoUrl,
    record.outfitImageFileName,
    record.outfitImageUrl,
    record.ownershipDeclarationAccepted,
    record.digitalConsentName,
    record.shopOutfitCount,
    JSON.stringify(record.shopCategoriesAvailable || []),
    JSON.stringify(record.shopTargetAudience || []),
    JSON.stringify(record.shopSizeRanges || []),
    record.shopMinRentalPrice,
    record.shopMaxRentalPrice,
    record.shopInventoryVolume,
    record.outfitCategory,
    record.outfitSize,
    record.outfitBrand,
    record.outfitCondition,
    record.outfitOriginalPrice,
    record.outfitAgeOrPurchaseYear,
    record.outfitAlterationSupportAvailable,
    record.expectedPriceRange,
    record.individualGeneralAlterationSupport,
    record.defaultRentalDuration,
    record.cleaningBufferDuration,
    record.acceptPlatformTerms,
    record.acceptCommissionAgreement,
    record.acceptCancellationPolicy,
    record.acceptDepositRules,
    record.shopAgreeOrderHandlingResponsibility,
    record.shopAgreeQualityStandards,
    record.shopAgreeReturnHandling,
    record.individualAgreePassiveOwnershipModel,
    record.individualAgreePlatformPricingControl,
    record.individualAgreeRevenueShare,
    record.individualAgreeMaintenanceDeductionRules,
    JSON.stringify(record.adminReviewNotes || []),
    record.lastReviewRequestedAt ? new Date(record.lastReviewRequestedAt).toISOString() : null,
    record.lastResubmittedAt ? new Date(record.lastResubmittedAt).toISOString() : null,
    options?.openingTime ?? record.operatingHours ?? null
  );
};

export const saveVendorOnboardingDetails = async (
  userId: string,
  rawData: Record<string, unknown>
) => {
  const userIdBig = BigInt(userId);
  const row = await queryVendorRegistrationDetailRow(userIdBig);
  const existing = row ? normalizeDbRecord(row) : defaultRecord();
  const persistedOpeningTime =
    toNullableString(row?.openingTime) ??
    toNullableString(row?.operatingHours) ??
    existing.operatingHours;

  const nextRecord: VendorOnboardingRecord = {
    vendorCategory: resolveString(rawData, 'vendorCategory', existing.vendorCategory),
    shortBrandDescription: resolveString(
      rawData,
      'shortBrandDescription',
      existing.shortBrandDescription
    ),
    operatingHours: resolveString(rawData, 'operatingHours', existing.operatingHours),
    googleBusinessProfileUrl: resolveString(
      rawData,
      'googleBusinessProfileUrl',
      existing.googleBusinessProfileUrl
    ),
    yearsInBusiness: resolveNumber(rawData, 'yearsInBusiness', existing.yearsInBusiness),
    storeType: resolveString(rawData, 'storeType', existing.storeType),
    workingDays: resolveStringArray(rawData, 'workingDays', existing.workingDays),
    trialAvailability: resolveBoolean(rawData, 'trialAvailability', existing.trialAvailability),
    homeDeliveryAvailable: resolveBoolean(
      rawData,
      'homeDeliveryAvailable',
      existing.homeDeliveryAvailable
    ),
    alterationSupportAvailable: resolveBoolean(
      rawData,
      'alterationSupportAvailable',
      existing.alterationSupportAvailable
    ),
    occupation: resolveString(rawData, 'occupation', existing.occupation),
    ownsMultipleOutfits: resolveBoolean(
      rawData,
      'ownsMultipleOutfits',
      existing.ownsMultipleOutfits
    ),
    preferredPickupMethod: resolveString(
      rawData,
      'preferredPickupMethod',
      existing.preferredPickupMethod
    ),
    idProofType: resolveString(rawData, 'idProofType', existing.idProofType),
    shopLogoFileName: resolveString(rawData, 'shopLogoFileName', existing.shopLogoFileName),
    shopLogoUrl: resolveString(rawData, 'shopLogoUrl', existing.shopLogoUrl),
    idProofFileName: resolveString(rawData, 'idProofFileName', existing.idProofFileName),
    idProofUrl: resolveString(rawData, 'idProofUrl', existing.idProofUrl),
    selfieFileName: resolveString(rawData, 'selfieFileName', existing.selfieFileName),
    selfieUrl: resolveString(rawData, 'selfieUrl', existing.selfieUrl),
    businessProofFileName: resolveString(
      rawData,
      'businessProofFileName',
      existing.businessProofFileName
    ),
    businessProofUrl: resolveString(
      rawData,
      'businessProofUrl',
      existing.businessProofUrl
    ),
    storeInteriorPhotoFileName: resolveString(
      rawData,
      'storeInteriorPhotoFileName',
      existing.storeInteriorPhotoFileName
    ),
    storeInteriorPhotoUrl: resolveString(
      rawData,
      'storeInteriorPhotoUrl',
      existing.storeInteriorPhotoUrl
    ),
    storeExteriorPhotoFileName: resolveString(
      rawData,
      'storeExteriorPhotoFileName',
      existing.storeExteriorPhotoFileName
    ),
    storeExteriorPhotoUrl: resolveString(
      rawData,
      'storeExteriorPhotoUrl',
      existing.storeExteriorPhotoUrl
    ),
    outfitImageFileName: resolveString(
      rawData,
      'outfitImageFileName',
      existing.outfitImageFileName
    ),
    outfitImageUrl: resolveString(rawData, 'outfitImageUrl', existing.outfitImageUrl),
    ownershipDeclarationAccepted: resolveBoolean(
      rawData,
      'ownershipDeclarationAccepted',
      existing.ownershipDeclarationAccepted
    ),
    digitalConsentName: resolveString(
      rawData,
      'digitalConsentName',
      existing.digitalConsentName
    ),
    shopOutfitCount: resolveNumber(rawData, 'shopOutfitCount', existing.shopOutfitCount),
    shopCategoriesAvailable: resolveStringArray(
      rawData,
      'shopCategoriesAvailable',
      existing.shopCategoriesAvailable
    ),
    shopTargetAudience: resolveStringArray(
      rawData,
      'shopTargetAudience',
      existing.shopTargetAudience
    ),
    shopSizeRanges: resolveStringArray(
      rawData,
      'shopSizeRanges',
      existing.shopSizeRanges
    ),
    shopMinRentalPrice: resolveNumber(
      rawData,
      'shopMinRentalPrice',
      existing.shopMinRentalPrice
    ),
    shopMaxRentalPrice: resolveNumber(
      rawData,
      'shopMaxRentalPrice',
      existing.shopMaxRentalPrice
    ),
    shopInventoryVolume: resolveNumber(
      rawData,
      'shopInventoryVolume',
      existing.shopInventoryVolume
    ),
    outfitCategory: resolveString(rawData, 'outfitCategory', existing.outfitCategory),
    outfitSize: resolveString(rawData, 'outfitSize', existing.outfitSize),
    outfitBrand: resolveString(rawData, 'outfitBrand', existing.outfitBrand),
    outfitCondition: resolveString(rawData, 'outfitCondition', existing.outfitCondition),
    outfitOriginalPrice: resolveNumber(
      rawData,
      'outfitOriginalPrice',
      existing.outfitOriginalPrice
    ),
    outfitAgeOrPurchaseYear: resolveString(
      rawData,
      'outfitAgeOrPurchaseYear',
      existing.outfitAgeOrPurchaseYear
    ),
    outfitAlterationSupportAvailable: resolveBoolean(
      rawData,
      'outfitAlterationSupportAvailable',
      existing.outfitAlterationSupportAvailable
    ),
    expectedPriceRange: resolveString(
      rawData,
      'expectedPriceRange',
      existing.expectedPriceRange
    ),
    individualGeneralAlterationSupport: resolveBoolean(
      rawData,
      'individualGeneralAlterationSupport',
      existing.individualGeneralAlterationSupport
    ),
    defaultRentalDuration: resolveNumber(
      rawData,
      'defaultRentalDuration',
      existing.defaultRentalDuration
    ),
    cleaningBufferDuration: resolveNumber(
      rawData,
      'cleaningBufferDuration',
      existing.cleaningBufferDuration
    ),
    acceptPlatformTerms: resolveBoolean(
      rawData,
      'acceptPlatformTerms',
      existing.acceptPlatformTerms
    ),
    acceptCommissionAgreement: resolveBoolean(
      rawData,
      'acceptCommissionAgreement',
      existing.acceptCommissionAgreement
    ),
    acceptCancellationPolicy: resolveBoolean(
      rawData,
      'acceptCancellationPolicy',
      existing.acceptCancellationPolicy
    ),
    acceptDepositRules: resolveBoolean(
      rawData,
      'acceptDepositRules',
      existing.acceptDepositRules
    ),
    shopAgreeOrderHandlingResponsibility: resolveBoolean(
      rawData,
      'shopAgreeOrderHandlingResponsibility',
      existing.shopAgreeOrderHandlingResponsibility
    ),
    shopAgreeQualityStandards: resolveBoolean(
      rawData,
      'shopAgreeQualityStandards',
      existing.shopAgreeQualityStandards
    ),
    shopAgreeReturnHandling: resolveBoolean(
      rawData,
      'shopAgreeReturnHandling',
      existing.shopAgreeReturnHandling
    ),
    individualAgreePassiveOwnershipModel: resolveBoolean(
      rawData,
      'individualAgreePassiveOwnershipModel',
      existing.individualAgreePassiveOwnershipModel
    ),
    individualAgreePlatformPricingControl: resolveBoolean(
      rawData,
      'individualAgreePlatformPricingControl',
      existing.individualAgreePlatformPricingControl
    ),
    individualAgreeRevenueShare: resolveBoolean(
      rawData,
      'individualAgreeRevenueShare',
      existing.individualAgreeRevenueShare
    ),
    individualAgreeMaintenanceDeductionRules: resolveBoolean(
      rawData,
      'individualAgreeMaintenanceDeductionRules',
      existing.individualAgreeMaintenanceDeductionRules
    ),
    adminReviewNotes: existing.adminReviewNotes || [],
    lastReviewRequestedAt: existing.lastReviewRequestedAt || null,
    lastResubmittedAt: existing.lastResubmittedAt || null
  };

  await upsertVendorRegistrationOnboardingRecord(userId, nextRecord, {
    openingTime:
      hasOwn(rawData, 'operatingHours')
        ? nextRecord.operatingHours
        : persistedOpeningTime ?? nextRecord.operatingHours
  });

  return nextRecord;
};

export const getVendorOnboardingDetails = async (userId: string) => {
  const row = await queryVendorRegistrationDetailRow(BigInt(userId));
  return row ? normalizeDbRecord(row) : defaultRecord();
};

export const saveVendorAdminReviewNotes = async (
  userId: string,
  notes: VendorAdminReviewNote[]
) => {
  const existing = await getVendorOnboardingDetails(userId);

  const nextRecord: VendorOnboardingRecord = {
    ...existing,
    adminReviewNotes: notes,
    lastReviewRequestedAt:
      notes.length > 0 ? new Date().toISOString() : existing.lastReviewRequestedAt,
    lastResubmittedAt: notes.length > 0 ? null : existing.lastResubmittedAt
  };

  await upsertVendorRegistrationOnboardingRecord(userId, nextRecord, {
    openingTime: existing.operatingHours
  });

  return nextRecord;
};

export const clearVendorAdminReviewNotes = async (
  userId: string,
  options?: {
    markResubmitted?: boolean;
  }
) => {
  const existing = await getVendorOnboardingDetails(userId);

  const nextRecord: VendorOnboardingRecord = {
    ...existing,
    adminReviewNotes: [],
    lastResubmittedAt: options?.markResubmitted
      ? new Date().toISOString()
      : existing.lastResubmittedAt
  };

  await upsertVendorRegistrationOnboardingRecord(userId, nextRecord, {
    openingTime: existing.operatingHours
  });

  return nextRecord;
};

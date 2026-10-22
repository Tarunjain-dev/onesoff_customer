"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = exports.withProductApprovalFlowMetadata = exports.readProductApprovalFlowMetadata = void 0;
const errors_1 = require("../utils/errors");
const db_1 = __importDefault(require("../config/db"));
const S3Service_1 = require("./S3Service");
const BadgeService_1 = require("./BadgeService");
const NotificationService_1 = require("./NotificationService");
const CategoryService_1 = require("./CategoryService");
const socketServer_1 = require("../realtime/socketServer");
const roles_1 = require("@/utils/roles");
const client_1 = require("@prisma/client");
const PRODUCT_SPEC_FIELDS = [
    { key: 'materialComposition', label: 'Material composition' },
    { key: 'sleeveType', label: 'Sleeve type' },
    { key: 'length', label: 'Length' },
    { key: 'neckStyle', label: 'Neck style' },
    { key: 'pattern', label: 'Pattern' },
    { key: 'style', label: 'Style' }
];
const PRODUCT_DESCRIPTION_KEYS = [
    'description',
    'shortDescription',
    'fullDescription',
    'descriptionSummary',
    'rentingPeriods',
    'rentalDays',
    'productDetailsFull',
    'mrp',
    'originalPrice',
    'purchaseYear',
    'ageInMonths',
    'fitNotes',
    'condition',
    'damageDescription',
    'color',
    'selectedColor',
    'materialComposition',
    'sleeveType',
    'length',
    'neckStyle',
    'pattern',
    'style',
    'alterationCharge',
];
const isObjectRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const toOptionalTrimmedString = (value) => {
    if (value === undefined || value === null)
        return undefined;
    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
};
const normalizeSkuToken = (value, maxLength) => String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLength);
const emitProductRealtimeUpdate = (product, reason, overrides) => {
    const productId = String(overrides?.productId ?? product?.id ?? '').trim();
    const vendorId = String(overrides?.vendorId ?? product?.vendor?.id ?? product?.vendorId ?? '').trim();
    const vendorUserId = String(overrides?.vendorUserId ?? product?.vendor?.user?.id ?? product?.vendor?.userId ?? '').trim();
    const vendorRole = String(overrides?.vendorRole ?? product?.vendor?.user?.role ?? '').trim().toUpperCase();
    const refs = Object.fromEntries(Object.entries({
        productId,
        vendorId
    }).filter(([, value]) => value));
    if (vendorUserId) {
        (0, socketServer_1.emitDataUpdatedToUser)(vendorUserId, {
            domains: ['products', 'dashboard'],
            refs,
            reason
        });
    }
    if (vendorRole === 'INDIVIDUAL_VENDOR') {
        (0, socketServer_1.emitDataUpdatedToRole)('ADMIN_AS_VENDOR', {
            domains: ['products', 'dashboard'],
            refs,
            reason
        });
        return;
    }
    if (vendorRole === 'VENDOR') {
        (0, socketServer_1.emitDataUpdatedToRole)('ADMIN', {
            domains: ['products', 'dashboard'],
            refs,
            reason
        });
    }
};
const resolveVariantSkuPrefix = (product) => {
    const candidates = [
        product?.productType,
        product?.category?.name,
        product?.name
    ];
    for (const candidate of candidates) {
        const token = normalizeSkuToken(candidate, 3);
        if (token)
            return token.padEnd(3, 'X');
    }
    return 'PRD';
};
const buildGeneratedVariantSku = (product, variantId) => {
    const prefix = resolveVariantSkuPrefix(product);
    const numericToken = String(variantId || '').replace(/\D/g, '') || String(variantId || '');
    const paddedToken = numericToken.padStart(6, '0');
    return `${prefix}${paddedToken}`;
};
const buildGeneratedProductSku = (product) => {
    const prefix = resolveVariantSkuPrefix(product);
    const numericToken = String(product?.id || '').replace(/\D/g, '') || String(product?.id || '');
    const paddedToken = numericToken.padStart(6, '0');
    return `${prefix}P${paddedToken}`;
};
const buildTemporaryVariantSku = () => `TMP${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
const normalizeVariantDisplaySize = (sizeValue, colorValue) => {
    const size = toOptionalTrimmedString(sizeValue);
    const color = toOptionalTrimmedString(colorValue);
    if (!size && !color)
        return undefined;
    if (!size)
        return color;
    if (!color)
        return size;
    const normalizedSize = size.toLowerCase();
    const normalizedColor = color.toLowerCase();
    if (normalizedSize.includes(`/${normalizedColor}`))
        return size;
    return `${size} / ${color}`;
};
const parseInitialVariantRows = (value) => {
    if (Array.isArray(value)) {
        return value.filter(isObjectRecord);
    }
    if (typeof value !== 'string')
        return [];
    const trimmed = value.trim();
    if (!trimmed)
        return [];
    try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.filter(isObjectRecord) : [];
    }
    catch {
        return [];
    }
};
const normalizeInitialProductVariants = (productData) => {
    const variants = [];
    const seen = new Set();
    const addVariant = (sizeValue, colorValue, quantityValue) => {
        const size = normalizeVariantDisplaySize(sizeValue, colorValue);
        if (!size)
            return;
        const key = size.trim().toLowerCase();
        if (!key || seen.has(key))
            return;
        const quantity = Number(quantityValue ?? 1);
        if (Number.isFinite(quantity) && quantity !== 1) {
            throw new errors_1.ValidationError('Each variant represents one physical piece. Add another variant instead of increasing quantity.');
        }
        seen.add(key);
        variants.push({ size, quantity: 1 });
    };
    parseInitialVariantRows(productData.variants).forEach((variant) => {
        addVariant(variant.size, variant.color, variant.quantity);
    });
    addVariant(productData.selectedSize ?? productData.size, productData.selectedColor ?? productData.color);
    return variants;
};
const normalizeDetailEntries = (value) => {
    if (!Array.isArray(value))
        return [];
    return value
        .map((row) => {
        if (isObjectRecord(row)) {
            const label = toOptionalTrimmedString(row.label);
            const detailValue = toOptionalTrimmedString(row.value);
            if (label && detailValue) {
                return { label, value: detailValue };
            }
        }
        return null;
    })
        .filter((row) => Boolean(row));
};
const normalizeRentingPeriods = (value) => {
    const rawItems = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(',')
            : [];
    const normalized = rawItems
        .map((entry) => {
        const raw = String(entry || '').trim();
        if (!raw)
            return '';
        const digits = raw.match(/\d+/)?.[0];
        return digits || '';
    })
        .filter(Boolean);
    return Array.from(new Set(normalized)).sort((a, b) => Number(a) - Number(b));
};
const normalizeApprovalFlowMetadata = (value) => {
    if (!isObjectRecord(value))
        return undefined;
    const currentStage = toOptionalTrimmedString(value.currentStage);
    const submittedAt = toOptionalTrimmedString(value.submittedAt);
    if (!currentStage || !submittedAt) {
        return undefined;
    }
    const finalRentalPriceRaw = value.finalRentalPrice;
    const parsedFinalRentalPrice = finalRentalPriceRaw === undefined || finalRentalPriceRaw === null || finalRentalPriceRaw === ''
        ? undefined
        : Number(finalRentalPriceRaw);
    const currentProductValueRaw = value.currentProductValue;
    const parsedCurrentProductValue = currentProductValueRaw === undefined ||
        currentProductValueRaw === null ||
        currentProductValueRaw === ''
        ? undefined
        : Number(currentProductValueRaw);
    return {
        currentStage,
        submittedAt,
        approved1At: toOptionalTrimmedString(value.approved1At) || null,
        approved2At: toOptionalTrimmedString(value.approved2At) || null,
        finalRentalPrice: parsedFinalRentalPrice !== undefined && Number.isFinite(parsedFinalRentalPrice)
            ? parsedFinalRentalPrice
            : null,
        currentProductValue: parsedCurrentProductValue !== undefined && Number.isFinite(parsedCurrentProductValue)
            ? parsedCurrentProductValue
            : null,
        withdrawalStatus: toOptionalTrimmedString(value.withdrawalStatus) || null,
        withdrawalRequestedAt: toOptionalTrimmedString(value.withdrawalRequestedAt) || null,
        withdrawalApprovedAt: toOptionalTrimmedString(value.withdrawalApprovedAt) || null,
        vendorDecision: toOptionalTrimmedString(value.vendorDecision) || null,
        vendorDecisionAt: toOptionalTrimmedString(value.vendorDecisionAt) || null,
        listedAt: toOptionalTrimmedString(value.listedAt) || null,
        rejectedAt: toOptionalTrimmedString(value.rejectedAt) || null,
        statusOverride: toOptionalTrimmedString(value.statusOverride) || null
    };
};
const isAccessoryProduct = (value) => {
    const token = String(value || '').trim().toLowerCase();
    if (!token)
        return false;
    return token.includes('accessor') || token.includes('jewell') || token.includes('jewel');
};
const extractRetailMRPFromProduct = (product) => {
    const direct = toOptionalTrimmedString(product?.mrp) ||
        toOptionalTrimmedString(product?.retailMRP) ||
        toOptionalTrimmedString(product?.originalPrice) ||
        toOptionalTrimmedString(product?.productDetailsFull?.originalPrice);
    if (direct)
        return direct;
    const additionalInfo = Array.isArray(product?.productDetailsFull?.additionalInfo)
        ? product.productDetailsFull.additionalInfo
        : [];
    const mrpEntry = additionalInfo.find((entry) => /(^|\b)mrp(\b|$)/i.test(String(entry?.label || '')));
    return toOptionalTrimmedString(mrpEntry?.value);
};
const parseCurrencyLikeValue = (value) => {
    if (value === undefined || value === null || value === '')
        return undefined;
    const normalized = String(value).replace(/[^0-9.]/g, '').trim();
    if (!normalized)
        return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
};
const upsertAdditionalInfoEntry = (entries, label, value) => {
    const filtered = entries.filter((entry) => entry.label.trim().toLowerCase() !== label.trim().toLowerCase());
    if (!value)
        return filtered;
    return [...filtered, { label, value }];
};
const extractAlterationChargeFromProduct = (product) => {
    const direct = toOptionalTrimmedString(product?.alterationCharge) ||
        toOptionalTrimmedString(product?.productDetailsFull?.alterationCharge);
    const parsedDirect = parseCurrencyLikeValue(direct);
    if (parsedDirect !== undefined)
        return parsedDirect;
    const additionalInfo = Array.isArray(product?.productDetailsFull?.additionalInfo)
        ? product.productDetailsFull.additionalInfo
        : [];
    const chargeEntry = additionalInfo.find((entry) => /alteration\s*charge/i.test(String(entry?.label || '')));
    return parseCurrencyLikeValue(chargeEntry?.value) ?? 0;
};
const normalizeProductDetailsFull = (raw, options) => {
    const forceAccessory = options?.forceAccessory === true;
    const fallbackAbout = toOptionalTrimmedString(options?.fullDescription);
    if (!isObjectRecord(raw)) {
        if (fallbackAbout) {
            return {
                specifications: [],
                aboutItem: fallbackAbout,
                additionalInfo: []
            };
        }
        return undefined;
    }
    const specifications = forceAccessory
        ? []
        : normalizeDetailEntries(raw.specifications);
    const additionalInfo = normalizeDetailEntries(raw.additionalInfo);
    const rentingPeriods = normalizeRentingPeriods(raw.rentingPeriods);
    const approvalFlow = normalizeApprovalFlowMetadata(raw.approvalFlow);
    const aboutItem = toOptionalTrimmedString(raw.aboutItem) || fallbackAbout || '';
    const fitNotes = toOptionalTrimmedString(raw.fitNotes);
    const originalPrice = toOptionalTrimmedString(raw.originalPrice) ||
        toOptionalTrimmedString(raw.mrp) ||
        toOptionalTrimmedString(raw.retailMRP);
    const purchaseYear = toOptionalTrimmedString(raw.purchaseYear);
    const ageInMonths = toOptionalTrimmedString(raw.ageInMonths);
    const condition = toOptionalTrimmedString(raw.condition);
    const damageDescription = toOptionalTrimmedString(raw.damageDescription);
    const color = toOptionalTrimmedString(raw.color) ||
        toOptionalTrimmedString(raw.selectedColor);
    const alterationCharge = toOptionalTrimmedString(raw.alterationCharge) ||
        toOptionalTrimmedString(normalizeDetailEntries(raw.additionalInfo).find((entry) => /alteration\s*charge/i.test(entry.label))?.value);
    if (!specifications.length &&
        !additionalInfo.length &&
        !aboutItem &&
        !rentingPeriods.length &&
        !approvalFlow &&
        !fitNotes &&
        !originalPrice &&
        !purchaseYear &&
        !ageInMonths &&
        !condition &&
        !damageDescription &&
        !color &&
        !alterationCharge) {
        return undefined;
    }
    return {
        specifications,
        aboutItem,
        additionalInfo,
        ...(rentingPeriods.length ? { rentingPeriods } : {}),
        ...(approvalFlow ? { approvalFlow } : {}),
        ...(fitNotes ? { fitNotes } : {}),
        ...(originalPrice ? { originalPrice } : {}),
        ...(purchaseYear ? { purchaseYear } : {}),
        ...(ageInMonths ? { ageInMonths } : {}),
        ...(condition ? { condition } : {}),
        ...(damageDescription ? { damageDescription } : {}),
        ...(color ? { color } : {}),
        ...(alterationCharge ? { alterationCharge } : {})
    };
};
const readProductApprovalFlowMetadata = (raw) => {
    if (!isObjectRecord(raw))
        return undefined;
    return normalizeApprovalFlowMetadata(raw.approvalFlow);
};
exports.readProductApprovalFlowMetadata = readProductApprovalFlowMetadata;
const withProductApprovalFlowMetadata = (raw, approvalFlow, fallbackAboutItem) => {
    const normalized = normalizeProductDetailsFull(raw, {
        fullDescription: fallbackAboutItem
    }) || {
        specifications: [],
        aboutItem: toOptionalTrimmedString(fallbackAboutItem) || '',
        additionalInfo: []
    };
    return {
        ...normalized,
        approvalFlow
    };
};
exports.withProductApprovalFlowMetadata = withProductApprovalFlowMetadata;
const applyAlterationChargeToProductDetailsFull = (raw, alterationAvailable, alterationCharge, fallbackAboutItem) => {
    const normalized = normalizeProductDetailsFull(raw, {
        fullDescription: fallbackAboutItem
    }) || {
        specifications: [],
        aboutItem: toOptionalTrimmedString(fallbackAboutItem) || '',
        additionalInfo: []
    };
    const nextAdditionalInfo = upsertAdditionalInfoEntry(normalized.additionalInfo || [], 'Alteration Charge', alterationAvailable && alterationCharge > 0 ? `₹${alterationCharge}` : undefined);
    const nextPayload = {
        ...normalized,
        additionalInfo: nextAdditionalInfo
    };
    if (alterationAvailable && alterationCharge > 0) {
        nextPayload.alterationCharge = String(alterationCharge);
    }
    else {
        delete nextPayload.alterationCharge;
    }
    return nextPayload;
};
const extractFlatSpecEntries = (payload) => PRODUCT_SPEC_FIELDS
    .map(({ key, label }) => {
    const value = toOptionalTrimmedString(payload[key]);
    return value ? { label, value } : null;
})
    .filter((row) => Boolean(row));
const buildDescriptionPayload = (payload, productTypeHint) => {
    const shortDescription = toOptionalTrimmedString(payload.shortDescription) ||
        toOptionalTrimmedString(payload.description);
    const fullDescription = toOptionalTrimmedString(payload.fullDescription);
    const descriptionSummary = toOptionalTrimmedString(payload.descriptionSummary);
    const isAccessory = isAccessoryProduct(payload.productType ?? productTypeHint);
    const flatSpecifications = isAccessory ? [] : extractFlatSpecEntries(payload);
    const normalizedRentingPeriods = normalizeRentingPeriods(payload.rentingPeriods ??
        payload.rentalDays ??
        (isObjectRecord(payload.productDetailsFull)
            ? payload.productDetailsFull.rentingPeriods
            : undefined));
    const fitNotes = toOptionalTrimmedString(payload.fitNotes);
    const originalPrice = toOptionalTrimmedString(payload.originalPrice) ||
        toOptionalTrimmedString(payload.mrp) ||
        toOptionalTrimmedString(payload.retailMRP);
    const purchaseYear = toOptionalTrimmedString(payload.purchaseYear);
    const ageInMonths = toOptionalTrimmedString(payload.ageInMonths);
    const condition = toOptionalTrimmedString(payload.condition);
    const damageDescription = toOptionalTrimmedString(payload.damageDescription);
    const color = toOptionalTrimmedString(payload.color) ||
        toOptionalTrimmedString(payload.selectedColor);
    const alterationCharge = toOptionalTrimmedString(payload.alterationCharge);
    let productDetailsFull = normalizeProductDetailsFull(payload.productDetailsFull, {
        forceAccessory: isAccessory,
        fullDescription
    });
    if (productDetailsFull && !isAccessory && !productDetailsFull.specifications.length && flatSpecifications.length) {
        productDetailsFull = {
            ...productDetailsFull,
            specifications: flatSpecifications
        };
    }
    if (!productDetailsFull && (fullDescription || flatSpecifications.length)) {
        productDetailsFull = {
            specifications: isAccessory ? [] : flatSpecifications,
            aboutItem: fullDescription || '',
            additionalInfo: [],
            ...(normalizedRentingPeriods.length ? { rentingPeriods: normalizedRentingPeriods } : {})
        };
    }
    if (!productDetailsFull &&
        (fitNotes || originalPrice || purchaseYear || ageInMonths || condition || damageDescription || color)) {
        productDetailsFull = {
            specifications: [],
            aboutItem: fullDescription || '',
            additionalInfo: []
        };
    }
    if (productDetailsFull && normalizedRentingPeriods.length) {
        productDetailsFull = {
            ...productDetailsFull,
            rentingPeriods: normalizedRentingPeriods
        };
    }
    if (productDetailsFull) {
        productDetailsFull = {
            ...productDetailsFull,
            ...(fitNotes ? { fitNotes } : {}),
            ...(originalPrice ? { originalPrice } : {}),
            ...(purchaseYear ? { purchaseYear } : {}),
            ...(ageInMonths ? { ageInMonths } : {}),
            ...(condition ? { condition } : {}),
            ...(damageDescription ? { damageDescription } : {}),
            ...(color ? { color } : {}),
            ...(alterationCharge ? { alterationCharge } : {}),
            additionalInfo: upsertAdditionalInfoEntry(productDetailsFull.additionalInfo || [], 'Alteration Charge', alterationCharge ? `₹${alterationCharge}` : undefined)
        };
    }
    const resolvedSummary = descriptionSummary ||
        (productDetailsFull?.specifications.length
            ? productDetailsFull.specifications.map((entry) => `${entry.label}: ${entry.value}`).join(' | ')
            : undefined);
    return {
        shortDescription,
        fullDescription: fullDescription || toOptionalTrimmedString(productDetailsFull?.aboutItem),
        descriptionSummary: resolvedSummary,
        productDetailsFull
    };
};
const normalizeProductDescriptionResponse = (product) => {
    if (!product)
        return product;
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const primarySku = buildGeneratedProductSku(product);
    const descriptionPayload = buildDescriptionPayload({
        ...product,
        description: product.shortDescription || product.description
    }, product?.productType);
    const resolvedRentingPeriods = descriptionPayload.productDetailsFull?.rentingPeriods ||
        normalizeRentingPeriods(product?.rentingPeriods);
    return {
        ...product,
        sku: primarySku,
        productSku: primarySku,
        variantSkuPreview: toOptionalTrimmedString(variants[0]?.sku) || null,
        description: descriptionPayload.shortDescription || product.description || null,
        shortDescription: descriptionPayload.shortDescription || null,
        fullDescription: descriptionPayload.fullDescription || null,
        descriptionSummary: descriptionPayload.descriptionSummary || null,
        productDetailsFull: descriptionPayload.productDetailsFull || null,
        rentingPeriods: resolvedRentingPeriods,
        mrp: extractRetailMRPFromProduct(product),
        originalPrice: extractRetailMRPFromProduct(product),
        retailMRP: extractRetailMRPFromProduct(product),
        alterationCharge: extractAlterationChargeFromProduct(product)
    };
};
const normalizeBadgeSnapshot = (vendor) => {
    const assignment = vendor?.currentBadgeAssignment;
    return {
        badgeId: assignment?.badgeRuleId !== undefined && assignment?.badgeRuleId !== null
            ? String(assignment.badgeRuleId)
            : vendor?.badgeId
                ? String(vendor.badgeId)
                : null,
        badgeName: assignment?.badgeRule?.name !== undefined && assignment?.badgeRule?.name !== null
            ? String(assignment.badgeRule.name)
            : vendor?.badgeName
                ? String(vendor.badgeName)
                : null,
        badgeImageUrl: assignment?.badgeRule?.imageUrl !== undefined && assignment?.badgeRule?.imageUrl !== null
            ? String(assignment.badgeRule.imageUrl)
            : vendor?.badgeImageUrl
                ? String(vendor.badgeImageUrl)
                : null
    };
};
const withAccessibleVendorBadgeSnapshot = async (badge) => {
    if (!badge)
        return null;
    return {
        ...badge,
        badgeImageUrl: badge.badgeImageUrl
            ? await S3Service_1.S3Service.getAccessibleImageUrl(String(badge.badgeImageUrl))
            : null
    };
};
const withVendorBadge = (product, vendorBadgeOverride) => {
    if (!product?.vendor)
        return product;
    const { currentBadgeAssignment, ...vendorRest } = product.vendor;
    const badge = vendorBadgeOverride || normalizeBadgeSnapshot(product.vendor);
    return {
        ...product,
        vendor: {
            ...vendorRest,
            badgeId: badge.badgeId,
            badgeName: badge.badgeName,
            badgeImageUrl: badge.badgeImageUrl
        }
    };
};
const sortProductImagesByCover = (images) => {
    if (!Array.isArray(images) || images.length <= 1) {
        return Array.isArray(images) ? images : [];
    }
    return [...images].sort((left, right) => {
        const leftScore = left?.isCover ? 1 : 0;
        const rightScore = right?.isCover ? 1 : 0;
        return rightScore - leftScore;
    });
};
const withAccessibleImages = async (product, vendorBadgeOverride) => {
    if (!product) {
        return product;
    }
    const accessibleBadgeSnapshot = await withAccessibleVendorBadgeSnapshot(vendorBadgeOverride || normalizeBadgeSnapshot(product.vendor));
    const baseProduct = withVendorBadge(normalizeProductDescriptionResponse(product), accessibleBadgeSnapshot);
    if (!Array.isArray(baseProduct.images) || baseProduct.images.length === 0) {
        return baseProduct;
    }
    const sortedImages = sortProductImagesByCover(baseProduct.images);
    const signedUrls = await S3Service_1.S3Service.getAccessibleImageUrls(sortedImages.map((img) => img.imageUrl));
    return {
        ...baseProduct,
        images: sortedImages.map((img, index) => ({
            ...img,
            imageUrl: signedUrls[index] || img.imageUrl
        }))
    };
};
const normalizeProductStatus = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'ACTIVE')
        return 'ACTIVE';
    if (normalized === 'INACTIVE')
        return 'INACTIVE';
    if (normalized === 'OUT_OF_STOCK')
        return 'OUT_OF_STOCK';
    return undefined;
};
const isAdminProductViewer = (context) => {
    const role = String(context?.requesterRole || '').trim().toUpperCase();
    return role === 'ADMIN' || role === 'ADMIN_AS_VENDOR';
};
const isAdminAsVendorProductViewer = (context) => {
    const role = String(context?.requesterRole || '').trim().toUpperCase();
    return role === 'ADMIN_AS_VENDOR';
};
const isVendorSelfProductViewer = (context, ownerUserId) => {
    const role = String(context?.requesterRole || '').trim().toUpperCase();
    const requesterUserId = String(context?.requesterUserId || '').trim();
    const normalizedOwnerUserId = String(ownerUserId || '').trim();
    if (!requesterUserId || !normalizedOwnerUserId) {
        return false;
    }
    return ((role === 'VENDOR' || role === 'INDIVIDUAL_VENDOR') &&
        requesterUserId === normalizedOwnerUserId);
};
const parseOptionalNonNegativeInteger = (value, fieldName) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        throw new errors_1.ValidationError(`${fieldName} must be a non-negative integer`);
    }
    return parsed;
};
const parseOptionalBoolean = (value, fieldName) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized))
        return true;
    if (['false', '0', 'no', 'n'].includes(normalized))
        return false;
    throw new errors_1.ValidationError(`${fieldName} must be a boolean value`);
};
const parseOptionalNonNegativeAmount = (value, fieldName) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new errors_1.ValidationError(`${fieldName} must be a non-negative amount`);
    }
    return Number(parsed.toFixed(2));
};
const resolveDepositPercent = (rentalPrice) => {
    void rentalPrice;
    return 80;
};
const computeSecurityDepositFromRentalPrice = (rentalPrice) => {
    const normalizedRentalPrice = Number(rentalPrice);
    if (!Number.isFinite(normalizedRentalPrice) || normalizedRentalPrice <= 0) {
        throw new errors_1.ValidationError('Rental price must be greater than 0');
    }
    const percent = resolveDepositPercent(normalizedRentalPrice);
    return Number(((normalizedRentalPrice * percent) / 100).toFixed(2));
};
const isMissingProductEnhancementColumnError = (error) => {
    const code = error?.code;
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (code === 'P2022' ||
        message.includes('does not exist in the current database') ||
        message.includes('unknown argument `cleaningbufferdays`') ||
        message.includes('unknown argument `alterationavailable`') ||
        message.includes('unknown argument `damagewaiveravailable`') ||
        message.includes('unknown argument `shortdescription`') ||
        message.includes('unknown argument `fulldescription`') ||
        message.includes('unknown argument `descriptionsummary`') ||
        message.includes('unknown argument `productdetailsfull`'));
};
exports.ProductService = {
    async createProduct(vendorId, productData) {
        await CategoryService_1.CategoryService.ensureDefaultCategoryCatalog();
        const vendor = await db_1.default.vendorProfile.findFirst({
            where: {
                OR: [
                    { id: BigInt(vendorId) },
                    { userId: BigInt(vendorId) }
                ]
            },
            include: { user: true }
        });
        if (!vendor || vendor.user.onboardingStatus !== 'APPROVED') {
            throw new errors_1.BusinessLogicError('Vendor not approved for listing products');
        }
        const categoryIdRaw = productData.categoryId ?? productData.category ?? productData.productType;
        if (!categoryIdRaw) {
            throw new errors_1.ValidationError('Category is required');
        }
        const rentalPrice = productData.rentalPrice ?? productData.dailyPrice;
        if (rentalPrice === undefined) {
            throw new errors_1.ValidationError('Rental price is required');
        }
        const normalizedRentalPrice = Number(rentalPrice);
        if (!Number.isFinite(normalizedRentalPrice) || normalizedRentalPrice <= 0) {
            throw new errors_1.ValidationError('Rental price must be greater than 0');
        }
        const normalizedMrp = Number(String(productData.mrp ?? '').replace(/,/g, '').trim());
        if (Number.isFinite(normalizedMrp) && normalizedMrp > 0 && normalizedRentalPrice > normalizedMrp) {
            throw new errors_1.ValidationError('Expected rental price cannot be greater than original purchase price');
        }
        const cleaningBufferDays = parseOptionalNonNegativeInteger(productData.cleaningBufferDays ?? productData.cleaningTimeAfterReturnDays ?? productData.bufferDays, 'cleaningBufferDays') ?? 0;
        const alterationAvailable = parseOptionalBoolean(productData.alterationAvailable, 'alterationAvailable') ?? false;
        const alterationCharge = alterationAvailable
            ? parseOptionalNonNegativeAmount(productData.alterationCharge, 'alterationCharge') ?? 0
            : 0;
        const damageWaiverAvailable = parseOptionalBoolean(productData.damageWaiverAvailable ?? productData.damageWaiverOption, 'damageWaiverAvailable') ?? false;
        const descriptionPayload = buildDescriptionPayload(productData, productData.productType);
        const initialApprovalFlow = {
            currentStage: 'PENDING_APPROVAL',
            submittedAt: new Date().toISOString(),
            finalRentalPrice: normalizedRentalPrice
        };
        const persistedProductDetailsFull = (0, exports.withProductApprovalFlowMetadata)(applyAlterationChargeToProductDetailsFull(descriptionPayload.productDetailsFull, alterationAvailable, alterationCharge, descriptionPayload.fullDescription), initialApprovalFlow, descriptionPayload.fullDescription);
        const autoSecurityDeposit = computeSecurityDepositFromRentalPrice(normalizedRentalPrice);
        const productStatus = 'INACTIVE';
        const categoryToken = String(categoryIdRaw).trim();
        const isNumericCategoryId = /^\d+$/.test(categoryToken);
        let category = isNumericCategoryId
            ? await db_1.default.category.findUnique({
                where: { id: BigInt(categoryToken) }
            })
            : null;
        // Fallback for frontend flows that pass category name.
        if (!category) {
            category = await db_1.default.category.findFirst({
                where: { name: { equals: categoryToken, mode: 'insensitive' } }
            });
        }
        // Fallback: map to a broad category when a specific one is missing.
        if (!category && productData.gender) {
            const normalizedGender = productData.gender.toLowerCase();
            const broadCategory = normalizedGender === 'male'
                ? 'Men'
                : normalizedGender === 'unisex'
                    ? 'Accessories'
                    : 'Women';
            category = await db_1.default.category.findFirst({
                where: { name: { equals: broadCategory, mode: 'insensitive' } }
            });
        }
        if (!category) {
            throw new errors_1.ValidationError('Category not found');
        }
        const initialVariants = normalizeInitialProductVariants(productData);
        const product = await db_1.default.$transaction(async (tx) => {
            const createData = {
                vendorId: vendor.id,
                name: productData.name,
                description: descriptionPayload.shortDescription || productData.description,
                shortDescription: descriptionPayload.shortDescription,
                fullDescription: descriptionPayload.fullDescription,
                descriptionSummary: descriptionPayload.descriptionSummary,
                productDetailsFull: persistedProductDetailsFull,
                categoryId: category.id,
                productType: productData.productType,
                occasion: productData.occasion,
                brand: productData.brand,
                gender: productData.gender,
                rentalPrice: normalizedRentalPrice,
                securityDeposit: autoSecurityDeposit,
                cleaningBufferDays,
                alterationAvailable,
                damageWaiverAvailable,
                gst: productData.gst,
                status: productStatus
            };
            let createdProduct;
            try {
                createdProduct = await tx.product.create({
                    data: createData
                });
            }
            catch (error) {
                if (!isMissingProductEnhancementColumnError(error))
                    throw error;
                const { cleaningBufferDays: _cleaningBufferDays, alterationAvailable: _alterationAvailable, damageWaiverAvailable: _damageWaiverAvailable, shortDescription: _shortDescription, fullDescription: _fullDescription, descriptionSummary: _descriptionSummary, productDetailsFull: _productDetailsFull, ...legacyCreateData } = createData;
                createdProduct = await tx.product.create({
                    data: legacyCreateData
                });
            }
            if (productData.images?.length) {
                await tx.productImage.createMany({
                    data: productData.images.map((url, index) => ({
                        productId: createdProduct.id,
                        imageUrl: url,
                        isCover: index === 0
                    }))
                });
            }
            for (const variant of initialVariants) {
                const createdVariant = await tx.productVariant.create({
                    data: {
                        productId: createdProduct.id,
                        size: variant.size,
                        sku: buildTemporaryVariantSku(),
                        quantity: 1
                    }
                });
                await tx.productVariant.update({
                    where: { id: createdVariant.id },
                    data: { sku: buildGeneratedVariantSku(createdProduct, createdVariant.id) }
                });
            }
            return tx.product.findUnique({
                where: { id: createdProduct.id },
                include: { images: true, variants: true, category: true, vendor: { include: { user: true } } }
            });
        });
        if (!product) {
            throw new errors_1.BusinessLogicError('Failed to create product');
        }
        if (String(product?.vendor?.user?.role || '').toUpperCase() === 'INDIVIDUAL_VENDOR') {
            await NotificationService_1.NotificationService.notifyIndividualVendorProductAdded(String(product.vendor.user.id), {
                id: String(product.id),
                name: String(product.name || 'Product'),
                status: String(product.status || 'PENDING_APPROVAL')
            }).catch(() => null);
            await NotificationService_1.NotificationService.notifyAdminAsVendorProductUpdate({
                title: 'New product approval request',
                message: `${String(product.name || 'Product')} was submitted by ${String(product.vendor?.shopName || product.vendor?.ownerName || product.vendor?.user?.name || 'an individual vendor')}.`,
                productId: String(product.id),
                status: String(product.status || 'PENDING_APPROVAL'),
                vendorId: String(product.vendor?.user?.id || product.vendor?.userId || '')
            }).catch(() => null);
        }
        emitProductRealtimeUpdate(product, 'PRODUCT_CREATED');
        return withAccessibleImages(product);
    },
    async getProducts(filters, context) {
        const normalize = (input) => {
            if (Array.isArray(input))
                return input[0];
            if (input === undefined || input === null)
                return undefined;
            return String(input);
        };
        const page = Number(normalize(filters.page) ?? 1);
        const limit = Number(normalize(filters.limit) ?? 10);
        const skip = (page - 1) * limit;
        const where = {};
        const vendorId = normalize(filters.vendorId);
        let resolvedVendorOwnerUserId = '';
        if (vendorId) {
            const trimmedVendorId = vendorId.trim();
            if (!/^\d+$/.test(trimmedVendorId)) {
                return {
                    products: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                };
            }
            const vendorIdBig = BigInt(trimmedVendorId);
            let resolvedVendorId = vendorIdBig;
            try {
                const vendorProfile = await db_1.default.vendorProfile.findFirst({
                    where: {
                        OR: [{ id: vendorIdBig }, { userId: vendorIdBig }]
                    },
                    select: { id: true, userId: true }
                });
                if (vendorProfile?.id) {
                    resolvedVendorId = vendorProfile.id;
                    resolvedVendorOwnerUserId = vendorProfile.userId?.toString() || '';
                }
            }
            catch (error) {
                if (error?.code !== 'P2022') {
                    throw error;
                }
                const rows = await db_1.default.$queryRawUnsafe(`SELECT "id", "userId"
           FROM "VendorProfile"
           WHERE "id" = $1 OR "userId" = $1
           LIMIT 1`, vendorIdBig.toString());
                if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id !== undefined && rows[0]?.id !== null) {
                    resolvedVendorId = BigInt(rows[0].id);
                    resolvedVendorOwnerUserId =
                        rows[0]?.userId !== undefined && rows[0]?.userId !== null
                            ? String(rows[0].userId)
                            : '';
                }
            }
            where.vendorId = resolvedVendorId;
        }
        if (isAdminAsVendorProductViewer(context)) {
            where.vendor = {
                user: {
                    role: { in: roles_1.MANAGED_VENDOR_ROLES }
                }
            };
        }
        const canAccessUnapprovedProducts = isAdminProductViewer(context) ||
            isVendorSelfProductViewer(context, resolvedVendorOwnerUserId);
        const categoryToken = normalize(filters.categoryId ?? filters.category);
        if (categoryToken) {
            const trimmed = categoryToken.trim();
            if (/^\d+$/.test(trimmed)) {
                where.categoryId = BigInt(trimmed);
            }
            else {
                const category = await db_1.default.category.findFirst({
                    where: { name: { equals: trimmed, mode: 'insensitive' } }
                });
                if (category) {
                    where.categoryId = category.id;
                }
                else {
                    // Unknown category name: return no results instead of crashing on BigInt conversion
                    return {
                        products: [],
                        pagination: { page, limit, total: 0, pages: 0 }
                    };
                }
            }
        }
        const status = normalize(filters.status);
        if (status) {
            const normalizedStatus = status.toUpperCase();
            // Accept APPROVED (frontend wording) as ACTIVE in DB
            if (normalizedStatus === 'APPROVED') {
                where.status = 'ACTIVE';
            }
            else if (normalizedStatus === 'ALL') {
                if (!canAccessUnapprovedProducts) {
                    where.status = 'ACTIVE';
                }
            }
            else {
                where.status = canAccessUnapprovedProducts ? normalizedStatus : 'ACTIVE';
            }
        }
        else if (!canAccessUnapprovedProducts) {
            where.status = 'ACTIVE';
        }
        const gender = normalize(filters.gender);
        let genderValues = [];
        if (gender) {
            genderValues = gender
                .split(',')
                .map((g) => g.trim())
                .filter(Boolean);
            if (genderValues.length === 1) {
                where.gender = { equals: genderValues[0] };
            }
            else if (genderValues.length > 1) {
                where.gender = { in: genderValues };
            }
        }
        const include = {
            images: true,
            variants: true,
            category: true,
            vendor: {
                select: {
                    id: true,
                    shopName: true,
                    ownerName: true,
                    user: {
                        select: {
                            id: true,
                            role: true
                        }
                    },
                    currentBadgeAssignment: {
                        include: {
                            badgeRule: true
                        }
                    }
                }
            }
        };
        const attachRentalCounts = async (productRows) => {
            const productIds = productRows
                .map((product) => product?.id)
                .filter((value) => typeof value === 'bigint');
            if (productIds.length === 0)
                return productRows;
            const groupedCounts = await db_1.default.orderItem.groupBy({
                by: ['productId'],
                where: {
                    productId: { in: productIds },
                    status: {
                        notIn: [client_1.OrderItemStatus.CANCELLED, client_1.OrderItemStatus.REJECTED]
                    }
                },
                _count: {
                    _all: true
                }
            });
            const rentalCountMap = new Map(groupedCounts.map((entry) => [
                entry.productId.toString(),
                Number(entry._count?._all || 0)
            ]));
            return productRows.map((product) => ({
                ...product,
                rentalCount: rentalCountMap.get(String(product?.id || '')) || 0
            }));
        };
        const isUnknownGenderArgumentError = (error) => {
            const msg = String(error?.message || '');
            return msg.includes('Unknown argument `gender`') || msg.includes('Unknown argument "gender"');
        };
        const isMissingGenderColumnError = (error) => {
            const msg = String(error?.message || '');
            const code = String(error?.code || '');
            const metaColumn = String(error?.meta?.column || '');
            return ((code === 'P2022' && metaColumn.toLowerCase().includes('gender')) ||
                msg.includes('column \"gender\"') ||
                msg.includes('column \"gender\" does not exist') ||
                msg.toLowerCase().includes('gender') && msg.toLowerCase().includes('does not exist'));
        };
        const runRawGenderFallback = async () => {
            const baseWhere = { ...where };
            delete baseWhere.gender;
            const applyGender = genderValues.length > 0;
            const buildQueries = (includeGender) => {
                const clauses = ['1=1'];
                const params = [];
                let i = 1;
                if (baseWhere.status) {
                    clauses.push(`p."status" = $${i++}`);
                    params.push(String(baseWhere.status));
                }
                if (baseWhere.vendorId) {
                    clauses.push(`p."vendorId" = $${i++}`);
                    params.push(BigInt(baseWhere.vendorId).toString());
                }
                if (baseWhere.categoryId) {
                    clauses.push(`p."categoryId" = $${i++}`);
                    params.push(BigInt(baseWhere.categoryId).toString());
                }
                if (includeGender && applyGender) {
                    if (genderValues.length === 1) {
                        clauses.push(`LOWER(p."gender") = LOWER($${i++})`);
                        params.push(genderValues[0]);
                    }
                    else {
                        const placeholders = genderValues.map((_, idx) => `$${i + idx}`).join(', ');
                        clauses.push(`LOWER(p."gender") IN (${placeholders})`);
                        params.push(...genderValues.map((v) => v.toLowerCase()));
                        i += genderValues.length;
                    }
                }
                const whereSql = clauses.join(' AND ');
                const offsetPlaceholder = `$${i++}`;
                const limitPlaceholder = `$${i++}`;
                const idsSql = `SELECT p."id"
          FROM "Product" p
          WHERE ${whereSql}
          ORDER BY p."createdAt" DESC
          OFFSET ${offsetPlaceholder} LIMIT ${limitPlaceholder}`;
                const countSql = `SELECT COUNT(*)::int AS "count"
          FROM "Product" p
          WHERE ${whereSql}`;
                return { idsSql, countSql, params };
            };
            const idsQuery = async (includeGender) => {
                const { idsSql, countSql, params } = buildQueries(includeGender);
                const rows = await db_1.default.$queryRawUnsafe(idsSql, ...params, skip, limit);
                const countRows = await db_1.default.$queryRawUnsafe(countSql, ...params);
                const ids = (rows || []).map((r) => r.id).filter(Boolean).map((id) => BigInt(String(id)));
                const total = Number(countRows?.[0]?.count || 0);
                return { ids, total };
            };
            try {
                return await idsQuery(true);
            }
            catch (error) {
                const msg = String(error?.message || '');
                // If DB doesn't have gender column yet, fall back to no-gender filtering.
                if (applyGender && (msg.includes('column \"gender\"') || msg.includes('column \"gender\" does not exist'))) {
                    return idsQuery(false);
                }
                throw error;
            }
        };
        try {
            const [products, total] = await Promise.all([
                db_1.default.product.findMany({
                    where,
                    include,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' }
                }),
                db_1.default.product.count({ where })
            ]);
            const vendorIds = Array.from(new Set(products
                .map((row) => row?.vendorId)
                .filter((value) => typeof value === 'bigint')));
            if (vendorIds.length > 0) {
                await Promise.allSettled(vendorIds.map(vendorId => BadgeService_1.BadgeService.autoAssignVendorBadge(vendorId.toString())));
            }
            const vendorBadgeRows = vendorIds.length
                ? await db_1.default.vendorBadgeAssignment.findMany({
                    where: {
                        vendorId: {
                            in: vendorIds
                        }
                    },
                    include: {
                        badgeRule: true
                    }
                })
                : [];
            const vendorBadgeMap = new Map(vendorBadgeRows.map(row => [
                row.vendorId.toString(),
                {
                    badgeId: row.badgeRuleId ? String(row.badgeRuleId) : null,
                    badgeName: row.badgeRule?.name ? String(row.badgeRule.name) : null,
                    badgeImageUrl: row.badgeRule?.imageUrl ? String(row.badgeRule.imageUrl) : null
                }
            ]));
            const productsWithRentalCounts = await attachRentalCounts(products);
            const productsWithSignedImages = await Promise.all(productsWithRentalCounts.map((product) => withAccessibleImages(product, vendorBadgeMap.get(String(product?.vendorId || '')) || null)));
            return {
                products: productsWithSignedImages,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) }
            };
        }
        catch (error) {
            // If DB is missing the column (migration not applied yet), gracefully fall back to no-gender filtering.
            if (gender && isMissingGenderColumnError(error)) {
                const whereWithoutGender = { ...where };
                delete whereWithoutGender.gender;
                const [products, total] = await Promise.all([
                    db_1.default.product.findMany({
                        where: whereWithoutGender,
                        include,
                        skip,
                        take: limit,
                        orderBy: { createdAt: 'desc' }
                    }),
                    db_1.default.product.count({ where: whereWithoutGender })
                ]);
                const productsWithRentalCounts = await attachRentalCounts(products);
                const productsWithSignedImages = await Promise.all(productsWithRentalCounts.map((product) => withAccessibleImages(product)));
                return {
                    products: productsWithSignedImages,
                    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
                };
            }
            if (!gender || !isUnknownGenderArgumentError(error)) {
                throw error;
            }
            const { ids, total } = await runRawGenderFallback();
            const products = ids.length
                ? await db_1.default.product.findMany({
                    where: { id: { in: ids } },
                    include,
                    orderBy: { createdAt: 'desc' }
                })
                : [];
            const productsWithRentalCounts = await attachRentalCounts(products);
            const productsWithSignedImages = await Promise.all(productsWithRentalCounts.map((product) => withAccessibleImages(product)));
            return {
                products: productsWithSignedImages,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) }
            };
        }
    },
    async getProduct(productId) {
        const product = await db_1.default.product.findUnique({
            where: { id: BigInt(productId) },
            include: {
                images: true,
                variants: true,
                vendor: {
                    include: {
                        user: true,
                        currentBadgeAssignment: {
                            include: {
                                badgeRule: true
                            }
                        }
                    }
                },
                category: true
            }
        });
        if (!product)
            throw new errors_1.ValidationError('Product not found');
        await BadgeService_1.BadgeService.autoAssignVendorBadge(product.vendorId.toString()).catch(() => null);
        const currentAssignment = await db_1.default.vendorBadgeAssignment.findUnique({
            where: { vendorId: product.vendorId },
            include: { badgeRule: true }
        });
        const badgeSnapshot = {
            badgeId: currentAssignment?.badgeRuleId
                ? String(currentAssignment.badgeRuleId)
                : null,
            badgeName: currentAssignment?.badgeRule?.name
                ? String(currentAssignment.badgeRule.name)
                : null,
            badgeImageUrl: currentAssignment?.badgeRule?.imageUrl
                ? String(currentAssignment.badgeRule.imageUrl)
                : null
        };
        return withAccessibleImages(product, badgeSnapshot);
    },
    async updateProduct(vendorId, productId, updateData) {
        await CategoryService_1.CategoryService.ensureDefaultCategoryCatalog();
        const vendor = await db_1.default.vendorProfile.findFirst({
            where: {
                OR: [
                    { id: BigInt(vendorId) },
                    { userId: BigInt(vendorId) }
                ]
            },
            include: { user: true }
        });
        if (!vendor)
            throw new errors_1.ValidationError('Vendor profile not found');
        const product = await db_1.default.product.findFirst({
            where: { id: BigInt(productId), vendorId: vendor.id }
        });
        if (!product)
            throw new errors_1.ValidationError('Product not found');
        const normalizedUpdateData = { ...updateData };
        const existingApprovalFlow = (0, exports.readProductApprovalFlowMetadata)(product.productDetailsFull);
        const requestedStatus = normalizedUpdateData.status !== undefined
            ? normalizeProductStatus(String(normalizedUpdateData.status))
            : undefined;
        const rawImages = normalizedUpdateData.images;
        const imageUrls = Array.isArray(rawImages)
            ? rawImages.filter((image) => typeof image === 'string')
            : undefined;
        const hasDescriptionPayloadKeys = PRODUCT_DESCRIPTION_KEYS.some((key) => normalizedUpdateData[key] !== undefined);
        if (hasDescriptionPayloadKeys) {
            const descriptionPayload = buildDescriptionPayload(normalizedUpdateData.productDetailsFull === undefined
                ? {
                    ...normalizedUpdateData,
                    productDetailsFull: product.productDetailsFull
                }
                : normalizedUpdateData, String(normalizedUpdateData.productType || product.productType || ''));
            if (descriptionPayload.shortDescription !== undefined) {
                normalizedUpdateData.shortDescription = descriptionPayload.shortDescription;
                normalizedUpdateData.description = descriptionPayload.shortDescription;
            }
            if (descriptionPayload.fullDescription !== undefined) {
                normalizedUpdateData.fullDescription = descriptionPayload.fullDescription;
            }
            if (descriptionPayload.descriptionSummary !== undefined) {
                normalizedUpdateData.descriptionSummary = descriptionPayload.descriptionSummary;
            }
            if (descriptionPayload.productDetailsFull !== undefined) {
                normalizedUpdateData.productDetailsFull = existingApprovalFlow
                    ? (0, exports.withProductApprovalFlowMetadata)(descriptionPayload.productDetailsFull, existingApprovalFlow, descriptionPayload.fullDescription ||
                        toOptionalTrimmedString(product.fullDescription))
                    : descriptionPayload.productDetailsFull;
            }
        }
        const hasRentingPeriodsPayload = normalizedUpdateData.rentingPeriods !== undefined ||
            normalizedUpdateData.rentalDays !== undefined;
        if (hasRentingPeriodsPayload &&
            normalizedUpdateData.productDetailsFull === undefined) {
            const mergedProductDetailsFull = normalizeProductDetailsFull(product.productDetailsFull, {
                forceAccessory: isAccessoryProduct(normalizedUpdateData.productType ?? product.productType),
                fullDescription: toOptionalTrimmedString(normalizedUpdateData.fullDescription) ||
                    toOptionalTrimmedString(product.fullDescription)
            }) || {
                specifications: [],
                aboutItem: toOptionalTrimmedString(product.fullDescription) || '',
                additionalInfo: []
            };
            const nextRentingPeriods = normalizeRentingPeriods(normalizedUpdateData.rentingPeriods ?? normalizedUpdateData.rentalDays);
            normalizedUpdateData.productDetailsFull = {
                ...mergedProductDetailsFull,
                rentingPeriods: nextRentingPeriods
            };
        }
        if (typeof normalizedUpdateData.categoryId === 'string') {
            const categoryIdStr = normalizedUpdateData.categoryId.trim();
            if (/^\d+$/.test(categoryIdStr)) {
                normalizedUpdateData.categoryId = BigInt(categoryIdStr);
            }
            else {
                const category = await db_1.default.category.findFirst({
                    where: { name: { equals: categoryIdStr, mode: 'insensitive' } }
                });
                if (category) {
                    normalizedUpdateData.categoryId = category.id;
                }
                else {
                    throw new errors_1.ValidationError(`Category '${categoryIdStr}' not found`);
                }
            }
        }
        if (typeof normalizedUpdateData.category === 'string' && normalizedUpdateData.categoryId === undefined) {
            const categoryName = normalizedUpdateData.category.trim();
            const category = await db_1.default.category.findFirst({
                where: { name: { equals: categoryName, mode: 'insensitive' } }
            });
            if (category) {
                normalizedUpdateData.categoryId = category.id;
            }
            else {
                throw new errors_1.ValidationError(`Category '${categoryName}' not found`);
            }
        }
        if (typeof normalizedUpdateData.dailyPrice === 'number' && normalizedUpdateData.rentalPrice === undefined) {
            normalizedUpdateData.rentalPrice = normalizedUpdateData.dailyPrice;
        }
        if (normalizedUpdateData.cleaningBufferDays === undefined &&
            normalizedUpdateData.cleaningTimeAfterReturnDays !== undefined) {
            normalizedUpdateData.cleaningBufferDays = normalizedUpdateData.cleaningTimeAfterReturnDays;
        }
        if (normalizedUpdateData.cleaningBufferDays === undefined &&
            normalizedUpdateData.bufferDays !== undefined) {
            normalizedUpdateData.cleaningBufferDays = normalizedUpdateData.bufferDays;
        }
        if (normalizedUpdateData.damageWaiverAvailable === undefined &&
            normalizedUpdateData.damageWaiverOption !== undefined) {
            normalizedUpdateData.damageWaiverAvailable = normalizedUpdateData.damageWaiverOption;
        }
        const parsedCleaningBufferDays = parseOptionalNonNegativeInteger(normalizedUpdateData.cleaningBufferDays, 'cleaningBufferDays');
        if (parsedCleaningBufferDays !== undefined) {
            normalizedUpdateData.cleaningBufferDays = parsedCleaningBufferDays;
        }
        const parsedAlterationAvailable = parseOptionalBoolean(normalizedUpdateData.alterationAvailable, 'alterationAvailable');
        if (parsedAlterationAvailable !== undefined) {
            normalizedUpdateData.alterationAvailable = parsedAlterationAvailable;
        }
        const parsedAlterationCharge = parseOptionalNonNegativeAmount(normalizedUpdateData.alterationCharge, 'alterationCharge');
        if (parsedAlterationCharge !== undefined) {
            normalizedUpdateData.alterationCharge = parsedAlterationCharge;
        }
        if (normalizedUpdateData.alterationAvailable === false) {
            normalizedUpdateData.alterationCharge = 0;
        }
        if (normalizedUpdateData.alterationAvailable !== undefined ||
            parsedAlterationCharge !== undefined) {
            const resolvedAlterationAvailable = normalizedUpdateData.alterationAvailable !== undefined
                ? Boolean(normalizedUpdateData.alterationAvailable)
                : Boolean(product?.alterationAvailable);
            const resolvedAlterationCharge = resolvedAlterationAvailable
                ? Number(normalizedUpdateData.alterationCharge ??
                    extractAlterationChargeFromProduct(product) ??
                    0)
                : 0;
            const fullDescription = toOptionalTrimmedString(normalizedUpdateData.fullDescription) ||
                toOptionalTrimmedString(product.fullDescription);
            const nextProductDetailsFull = applyAlterationChargeToProductDetailsFull(normalizedUpdateData.productDetailsFull === undefined
                ? product.productDetailsFull
                : normalizedUpdateData.productDetailsFull, resolvedAlterationAvailable, resolvedAlterationCharge, fullDescription);
            normalizedUpdateData.productDetailsFull = existingApprovalFlow
                ? (0, exports.withProductApprovalFlowMetadata)(nextProductDetailsFull, existingApprovalFlow, fullDescription)
                : nextProductDetailsFull;
        }
        const parsedDamageWaiverAvailable = parseOptionalBoolean(normalizedUpdateData.damageWaiverAvailable, 'damageWaiverAvailable');
        if (parsedDamageWaiverAvailable !== undefined) {
            normalizedUpdateData.damageWaiverAvailable = parsedDamageWaiverAvailable;
        }
        let nextRentalPrice = Number(product.rentalPrice);
        if (normalizedUpdateData.rentalPrice !== undefined) {
            const parsedRentalPrice = Number(normalizedUpdateData.rentalPrice);
            if (!Number.isFinite(parsedRentalPrice) || parsedRentalPrice <= 0) {
                throw new errors_1.ValidationError('Rental price must be greater than 0');
            }
            nextRentalPrice = parsedRentalPrice;
            normalizedUpdateData.rentalPrice = parsedRentalPrice;
        }
        // Keep refundable security deposit tied to the current rent price.
        normalizedUpdateData.securityDeposit = computeSecurityDepositFromRentalPrice(nextRentalPrice);
        const currentApprovalStage = String(existingApprovalFlow?.currentStage || '')
            .trim()
            .toUpperCase();
        const ownerVendorRole = String(vendor?.user?.role || '').trim().toUpperCase();
        const isApprovalFlowLocked = Boolean(ownerVendorRole === 'INDIVIDUAL_VENDOR' &&
            currentApprovalStage &&
            currentApprovalStage !== 'LIVE');
        if (requestedStatus !== undefined && !isApprovalFlowLocked) {
            normalizedUpdateData.status = requestedStatus;
            if (existingApprovalFlow) {
                const nextApprovalFlow = {
                    ...existingApprovalFlow,
                    ...(requestedStatus === 'ACTIVE'
                        ? {
                            currentStage: 'LIVE',
                            listedAt: existingApprovalFlow.listedAt || new Date().toISOString(),
                            statusOverride: null
                        }
                        : {
                            statusOverride: requestedStatus
                        })
                };
                normalizedUpdateData.productDetailsFull = (0, exports.withProductApprovalFlowMetadata)(normalizedUpdateData.productDetailsFull === undefined
                    ? product.productDetailsFull
                    : normalizedUpdateData.productDetailsFull, nextApprovalFlow, toOptionalTrimmedString(normalizedUpdateData.fullDescription) ||
                    toOptionalTrimmedString(product.fullDescription));
            }
        }
        delete normalizedUpdateData.images;
        delete normalizedUpdateData.category;
        delete normalizedUpdateData.dailyPrice;
        delete normalizedUpdateData.cleaningTimeAfterReturnDays;
        delete normalizedUpdateData.bufferDays;
        delete normalizedUpdateData.damageWaiverOption;
        delete normalizedUpdateData.rentingPeriods;
        delete normalizedUpdateData.rentalDays;
        delete normalizedUpdateData.alterationCharge;
        delete normalizedUpdateData.mrp;
        delete normalizedUpdateData.originalPrice;
        delete normalizedUpdateData.purchaseYear;
        delete normalizedUpdateData.ageInMonths;
        delete normalizedUpdateData.fitNotes;
        delete normalizedUpdateData.condition;
        delete normalizedUpdateData.damageDescription;
        delete normalizedUpdateData.color;
        delete normalizedUpdateData.selectedColor;
        delete normalizedUpdateData.materialComposition;
        delete normalizedUpdateData.sleeveType;
        delete normalizedUpdateData.length;
        delete normalizedUpdateData.neckStyle;
        delete normalizedUpdateData.pattern;
        delete normalizedUpdateData.style;
        delete normalizedUpdateData.id;
        delete normalizedUpdateData.image;
        delete normalizedUpdateData.price;
        delete normalizedUpdateData.stock;
        delete normalizedUpdateData.size;
        delete normalizedUpdateData.sku;
        delete normalizedUpdateData.approvalStage;
        delete normalizedUpdateData.categoryDetail;
        delete normalizedUpdateData.vendorId;
        delete normalizedUpdateData.vendor;
        delete normalizedUpdateData.createdAt;
        delete normalizedUpdateData.updatedAt;
        delete normalizedUpdateData.variants;
        const productIdBig = BigInt(productId);
        const updatedProduct = await db_1.default.$transaction(async (tx) => {
            try {
                await tx.product.update({
                    where: { id: productIdBig },
                    data: normalizedUpdateData
                });
            }
            catch (error) {
                if (!isMissingProductEnhancementColumnError(error))
                    throw error;
                const { cleaningBufferDays: _cleaningBufferDays, alterationAvailable: _alterationAvailable, damageWaiverAvailable: _damageWaiverAvailable, shortDescription: _shortDescription, fullDescription: _fullDescription, descriptionSummary: _descriptionSummary, productDetailsFull: _productDetailsFull, ...legacyUpdateData } = normalizedUpdateData;
                await tx.product.update({
                    where: { id: productIdBig },
                    data: legacyUpdateData
                });
            }
            if (imageUrls) {
                await tx.productImage.deleteMany({ where: { productId: productIdBig } });
                if (imageUrls.length > 0) {
                    await tx.productImage.createMany({
                        data: imageUrls.map((url, index) => ({
                            productId: productIdBig,
                            imageUrl: url,
                            isCover: index === 0
                        }))
                    });
                }
            }
            return tx.product.findUnique({
                where: { id: productIdBig },
                include: { images: true, variants: true, category: true, vendor: { include: { user: true } } }
            });
        });
        if (!updatedProduct) {
            throw new errors_1.ValidationError('Product not found');
        }
        const previousStatus = String(product?.status || '').trim().toUpperCase();
        const nextStatus = String(updatedProduct?.status || '').trim().toUpperCase();
        if (String(updatedProduct?.vendor?.user?.role || '').toUpperCase() ===
            'INDIVIDUAL_VENDOR' &&
            nextStatus &&
            nextStatus !== previousStatus) {
            await NotificationService_1.NotificationService.notifyIndividualVendorProductStatusChanged(String(updatedProduct.vendor.user.id), {
                productId: String(updatedProduct.id),
                productName: String(updatedProduct.name || 'Product'),
                status: nextStatus
            }).catch(() => null);
        }
        emitProductRealtimeUpdate(updatedProduct, 'PRODUCT_UPDATED');
        return withAccessibleImages(updatedProduct);
    },
    async deleteProduct(vendorId, productId) {
        const vendor = await db_1.default.vendorProfile.findFirst({
            where: {
                OR: [
                    { id: BigInt(vendorId) },
                    { userId: BigInt(vendorId) }
                ]
            },
            include: {
                user: {
                    select: {
                        id: true,
                        role: true
                    }
                }
            }
        });
        if (!vendor)
            throw new errors_1.ValidationError('Vendor profile not found');
        const productIdBig = BigInt(productId);
        const product = await db_1.default.product.findFirst({
            where: { id: productIdBig, vendorId: vendor.id }
        });
        if (!product)
            throw new errors_1.ValidationError('Product not found');
        const linkedOrders = await db_1.default.orderItem.count({
            where: { productId: productIdBig }
        });
        if (linkedOrders > 0) {
            throw new errors_1.BusinessLogicError('Cannot delete product with existing orders');
        }
        await db_1.default.$transaction(async (tx) => {
            await tx.productImage.deleteMany({ where: { productId: productIdBig } });
            await tx.trialRequest.deleteMany({ where: { productId: productIdBig } });
            await tx.wishlist.deleteMany({ where: { productId: productIdBig } });
            await tx.cart.deleteMany({ where: { productId: productIdBig } });
            await tx.productAvailabilityOverride.deleteMany({ where: { productId: productIdBig } });
            await tx.productVariant.deleteMany({ where: { productId: productIdBig } });
            await tx.review.deleteMany({ where: { productId: productIdBig } });
            await tx.product.delete({ where: { id: productIdBig } });
        });
        emitProductRealtimeUpdate(product, 'PRODUCT_DELETED', {
            productId: productIdBig,
            vendorId: vendor.id,
            vendorUserId: vendor.user?.id || vendor.userId,
            vendorRole: vendor.user?.role
        });
        return { id: productIdBig };
    },
    async addVariant(productId, variantData) {
        const productIdBig = BigInt(productId);
        const size = String(variantData.size || '').trim();
        if (!size) {
            throw new errors_1.ValidationError('Variant size is required');
        }
        if (variantData.quantity !== undefined &&
            Number.isFinite(Number(variantData.quantity)) &&
            Number(variantData.quantity) !== 1) {
            throw new errors_1.ValidationError('Each variant represents one physical piece. Add another variant instead of increasing quantity.');
        }
        const product = await db_1.default.product.findUnique({
            where: { id: productIdBig },
            include: { category: true }
        });
        if (!product) {
            throw new errors_1.ValidationError('Product not found');
        }
        const existingVariants = await db_1.default.productVariant.findMany({
            where: { productId: productIdBig }
        });
        const existingVariant = existingVariants.find((variant) => String(variant.size || '').trim().toLowerCase() === size.toLowerCase());
        if (existingVariant) {
            return existingVariant;
        }
        return db_1.default.$transaction(async (tx) => {
            const createdVariant = await tx.productVariant.create({
                data: {
                    productId: productIdBig,
                    size,
                    sku: buildTemporaryVariantSku(),
                    quantity: 1
                }
            });
            return tx.productVariant.update({
                where: { id: createdVariant.id },
                data: {
                    sku: buildGeneratedVariantSku(product, createdVariant.id)
                }
            });
        });
    },
    async updateVariant(vendorId, productId, variantId, variantData) {
        const vendor = await db_1.default.vendorProfile.findFirst({
            where: {
                OR: [
                    { id: BigInt(vendorId) },
                    { userId: BigInt(vendorId) }
                ]
            }
        });
        if (!vendor)
            throw new errors_1.ValidationError('Vendor profile not found');
        const productIdBig = BigInt(productId);
        const variantIdBig = BigInt(variantId);
        const product = await db_1.default.product.findFirst({
            where: { id: productIdBig, vendorId: vendor.id }
        });
        if (!product)
            throw new errors_1.ValidationError('Product not found');
        const variant = await db_1.default.productVariant.findFirst({
            where: { id: variantIdBig, productId: productIdBig }
        });
        if (!variant)
            throw new errors_1.ValidationError('Variant not found');
        const updatePayload = {};
        if (variantData.quantity !== undefined) {
            const quantity = Number(variantData.quantity);
            if (!Number.isFinite(quantity) || quantity !== 1) {
                throw new errors_1.ValidationError('Variant quantity is fixed at 1. Add another variant instead of changing quantity.');
            }
        }
        if (variantData.size !== undefined) {
            const size = String(variantData.size || '').trim();
            if (!size) {
                throw new errors_1.ValidationError('Variant size is required');
            }
            updatePayload.size = size;
        }
        if (Object.keys(updatePayload).length === 0) {
            throw new errors_1.ValidationError('No variant changes provided');
        }
        return db_1.default.productVariant.update({
            where: { id: variantIdBig },
            data: updatePayload
        });
    },
    async deleteVariant(vendorId, productId, variantId) {
        const vendor = await db_1.default.vendorProfile.findFirst({
            where: {
                OR: [
                    { id: BigInt(vendorId) },
                    { userId: BigInt(vendorId) }
                ]
            }
        });
        if (!vendor)
            throw new errors_1.ValidationError('Vendor profile not found');
        const productIdBig = BigInt(productId);
        const variantIdBig = BigInt(variantId);
        const product = await db_1.default.product.findFirst({
            where: { id: productIdBig, vendorId: vendor.id }
        });
        if (!product)
            throw new errors_1.ValidationError('Product not found');
        const variant = await db_1.default.productVariant.findFirst({
            where: { id: variantIdBig, productId: productIdBig }
        });
        if (!variant)
            throw new errors_1.ValidationError('Variant not found');
        await db_1.default.productVariant.delete({
            where: { id: variantIdBig }
        });
        return { id: variantIdBig, productId: productIdBig };
    }
};

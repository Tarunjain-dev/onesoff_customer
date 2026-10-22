"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminVendorService = void 0;
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const CommissionService_1 = require("./CommissionService");
const NotificationService_1 = require("./NotificationService");
const VendorProfileService_1 = require("./VendorProfileService");
const S3Service_1 = require("./S3Service");
const vendorOnboardingStorage_1 = require("./vendorOnboardingStorage");
const vendorScope_1 = require("../utils/vendorScope");
const CLOSED_ORDER_STATUSES = new Set([
    'COMPLETED',
    'SECURITY_DEPOSIT_REFUNDED',
    'DAMAGE_REVIEW',
    'INSPECTED_GOOD',
    'INSPECTED_DAMAGED',
    'INSPECTED_LOST'
]);
const BASE_VENDOR_AGREEMENT_FIELDS = [
    'ownershipDeclarationAccepted',
    'acceptPlatformTerms',
    'acceptCommissionAgreement',
    'acceptCancellationPolicy',
    'acceptDepositRules'
];
const SHOP_VENDOR_AGREEMENT_FIELDS = [
    'shopAgreeOrderHandlingResponsibility',
    'shopAgreeQualityStandards',
    'shopAgreeReturnHandling'
];
const INDIVIDUAL_VENDOR_AGREEMENT_FIELDS = [
    'individualAgreePassiveOwnershipModel',
    'individualAgreePlatformPricingControl',
    'individualAgreeRevenueShare',
    'individualAgreeMaintenanceDeductionRules'
];
const resolveVendorAgreementPanel = (vendor, onboardingDetails) => {
    const role = String(vendor?.role || '').trim().toUpperCase();
    const vendorCategory = String(onboardingDetails?.vendorCategory || '')
        .trim()
        .toLowerCase();
    if (role === 'INDIVIDUAL_VENDOR' || vendorCategory === 'individual_owner') {
        return client_1.AgreementPanel.INDIVIDUAL_VENDOR;
    }
    return client_1.AgreementPanel.VENDOR;
};
const resolveVendorAgreementFields = (panel) => {
    if (panel === client_1.AgreementPanel.INDIVIDUAL_VENDOR) {
        return [
            ...BASE_VENDOR_AGREEMENT_FIELDS,
            ...INDIVIDUAL_VENDOR_AGREEMENT_FIELDS
        ];
    }
    return [...BASE_VENDOR_AGREEMENT_FIELDS, ...SHOP_VENDOR_AGREEMENT_FIELDS];
};
const buildAgreementVersionMap = (agreements) => {
    const map = new Map();
    const panels = [
        client_1.AgreementPanel.VENDOR,
        client_1.AgreementPanel.INDIVIDUAL_VENDOR
    ];
    panels.forEach(panel => {
        const matched = agreements.find(agreement => {
            if (agreement.scope === client_1.AgreementScope.GLOBAL)
                return true;
            return Array.isArray(agreement.applicablePanels) && agreement.applicablePanels.includes(panel);
        });
        if (matched?.version) {
            map.set(panel, `v${Number(matched.version)}`);
        }
    });
    return map;
};
const buildVendorAgreementSummary = (vendor, onboardingDetails, acceptanceRow, agreementVersionMap) => {
    const panel = resolveVendorAgreementPanel(vendor, onboardingDetails);
    const requiredFields = resolveVendorAgreementFields(panel);
    const acceptedTermsCount = requiredFields.filter(field => onboardingDetails?.[field] === true || acceptanceRow?.[field] === true).length;
    const totalTermsCount = requiredFields.length;
    const signedAt = acceptanceRow?.updatedAt || acceptanceRow?.createdAt || null;
    const hasAcceptedAgreement = Boolean(signedAt) || (totalTermsCount > 0 && acceptedTermsCount > 0);
    return {
        version: agreementVersionMap.get(panel) || null,
        signedAt,
        effectiveFrom: signedAt,
        status: hasAcceptedAgreement ? 'SIGNED' : 'PENDING',
        acceptedTermsCount,
        totalTermsCount
    };
};
const ONBOARDING_DOCUMENT_URL_FIELDS = [
    'shopLogoUrl',
    'idProofUrl',
    'selfieUrl',
    'businessProofUrl',
    'storeInteriorPhotoUrl',
    'storeExteriorPhotoUrl',
    'outfitImageUrl'
];
const withAccessibleOnboardingDocumentUrls = async (onboardingDetails) => {
    if (!onboardingDetails || typeof onboardingDetails !== 'object') {
        return onboardingDetails;
    }
    const entries = await Promise.all(ONBOARDING_DOCUMENT_URL_FIELDS.map(async (field) => {
        const currentUrl = String(onboardingDetails?.[field] || '').trim();
        if (!currentUrl) {
            return [field, onboardingDetails?.[field] || null];
        }
        return [field, await S3Service_1.S3Service.getAccessibleImageUrl(currentUrl)];
    }));
    return {
        ...onboardingDetails,
        ...Object.fromEntries(entries)
    };
};
exports.AdminVendorService = {
    async getVendorList(filters) {
        try {
            const where = (0, vendorScope_1.getVendorUserRoleWhere)(filters.roleFilter);
            if (filters.status)
                where.onboardingStatus = filters.status;
            if (filters.city)
                where.vendorProfile = { is: { city: filters.city } };
            if (filters.dateFrom)
                where.createdAt = { gte: filters.dateFrom };
            const vendors = await db_1.default.user.findMany({
                where,
                include: {
                    vendorProfile: {
                        include: {
                            currentBadgeAssignment: {
                                include: {
                                    badgeRule: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            const commissionSettings = await CommissionService_1.CommissionService.getCommissionSettings();
            const onboardingEntries = await Promise.all(vendors.map(async (vendor) => [
                String(vendor.id),
                await (0, vendorOnboardingStorage_1.getVendorOnboardingDetails)(String(vendor.id))
            ]));
            const onboardingMap = new Map(onboardingEntries);
            const vendorIds = vendors.map(vendor => vendor.id).filter(Boolean);
            const agreementAcceptances = vendorIds.length
                ? await db_1.default.vendorAgreementAcceptance.findMany({
                    where: {
                        userId: { in: vendorIds }
                    }
                })
                : [];
            const agreementAcceptanceMap = new Map(agreementAcceptances.map(row => [String(row.userId), row]));
            const latestAgreements = await db_1.default.agreement.findMany({
                where: {
                    isDeleted: false,
                    OR: [
                        { scope: client_1.AgreementScope.GLOBAL },
                        {
                            applicablePanels: {
                                hasSome: [client_1.AgreementPanel.VENDOR, client_1.AgreementPanel.INDIVIDUAL_VENDOR]
                            }
                        }
                    ]
                },
                orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                select: {
                    scope: true,
                    applicablePanels: true,
                    version: true
                }
            });
            const agreementVersionMap = buildAgreementVersionMap(latestAgreements);
            const mapped = await Promise.all(vendors.map(async (vendor) => {
                let completedOrders = 0;
                if (vendor.vendorProfile?.id) {
                    const result = await db_1.default.$queryRaw `
            SELECT COUNT(*) as count FROM "OrderItem"
            WHERE "vendorId" = ${vendor.vendorProfile.id}
          `;
                    completedOrders = Number(result[0]?.count ?? 0);
                }
                const badgeId = vendor.vendorProfile?.currentBadgeAssignment?.badgeRuleId || null;
                const badgeName = vendor.vendorProfile?.currentBadgeAssignment?.badgeRule?.name || null;
                const effectiveCommissionPercentage = CommissionService_1.CommissionService.resolveEffectiveCommissionRate(vendor.vendorProfile
                    ? {
                        ...vendor.vendorProfile,
                        role: vendor.role
                    }
                    : { role: vendor.role }, commissionSettings);
                const onboardingDetails = onboardingMap.get(String(vendor.id)) ||
                    (await (0, vendorOnboardingStorage_1.getVendorOnboardingDetails)(String(vendor.id)));
                const agreementSummary = buildVendorAgreementSummary(vendor, onboardingDetails, agreementAcceptanceMap.get(String(vendor.id)), agreementVersionMap);
                return {
                    ...vendor,
                    vendorCategory: onboardingDetails.vendorCategory,
                    vendorProfile: vendor.vendorProfile
                        ? {
                            ...vendor.vendorProfile,
                            vendorCategory: onboardingDetails.vendorCategory,
                            shortBrandDescription: onboardingDetails.shortBrandDescription,
                            shopLogoUrl: onboardingDetails.shopLogoUrl
                        }
                        : vendor.vendorProfile,
                    badgeId,
                    badgeName,
                    effectiveCommissionPercentage,
                    agreementSummary,
                    _count: {
                        ordersAsVendor: completedOrders
                    }
                };
            }));
            if (filters.badge) {
                const normalizedFilter = String(filters.badge).trim().toLowerCase();
                return mapped.filter((vendor) => {
                    const badgeId = String(vendor.badgeId || '').toLowerCase();
                    const badgeName = String(vendor.badgeName || '').toLowerCase();
                    return badgeId === normalizedFilter || badgeName === normalizedFilter;
                });
            }
            return mapped;
        }
        catch (error) {
            console.error('Error in getVendorList:', error);
            throw new Error('Failed to fetch vendor list');
        }
    },
    async getVendorDetail(vendorId, roleFilter) {
        try {
            const vendor = await db_1.default.user.findFirst({
                where: { id: BigInt(vendorId), ...(0, vendorScope_1.getVendorUserRoleWhere)(roleFilter) },
                include: {
                    vendorProfile: {
                        include: {
                            currentBadgeAssignment: {
                                include: { badgeRule: true }
                            },
                            products: {
                                select: { id: true, name: true, status: true, rentalPrice: true },
                                orderBy: { createdAt: 'desc' }
                            }
                        }
                    }
                }
            });
            if (!vendor)
                throw new Error('Vendor not found');
            let completedOrders = 0;
            let totalOrders = 0;
            if (vendor.vendorProfile?.id) {
                const completedResult = await db_1.default.$queryRaw `
          SELECT COUNT(*) as count FROM "OrderItem"
          WHERE "vendorId" = ${vendor.vendorProfile.id}
          AND "status" IN ('COMPLETED','SECURITY_DEPOSIT_REFUNDED','DAMAGE_REVIEW','INSPECTED_GOOD','INSPECTED_DAMAGED','INSPECTED_LOST')
        `;
                const totalResult = await db_1.default.$queryRaw `
          SELECT COUNT(*) as count FROM "OrderItem" WHERE "vendorId" = ${vendor.vendorProfile.id}
        `;
                completedOrders = Number(completedResult[0]?.count ?? 0);
                totalOrders = Number(totalResult[0]?.count ?? 0);
            }
            const commissionSettings = await CommissionService_1.CommissionService.getCommissionSettings();
            const effectiveCommissionPercentage = CommissionService_1.CommissionService.resolveEffectiveCommissionRate(vendor.vendorProfile
                ? {
                    ...vendor.vendorProfile,
                    role: vendor.role
                }
                : { role: vendor.role }, commissionSettings);
            const operationalSettings = vendor.vendorProfile?.id
                ? await VendorProfileService_1.VendorProfileService.getOperationalSettingsByVendorProfileId(vendor.vendorProfile.id)
                : {
                    lateFeePerDay: 0,
                    homeDeliveryApplicable: false,
                    deliveryCharges: 0
                };
            const onboardingDetails = await withAccessibleOnboardingDocumentUrls(await (0, vendorOnboardingStorage_1.getVendorOnboardingDetails)(String(vendor.id)));
            const agreementAcceptance = await db_1.default.vendorAgreementAcceptance.findUnique({
                where: { userId: BigInt(vendorId) }
            });
            const latestAgreements = await db_1.default.agreement.findMany({
                where: {
                    isDeleted: false,
                    OR: [
                        { scope: client_1.AgreementScope.GLOBAL },
                        {
                            applicablePanels: {
                                hasSome: [client_1.AgreementPanel.VENDOR, client_1.AgreementPanel.INDIVIDUAL_VENDOR]
                            }
                        }
                    ]
                },
                orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                select: {
                    scope: true,
                    applicablePanels: true,
                    version: true
                }
            });
            const agreementVersionMap = buildAgreementVersionMap(latestAgreements);
            return {
                ...vendor,
                vendorCategory: onboardingDetails.vendorCategory,
                vendorProfile: vendor.vendorProfile
                    ? {
                        ...vendor.vendorProfile,
                        ...onboardingDetails,
                        ...operationalSettings
                    }
                    : vendor.vendorProfile,
                completedOrders,
                totalOrders,
                effectiveCommissionPercentage,
                agreementSummary: buildVendorAgreementSummary(vendor, onboardingDetails, agreementAcceptance, agreementVersionMap)
            };
        }
        catch (error) {
            console.error('Error in getVendorDetail:', error);
            throw new Error('Failed to fetch vendor details');
        }
    },
    async updateVendorStatus(vendorId, status, roleFilter) {
        try {
            const updated = await db_1.default.user.updateMany({
                where: { id: BigInt(vendorId), ...(0, vendorScope_1.getVendorUserRoleWhere)(roleFilter) },
                data: { onboardingStatus: status }
            });
            if (updated.count === 0) {
                throw new Error('Vendor not found');
            }
            if (String(status).toUpperCase() === 'APPROVED') {
                await (0, vendorOnboardingStorage_1.clearVendorAdminReviewNotes)(vendorId);
            }
            return db_1.default.user.findUnique({
                where: { id: BigInt(vendorId) },
                include: { vendorProfile: true }
            });
        }
        catch (error) {
            console.error('Error in updateVendorStatus:', error);
            throw new Error('Failed to update vendor status');
        }
    },
    async updateCommission(vendorId, commission, roleFilter) {
        try {
            const vendor = await db_1.default.user.findFirst({
                where: { id: BigInt(vendorId), ...(0, vendorScope_1.getVendorUserRoleWhere)(roleFilter) },
                select: { id: true, role: true }
            });
            if (!vendor) {
                throw new Error('Vendor not found');
            }
            const profile = await db_1.default.vendorProfile.update({
                where: { userId: BigInt(vendorId) },
                data: {
                    commissionOverridePercentage: commission,
                    commissionPercentage: commission
                }
            });
            if (String(vendor.role || '').toUpperCase() === 'INDIVIDUAL_VENDOR') {
                await NotificationService_1.NotificationService.notifyIndividualVendorContractUpdated(vendor.id.toString(), { revenueSharePercent: commission }).catch(() => null);
            }
            return profile;
        }
        catch (error) {
            console.error('Error in updateCommission:', error);
            throw new Error('Failed to update commission');
        }
    },
    async requestDocumentResubmission(vendorId, notes, adminName, roleFilter) {
        try {
            const vendor = await db_1.default.user.findFirst({
                where: { id: BigInt(vendorId), ...(0, vendorScope_1.getVendorUserRoleWhere)(roleFilter) },
                select: { id: true }
            });
            if (!vendor) {
                throw new Error('Vendor not found');
            }
            return VendorProfileService_1.VendorProfileService.requestDocumentResubmission(vendorId, notes.map(note => ({
                ...note,
                adminName: adminName || null
            })));
        }
        catch (error) {
            console.error('Error in requestDocumentResubmission:', error);
            throw new Error(error.message || 'Failed to request document resubmission');
        }
    },
    async deleteVendor(vendorId, roleFilter) {
        try {
            const vendor = await db_1.default.user.findFirst({
                where: { id: parseInt(vendorId), ...(0, vendorScope_1.getVendorUserRoleWhere)(roleFilter) }
            });
            if (!vendor)
                throw new Error('Vendor not found');
            // Delete related records first
            await db_1.default.$transaction(async (tx) => {
                // Delete password auth
                await tx.userPasswordAuth.deleteMany({ where: { userId: parseInt(vendorId) } });
                // Delete auth sessions
                await tx.authSession.deleteMany({ where: { userId: parseInt(vendorId) } });
                // Delete vendor profile (cascade will handle products, orders, etc.)
                await tx.vendorProfile.deleteMany({ where: { userId: parseInt(vendorId) } });
                // Finally delete the user
                await tx.user.delete({ where: { id: parseInt(vendorId) } });
            });
        }
        catch (error) {
            console.error('Error in deleteVendor:', error);
            throw new Error(error.message || 'Failed to delete vendor');
        }
    }
};

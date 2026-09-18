import prisma from '../config/db';
import { AgreementPanel, AgreementScope, OnboardingStatus } from '@prisma/client';
import { CommissionService } from './CommissionService';
import { NotificationService } from './NotificationService';
import { VendorProfileService } from './VendorProfileService';
import { S3Service } from './S3Service';
import {
  clearVendorAdminReviewNotes,
  getVendorOnboardingDetails
} from './vendorOnboardingStorage';
import { VENDOR_ROLES } from '../utils/roles';
import { getVendorUserRoleWhere } from '../utils/vendorScope';

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
] as const;

const SHOP_VENDOR_AGREEMENT_FIELDS = [
  'shopAgreeOrderHandlingResponsibility',
  'shopAgreeQualityStandards',
  'shopAgreeReturnHandling'
] as const;

const INDIVIDUAL_VENDOR_AGREEMENT_FIELDS = [
  'individualAgreePassiveOwnershipModel',
  'individualAgreePlatformPricingControl',
  'individualAgreeRevenueShare',
  'individualAgreeMaintenanceDeductionRules'
] as const;

type VendorAgreementField =
  | (typeof BASE_VENDOR_AGREEMENT_FIELDS)[number]
  | (typeof SHOP_VENDOR_AGREEMENT_FIELDS)[number]
  | (typeof INDIVIDUAL_VENDOR_AGREEMENT_FIELDS)[number];

const resolveVendorAgreementPanel = (vendor: any, onboardingDetails: any) => {
  const role = String(vendor?.role || '').trim().toUpperCase();
  const vendorCategory = String(onboardingDetails?.vendorCategory || '')
    .trim()
    .toLowerCase();

  if (role === 'INDIVIDUAL_VENDOR' || vendorCategory === 'individual_owner') {
    return AgreementPanel.INDIVIDUAL_VENDOR;
  }

  return AgreementPanel.VENDOR;
};

const resolveVendorAgreementFields = (panel: AgreementPanel): VendorAgreementField[] => {
  if (panel === AgreementPanel.INDIVIDUAL_VENDOR) {
    return [
      ...BASE_VENDOR_AGREEMENT_FIELDS,
      ...INDIVIDUAL_VENDOR_AGREEMENT_FIELDS
    ];
  }

  return [...BASE_VENDOR_AGREEMENT_FIELDS, ...SHOP_VENDOR_AGREEMENT_FIELDS];
};

const buildAgreementVersionMap = (agreements: Array<{
  scope: AgreementScope;
  applicablePanels: AgreementPanel[];
  version: number;
}>) => {
  const map = new Map<AgreementPanel, string>();
  const panels: AgreementPanel[] = [
    AgreementPanel.VENDOR,
    AgreementPanel.INDIVIDUAL_VENDOR
  ];

  panels.forEach(panel => {
    const matched = agreements.find(agreement => {
      if (agreement.scope === AgreementScope.GLOBAL) return true;
      return Array.isArray(agreement.applicablePanels) && agreement.applicablePanels.includes(panel);
    });

    if (matched?.version) {
      map.set(panel, `v${Number(matched.version)}`);
    }
  });

  return map;
};

const buildVendorAgreementSummary = (
  vendor: any,
  onboardingDetails: any,
  acceptanceRow: any,
  agreementVersionMap: Map<AgreementPanel, string>
) => {
  const panel = resolveVendorAgreementPanel(vendor, onboardingDetails);
  const requiredFields = resolveVendorAgreementFields(panel);
  const acceptedTermsCount = requiredFields.filter(
    field => onboardingDetails?.[field] === true || acceptanceRow?.[field] === true
  ).length;
  const totalTermsCount = requiredFields.length;
  const signedAt = acceptanceRow?.updatedAt || acceptanceRow?.createdAt || null;
  const hasAcceptedAgreement =
    Boolean(signedAt) || (totalTermsCount > 0 && acceptedTermsCount > 0);

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
] as const;

const withAccessibleOnboardingDocumentUrls = async (
  onboardingDetails: Record<string, any>
) => {
  if (!onboardingDetails || typeof onboardingDetails !== 'object') {
    return onboardingDetails;
  }

  const entries = await Promise.all(
    ONBOARDING_DOCUMENT_URL_FIELDS.map(async (field) => {
      const currentUrl = String(onboardingDetails?.[field] || '').trim();
      if (!currentUrl) {
        return [field, onboardingDetails?.[field] || null] as const;
      }

      return [field, await S3Service.getAccessibleImageUrl(currentUrl)] as const;
    })
  );

  return {
    ...onboardingDetails,
    ...Object.fromEntries(entries)
  };
};

export const AdminVendorService = {
  async getVendorList(filters: { status?: OnboardingStatus; city?: string; badge?: string; dateFrom?: Date, roleFilter?: Record<string, any> }) {
    try {
      const where: any = getVendorUserRoleWhere(filters.roleFilter);
      if (filters.status) where.onboardingStatus = filters.status;
      if (filters.city) where.vendorProfile = { is: { city: filters.city } };
      if (filters.dateFrom) where.createdAt = { gte: filters.dateFrom };

      const vendors = await prisma.user.findMany({
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

      const commissionSettings = await CommissionService.getCommissionSettings();
      const onboardingEntries = await Promise.all(
        vendors.map(async (vendor: any) => [
          String(vendor.id),
          await getVendorOnboardingDetails(String(vendor.id))
        ] as const)
      );
      const onboardingMap = new Map(onboardingEntries);
      const vendorIds = vendors.map(vendor => vendor.id).filter(Boolean);
      const agreementAcceptances = vendorIds.length
        ? await prisma.vendorAgreementAcceptance.findMany({
            where: {
              userId: { in: vendorIds }
            }
          })
        : [];
      const agreementAcceptanceMap = new Map(
        agreementAcceptances.map(row => [String(row.userId), row])
      );
      const latestAgreements = await prisma.agreement.findMany({
        where: {
          isDeleted: false,
          OR: [
            { scope: AgreementScope.GLOBAL },
            {
              applicablePanels: {
                hasSome: [AgreementPanel.VENDOR, AgreementPanel.INDIVIDUAL_VENDOR]
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

      const mapped = await Promise.all(vendors.map(async (vendor: any) => {
        let completedOrders = 0;
        if (vendor.vendorProfile?.id) {
          const result = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM "OrderItem"
            WHERE "vendorId" = ${vendor.vendorProfile.id}
          `;
          completedOrders = Number(result[0]?.count ?? 0);
        }
        const badgeId = vendor.vendorProfile?.currentBadgeAssignment?.badgeRuleId || null;
        const badgeName = vendor.vendorProfile?.currentBadgeAssignment?.badgeRule?.name || null;
        const effectiveCommissionPercentage = CommissionService.resolveEffectiveCommissionRate(
          vendor.vendorProfile
            ? {
                ...vendor.vendorProfile,
                role: vendor.role
              }
            : { role: vendor.role },
          commissionSettings
        );
        const onboardingDetails =
          onboardingMap.get(String(vendor.id)) ||
          (await getVendorOnboardingDetails(String(vendor.id)));
        const agreementSummary = buildVendorAgreementSummary(
          vendor,
          onboardingDetails,
          agreementAcceptanceMap.get(String(vendor.id)),
          agreementVersionMap
        );

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
        return mapped.filter((vendor: any) => {
          const badgeId = String(vendor.badgeId || '').toLowerCase();
          const badgeName = String(vendor.badgeName || '').toLowerCase();
          return badgeId === normalizedFilter || badgeName === normalizedFilter;
        });
      }

      return mapped;
    } catch (error: any) {
      console.error('Error in getVendorList:', error);
      throw new Error('Failed to fetch vendor list');
    }
  },

  async getVendorDetail(vendorId: string, roleFilter?: Record<string, any>) {
    try {
      const vendor = await prisma.user.findFirst({
        where: { id: BigInt(vendorId), ...getVendorUserRoleWhere(roleFilter) },
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

      if (!vendor) throw new Error('Vendor not found');

      let completedOrders = 0;
      let totalOrders = 0;
      if (vendor.vendorProfile?.id) {
        const completedResult = await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM "OrderItem"
          WHERE "vendorId" = ${vendor.vendorProfile.id}
          AND "status" IN ('COMPLETED','SECURITY_DEPOSIT_REFUNDED','DAMAGE_REVIEW','INSPECTED_GOOD','INSPECTED_DAMAGED','INSPECTED_LOST')
        `;
        const totalResult = await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM "OrderItem" WHERE "vendorId" = ${vendor.vendorProfile.id}
        `;
        completedOrders = Number(completedResult[0]?.count ?? 0);
        totalOrders = Number(totalResult[0]?.count ?? 0);
      }

      const commissionSettings = await CommissionService.getCommissionSettings();
      const effectiveCommissionPercentage = CommissionService.resolveEffectiveCommissionRate(
        vendor.vendorProfile
          ? {
              ...vendor.vendorProfile,
              role: vendor.role
            }
          : { role: vendor.role },
        commissionSettings
      );
      const operationalSettings = vendor.vendorProfile?.id
        ? await VendorProfileService.getOperationalSettingsByVendorProfileId(vendor.vendorProfile.id)
        : {
          lateFeePerDay: 0,
          homeDeliveryApplicable: false,
          deliveryCharges: 0
        };
      const onboardingDetails = await withAccessibleOnboardingDocumentUrls(
        await getVendorOnboardingDetails(String(vendor.id))
      );
      const agreementAcceptance = await prisma.vendorAgreementAcceptance.findUnique({
        where: { userId: BigInt(vendorId) }
      });
      const latestAgreements = await prisma.agreement.findMany({
        where: {
          isDeleted: false,
          OR: [
            { scope: AgreementScope.GLOBAL },
            {
              applicablePanels: {
                hasSome: [AgreementPanel.VENDOR, AgreementPanel.INDIVIDUAL_VENDOR]
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
        agreementSummary: buildVendorAgreementSummary(
          vendor,
          onboardingDetails,
          agreementAcceptance,
          agreementVersionMap
        )
      };
    } catch (error: any) {
      console.error('Error in getVendorDetail:', error);
      throw new Error('Failed to fetch vendor details');
    }
  },

  async updateVendorStatus(vendorId: string, status: OnboardingStatus, roleFilter?: Record<string, any>) {
    try {
      const updated = await prisma.user.updateMany({
        where: { id: BigInt(vendorId), ...getVendorUserRoleWhere(roleFilter) },
        data: { onboardingStatus: status }
      });

      if (updated.count === 0) {
        throw new Error('Vendor not found');
      }

      if (String(status).toUpperCase() === 'APPROVED') {
        await clearVendorAdminReviewNotes(vendorId);
      }

      return prisma.user.findUnique({
        where: { id: BigInt(vendorId) },
        include: { vendorProfile: true }
      });
    } catch (error: any) {
      console.error('Error in updateVendorStatus:', error);
      throw new Error('Failed to update vendor status');
    }
  },

  async updateCommission(vendorId: string, commission: number, roleFilter?: Record<string, any>) {
    try {
      const vendor = await prisma.user.findFirst({
        where: { id: BigInt(vendorId), ...getVendorUserRoleWhere(roleFilter) },
        select: { id: true, role: true }
      });

      if (!vendor) {
        throw new Error('Vendor not found');
      }

      const profile = await prisma.vendorProfile.update({
        where: { userId: BigInt(vendorId) },
        data: {
          commissionOverridePercentage: commission,
          commissionPercentage: commission
        }
      });

      if (String(vendor.role || '').toUpperCase() === 'INDIVIDUAL_VENDOR') {
        await NotificationService.notifyIndividualVendorContractUpdated(
          vendor.id.toString(),
          { revenueSharePercent: commission }
        ).catch(() => null);
      }

      return profile;
    } catch (error: any) {
      console.error('Error in updateCommission:', error);
      throw new Error('Failed to update commission');
    }
  },

  async requestDocumentResubmission(
    vendorId: string,
    notes: Array<{ documentKey: string; message: string }>,
    adminName?: string | null,
    roleFilter?: Record<string, any>
  ) {
    try {
      const vendor = await prisma.user.findFirst({
        where: { id: BigInt(vendorId), ...getVendorUserRoleWhere(roleFilter) },
        select: { id: true }
      });

      if (!vendor) {
        throw new Error('Vendor not found');
      }

      return VendorProfileService.requestDocumentResubmission(
        vendorId,
        notes.map(note => ({
          ...note,
          adminName: adminName || null
        }))
      );
    } catch (error: any) {
      console.error('Error in requestDocumentResubmission:', error);
      throw new Error(error.message || 'Failed to request document resubmission');
    }
  },

  async deleteVendor(vendorId: string, roleFilter?: Record<string, any>) {
    try {
      const vendor = await prisma.user.findFirst({
        where: { id: parseInt(vendorId), ...getVendorUserRoleWhere(roleFilter) }
      });

      if (!vendor) throw new Error('Vendor not found');

      // Delete related records first
      await prisma.$transaction(async (tx) => {
        // Delete password auth
        await tx.userPasswordAuth.deleteMany({ where: { userId: parseInt(vendorId) } });

        // Delete auth sessions
        await tx.authSession.deleteMany({ where: { userId: parseInt(vendorId) } });

        // Delete vendor profile (cascade will handle products, orders, etc.)
        await tx.vendorProfile.deleteMany({ where: { userId: parseInt(vendorId) } });

        // Finally delete the user
        await tx.user.delete({ where: { id: parseInt(vendorId) } });
      });
    } catch (error: any) {
      console.error('Error in deleteVendor:', error);
      throw new Error(error.message || 'Failed to delete vendor');
    }
  }
};

import prisma from '../config/db';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';
import { SHOP_VENDOR_ROLES } from '@/utils/roles';
import { S3Service } from './S3Service';

type BadgeRulePayload = {
  name?: unknown;
  imageUrl?: unknown;
  minOrders?: unknown;
  minRating?: unknown;
  maxLatePercent?: unknown;
  maxDamagePercent?: unknown;
  maxCancellationPercent?: unknown;
  minRepeatCustomerPercent?: unknown;
  maxPolicyViolations?: unknown;
  isActive?: unknown;
  priority?: unknown;
};

type VendorPerformance = {
  completedOrders: number;
  totalOrders: number;
  cancelledOrders: number;
  lateReturns: number;
  damagedReturns: number;
  latePercent: number;
  damagePercent: number;
  cancellationPercent: number;
  repeatCustomerPercent: number;
  repeatCustomers: number;
  totalCustomers: number;
  policyViolations: number;
  avgRating: number;
};

const BADGE_COMPLETED_STATUSES = new Set([
  'SECURITY_DEPOSIT_REFUNDED',
  'DAMAGE_REVIEW',
  'COMPLETED',
  'RETURNED',
  'INSPECTED_GOOD',
  'INSPECTED_DAMAGED',
  'INSPECTED_LOST'
]);

const BADGE_CANCELLED_STATUSES = new Set(['CANCELLED', 'REJECTED']);
const BADGE_DAMAGED_STATUSES = new Set(['INSPECTED_DAMAGED', 'INSPECTED_LOST']);

const DEFAULT_BADGE_RULES = [
  {
    id: 'bronze-partner',
    name: 'Bronze Partner',
    imageUrl: '/media/Badges/BadgeBronze.png',
    minOrders: 100,
    minRating: 3.5,
    maxLatePercent: 30,
    maxDamagePercent: 20,
    maxCancellationPercent: 20,
    minRepeatCustomerPercent: 0,
    maxPolicyViolations: 100,
    priority: 10
  },
  {
    id: 'silver-partner',
    name: 'Silver Partner',
    imageUrl: '/media/Badges/BadgeSilver.png',
    minOrders: 500,
    minRating: 4.0,
    maxLatePercent: 20,
    maxDamagePercent: 15,
    maxCancellationPercent: 15,
    minRepeatCustomerPercent: 5,
    maxPolicyViolations: 80,
    priority: 20
  },
  {
    id: 'gold-partner',
    name: 'Gold Partner',
    imageUrl: '/media/Badges/BadgeGold.png',
    minOrders: 2000,
    minRating: 4.5,
    maxLatePercent: 12,
    maxDamagePercent: 10,
    maxCancellationPercent: 10,
    minRepeatCustomerPercent: 10,
    maxPolicyViolations: 60,
    priority: 30
  },
  {
    id: 'platinum-partner',
    name: 'Platinum Partner',
    imageUrl: '/media/Badges/BadgePlatinum.png',
    minOrders: 4000,
    minRating: 4.7,
    maxLatePercent: 10,
    maxDamagePercent: 8,
    maxCancellationPercent: 8,
    minRepeatCustomerPercent: 15,
    maxPolicyViolations: 45,
    priority: 40
  },
  {
    id: 'titanium-partner',
    name: 'Titanium Partner',
    imageUrl: '/media/Badges/BadgeTitanium.png',
    minOrders: 6000,
    minRating: 4.8,
    maxLatePercent: 8,
    maxDamagePercent: 6,
    maxCancellationPercent: 6,
    minRepeatCustomerPercent: 20,
    maxPolicyViolations: 30,
    priority: 50
  },
  {
    id: 'diamond-elite-partner',
    name: 'Diamond Elite Partner',
    imageUrl: '/media/Badges/BadgeDiamond.png',
    minOrders: 8000,
    minRating: 4.8,
    maxLatePercent: 6,
    maxDamagePercent: 5,
    maxCancellationPercent: 5,
    minRepeatCustomerPercent: 25,
    maxPolicyViolations: 20,
    priority: 60
  },
  {
    id: 'crown-legend',
    name: 'Crown Legend',
    imageUrl: '/media/Badges/BadgeCrown.png',
    minOrders: 10000,
    minRating: 4.9,
    maxLatePercent: 5,
    maxDamagePercent: 4,
    maxCancellationPercent: 3,
    minRepeatCustomerPercent: 30,
    maxPolicyViolations: 10,
    priority: 70
  }
] as const;

let defaultBadgeRulesPromise: Promise<void> | null = null;

const parseVendorId = (vendorId: string) => {
  try {
    return BigInt(vendorId);
  } catch {
    throw new ValidationError('Invalid vendor id');
  }
};

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNonNegativeInt = (value: unknown, fallback: number) =>
  Math.max(0, Math.floor(toNumber(value, fallback)));

const toRating = (value: unknown, fallback: number) =>
  Math.min(5, Math.max(0, toNumber(value, fallback)));

const toPercentMinZero = (value: unknown, fallback: number) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = toNumber(value, fallback);
  if (parsed <= 0) return fallback;
  return Math.min(100, Math.max(0, parsed));
};

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toOptionalString = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const toAccessibleBadgeImageUrl = async (value: unknown) => {
  const normalized = toOptionalString(value);
  if (!normalized) return null;
  return S3Service.getAccessibleImageUrl(normalized);
};

const mapRuleForApi = async (rule: any) => ({
  id: String(rule.id),
  name: String(rule.name),
  imageUrl: await toAccessibleBadgeImageUrl(rule?.imageUrl),
  minOrders: Number(rule.minOrders || 0),
  minRating: Number(rule.minRating || 0),
  maxLatePercent: Number(rule.maxLatePercent || 0),
  maxDamagePercent: Number(rule.maxDamagePercent || 0),
  maxCancellationPercent: Number(rule.maxCancellationPercent || 0),
  minRepeatCustomerPercent: Number(rule.minRepeatCustomerPercent || 0),
  maxPolicyViolations: Number(rule.maxPolicyViolations || 0),
  isDefault: Boolean(rule.isDefault),
  isActive: Boolean(rule.isActive),
  priority: Number(rule.priority || 0)
});

const mapCurrentAssignmentForApi = async (payload: {
  vendorId: string;
  vendorName: string;
  source: 'AUTO' | 'MANUAL' | 'NONE';
  badgeId: string | null;
  badgeName: string | null;
  badgeImageUrl?: string | null;
  assignedAt: Date | null;
  performance?: VendorPerformance;
}) => ({
  vendorId: payload.vendorId,
  vendorName: payload.vendorName,
  badge: payload.badgeId,
  badgeId: payload.badgeId,
  badgeName: payload.badgeName,
  badgeImageUrl: await toAccessibleBadgeImageUrl(payload.badgeImageUrl),
  source: payload.source,
  assignedAt: payload.assignedAt,
  performance: payload.performance
});

const buildNoBadgeResult = (vendorId: string, vendorName: string, performance?: VendorPerformance) => ({
  vendorId,
  vendorName,
  badgeId: null,
  badgeName: undefined,
  badgeImageUrl: null,
  source: 'NONE',
  assignedAt: null,
  performance
});

const ensureDefaultBadgeRules = async () => {
  if (!defaultBadgeRulesPromise) {
    defaultBadgeRulesPromise = (async () => {
      const existingRules = await prisma.badgeRule.findMany({
        where: { id: { in: DEFAULT_BADGE_RULES.map(rule => rule.id) } },
        select: {
          id: true
        }
      });

      const existingIds = new Set(existingRules.map(rule => rule.id));
      const rulesToWrite = DEFAULT_BADGE_RULES.filter(rule => !existingIds.has(rule.id));

      if (rulesToWrite.length === 0) return;

      await Promise.all(
        rulesToWrite.map(rule =>
          prisma.badgeRule.create({
            data: {
              id: rule.id,
              name: rule.name,
              imageUrl: rule.imageUrl,
              minOrders: rule.minOrders,
              minRating: rule.minRating,
              maxLatePercent: rule.maxLatePercent,
              maxDamagePercent: rule.maxDamagePercent,
              maxCancellationPercent: rule.maxCancellationPercent,
              minRepeatCustomerPercent: rule.minRepeatCustomerPercent,
              maxPolicyViolations: rule.maxPolicyViolations,
              isDefault: true,
              isActive: true,
              priority: rule.priority
            }
          })
        )
      );
    })().catch(error => {
      defaultBadgeRulesPromise = null;
      throw error;
    });
  }

  await defaultBadgeRulesPromise;
};

export const BadgeService = {
  async getBadgeRules() {
    await ensureDefaultBadgeRules();
    const rules = await prisma.badgeRule.findMany({
      orderBy: [{ priority: 'asc' }, { minOrders: 'asc' }, { name: 'asc' }]
    });
    return Promise.all(rules.map(mapRuleForApi));
  },

  async createBadgeRule(data: BadgeRulePayload) {
    await ensureDefaultBadgeRules();

    const name = String(data.name || '').trim();
    if (!name) {
      throw new ValidationError('Badge name is required');
    }

    const minOrders = toNonNegativeInt(data.minOrders, 0);
    const minRating = toRating(data.minRating, 0);
    const maxLatePercent = toPercentMinZero(data.maxLatePercent, 100);
    const maxDamagePercent = toPercentMinZero(data.maxDamagePercent, 100);
    const maxCancellationPercent = toPercentMinZero(data.maxCancellationPercent, 100);
    const minRepeatCustomerPercent = Math.min(
      100,
      Math.max(0, toNumber(data.minRepeatCustomerPercent, 0))
    );
    const maxPolicyViolations = toNonNegativeInt(data.maxPolicyViolations, 9999);
    const isActive = data.isActive === undefined ? true : Boolean(data.isActive);
    const priority = toNonNegativeInt(data.priority, minOrders);
    const imageUrl = toOptionalString(data.imageUrl);
    const slug = toSlug(name) || 'badge-rule';
    const id = `${slug}-${Date.now()}`;

    const created = await prisma.badgeRule.create({
      data: {
        id,
        name,
        imageUrl,
        minOrders,
        minRating,
        maxLatePercent,
        maxDamagePercent,
        maxCancellationPercent,
        minRepeatCustomerPercent,
        maxPolicyViolations,
        isDefault: false,
        isActive,
        priority
      }
    });

    return mapRuleForApi(created);
  },

  async updateBadgeRule(badgeId: string, data: BadgeRulePayload) {
    await ensureDefaultBadgeRules();

    const existing = await prisma.badgeRule.findUnique({
      where: { id: badgeId }
    });

    if (!existing) {
      throw new NotFoundError('Badge rule not found');
    }

    const updated = await prisma.badgeRule.update({
      where: { id: badgeId },
      data: {
        name:
          data.name === undefined ? existing.name : String(data.name || existing.name).trim(),
        imageUrl:
          data.imageUrl === undefined ? existing.imageUrl : toOptionalString(data.imageUrl),
        minOrders:
          data.minOrders === undefined
            ? existing.minOrders
            : toNonNegativeInt(data.minOrders, existing.minOrders),
        minRating:
          data.minRating === undefined ? existing.minRating : toRating(data.minRating, existing.minRating),
        maxLatePercent:
          data.maxLatePercent === undefined
            ? existing.maxLatePercent
            : toPercentMinZero(data.maxLatePercent, existing.maxLatePercent),
        maxDamagePercent:
          data.maxDamagePercent === undefined
            ? existing.maxDamagePercent
            : toPercentMinZero(data.maxDamagePercent, existing.maxDamagePercent),
        maxCancellationPercent:
          data.maxCancellationPercent === undefined
            ? existing.maxCancellationPercent
            : toPercentMinZero(data.maxCancellationPercent, existing.maxCancellationPercent),
        minRepeatCustomerPercent:
          data.minRepeatCustomerPercent === undefined
            ? existing.minRepeatCustomerPercent
            : Math.min(100, Math.max(0, toNumber(data.minRepeatCustomerPercent, existing.minRepeatCustomerPercent))),
        maxPolicyViolations:
          data.maxPolicyViolations === undefined
            ? existing.maxPolicyViolations
            : toNonNegativeInt(data.maxPolicyViolations, existing.maxPolicyViolations),
        isActive:
          data.isActive === undefined ? existing.isActive : Boolean(data.isActive),
        priority:
          data.priority === undefined
            ? existing.priority
            : toNonNegativeInt(data.priority, existing.priority)
      }
    });

    return mapRuleForApi(updated);
  },

  async deleteBadgeRule(badgeId: string) {
    await ensureDefaultBadgeRules();

    const existing = await prisma.badgeRule.findUnique({
      where: { id: badgeId },
      select: {
        id: true,
        name: true,
        isDefault: true
      }
    });

    if (!existing) {
      throw new NotFoundError('Badge rule not found');
    }

    if (existing.isDefault) {
      throw new ValidationError('Default badge rules cannot be deleted');
    }

    const deletedAssignments = await prisma.vendorBadgeAssignment.deleteMany({
      where: { badgeRuleId: badgeId }
    });

    await prisma.badgeRule.delete({
      where: { id: badgeId }
    });

    return {
      id: existing.id,
      name: existing.name,
      removedAssignments: deletedAssignments.count
    };
  },

  async getVendorBadgeHistory(vendorId?: string) {
    if (vendorId) {
      const parsedVendorId = parseVendorId(vendorId);
      const vendor = await prisma.vendorProfile.findFirst({
        where: {
          id: parsedVendorId,
          user: {
            role: { in: SHOP_VENDOR_ROLES }
          }
        },
        select: {
          id: true,
          shopName: true,
          currentBadgeAssignment: {
            include: { badgeRule: true }
          }
        }
      });

      if (!vendor) {
        throw new NotFoundError('Vendor not found');
      }

      if (!vendor.currentBadgeAssignment) {
        return [
          await mapCurrentAssignmentForApi({
            vendorId: vendor.id.toString(),
            vendorName: vendor.shopName,
            source: 'NONE',
            badgeId: null,
            badgeName: null,
            badgeImageUrl: null,
            assignedAt: null
          })
        ];
      }

      return [
        await mapCurrentAssignmentForApi({
          vendorId: vendor.id.toString(),
          vendorName: vendor.shopName,
          source: vendor.currentBadgeAssignment.source,
          badgeId: vendor.currentBadgeAssignment.badgeRuleId,
          badgeName: vendor.currentBadgeAssignment.badgeRule.name,
          badgeImageUrl: vendor.currentBadgeAssignment.badgeRule.imageUrl
            ? String(vendor.currentBadgeAssignment.badgeRule.imageUrl)
            : null,
          assignedAt: vendor.currentBadgeAssignment.assignedAt
        })
      ];
    }

    const vendors = await prisma.vendorProfile.findMany({
      where: {
        user: {
          role: { in: SHOP_VENDOR_ROLES }
        }
      },
      select: {
        id: true,
        shopName: true,
        currentBadgeAssignment: {
          include: { badgeRule: true }
        }
      },
      orderBy: { id: 'asc' }
    });

    return Promise.all(vendors.map(vendor =>
      mapCurrentAssignmentForApi({
        vendorId: vendor.id.toString(),
        vendorName: vendor.shopName,
        source: vendor.currentBadgeAssignment?.source || 'NONE',
        badgeId: vendor.currentBadgeAssignment?.badgeRuleId || null,
        badgeName: vendor.currentBadgeAssignment?.badgeRule?.name || null,
        badgeImageUrl: vendor.currentBadgeAssignment?.badgeRule?.imageUrl
          ? String(vendor.currentBadgeAssignment.badgeRule.imageUrl)
          : null,
        assignedAt: vendor.currentBadgeAssignment?.assignedAt || null
      })
    ));
  },

  async getVendorCurrentBadgeByUserId(userId: string) {
    let parsedUserId: bigint;
    try {
      parsedUserId = BigInt(userId);
    } catch {
      throw new ValidationError('Invalid user id');
    }

    const vendor = await prisma.vendorProfile.findFirst({
      where: {
        userId: parsedUserId,
        user: {
          role: { in: SHOP_VENDOR_ROLES }
        }
      },
      select: {
        id: true,
        shopName: true
      }
    });

    if (!vendor) {
      throw new NotFoundError('Vendor profile not found');
    }

    const latest = await BadgeService.autoAssignVendorBadge(vendor.id.toString());

    if (!latest?.badgeId) {
      return mapCurrentAssignmentForApi({
        vendorId: vendor.id.toString(),
        vendorName: vendor.shopName,
        source: 'NONE',
        badgeId: null,
        badgeName: null,
        badgeImageUrl: null,
        assignedAt: null
      });
    }

    return mapCurrentAssignmentForApi({
      vendorId: vendor.id.toString(),
      vendorName: vendor.shopName,
      source:
        latest?.source === 'MANUAL' || latest?.source === 'AUTO'
          ? latest.source
          : 'AUTO',
      badgeId: latest.badgeId || null,
      badgeName: latest.badgeName || null,
      badgeImageUrl: latest.badgeImageUrl || null,
      assignedAt: latest.assignedAt || null
    });
  },

  async assignBadge(vendorId: string, badgeId: string) {
    await ensureDefaultBadgeRules();
    const vendorExists = await prisma.vendorProfile.findFirst({
      where: {
        id: parseVendorId(vendorId),
        user: {
          role: { in: SHOP_VENDOR_ROLES }
        }
      },
      select: { id: true, shopName: true }
    });
    if (!vendorExists) {
      throw new ValidationError('Badges can only be assigned to shop vendors');
    }

    const rule = await prisma.badgeRule.findUnique({
      where: { id: badgeId }
    });

    if (!rule) {
      throw new ValidationError('Invalid badge id');
    }

    const assignedAt = new Date();
    await prisma.$transaction([
      prisma.vendorBadgeAssignment.upsert({
        where: { vendorId: parseVendorId(vendorId) },
        create: {
          vendorId: parseVendorId(vendorId),
          badgeRuleId: badgeId,
          source: 'MANUAL',
          assignedAt
        },
        update: {
          badgeRuleId: badgeId,
          source: 'MANUAL',
          assignedAt,
          lastEvaluatedAt: null,
          metricsSnapshot: Prisma.JsonNull
        }
      }),
      prisma.vendorBadgeHistory.create({
        data: {
          vendorId: parseVendorId(vendorId),
          badgeRuleId: badgeId,
          source: 'MANUAL',
          assignedAt
        }
      })
    ]);

    return {
      vendorId,
      badgeId,
      badgeName: rule.name,
      badgeImageUrl: await toAccessibleBadgeImageUrl(rule.imageUrl),
      source: 'MANUAL',
      assignedAt
    };
  },

  async unassignBadge(vendorId: string) {
    await ensureDefaultBadgeRules();
    const parsedVendorId = parseVendorId(vendorId);

    const vendor = await prisma.vendorProfile.findFirst({
      where: {
        id: parsedVendorId,
        user: {
          role: { in: SHOP_VENDOR_ROLES }
        }
      },
      select: {
        id: true,
        shopName: true,
        currentBadgeAssignment: {
          include: {
            badgeRule: true
          }
        }
      }
    });

    if (!vendor) {
      throw new ValidationError('Badges can only be unassigned from shop vendors');
    }

    if (!vendor.currentBadgeAssignment) {
      return mapCurrentAssignmentForApi({
        vendorId,
        vendorName: vendor.shopName,
        source: 'NONE',
        badgeId: null,
        badgeName: null,
        badgeImageUrl: null,
        assignedAt: null
      });
    }

    const previousBadgeId = vendor.currentBadgeAssignment.badgeRuleId;
    const previousBadgeName = vendor.currentBadgeAssignment.badgeRule?.name || null;
    const unassignedAt = new Date();

    await prisma.$transaction([
      prisma.vendorBadgeAssignment.delete({
        where: { vendorId: parsedVendorId }
      }),
      prisma.vendorBadgeHistory.create({
        data: {
          vendorId: parsedVendorId,
          badgeRuleId: null,
          source: 'MANUAL',
          assignedAt: unassignedAt,
          metricsSnapshot: {
            action: 'UNASSIGNED',
            previousBadgeId,
            previousBadgeName
          } as any
        }
      })
    ]);

    return {
      vendorId,
      vendorName: vendor.shopName,
      badgeId: null,
      badgeName: null,
      badgeImageUrl: null,
      source: 'NONE',
      assignedAt: null,
      previousBadgeId,
      previousBadgeName,
      unassignedAt
    };
  },

  async calculateVendorPerformance(vendorId: string) {
    const parsedVendorId = parseVendorId(vendorId);
    const completedStatusList = Array.from(BADGE_COMPLETED_STATUSES);
    const cancelledStatusList = Array.from(BADGE_CANCELLED_STATUSES);
    const damagedStatusList = Array.from(BADGE_DAMAGED_STATUSES);

    const [
      completedOrders,
      totalOrders,
      cancelledOrders,
      lateReturns,
      damagedReturns,
      reviewAggregate,
      completedOrderCustomers,
      approvedDamageClaims
    ] = await prisma.$transaction([
      prisma.orderItem.count({
        where: { vendorId: parsedVendorId, status: { in: completedStatusList as any[] } }
      }),
      prisma.orderItem.count({
        where: { vendorId: parsedVendorId }
      }),
      prisma.orderItem.count({
        where: { vendorId: parsedVendorId, status: { in: cancelledStatusList as any[] } }
      }),
      prisma.orderItem.count({
        where: { vendorId: parsedVendorId, status: 'LATE_RETURN' as any }
      }),
      prisma.orderItem.count({
        where: { vendorId: parsedVendorId, status: { in: damagedStatusList as any[] } }
      }),
      prisma.review.aggregate({
        where: {
          vendorId: parsedVendorId,
          status: 'APPROVED'
        },
        _avg: {
          rating: true
        }
      }),
      prisma.orderItem.findMany({
        where: { vendorId: parsedVendorId, status: { in: completedStatusList as any[] } },
        select: {
          order: {
            select: {
              customerId: true
            }
          }
        }
      }),
      prisma.damageClaim.count({
        where: {
          vendorId: parsedVendorId,
          status: { in: ['APPROVED_FULL', 'APPROVED_PARTIAL'] }
        }
      })
    ]);

    const customerCounts = new Map<string, number>();
    for (const row of completedOrderCustomers) {
      const customerId = row.order.customerId.toString();
      customerCounts.set(customerId, (customerCounts.get(customerId) || 0) + 1);
    }

    const totalCustomers = customerCounts.size;
    const repeatCustomers = Array.from(customerCounts.values()).filter(count => count > 1).length;

    const latePercent = completedOrders > 0 ? (lateReturns / completedOrders) * 100 : 0;
    const damagePercent = completedOrders > 0 ? (damagedReturns / completedOrders) * 100 : 0;
    const cancellationPercent = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
    const repeatCustomerPercent = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

    const policyViolations = cancelledOrders + lateReturns + approvedDamageClaims;

    return {
      completedOrders,
      totalOrders,
      cancelledOrders,
      lateReturns,
      damagedReturns,
      latePercent,
      damagePercent,
      cancellationPercent,
      repeatCustomerPercent,
      repeatCustomers,
      totalCustomers,
      policyViolations,
      avgRating: Number(reviewAggregate?._avg?.rating || 0)
    };
  },

  async autoAssignBadge(vendorId: string) {
    await ensureDefaultBadgeRules();
    const performance = await BadgeService.calculateVendorPerformance(vendorId);
    const rules = await prisma.badgeRule.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'asc' }, { minOrders: 'asc' }]
    });

    let eligibleBadge: any = null;
    for (const rule of [...rules].reverse()) {
      if (
        performance.completedOrders >= rule.minOrders &&
        performance.avgRating >= rule.minRating &&
        performance.latePercent <= rule.maxLatePercent &&
        performance.damagePercent <= rule.maxDamagePercent &&
        performance.cancellationPercent <= rule.maxCancellationPercent &&
        performance.repeatCustomerPercent >= rule.minRepeatCustomerPercent &&
        performance.policyViolations <= rule.maxPolicyViolations
      ) {
        eligibleBadge = rule;
        break;
      }
    }

    return eligibleBadge;
  },

  async autoAssignVendorBadge(vendorId: string) {
    await ensureDefaultBadgeRules();
    const parsedVendorId = parseVendorId(vendorId);
    const vendor = await prisma.vendorProfile.findFirst({
      where: { id: parsedVendorId },
      select: {
        id: true,
        shopName: true,
        user: {
          select: {
            role: true
          }
        },
        currentBadgeAssignment: {
          include: {
            badgeRule: true
          }
        }
      }
    });
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    const vendorRole = String(vendor.user?.role || '').trim().toUpperCase();
    if (!SHOP_VENDOR_ROLES.includes(vendorRole as any)) {
      return buildNoBadgeResult(vendorId, vendor.shopName);
    }

    const currentAssignment = vendor.currentBadgeAssignment;
    if (currentAssignment?.source === 'MANUAL') {
      return {
        vendorId,
        vendorName: vendor.shopName,
        badgeId: currentAssignment.badgeRuleId,
        badgeName: currentAssignment.badgeRule.name,
        badgeImageUrl: await toAccessibleBadgeImageUrl(currentAssignment.badgeRule.imageUrl),
        source: 'MANUAL',
        assignedAt: currentAssignment.assignedAt
      };
    }

    const performance = await BadgeService.calculateVendorPerformance(vendorId);
    const badge = await BadgeService.autoAssignBadge(vendorId);

    if (!badge) {
      if (currentAssignment?.source === 'AUTO') {
        await prisma.$transaction([
          prisma.vendorBadgeAssignment.delete({
            where: { vendorId: parsedVendorId }
          }),
          prisma.vendorBadgeHistory.create({
            data: {
              vendorId: parsedVendorId,
              badgeRuleId: null,
              source: 'AUTO',
              assignedAt: new Date(),
              metricsSnapshot: performance as any
            }
          })
        ]);
      }

      return {
        ...buildNoBadgeResult(vendorId, vendor.shopName, performance),
        source: 'AUTO'
      };
    }

    if (
      currentAssignment &&
      currentAssignment.source === 'AUTO' &&
      currentAssignment.badgeRuleId === badge.id
    ) {
      await prisma.vendorBadgeAssignment.update({
        where: { vendorId: parsedVendorId },
        data: {
          lastEvaluatedAt: new Date(),
          metricsSnapshot: performance as any
        }
      });

      return {
        vendorId,
        vendorName: vendor.shopName,
        badgeId: badge.id,
        badgeName: badge.name,
        badgeImageUrl: await toAccessibleBadgeImageUrl(badge.imageUrl),
        source: 'AUTO',
        assignedAt: currentAssignment.assignedAt,
        performance
      };
    }

    const assignedAt = new Date();
    await prisma.$transaction([
      prisma.vendorBadgeAssignment.upsert({
        where: { vendorId: parsedVendorId },
        create: {
          vendorId: parsedVendorId,
          badgeRuleId: badge.id,
          source: 'AUTO',
          assignedAt,
          lastEvaluatedAt: assignedAt,
          metricsSnapshot: performance as any
        },
        update: {
          badgeRuleId: badge.id,
          source: 'AUTO',
          assignedAt,
          lastEvaluatedAt: assignedAt,
          metricsSnapshot: performance as any
        }
      }),
      prisma.vendorBadgeHistory.create({
        data: {
          vendorId: parsedVendorId,
          badgeRuleId: badge.id,
          source: 'AUTO',
          assignedAt,
          metricsSnapshot: performance as any
        }
      })
    ]);

    return {
      vendorId,
      vendorName: vendor.shopName,
      badgeId: badge.id,
      badgeName: badge.name,
      badgeImageUrl: await toAccessibleBadgeImageUrl(badge.imageUrl),
      source: 'AUTO',
      assignedAt,
      performance
    };
  },

  async processAllVendorBadges() {
    await ensureDefaultBadgeRules();
    const vendors = await prisma.vendorProfile.findMany({
      where: {
        user: {
          role: { in: SHOP_VENDOR_ROLES }
        }
      },
      select: {
        id: true
      }
    });

    const results: Array<{
      vendorId: string;
      vendorName: string;
      badgeId: string | null;
      badgeName?: string;
      badgeImageUrl?: string | null;
      source: string;
      assignedAt: Date | null;
      performance?: any;
    }> = [];

    for (const vendor of vendors) {
      const result = await BadgeService.autoAssignVendorBadge(vendor.id.toString());
      results.push(result);
    }

    return results;
  }
};

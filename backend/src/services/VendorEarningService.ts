import { BadgeService } from './BadgeService';
import { NotificationService } from './NotificationService';
import { CommissionService } from './CommissionService';
import { ValidationError } from '../utils/errors';
import { buildUserPublicCode } from '../utils/publicCodes';
import prisma from '../config/db';
import { DamageClaimStatus, OrderItemStatus, TrialRequestStatus, UserRole } from '@prisma/client';

type PaginationInput = { page?: number; limit?: number };
type VendorPayoutCycle = 'DAILY' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
type OptionalPeriod = { from: Date; to: Date } | undefined;

const DEPOSIT_LIABILITY_STATUSES: OrderItemStatus[] = [
  OrderItemStatus.PLACED,
  OrderItemStatus.BOOKED,
  OrderItemStatus.RENTAL_CONFIRMED,
  OrderItemStatus.ACCEPTED,
  OrderItemStatus.READY_FOR_PICKUP,
  OrderItemStatus.PICKED_UP,
  OrderItemStatus.OUT_FOR_DELIVERY,
  OrderItemStatus.DISPATCHED,
  OrderItemStatus.DELIVERED,
  OrderItemStatus.RETURN_SCHEDULED,
  OrderItemStatus.RETURNED,
  OrderItemStatus.DAMAGE_REVIEW,
  OrderItemStatus.RETURN_REQUESTED,
  OrderItemStatus.RETURN_RECEIVED,
  OrderItemStatus.INSPECTED_DAMAGED,
  OrderItemStatus.INSPECTED_LOST
];

const isMissingColumnError = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return code === 'P2022' || message.includes('does not exist in the current database');
};

const normalizeCycle = (value?: string | null): VendorPayoutCycle => {
  const normalized = String(value || 'MONTHLY').trim().toUpperCase();
  if (normalized === 'DAILY') return 'DAILY';
  if (normalized === 'WEEKLY') return 'WEEKLY';
  if (normalized === 'FORTNIGHTLY') return 'FORTNIGHTLY';
  return 'MONTHLY';
};

const getNextPayoutDate = (cycle: VendorPayoutCycle) => {
  const now = new Date();
  const next = new Date(now);

  if (cycle === 'DAILY') {
    next.setDate(now.getDate() + 1);
  } else if (cycle === 'WEEKLY') {
    next.setDate(now.getDate() + 7);
  } else if (cycle === 'FORTNIGHTLY') {
    next.setDate(now.getDate() + 14);
  } else {
    next.setMonth(now.getMonth() + 1);
  }

  return next;
};

const toRounded = (value: number) => Number(value.toFixed(2));

const EXCLUDED_VENDOR_PAYOUT_STATUSES: OrderItemStatus[] = [
  OrderItemStatus.CANCELLED,
  OrderItemStatus.REJECTED
];

const resolveVendorProfileId = async (vendorIdentifier: string): Promise<bigint> => {
  let vendorIdBig: bigint;
  try {
    vendorIdBig = BigInt(vendorIdentifier);
  } catch {
    throw new ValidationError('Invalid vendor identifier');
  }

  let vendor: { id: bigint } | null = null;
  try {
    vendor = await prisma.vendorProfile.findFirst({
      where: {
        OR: [
          { id: vendorIdBig },
          { userId: vendorIdBig }
        ]
      },
      select: { id: true }
    });
  } catch (error: any) {
    if (error?.code !== 'P2022') throw error;

    const rows = await prisma.$queryRawUnsafe<Array<{ id: string | number | bigint }>>(
      `SELECT "id"
       FROM "VendorProfile"
       WHERE "id" = $1 OR "userId" = $1
       LIMIT 1`,
      vendorIdBig.toString()
    );

    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id !== undefined && rows[0]?.id !== null) {
      vendor = { id: BigInt(rows[0].id) };
    }
  }

  if (!vendor) {
    throw new ValidationError('Vendor not found');
  }

  return vendor.id;
};

const getVendorFinancialConfig = async (vendorProfileId: bigint) => {
  try {
    const vendor = await prisma.vendorProfile.findUnique({
      where: { id: vendorProfileId },
      select: {
        commissionOverridePercentage: true,
        commissionRate: true,
        commissionPercentage: true,
        payoutCycle: true,
        user: {
          select: {
            role: true
          }
        }
      }
    });

    const commissionRate = await CommissionService.getEffectiveCommissionRateForVendorProfile(
      vendorProfileId,
      vendor
    );
    const payoutCycle = normalizeCycle(vendor?.payoutCycle || 'MONTHLY');
    return { commissionRate, payoutCycle };
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    return { commissionRate: 0, payoutCycle: normalizeCycle('MONTHLY') };
  }
};

const computeVendorPayoutFigures = async (vendorProfileId: bigint, period?: OptionalPeriod) => {
  const { commissionRate } = await getVendorFinancialConfig(vendorProfileId);

  const orderWhere: any = {
    vendorId: vendorProfileId,
    order: { paymentStatus: { in: ['PAID', 'REFUND_PENDING'] } },
    status: { notIn: EXCLUDED_VENDOR_PAYOUT_STATUSES }
  };

  if (period?.from && period?.to) {
    orderWhere.order.createdAt = { gte: period.from, lte: period.to };
  }

  const settlementWhere: any = {
    vendorId: vendorProfileId,
    status: 'COMPLETED'
  };

  if (period?.from && period?.to) {
    settlementWhere.createdAt = { gte: period.from, lte: period.to };
  }

  const pendingSettlementWhere: any = {
    vendorId: vendorProfileId,
    status: 'PENDING'
  };

  if (period?.from && period?.to) {
    pendingSettlementWhere.createdAt = { gte: period.from, lte: period.to };
  }

  const [orderAggregate, paidSettlements, pendingSettlements] = await Promise.all([
    prisma.orderItem.aggregate({
      where: orderWhere,
      _sum: { rentPrice: true },
      _count: { id: true }
    }),
    prisma.vendorSettlement.aggregate({
      where: settlementWhere,
      _sum: { amount: true }
    }),
    prisma.vendorSettlement.aggregate({
      where: pendingSettlementWhere,
      _sum: { amount: true }
    })
  ]);

  const grossRentalRevenue = Number(orderAggregate._sum.rentPrice || 0);
  const commissionDeducted = Math.max(0, (grossRentalRevenue * commissionRate) / 100);
  const netPayableTotal = Math.max(0, grossRentalRevenue - commissionDeducted);
  const totalSettled = Number(paidSettlements._sum.amount || 0);
  const totalPendingSettlements = Number(pendingSettlements._sum.amount || 0);
  const pendingPayout = Math.max(0, netPayableTotal - totalSettled);
  const availableForNewSettlement = Math.max(0, pendingPayout - totalPendingSettlements);
  const orderCount = Number(orderAggregate._count.id || 0);

  return {
    commissionRate,
    grossRentalRevenue,
    commissionDeducted,
    netPayableTotal,
    totalSettled,
    totalPendingSettlements,
    pendingPayout,
    availableForNewSettlement,
    orderCount
  };
};

const computeDepositSummary = async (vendorProfileId: bigint) => {
  try {
    const rows = await prisma.orderItem.findMany({
      where: {
        vendorId: vendorProfileId,
        order: { paymentStatus: { in: ['PAID', 'REFUND_PENDING'] } },
        status: { notIn: [OrderItemStatus.CANCELLED, OrderItemStatus.REJECTED] }
      },
      select: {
        deposit: true,
        securityDepositRefunded: true,
        securityDepositHeld: true
      }
    });

    let securityDepositReceived = 0;
    let securityDepositRefunded = 0;
    let securityDepositHeldForDamage = 0;

    for (const row of rows) {
      const received = Math.max(0, Number(row.deposit || 0));
      const refunded = Math.min(received, Math.max(0, Number(row.securityDepositRefunded || 0)));
      const held = Math.min(received, Math.max(0, Number(row.securityDepositHeld || 0)));

      securityDepositReceived += received;
      securityDepositRefunded += refunded;
      securityDepositHeldForDamage += held;
    }

    const depositLiability = Math.max(
      0,
      securityDepositReceived - securityDepositRefunded - securityDepositHeldForDamage
    );

    return {
      securityDepositReceived,
      securityDepositRefunded,
      securityDepositHeldForDamage,
      depositLiability
    };
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;

    // Backward-compatible fallback if split columns are not migrated yet.
    const aggregate = await prisma.orderItem.aggregate({
      where: {
        vendorId: vendorProfileId,
        order: { paymentStatus: { in: ['PAID', 'REFUND_PENDING'] } },
        status: { in: DEPOSIT_LIABILITY_STATUSES }
      },
      _sum: { deposit: true }
    });

    const depositLiability = Number(aggregate._sum.deposit || 0);
    return {
      securityDepositReceived: depositLiability,
      securityDepositRefunded: 0,
      securityDepositHeldForDamage: 0,
      depositLiability
    };
  }
};

export const VendorEarningService = {
  async createVendorEarning(tx: any, vendorId: string, orderItemId: string, rentPrice: number) {
    const vendor = await tx.vendorProfile.findUnique({ where: { id: BigInt(vendorId) } });
    if (!vendor) {
      throw new ValidationError('Vendor not found');
    }

    const commissionRate = await CommissionService.getEffectiveCommissionRateForVendorProfile(
      BigInt(vendorId),
      vendor
    );
    const commission = (rentPrice * commissionRate) / 100;
    const vendorEarning = Math.max(0, rentPrice - commission);

    await tx.vendorTransaction.create({
      data: {
        vendorId: BigInt(vendorId),
        orderItemId: BigInt(orderItemId),
        type: 'CREDIT',
        amount: vendorEarning
      }
    });

    return { vendorEarning, commission };
  },

  async getVendorBalance(vendorId: string) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const payout = await computeVendorPayoutFigures(vendorProfileId);
    const totalCredits = toRounded(payout.netPayableTotal);
    const totalDebits = toRounded(payout.totalSettled);
    const availableBalance = toRounded(payout.pendingPayout);

    return {
      totalCredits,
      totalDebits,
      availableBalance,
      pendingSettlementGenerated: toRounded(payout.totalPendingSettlements)
    };
  },

  async getVendorEarningsSummary(vendorId: string) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const { payoutCycle } = await getVendorFinancialConfig(vendorProfileId);

    const [depositSummary, payout] = await Promise.all([
      computeDepositSummary(vendorProfileId),
      computeVendorPayoutFigures(vendorProfileId)
    ]);

    const grossRentalRevenue = toRounded(payout.grossRentalRevenue);
    const commissionDeducted = toRounded(payout.commissionDeducted);
    const netPayable = toRounded(payout.netPayableTotal);
    const pendingPayout = toRounded(payout.pendingPayout);
    const nextPayoutDate = getNextPayoutDate(payoutCycle).toISOString();
    const securityDepositReceived = toRounded(depositSummary.securityDepositReceived);
    const securityDepositRefunded = toRounded(depositSummary.securityDepositRefunded);
    const securityDepositHeldForDamage = toRounded(depositSummary.securityDepositHeldForDamage);
    const depositLiability = toRounded(depositSummary.depositLiability);

    return {
      commissionRate: toRounded(payout.commissionRate),
      grossRentalRevenue,
      commissionDeducted,
      netPayable,
      pendingPayout,
      nextPayoutDate,
      totalSettled: toRounded(payout.totalSettled),
      depositLiability,
      securityDepositReceived,
      securityDepositRefunded,
      securityDepositHeldForDamage
    };
  },

  async createSettlement(_adminId: string, vendorId: string) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const payout = await computeVendorPayoutFigures(vendorProfileId);
    if (payout.availableForNewSettlement <= 0) {
      throw new ValidationError('No balance available for settlement');
    }

    const vendor = await prisma.vendorProfile.findUnique({ where: { id: vendorProfileId } });
    if (!vendor) {
      throw new ValidationError('Vendor not found');
    }

    return prisma.vendorSettlement.create({
      data: {
        vendorId: vendorProfileId,
        amount: payout.availableForNewSettlement,
        status: 'PENDING'
      }
    });
  },

  async approveSettlement(_adminId: string, settlementId: string) {
    const settlement = await prisma.vendorSettlement.findFirst({
      where: { id: BigInt(settlementId), status: 'PENDING' },
      include: { vendor: { include: { user: true } } }
    });

    if (!settlement) throw new ValidationError('Settlement not found or already processed');
    const updated = await prisma.vendorSettlement.update({
      where: { id: settlement.id },
      data: { status: 'COMPLETED' }
    });

    await NotificationService.notifyVendorSettlement(settlement.vendorId.toString(), Number(settlement.amount));
    await BadgeService.autoAssignBadge(settlement.vendorId.toString());

    return updated;
  },

  async getVendorTransactions(vendorId: string, filters: PaginationInput) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const transactions = await prisma.vendorTransaction.findMany({
      where: { vendorId: vendorProfileId },
      include: { orderItem: true },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.vendorTransaction.count({ where: { vendorId: vendorProfileId } });
    return { transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },

  async getVendorSettlements(vendorId: string, filters: PaginationInput) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const settlements = await prisma.vendorSettlement.findMany({
      where: { vendorId: vendorProfileId },
      skip,
      take: limit,
      orderBy: { id: 'desc' }
    });

    const total = await prisma.vendorSettlement.count({ where: { vendorId: vendorProfileId } });
    return { settlements, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },

  async getPendingSettlements(filters: PaginationInput) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const settlements = await prisma.vendorSettlement.findMany({
      where: { status: 'PENDING' },
      include: { vendor: { include: { user: true } } },
      skip,
      take: limit,
      orderBy: { id: 'desc' }
    });

    const total = await prisma.vendorSettlement.count({ where: { status: 'PENDING' } });
    return { settlements, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },

  async getVendorCustomers(vendorId: string, filters: PaginationInput) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const orderItems = await prisma.orderItem.findMany({
      where: {
        vendorId: vendorProfileId,
        order: { paymentStatus: { in: ['PAID', 'REFUND_PENDING'] } }
      },
      include: {
        order: {
          include: {
            customer: true
          }
        }
      },
      orderBy: { id: 'desc' }
    });

    const customerMap = new Map<string, {
      id: string;
      publicCode: string;
      name: string;
      email: string | null;
      phone: string | null;
      totalOrders: number;
      totalItems: number;
      totalRentPaid: number;
      lastOrderAt: Date | null;
      orderIds: Set<string>;
    }>();

    for (const item of orderItems) {
      const customer = item.order.customer;
      if (!customer) continue;

      const customerId = customer.id.toString();
      const orderId = item.orderId.toString();

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          id: customerId,
          publicCode: String(
            (customer as any)?.publicCode || buildUserPublicCode(UserRole.CUSTOMER, customer.id)
          ),
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          totalOrders: 0,
          totalItems: 0,
          totalRentPaid: 0,
          lastOrderAt: item.order.createdAt ?? null,
          orderIds: new Set<string>()
        });
      }

      const summary = customerMap.get(customerId)!;
      summary.totalItems += Number(item.quantity || 0);
      summary.totalRentPaid += Number(item.rentPrice || 0);
      summary.orderIds.add(orderId);

      if (!summary.lastOrderAt || item.order.createdAt > summary.lastOrderAt) {
        summary.lastOrderAt = item.order.createdAt;
      }
    }

    const customerIdBigInts = Array.from(customerMap.keys()).map((id) => BigInt(id));
    const trialCountByCustomer = new Map<string, number>();
    const noShowCountByCustomer = new Map<string, number>();
    const damageHistoryCountByCustomer = new Map<string, number>();
    const damageHistoryAmountByCustomer = new Map<string, number>();
    const depositDisputeCountByCustomer = new Map<string, number>();

    if (customerIdBigInts.length > 0) {
      const trialGrouped = await prisma.trialRequest.groupBy({
        by: ['customerId'],
        where: {
          vendorId: vendorProfileId,
          customerId: { in: customerIdBigInts }
        },
        _count: { _all: true }
      });

      for (const row of trialGrouped) {
        trialCountByCustomer.set(row.customerId.toString(), Number(row._count._all || 0));
      }

      const noShowStatus = (TrialRequestStatus as unknown as Record<string, string>).NO_SHOW;
      if (noShowStatus) {
        try {
          const noShowGrouped = await prisma.trialRequest.groupBy({
            by: ['customerId'],
            where: {
              vendorId: vendorProfileId,
              customerId: { in: customerIdBigInts },
              status: noShowStatus as any
            },
            _count: { _all: true }
          });

          for (const row of noShowGrouped) {
            noShowCountByCustomer.set(row.customerId.toString(), Number(row._count._all || 0));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
          const isEnumOrValidationIssue =
            message.includes('invalid input value for enum') ||
            message.includes('expected trialrequeststatus') ||
            message.includes('invalid value for argument `status`');

          if (!isEnumOrValidationIssue) {
            throw error;
          }
        }
      }

      const claimRows: any[] = await (prisma.damageClaim as any).findMany({
        where: {
          vendorId: vendorProfileId,
          OrderItem: {
            order: {
              customerId: { in: customerIdBigInts }
            }
          }
        },
        select: {
          status: true,
          approvedAmount: true,
          repairCost: true,
          OrderItem: {
            select: {
              order: {
                select: {
                  customerId: true
                }
              }
            }
          }
        }
      });

      const disputedStatuses = new Set<DamageClaimStatus>([
        DamageClaimStatus.PENDING,
        DamageClaimStatus.APPROVED_PARTIAL,
        DamageClaimStatus.REJECTED
      ]);

      for (const row of claimRows) {
        const relatedOrderItem = row.orderItem || row.OrderItem;
        const customerId = relatedOrderItem?.order?.customerId?.toString();
        if (!customerId) {
          continue;
        }
        damageHistoryCountByCustomer.set(
          customerId,
          Number(damageHistoryCountByCustomer.get(customerId) || 0) + 1
        );

        const impactAmount = Math.max(
          Number(row.approvedAmount || 0),
          Number(row.repairCost || 0)
        );
        damageHistoryAmountByCustomer.set(
          customerId,
          Number(damageHistoryAmountByCustomer.get(customerId) || 0) + impactAmount
        );

        if (disputedStatuses.has(row.status)) {
          depositDisputeCountByCustomer.set(
            customerId,
            Number(depositDisputeCountByCustomer.get(customerId) || 0) + 1
          );
        }
      }
    }

    const allCustomers = Array.from(customerMap.values())
      .map((customer) => ({
        id: customer.id,
        publicCode: customer.publicCode,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        totalOrders: customer.orderIds.size,
        totalItems: customer.totalItems,
        totalRentPaid: customer.totalRentPaid,
        lastOrderAt: customer.lastOrderAt,
        trialCount: Number(trialCountByCustomer.get(customer.id) || 0),
        noShowCount: Number(noShowCountByCustomer.get(customer.id) || 0),
        damageHistoryCount: Number(damageHistoryCountByCustomer.get(customer.id) || 0),
        damageHistoryAmount: Number(damageHistoryAmountByCustomer.get(customer.id) || 0),
        depositDisputeCount: Number(depositDisputeCountByCustomer.get(customer.id) || 0),
        isRepeatCustomer: customer.orderIds.size > 1
      }))
      .sort((a, b) => {
        const aTime = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
        const bTime = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
        return bTime - aTime;
      });

    const total = allCustomers.length;
    const repeatCustomers = allCustomers.filter((customer) => customer.isRepeatCustomer).length;
    const repeatCustomerPercent =
      total > 0 ? Number(((repeatCustomers / total) * 100).toFixed(2)) : 0;
    const totalTrials = allCustomers.reduce((sum, customer) => sum + customer.trialCount, 0);
    const totalNoShows = allCustomers.reduce((sum, customer) => sum + customer.noShowCount, 0);
    const totalDamageCases = allCustomers.reduce((sum, customer) => sum + customer.damageHistoryCount, 0);
    const totalDepositDisputes = allCustomers.reduce(
      (sum, customer) => sum + customer.depositDisputeCount,
      0
    );

    const start = (page - 1) * limit;
    const customers = allCustomers.slice(start, start + limit);

    return {
      customers,
      summary: {
        totalCustomers: total,
        repeatCustomers,
        repeatCustomerPercent,
        totalTrials,
        totalNoShows,
        totalDamageCases,
        totalDepositDisputes
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
};

import { OrderItemStatus, PaymentStatus } from '@prisma/client';
import prisma from '../config/db';
import { CommissionService } from './CommissionService';
import { getVendorProfileUserWhere } from '../utils/vendorScope';
import { ValidationError } from '../utils/errors';

type ReportsDateRange = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

type ReportsOverviewInput = {
  dateRange?: string;
  customStart?: string;
  customEnd?: string;
};

type Period = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  bucket: 'day' | 'month';
};

const INCLUDED_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.REFUND_PENDING,
  PaymentStatus.REFUNDED
];

const ACTIVE_RENTAL_STATUSES: OrderItemStatus[] = [
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
  OrderItemStatus.RETURN_RECEIVED
];

const ORDER_COMPLETED_STATUSES = new Set<string>([
  'COMPLETED',
  'SECURITY_DEPOSIT_REFUNDED',
  'INSPECTED_GOOD'
]);

const ORDER_CANCELLED_STATUSES = new Set<string>(['CANCELLED', 'REJECTED']);

const ORDER_RETURNED_STATUSES = new Set<string>([
  'RETURN_REQUESTED',
  'RETURN_SCHEDULED',
  'RETURNED',
  'RETURN_RECEIVED',
  'DAMAGE_REVIEW',
  'INSPECTED_DAMAGED',
  'INSPECTED_LOST',
  'LATE_RETURN'
]);

const toSafeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value: number) => Number(value.toFixed(2));

const parseDateOnly = (value: string, fieldName: string) => {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new ValidationError(`${fieldName} must be in YYYY-MM-DD format`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day, 0, 0, 0, 0);
};

const getStartOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getEndOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const diffInCalendarDays = (start: Date, end: Date) =>
  Math.max(1, Math.round((getEndOfDay(end).getTime() - getStartOfDay(start).getTime()) / (24 * 60 * 60 * 1000)) + 1);

const resolvePeriod = (input: ReportsOverviewInput): Period => {
  const now = new Date();
  const todayStart = getStartOfDay(now);
  const todayEnd = getEndOfDay(now);
  const dateRange = String(input.dateRange || 'month').trim().toLowerCase() as ReportsDateRange;

  let start = addDays(todayStart, -29);
  let end = todayEnd;
  let bucket: 'day' | 'month' = 'day';

  if (dateRange === 'today') {
    start = todayStart;
    end = todayEnd;
  } else if (dateRange === 'yesterday') {
    start = addDays(todayStart, -1);
    end = getEndOfDay(start);
  } else if (dateRange === 'week') {
    start = addDays(todayStart, -6);
    end = todayEnd;
  } else if (dateRange === 'month') {
    start = addDays(todayStart, -29);
    end = todayEnd;
  } else if (dateRange === 'quarter') {
    start = addDays(todayStart, -89);
    end = todayEnd;
  } else if (dateRange === 'year') {
    start = new Date(todayStart.getFullYear(), todayStart.getMonth() - 11, 1);
    end = todayEnd;
    bucket = 'month';
  } else if (dateRange === 'custom') {
    if (!input.customStart || !input.customEnd) {
      throw new ValidationError('customStart and customEnd are required for custom date range');
    }

    start = parseDateOnly(input.customStart, 'customStart');
    end = getEndOfDay(parseDateOnly(input.customEnd, 'customEnd'));
    if (end < start) {
      throw new ValidationError('customEnd must be on or after customStart');
    }
    if (diffInCalendarDays(start, end) > 120) {
      bucket = 'month';
    }
  }

  const durationMs = end.getTime() - start.getTime() + 1;
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs + 1);

  return { start, end, previousStart, previousEnd, bucket };
};

const toBucketKey = (date: Date, bucket: 'day' | 'month') => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  if (bucket === 'month') {
    return `${year}-${month}-01`;
  }

  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildBucketKeys = (period: Period) => {
  const keys: string[] = [];

  if (period.bucket === 'month') {
    const cursor = new Date(period.start.getFullYear(), period.start.getMonth(), 1);
    const endCursor = new Date(period.end.getFullYear(), period.end.getMonth(), 1);
    while (cursor <= endCursor) {
      keys.push(toBucketKey(cursor, 'month'));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return keys;
  }

  const cursor = getStartOfDay(period.start);
  const endCursor = getStartOfDay(period.end);
  while (cursor <= endCursor) {
    keys.push(toBucketKey(cursor, 'day'));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
};

const calculateGrowthRate = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return round(((current - previous) / previous) * 100);
};

const classifyOrderStatus = (status: string) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (ORDER_COMPLETED_STATUSES.has(normalized)) return 'Completed';
  if (ORDER_CANCELLED_STATUSES.has(normalized)) return 'Cancelled';
  if (ORDER_RETURNED_STATUSES.has(normalized)) return 'Returned';
  return 'Pending';
};

export const AdminReportService = {
  async getOverview(input: ReportsOverviewInput, roleFilter?: Record<string, any>) {
    const period = resolvePeriod(input);
    const vendorProfileWhere = getVendorProfileUserWhere(roleFilter);
    const commissionSettings = await CommissionService.getCommissionSettings();

    const [
      reportOrderItems,
      previousOrderItems,
      scopedProducts,
      activeRentals,
      pendingQC,
      maintenanceTasks,
      pendingSettlements,
      reviewsAggregate,
      allTimeProductRentals
    ] = await Promise.all([
      prisma.orderItem.findMany({
        where: {
          vendorProfile: vendorProfileWhere,
          order: {
            paymentStatus: { in: INCLUDED_PAYMENT_STATUSES },
            createdAt: { gte: period.start, lte: period.end }
          }
        },
        include: {
          order: {
            select: {
              id: true,
              createdAt: true,
              paymentStatus: true
            }
          },
          product: {
            select: {
              id: true,
              name: true,
              createdAt: true,
              category: { select: { name: true } }
            }
          },
          vendorProfile: {
            select: {
              id: true,
              commissionOverridePercentage: true,
              commissionPercentage: true,
              commissionRate: true,
              user: {
                select: {
                  role: true
                }
              }
            }
          }
        }
      }),
      prisma.orderItem.findMany({
        where: {
          vendorProfile: vendorProfileWhere,
          order: {
            paymentStatus: { in: INCLUDED_PAYMENT_STATUSES },
            createdAt: { gte: period.previousStart, lte: period.previousEnd }
          }
        },
        select: {
          rentPrice: true
        }
      }),
      prisma.product.findMany({
        where: {
          vendor: vendorProfileWhere
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          status: true,
          category: { select: { name: true } }
        }
      }),
      prisma.orderItem.findMany({
        where: {
          vendorProfile: vendorProfileWhere,
          status: { in: ACTIVE_RENTAL_STATUSES }
        },
        select: {
          id: true,
          productId: true
        }
      }),
      prisma.orderItemQualityCheck.count({
        where: {
          vendor: vendorProfileWhere,
          status: 'PENDING'
        }
      }),
      prisma.orderItemMaintenanceTask.count({
        where: {
          vendor: vendorProfileWhere,
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        }
      }),
      prisma.vendorSettlement.aggregate({
        where: {
          vendor: vendorProfileWhere,
          status: 'PENDING'
        },
        _sum: { amount: true }
      }),
      prisma.review.aggregate({
        where: {
          vendor: vendorProfileWhere,
          createdAt: { gte: period.start, lte: period.end }
        },
        _avg: { rating: true }
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          vendorProfile: vendorProfileWhere,
          order: {
            paymentStatus: { in: INCLUDED_PAYMENT_STATUSES }
          }
        },
        _count: { _all: true }
      })
    ]);

    const totalRevenue = reportOrderItems.reduce(
      (sum, item) => sum + toSafeNumber(item.rentPrice),
      0
    );
    const previousRevenue = previousOrderItems.reduce(
      (sum, item) => sum + toSafeNumber(item.rentPrice),
      0
    );

    const bucketKeys = buildBucketKeys(period);
    const revenueBuckets = new Map<
      string,
      {
        revenue: number;
        commission: number;
        payout: number;
        orderIds: Set<string>;
      }
    >();

    bucketKeys.forEach((key) => {
      revenueBuckets.set(key, {
        revenue: 0,
        commission: 0,
        payout: 0,
        orderIds: new Set<string>()
      });
    });

    const categoryMap = new Map<string, { category: string; rentals: number; revenue: number }>();
    const orderCategoryMap = new Map<string, { category: string; count: number; revenue: number }>();
    const orderStatusMap = new Map<string, number>([
      ['Completed', 0],
      ['Cancelled', 0],
      ['Returned', 0],
      ['Pending', 0]
    ]);

    let totalCommission = 0;
    let totalOwnerPayout = 0;
    let totalRefundAmount = 0;
    let totalDepositHeld = 0;
    let totalRentalDurationDays = 0;
    let rentalDurationCount = 0;
    let totalProcessingDays = 0;
    let processingDaysCount = 0;
    const uniqueOrderIds = new Set<string>();

    for (const item of reportOrderItems) {
      const itemRevenue = toSafeNumber(item.rentPrice);
      const commissionRate = CommissionService.resolveEffectiveCommissionRate(
        item.vendorProfile,
        commissionSettings
      );
      const commissionAmount = (itemRevenue * commissionRate) / 100;
      const ownerPayout = Math.max(0, itemRevenue - commissionAmount);
      const orderCreatedAt = new Date(item.order.createdAt);
      const bucketKey = toBucketKey(orderCreatedAt, period.bucket);

      const bucket = revenueBuckets.get(bucketKey);
      if (bucket) {
        bucket.revenue += itemRevenue;
        bucket.commission += commissionAmount;
        bucket.payout += ownerPayout;
        bucket.orderIds.add(item.orderId.toString());
      }

      totalCommission += commissionAmount;
      totalOwnerPayout += ownerPayout;
      totalDepositHeld += toSafeNumber(item.securityDepositHeld);
      if (String(item.order.paymentStatus || '').toUpperCase() === 'REFUNDED') {
        totalRefundAmount += itemRevenue;
      }

      uniqueOrderIds.add(item.orderId.toString());

      if (item.rentalStartDate) {
        const processingMs =
          new Date(item.rentalStartDate).getTime() - new Date(item.order.createdAt).getTime();
        if (processingMs >= 0) {
          totalProcessingDays += processingMs / (24 * 60 * 60 * 1000);
          processingDaysCount += 1;
        }
      }

      if (item.rentalStartDate && item.returnDueDate) {
        const durationMs =
          new Date(item.returnDueDate).getTime() - new Date(item.rentalStartDate).getTime();
        if (durationMs >= 0) {
          totalRentalDurationDays += durationMs / (24 * 60 * 60 * 1000) + 1;
          rentalDurationCount += 1;
        }
      }

      const category = item.product?.category?.name || 'Uncategorized';
      const categorySummary = categoryMap.get(category) || {
        category,
        rentals: 0,
        revenue: 0
      };
      categorySummary.rentals += 1;
      categorySummary.revenue += itemRevenue;
      categoryMap.set(category, categorySummary);

      const orderCategorySummary = orderCategoryMap.get(category) || {
        category,
        count: 0,
        revenue: 0
      };
      orderCategorySummary.count += 1;
      orderCategorySummary.revenue += itemRevenue;
      orderCategoryMap.set(category, orderCategorySummary);

      const statusLabel = classifyOrderStatus(String(item.status || ''));
      orderStatusMap.set(statusLabel, Number(orderStatusMap.get(statusLabel) || 0) + 1);
    }

    const activeProductIds = new Set(
      scopedProducts
        .filter((product) => String(product.status || '').toUpperCase() === 'ACTIVE')
        .map((product) => product.id.toString())
    );
    const activeRentalProductIds = new Set(
      activeRentals.map((item) => item.productId.toString())
    );

    const productRentalCountMap = new Map<string, number>(
      allTimeProductRentals.map((row) => [
        row.productId.toString(),
        Number(row._count._all || 0)
      ])
    );

    const lowPerformingOutfits = scopedProducts
      .map((product) => {
        const createdAt = new Date(product.createdAt);
        const daysListed = Math.max(
          1,
          Math.round((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000))
        );
        return {
          id: product.id.toString(),
          name: product.name || 'Product',
          rentals: Number(productRentalCountMap.get(product.id.toString()) || 0),
          daysListed
        };
      })
      .sort((a, b) => {
        if (a.rentals === b.rentals) return b.daysListed - a.daysListed;
        return a.rentals - b.rentals;
      })
      .slice(0, 3);

    const revenueData = bucketKeys.map((key) => {
      const bucket = revenueBuckets.get(key);
      return {
        date: key,
        revenue: round(bucket?.revenue || 0),
        orders: bucket?.orderIds.size || 0,
        commission: round(bucket?.commission || 0),
        payout: round(bucket?.payout || 0)
      };
    });

    const ordersByStatus = Array.from(orderStatusMap.entries()).map(([status, count]) => ({
      status,
      count
    }));
    const completedOrders = Number(orderStatusMap.get('Completed') || 0);
    const cancelledOrders = Number(orderStatusMap.get('Cancelled') || 0);
    const returnedOrders = Number(orderStatusMap.get('Returned') || 0);
    const pendingOrders = Number(orderStatusMap.get('Pending') || 0);
    const totalOrders = completedOrders + cancelledOrders + returnedOrders + pendingOrders;

    const topPerformingCategories = Array.from(categoryMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((row) => ({
        category: row.category,
        rentals: row.rentals,
        revenue: round(row.revenue)
      }));

    const ordersByCategory = Array.from(orderCategoryMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((row) => ({
        category: row.category,
        count: row.count,
        revenue: round(row.revenue)
      }));

    const totalOutfits = scopedProducts.length;
    const activeRentalsCount = activeRentals.length;
    const availableOutfits = Math.max(
      0,
      activeProductIds.size - activeRentalProductIds.size
    );

    return {
      revenueData,
      revenueMetrics: {
        totalRevenue: round(totalRevenue),
        platformCommission: round(totalCommission),
        ownerPayout: round(totalOwnerPayout),
        netProfit: round(totalCommission),
        pendingPayouts: round(toSafeNumber(pendingSettlements._sum.amount)),
        averageOrderValue: round(uniqueOrderIds.size > 0 ? totalRevenue / uniqueOrderIds.size : 0),
        refundAmount: round(totalRefundAmount),
        depositHeld: round(totalDepositHeld),
        growthRate: calculateGrowthRate(totalRevenue, previousRevenue)
      },
      inventoryMetrics: {
        totalOutfits,
        activeRentals: activeRentalsCount,
        availableOutfits,
        pendingQC,
        underMaintenance: maintenanceTasks,
        totalRentalsCount: reportOrderItems.length,
        utilizationRate: round(totalOutfits > 0 ? (activeRentalsCount / totalOutfits) * 100 : 0),
        averageRentalDuration: round(
          rentalDurationCount > 0 ? totalRentalDurationDays / rentalDurationCount : 0
        ),
        topPerformingCategories,
        lowPerformingOutfits
      },
      orderMetrics: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        returnedOrders,
        pendingOrders,
        averageProcessingTime: round(
          processingDaysCount > 0 ? totalProcessingDays / processingDaysCount : 0
        ),
        averageDeliveryTime: round(
          rentalDurationCount > 0 ? totalRentalDurationDays / rentalDurationCount : 0
        ),
        returnRate: round(totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0),
        cancellationRate: round(totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0),
        customerSatisfaction: round(toSafeNumber(reviewsAggregate._avg.rating)),
        ordersByStatus,
        ordersByCategory
      }
    };
  }
};

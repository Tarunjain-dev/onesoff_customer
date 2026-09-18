import prisma from '../config/db';
import { OrderItemStatus } from '@prisma/client';
import { getVendorProfileUserWhere, getVendorUserRoleWhere, matchesVendorRoleScope } from '../utils/vendorScope';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toNumber = (value: unknown): number => Number(value || 0);

const toRoundedPercent = (value: number): number =>
  Number(value.toFixed(2));

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfCurrentWeek = (date: Date): Date => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const parseInputDate = (dateString?: string): Date | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const getPercentChange = (current: number, previous: number): number => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
};

const isMissingColumnError = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return code === 'P2022' || message.includes('does not exist in the current database');
};

export const AdminDashboardService = {
  async getDashboardStats(
    roleFilter?: Record<string, any>,
    chartOptions?: { range?: string; from?: string; to?: string }
  ) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday.getTime() - DAY_IN_MS);
    const startOfCurrentWindow = new Date(now.getTime() - 30 * DAY_IN_MS);
    const requestedRange = String(chartOptions?.range || '7D').toUpperCase();

    let chartStartDate = getStartOfCurrentWeek(now);
    let chartEndDate = new Date(chartStartDate);
    chartEndDate.setDate(chartStartDate.getDate() + 6);

    if (requestedRange === '30D') {
      chartStartDate = new Date(startOfToday);
      chartStartDate.setDate(chartStartDate.getDate() - 29);
      chartEndDate = endOfDay(startOfToday);
    } else if (requestedRange === '90D') {
      chartStartDate = new Date(startOfToday);
      chartStartDate.setDate(chartStartDate.getDate() - 89);
      chartEndDate = endOfDay(startOfToday);
    } else if (requestedRange === 'CUSTOM') {
      const fromDate = parseInputDate(chartOptions?.from);
      const toDate = parseInputDate(chartOptions?.to);
      if (fromDate && toDate && fromDate <= toDate) {
        chartStartDate = fromDate;
        chartEndDate = endOfDay(toDate);
      } else {
        chartStartDate = getStartOfCurrentWeek(now);
        chartEndDate = new Date(chartStartDate);
        chartEndDate.setDate(chartStartDate.getDate() + 6);
        chartEndDate = endOfDay(chartEndDate);
      }
    } else {
      chartEndDate = endOfDay(chartEndDate);
    }

    const activeOrderStatuses: OrderItemStatus[] = [
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

    const pendingReturnStatuses: OrderItemStatus[] = [
      OrderItemStatus.RETURN_SCHEDULED,
      OrderItemStatus.RETURNED,
      OrderItemStatus.DAMAGE_REVIEW,
      OrderItemStatus.RETURN_REQUESTED,
      OrderItemStatus.RETURN_RECEIVED
    ];

    const vendorUserWhere = getVendorUserRoleWhere(roleFilter);
    const vendorProfileWhere = getVendorProfileUserWhere(roleFilter);
    const filterRecentOrderItems = (items: any[]) =>
      Array.isArray(items)
        ? items.filter((item) => {
            const vendorRole = item?.vendorProfile?.user?.role;
            return !vendorRole || matchesVendorRoleScope(vendorRole, roleFilter);
          })
        : [];

    const [
      totalVendors,
      totalVendorsPrevious,
      activeVendors,
      activeVendorsPrevious,
      totalCustomers,
      totalCustomersPrevious,
      activeOrders,
      activeOrdersPrevious,
      pendingReturns,
      pendingReturnsPrevious,
      pendingRefundAmount,
      pendingRefundAmountPrevious,
      todayRevenue,
      yesterdayRevenue,
      totalPaid,
      totalRefunded,
      totalPaidBeforeWindow,
      totalRefundedBeforeWindow,
      vendorCredits,
      vendorDebits,
      paidPaymentsForTrend,
      ordersForTrend
    ] = await Promise.all([
      prisma.user.count({ where: vendorUserWhere }),
      prisma.user.count({
        where: { ...vendorUserWhere, createdAt: { lt: startOfCurrentWindow } }
      }),
      prisma.user.count({
        where: {
          ...vendorUserWhere,
          onboardingStatus: 'APPROVED',
          status: 'ACTIVE'
        }
      }),
      prisma.user.count({
        where: {
          ...vendorUserWhere,
          onboardingStatus: 'APPROVED',
          status: 'ACTIVE',
          createdAt: { lt: startOfCurrentWindow }
        }
      }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.user.count({
        where: { role: 'CUSTOMER', createdAt: { lt: startOfCurrentWindow } }
      }),
      prisma.orderItem.count({
        where: { status: { in: activeOrderStatuses }, vendorProfile: vendorProfileWhere }
      }),
      prisma.orderItem.count({
        where: {
          status: { in: activeOrderStatuses },
          vendorProfile: vendorProfileWhere,
          order: { createdAt: { lt: startOfCurrentWindow } }
        }
      }),
      prisma.orderItem.count({ where: { status: { in: pendingReturnStatuses }, vendorProfile: vendorProfileWhere } }),
      prisma.orderItem.count({
        where: {
          status: { in: pendingReturnStatuses },
          vendorProfile: vendorProfileWhere,
          order: { createdAt: { lt: startOfCurrentWindow } }
        }
      }),
      prisma.orderItem.aggregate({
        where: { status: { in: pendingReturnStatuses }, vendorProfile: vendorProfileWhere },
        _sum: { deposit: true }
      }),
      prisma.orderItem.aggregate({
        where: {
          status: { in: pendingReturnStatuses },
          vendorProfile: vendorProfileWhere,
          order: { createdAt: { lt: startOfCurrentWindow } }
        },
        _sum: { deposit: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: 'PAID',
          paidAt: { gte: startOfToday },
          order: { items: { some: { vendorProfile: vendorProfileWhere } } }
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: 'PAID',
          paidAt: { gte: startOfYesterday, lt: startOfToday },
          order: { items: { some: { vendorProfile: vendorProfileWhere } } }
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { status: 'PAID', order: { items: { some: { vendorProfile: vendorProfileWhere } } } },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { status: 'REFUNDED', order: { items: { some: { vendorProfile: vendorProfileWhere } } } },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: 'PAID',
          paidAt: { lt: startOfCurrentWindow },
          order: { items: { some: { vendorProfile: vendorProfileWhere } } }
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: 'REFUNDED',
          paidAt: { lt: startOfCurrentWindow },
          order: { items: { some: { vendorProfile: vendorProfileWhere } } }
        },
        _sum: { amount: true }
      }),
      prisma.vendorTransaction.aggregate({
        where: {
          type: 'CREDIT',
          vendor: vendorProfileWhere,
          createdAt: { gte: chartStartDate, lte: chartEndDate }
        },
        _sum: { amount: true }
      }),
      prisma.vendorTransaction.aggregate({
        where: {
          type: 'DEBIT',
          vendor: vendorProfileWhere,
          createdAt: { gte: chartStartDate, lte: chartEndDate }
        },
        _sum: { amount: true }
      }),
      prisma.payment.findMany({
        where: {
          status: 'PAID',
          paidAt: { gte: chartStartDate, lte: chartEndDate },
          order: { items: { some: { vendorProfile: vendorProfileWhere } } }
        },
        select: {
          paidAt: true,
          amount: true
        }
      }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: chartStartDate, lte: chartEndDate },
          items: { some: { vendorProfile: vendorProfileWhere } }
        },
        select: {
          createdAt: true
        }
      })
    ]);

    let recentOrders: any[] = [];
    try {
      recentOrders = await prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        where: {
          items: {
            some: {
              vendorProfile: vendorProfileWhere
            }
          }
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              vendorProfile: { include: { user: true } }
            }
          }
        }
      });
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;

      try {
        recentOrders = await prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          where: {
            items: {
              some: {
                vendorProfile: vendorProfileWhere
              }
            }
          },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    rentalPrice: true,
                    securityDeposit: true,
                    status: true
                  }
                },
                vendorProfile: {
                  select: {
                    id: true,
                    shopName: true
                  }
                }
              }
            }
          }
        });
      } catch (fallbackError) {
        if (!isMissingColumnError(fallbackError)) throw fallbackError;

        const basicOrders = await prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          where: {
            items: { some: { vendorProfile: vendorProfileWhere } }
          },
          select: {
            id: true,
            orderNo: true,
            customerId: true,
            finalPayable: true,
            paymentStatus: true,
            createdAt: true
          }
        });

        recentOrders = basicOrders.map((order) => ({
          ...order,
          customer: null,
          items: []
        }));
      }
    }

    recentOrders = recentOrders
      .map((order) => ({
        ...order,
        items: filterRecentOrderItems(order.items)
      }))
      .filter((order) => Array.isArray(order.items) ? order.items.length > 0 : true);

    const pendingRefundAmountValue = toNumber(
      pendingRefundAmount?._sum?.deposit
    );
    const pendingRefundAmountPreviousValue = toNumber(
      pendingRefundAmountPrevious?._sum?.deposit
    );
    const todayRevenueValue = toNumber(todayRevenue._sum.amount);
    const yesterdayRevenueValue = toNumber(yesterdayRevenue._sum.amount);
    const escrowBalance = toNumber(totalPaid._sum.amount) - toNumber(totalRefunded._sum.amount);
    const escrowBalancePrevious =
      toNumber(totalPaidBeforeWindow._sum.amount) - toNumber(totalRefundedBeforeWindow._sum.amount);

    const chartDates: Date[] = [];
    const chartCursor = new Date(chartStartDate);
    chartCursor.setHours(0, 0, 0, 0);
    while (chartCursor <= chartEndDate) {
      chartDates.push(new Date(chartCursor));
      chartCursor.setDate(chartCursor.getDate() + 1);
    }

    const chartDayMap = chartDates.reduce<Record<string, { orders: number; revenue: number }>>(
      (acc, date) => {
        acc[toDateKey(date)] = { orders: 0, revenue: 0 };
        return acc;
      },
      {}
    );

    ordersForTrend.forEach(order => {
      const date = new Date(order.createdAt);
      date.setHours(0, 0, 0, 0);
      const key = toDateKey(date);
      if (chartDayMap[key]) {
        chartDayMap[key].orders += 1;
      }
    });

    paidPaymentsForTrend.forEach(payment => {
      if (!payment.paidAt) return;
      const date = new Date(payment.paidAt);
      date.setHours(0, 0, 0, 0);
      const key = toDateKey(date);
      if (chartDayMap[key]) {
        chartDayMap[key].revenue += toNumber(payment.amount);
      }
    });

    const isShortRange = chartDates.length <= 10;

    const ordersTrend = chartDates.map(date => ({
      name:
        requestedRange === '7D'
          ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
          : isShortRange
            ? date.toLocaleDateString('en-US', { weekday: 'short' })
            : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      orders: chartDayMap[toDateKey(date)]?.orders || 0,
      revenue: chartDayMap[toDateKey(date)]?.revenue || 0
    }));

    const revenueDistributionRaw = [
      {
        name: 'Customer Paid',
        value: paidPaymentsForTrend.reduce((sum, payment) => sum + toNumber(payment.amount), 0),
        color: '#5A1E2D'
      },
      {
        name: 'Vendor Credits',
        value: toNumber(vendorCredits._sum.amount),
        color: '#EAB308'
      },
      {
        name: 'Platform Debits',
        value: toNumber(vendorDebits._sum.amount),
        color: '#3B82F6'
      },
      {
        name: 'Refunded',
        value: toNumber(totalRefunded._sum.amount),
        color: '#10B981'
      }
    ];
    const revenueDistributionTotal = revenueDistributionRaw.reduce(
      (sum, item) => sum + item.value,
      0
    );
    const revenueDistribution = revenueDistributionRaw.map(item => ({
      ...item,
      percentage:
        revenueDistributionTotal > 0
          ? toRoundedPercent((item.value / revenueDistributionTotal) * 100)
          : 0
    }));

    return {
      stats: {
        totalVendors,
        activeVendors,
        totalCustomers,
        activeOrders,
        pendingReturns,
        pendingRefundAmount: pendingRefundAmountValue,
        todayRevenue: todayRevenueValue,
        escrowBalance,
        changes: {
          totalVendorsPct: toRoundedPercent(
            getPercentChange(totalVendors, totalVendorsPrevious)
          ),
          activeVendorsPct: toRoundedPercent(
            getPercentChange(activeVendors, activeVendorsPrevious)
          ),
          totalCustomersPct: toRoundedPercent(
            getPercentChange(totalCustomers, totalCustomersPrevious)
          ),
          activeOrdersPct: toRoundedPercent(
            getPercentChange(activeOrders, activeOrdersPrevious)
          ),
          pendingReturnsPct: toRoundedPercent(
            getPercentChange(pendingReturns, pendingReturnsPrevious)
          ),
          pendingRefundAmountPct: toRoundedPercent(
            getPercentChange(
              pendingRefundAmountValue,
              pendingRefundAmountPreviousValue
            )
          ),
          todayRevenuePct: toRoundedPercent(
            getPercentChange(todayRevenueValue, yesterdayRevenueValue)
          ),
          escrowBalancePct: toRoundedPercent(
            getPercentChange(escrowBalance, escrowBalancePrevious)
          )
        },
        charts: {
          revenueDistribution,
          ordersTrend
        }
      },
      recentOrders,
      pendingComplaints: [],
      newVendorDocs: []
    };
  }
};

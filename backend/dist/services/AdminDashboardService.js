"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminDashboardService = void 0;
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const vendorScope_1 = require("../utils/vendorScope");
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const toNumber = (value) => Number(value || 0);
const toRoundedPercent = (value) => Number(value.toFixed(2));
const toDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const getStartOfCurrentWeek = (date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return start;
};
const parseInputDate = (dateString) => {
    if (!dateString)
        return null;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime()))
        return null;
    date.setHours(0, 0, 0, 0);
    return date;
};
const endOfDay = (date) => {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
};
const getPercentChange = (current, previous) => {
    if (previous === 0)
        return current === 0 ? 0 : 100;
    return ((current - previous) / previous) * 100;
};
const isMissingColumnError = (error) => {
    const code = error?.code;
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return code === 'P2022' || message.includes('does not exist in the current database');
};
exports.AdminDashboardService = {
    async getDashboardStats(roleFilter, chartOptions) {
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
        }
        else if (requestedRange === '90D') {
            chartStartDate = new Date(startOfToday);
            chartStartDate.setDate(chartStartDate.getDate() - 89);
            chartEndDate = endOfDay(startOfToday);
        }
        else if (requestedRange === 'CUSTOM') {
            const fromDate = parseInputDate(chartOptions?.from);
            const toDate = parseInputDate(chartOptions?.to);
            if (fromDate && toDate && fromDate <= toDate) {
                chartStartDate = fromDate;
                chartEndDate = endOfDay(toDate);
            }
            else {
                chartStartDate = getStartOfCurrentWeek(now);
                chartEndDate = new Date(chartStartDate);
                chartEndDate.setDate(chartStartDate.getDate() + 6);
                chartEndDate = endOfDay(chartEndDate);
            }
        }
        else {
            chartEndDate = endOfDay(chartEndDate);
        }
        const activeOrderStatuses = [
            client_1.OrderItemStatus.PLACED,
            client_1.OrderItemStatus.BOOKED,
            client_1.OrderItemStatus.RENTAL_CONFIRMED,
            client_1.OrderItemStatus.ACCEPTED,
            client_1.OrderItemStatus.READY_FOR_PICKUP,
            client_1.OrderItemStatus.PICKED_UP,
            client_1.OrderItemStatus.OUT_FOR_DELIVERY,
            client_1.OrderItemStatus.DISPATCHED,
            client_1.OrderItemStatus.DELIVERED,
            client_1.OrderItemStatus.RETURN_SCHEDULED,
            client_1.OrderItemStatus.RETURNED,
            client_1.OrderItemStatus.DAMAGE_REVIEW,
            client_1.OrderItemStatus.RETURN_REQUESTED,
            client_1.OrderItemStatus.RETURN_RECEIVED
        ];
        const pendingReturnStatuses = [
            client_1.OrderItemStatus.RETURN_SCHEDULED,
            client_1.OrderItemStatus.RETURNED,
            client_1.OrderItemStatus.DAMAGE_REVIEW,
            client_1.OrderItemStatus.RETURN_REQUESTED,
            client_1.OrderItemStatus.RETURN_RECEIVED
        ];
        const vendorUserWhere = (0, vendorScope_1.getVendorUserRoleWhere)(roleFilter);
        const vendorProfileWhere = (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter);
        const filterRecentOrderItems = (items) => Array.isArray(items)
            ? items.filter((item) => {
                const vendorRole = item?.vendorProfile?.user?.role;
                return !vendorRole || (0, vendorScope_1.matchesVendorRoleScope)(vendorRole, roleFilter);
            })
            : [];
        const [totalVendors, totalVendorsPrevious, activeVendors, activeVendorsPrevious, totalCustomers, totalCustomersPrevious, activeOrders, activeOrdersPrevious, pendingReturns, pendingReturnsPrevious, pendingRefundAmount, pendingRefundAmountPrevious, todayRevenue, yesterdayRevenue, totalPaid, totalRefunded, totalPaidBeforeWindow, totalRefundedBeforeWindow, vendorCredits, vendorDebits, paidPaymentsForTrend, ordersForTrend] = await Promise.all([
            db_1.default.user.count({ where: vendorUserWhere }),
            db_1.default.user.count({
                where: { ...vendorUserWhere, createdAt: { lt: startOfCurrentWindow } }
            }),
            db_1.default.user.count({
                where: {
                    ...vendorUserWhere,
                    onboardingStatus: 'APPROVED',
                    status: 'ACTIVE'
                }
            }),
            db_1.default.user.count({
                where: {
                    ...vendorUserWhere,
                    onboardingStatus: 'APPROVED',
                    status: 'ACTIVE',
                    createdAt: { lt: startOfCurrentWindow }
                }
            }),
            db_1.default.user.count({ where: { role: 'CUSTOMER' } }),
            db_1.default.user.count({
                where: { role: 'CUSTOMER', createdAt: { lt: startOfCurrentWindow } }
            }),
            db_1.default.orderItem.count({
                where: { status: { in: activeOrderStatuses }, vendorProfile: vendorProfileWhere }
            }),
            db_1.default.orderItem.count({
                where: {
                    status: { in: activeOrderStatuses },
                    vendorProfile: vendorProfileWhere,
                    order: { createdAt: { lt: startOfCurrentWindow } }
                }
            }),
            db_1.default.orderItem.count({ where: { status: { in: pendingReturnStatuses }, vendorProfile: vendorProfileWhere } }),
            db_1.default.orderItem.count({
                where: {
                    status: { in: pendingReturnStatuses },
                    vendorProfile: vendorProfileWhere,
                    order: { createdAt: { lt: startOfCurrentWindow } }
                }
            }),
            db_1.default.orderItem.aggregate({
                where: { status: { in: pendingReturnStatuses }, vendorProfile: vendorProfileWhere },
                _sum: { deposit: true }
            }),
            db_1.default.orderItem.aggregate({
                where: {
                    status: { in: pendingReturnStatuses },
                    vendorProfile: vendorProfileWhere,
                    order: { createdAt: { lt: startOfCurrentWindow } }
                },
                _sum: { deposit: true }
            }),
            db_1.default.payment.aggregate({
                where: {
                    status: 'PAID',
                    paidAt: { gte: startOfToday },
                    order: { items: { some: { vendorProfile: vendorProfileWhere } } }
                },
                _sum: { amount: true }
            }),
            db_1.default.payment.aggregate({
                where: {
                    status: 'PAID',
                    paidAt: { gte: startOfYesterday, lt: startOfToday },
                    order: { items: { some: { vendorProfile: vendorProfileWhere } } }
                },
                _sum: { amount: true }
            }),
            db_1.default.payment.aggregate({
                where: { status: 'PAID', order: { items: { some: { vendorProfile: vendorProfileWhere } } } },
                _sum: { amount: true }
            }),
            db_1.default.payment.aggregate({
                where: { status: 'REFUNDED', order: { items: { some: { vendorProfile: vendorProfileWhere } } } },
                _sum: { amount: true }
            }),
            db_1.default.payment.aggregate({
                where: {
                    status: 'PAID',
                    paidAt: { lt: startOfCurrentWindow },
                    order: { items: { some: { vendorProfile: vendorProfileWhere } } }
                },
                _sum: { amount: true }
            }),
            db_1.default.payment.aggregate({
                where: {
                    status: 'REFUNDED',
                    paidAt: { lt: startOfCurrentWindow },
                    order: { items: { some: { vendorProfile: vendorProfileWhere } } }
                },
                _sum: { amount: true }
            }),
            db_1.default.vendorTransaction.aggregate({
                where: {
                    type: 'CREDIT',
                    vendor: vendorProfileWhere,
                    createdAt: { gte: chartStartDate, lte: chartEndDate }
                },
                _sum: { amount: true }
            }),
            db_1.default.vendorTransaction.aggregate({
                where: {
                    type: 'DEBIT',
                    vendor: vendorProfileWhere,
                    createdAt: { gte: chartStartDate, lte: chartEndDate }
                },
                _sum: { amount: true }
            }),
            db_1.default.payment.findMany({
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
            db_1.default.order.findMany({
                where: {
                    createdAt: { gte: chartStartDate, lte: chartEndDate },
                    items: { some: { vendorProfile: vendorProfileWhere } }
                },
                select: {
                    createdAt: true
                }
            })
        ]);
        let recentOrders = [];
        try {
            recentOrders = await db_1.default.order.findMany({
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
        }
        catch (error) {
            if (!isMissingColumnError(error))
                throw error;
            try {
                recentOrders = await db_1.default.order.findMany({
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
            }
            catch (fallbackError) {
                if (!isMissingColumnError(fallbackError))
                    throw fallbackError;
                const basicOrders = await db_1.default.order.findMany({
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
        const pendingRefundAmountValue = toNumber(pendingRefundAmount?._sum?.deposit);
        const pendingRefundAmountPreviousValue = toNumber(pendingRefundAmountPrevious?._sum?.deposit);
        const todayRevenueValue = toNumber(todayRevenue._sum.amount);
        const yesterdayRevenueValue = toNumber(yesterdayRevenue._sum.amount);
        const escrowBalance = toNumber(totalPaid._sum.amount) - toNumber(totalRefunded._sum.amount);
        const escrowBalancePrevious = toNumber(totalPaidBeforeWindow._sum.amount) - toNumber(totalRefundedBeforeWindow._sum.amount);
        const chartDates = [];
        const chartCursor = new Date(chartStartDate);
        chartCursor.setHours(0, 0, 0, 0);
        while (chartCursor <= chartEndDate) {
            chartDates.push(new Date(chartCursor));
            chartCursor.setDate(chartCursor.getDate() + 1);
        }
        const chartDayMap = chartDates.reduce((acc, date) => {
            acc[toDateKey(date)] = { orders: 0, revenue: 0 };
            return acc;
        }, {});
        ordersForTrend.forEach(order => {
            const date = new Date(order.createdAt);
            date.setHours(0, 0, 0, 0);
            const key = toDateKey(date);
            if (chartDayMap[key]) {
                chartDayMap[key].orders += 1;
            }
        });
        paidPaymentsForTrend.forEach(payment => {
            if (!payment.paidAt)
                return;
            const date = new Date(payment.paidAt);
            date.setHours(0, 0, 0, 0);
            const key = toDateKey(date);
            if (chartDayMap[key]) {
                chartDayMap[key].revenue += toNumber(payment.amount);
            }
        });
        const isShortRange = chartDates.length <= 10;
        const ordersTrend = chartDates.map(date => ({
            name: requestedRange === '7D'
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
        const revenueDistributionTotal = revenueDistributionRaw.reduce((sum, item) => sum + item.value, 0);
        const revenueDistribution = revenueDistributionRaw.map(item => ({
            ...item,
            percentage: revenueDistributionTotal > 0
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
                    totalVendorsPct: toRoundedPercent(getPercentChange(totalVendors, totalVendorsPrevious)),
                    activeVendorsPct: toRoundedPercent(getPercentChange(activeVendors, activeVendorsPrevious)),
                    totalCustomersPct: toRoundedPercent(getPercentChange(totalCustomers, totalCustomersPrevious)),
                    activeOrdersPct: toRoundedPercent(getPercentChange(activeOrders, activeOrdersPrevious)),
                    pendingReturnsPct: toRoundedPercent(getPercentChange(pendingReturns, pendingReturnsPrevious)),
                    pendingRefundAmountPct: toRoundedPercent(getPercentChange(pendingRefundAmountValue, pendingRefundAmountPreviousValue)),
                    todayRevenuePct: toRoundedPercent(getPercentChange(todayRevenueValue, yesterdayRevenueValue)),
                    escrowBalancePct: toRoundedPercent(getPercentChange(escrowBalance, escrowBalancePrevious))
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

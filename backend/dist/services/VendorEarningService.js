"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorEarningService = void 0;
const BadgeService_1 = require("./BadgeService");
const NotificationService_1 = require("./NotificationService");
const CommissionService_1 = require("./CommissionService");
const errors_1 = require("../utils/errors");
const publicCodes_1 = require("../utils/publicCodes");
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const DEPOSIT_LIABILITY_STATUSES = [
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
    client_1.OrderItemStatus.RETURN_RECEIVED,
    client_1.OrderItemStatus.INSPECTED_DAMAGED,
    client_1.OrderItemStatus.INSPECTED_LOST
];
const isMissingColumnError = (error) => {
    const code = error?.code;
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return code === 'P2022' || message.includes('does not exist in the current database');
};
const normalizeCycle = (value) => {
    const normalized = String(value || 'MONTHLY').trim().toUpperCase();
    if (normalized === 'DAILY')
        return 'DAILY';
    if (normalized === 'WEEKLY')
        return 'WEEKLY';
    if (normalized === 'FORTNIGHTLY')
        return 'FORTNIGHTLY';
    return 'MONTHLY';
};
const getNextPayoutDate = (cycle) => {
    const now = new Date();
    const next = new Date(now);
    if (cycle === 'DAILY') {
        next.setDate(now.getDate() + 1);
    }
    else if (cycle === 'WEEKLY') {
        next.setDate(now.getDate() + 7);
    }
    else if (cycle === 'FORTNIGHTLY') {
        next.setDate(now.getDate() + 14);
    }
    else {
        next.setMonth(now.getMonth() + 1);
    }
    return next;
};
const toRounded = (value) => Number(value.toFixed(2));
const EXCLUDED_VENDOR_PAYOUT_STATUSES = [
    client_1.OrderItemStatus.CANCELLED,
    client_1.OrderItemStatus.REJECTED
];
const resolveVendorProfileId = async (vendorIdentifier) => {
    let vendorIdBig;
    try {
        vendorIdBig = BigInt(vendorIdentifier);
    }
    catch {
        throw new errors_1.ValidationError('Invalid vendor identifier');
    }
    let vendor = null;
    try {
        vendor = await db_1.default.vendorProfile.findFirst({
            where: {
                OR: [
                    { id: vendorIdBig },
                    { userId: vendorIdBig }
                ]
            },
            select: { id: true }
        });
    }
    catch (error) {
        if (error?.code !== 'P2022')
            throw error;
        const rows = await db_1.default.$queryRawUnsafe(`SELECT "id"
       FROM "VendorProfile"
       WHERE "id" = $1 OR "userId" = $1
       LIMIT 1`, vendorIdBig.toString());
        if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id !== undefined && rows[0]?.id !== null) {
            vendor = { id: BigInt(rows[0].id) };
        }
    }
    if (!vendor) {
        throw new errors_1.ValidationError('Vendor not found');
    }
    return vendor.id;
};
const getVendorFinancialConfig = async (vendorProfileId) => {
    try {
        const vendor = await db_1.default.vendorProfile.findUnique({
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
        const commissionRate = await CommissionService_1.CommissionService.getEffectiveCommissionRateForVendorProfile(vendorProfileId, vendor);
        const payoutCycle = normalizeCycle(vendor?.payoutCycle || 'MONTHLY');
        return { commissionRate, payoutCycle };
    }
    catch (error) {
        if (!isMissingColumnError(error))
            throw error;
        return { commissionRate: 0, payoutCycle: normalizeCycle('MONTHLY') };
    }
};
const computeVendorPayoutFigures = async (vendorProfileId, period) => {
    const { commissionRate } = await getVendorFinancialConfig(vendorProfileId);
    const orderWhere = {
        vendorId: vendorProfileId,
        order: { paymentStatus: { in: ['PAID', 'REFUND_PENDING'] } },
        status: { notIn: EXCLUDED_VENDOR_PAYOUT_STATUSES }
    };
    if (period?.from && period?.to) {
        orderWhere.order.createdAt = { gte: period.from, lte: period.to };
    }
    const settlementWhere = {
        vendorId: vendorProfileId,
        status: 'COMPLETED'
    };
    if (period?.from && period?.to) {
        settlementWhere.createdAt = { gte: period.from, lte: period.to };
    }
    const pendingSettlementWhere = {
        vendorId: vendorProfileId,
        status: 'PENDING'
    };
    if (period?.from && period?.to) {
        pendingSettlementWhere.createdAt = { gte: period.from, lte: period.to };
    }
    const [orderAggregate, paidSettlements, pendingSettlements] = await Promise.all([
        db_1.default.orderItem.aggregate({
            where: orderWhere,
            _sum: { rentPrice: true },
            _count: { id: true }
        }),
        db_1.default.vendorSettlement.aggregate({
            where: settlementWhere,
            _sum: { amount: true }
        }),
        db_1.default.vendorSettlement.aggregate({
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
const computeDepositSummary = async (vendorProfileId) => {
    try {
        const rows = await db_1.default.orderItem.findMany({
            where: {
                vendorId: vendorProfileId,
                order: { paymentStatus: { in: ['PAID', 'REFUND_PENDING'] } },
                status: { notIn: [client_1.OrderItemStatus.CANCELLED, client_1.OrderItemStatus.REJECTED] }
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
        const depositLiability = Math.max(0, securityDepositReceived - securityDepositRefunded - securityDepositHeldForDamage);
        return {
            securityDepositReceived,
            securityDepositRefunded,
            securityDepositHeldForDamage,
            depositLiability
        };
    }
    catch (error) {
        if (!isMissingColumnError(error))
            throw error;
        // Backward-compatible fallback if split columns are not migrated yet.
        const aggregate = await db_1.default.orderItem.aggregate({
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
exports.VendorEarningService = {
    async createVendorEarning(tx, vendorId, orderItemId, rentPrice) {
        const vendor = await tx.vendorProfile.findUnique({ where: { id: BigInt(vendorId) } });
        if (!vendor) {
            throw new errors_1.ValidationError('Vendor not found');
        }
        const commissionRate = await CommissionService_1.CommissionService.getEffectiveCommissionRateForVendorProfile(BigInt(vendorId), vendor);
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
    async getVendorBalance(vendorId) {
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
    async getVendorEarningsSummary(vendorId) {
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
    async createSettlement(_adminId, vendorId) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const payout = await computeVendorPayoutFigures(vendorProfileId);
        if (payout.availableForNewSettlement <= 0) {
            throw new errors_1.ValidationError('No balance available for settlement');
        }
        const vendor = await db_1.default.vendorProfile.findUnique({ where: { id: vendorProfileId } });
        if (!vendor) {
            throw new errors_1.ValidationError('Vendor not found');
        }
        return db_1.default.vendorSettlement.create({
            data: {
                vendorId: vendorProfileId,
                amount: payout.availableForNewSettlement,
                status: 'PENDING'
            }
        });
    },
    async approveSettlement(_adminId, settlementId) {
        const settlement = await db_1.default.vendorSettlement.findFirst({
            where: { id: BigInt(settlementId), status: 'PENDING' },
            include: { vendor: { include: { user: true } } }
        });
        if (!settlement)
            throw new errors_1.ValidationError('Settlement not found or already processed');
        const updated = await db_1.default.vendorSettlement.update({
            where: { id: settlement.id },
            data: { status: 'COMPLETED' }
        });
        await NotificationService_1.NotificationService.notifyVendorSettlement(settlement.vendorId.toString(), Number(settlement.amount));
        await BadgeService_1.BadgeService.autoAssignBadge(settlement.vendorId.toString());
        return updated;
    },
    async getVendorTransactions(vendorId, filters) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const skip = (page - 1) * limit;
        const transactions = await db_1.default.vendorTransaction.findMany({
            where: { vendorId: vendorProfileId },
            include: { orderItem: true },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' }
        });
        const total = await db_1.default.vendorTransaction.count({ where: { vendorId: vendorProfileId } });
        return { transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    },
    async getVendorSettlements(vendorId, filters) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const skip = (page - 1) * limit;
        const settlements = await db_1.default.vendorSettlement.findMany({
            where: { vendorId: vendorProfileId },
            skip,
            take: limit,
            orderBy: { id: 'desc' }
        });
        const total = await db_1.default.vendorSettlement.count({ where: { vendorId: vendorProfileId } });
        return { settlements, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    },
    async getPendingSettlements(filters) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const skip = (page - 1) * limit;
        const settlements = await db_1.default.vendorSettlement.findMany({
            where: { status: 'PENDING' },
            include: { vendor: { include: { user: true } } },
            skip,
            take: limit,
            orderBy: { id: 'desc' }
        });
        const total = await db_1.default.vendorSettlement.count({ where: { status: 'PENDING' } });
        return { settlements, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    },
    async getVendorCustomers(vendorId, filters) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const orderItems = await db_1.default.orderItem.findMany({
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
        const customerMap = new Map();
        for (const item of orderItems) {
            const customer = item.order.customer;
            if (!customer)
                continue;
            const customerId = customer.id.toString();
            const orderId = item.orderId.toString();
            if (!customerMap.has(customerId)) {
                customerMap.set(customerId, {
                    id: customerId,
                    publicCode: String(customer?.publicCode || (0, publicCodes_1.buildUserPublicCode)(client_1.UserRole.CUSTOMER, customer.id)),
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    totalOrders: 0,
                    totalItems: 0,
                    totalRentPaid: 0,
                    lastOrderAt: item.order.createdAt ?? null,
                    orderIds: new Set()
                });
            }
            const summary = customerMap.get(customerId);
            summary.totalItems += Number(item.quantity || 0);
            summary.totalRentPaid += Number(item.rentPrice || 0);
            summary.orderIds.add(orderId);
            if (!summary.lastOrderAt || item.order.createdAt > summary.lastOrderAt) {
                summary.lastOrderAt = item.order.createdAt;
            }
        }
        const customerIdBigInts = Array.from(customerMap.keys()).map((id) => BigInt(id));
        const trialCountByCustomer = new Map();
        const noShowCountByCustomer = new Map();
        const damageHistoryCountByCustomer = new Map();
        const damageHistoryAmountByCustomer = new Map();
        const depositDisputeCountByCustomer = new Map();
        if (customerIdBigInts.length > 0) {
            const trialGrouped = await db_1.default.trialRequest.groupBy({
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
            const noShowStatus = client_1.TrialRequestStatus.NO_SHOW;
            if (noShowStatus) {
                try {
                    const noShowGrouped = await db_1.default.trialRequest.groupBy({
                        by: ['customerId'],
                        where: {
                            vendorId: vendorProfileId,
                            customerId: { in: customerIdBigInts },
                            status: noShowStatus
                        },
                        _count: { _all: true }
                    });
                    for (const row of noShowGrouped) {
                        noShowCountByCustomer.set(row.customerId.toString(), Number(row._count._all || 0));
                    }
                }
                catch (error) {
                    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
                    const isEnumOrValidationIssue = message.includes('invalid input value for enum') ||
                        message.includes('expected trialrequeststatus') ||
                        message.includes('invalid value for argument `status`');
                    if (!isEnumOrValidationIssue) {
                        throw error;
                    }
                }
            }
            const claimRows = await db_1.default.damageClaim.findMany({
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
            const disputedStatuses = new Set([
                client_1.DamageClaimStatus.PENDING,
                client_1.DamageClaimStatus.APPROVED_PARTIAL,
                client_1.DamageClaimStatus.REJECTED
            ]);
            for (const row of claimRows) {
                const relatedOrderItem = row.orderItem || row.OrderItem;
                const customerId = relatedOrderItem?.order?.customerId?.toString();
                if (!customerId) {
                    continue;
                }
                damageHistoryCountByCustomer.set(customerId, Number(damageHistoryCountByCustomer.get(customerId) || 0) + 1);
                const impactAmount = Math.max(Number(row.approvedAmount || 0), Number(row.repairCost || 0));
                damageHistoryAmountByCustomer.set(customerId, Number(damageHistoryAmountByCustomer.get(customerId) || 0) + impactAmount);
                if (disputedStatuses.has(row.status)) {
                    depositDisputeCountByCustomer.set(customerId, Number(depositDisputeCountByCustomer.get(customerId) || 0) + 1);
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
        const repeatCustomerPercent = total > 0 ? Number(((repeatCustomers / total) * 100).toFixed(2)) : 0;
        const totalTrials = allCustomers.reduce((sum, customer) => sum + customer.trialCount, 0);
        const totalNoShows = allCustomers.reduce((sum, customer) => sum + customer.noShowCount, 0);
        const totalDamageCases = allCustomers.reduce((sum, customer) => sum + customer.damageHistoryCount, 0);
        const totalDepositDisputes = allCustomers.reduce((sum, customer) => sum + customer.depositDisputeCount, 0);
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

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminCustomerService = void 0;
const client_1 = require("@prisma/client");
const db_1 = __importDefault(require("../config/db"));
const vendorScope_1 = require("../utils/vendorScope");
const publicCodes_1 = require("../utils/publicCodes");
const INCLUDED_PAYMENT_STATUSES = [
    client_1.PaymentStatus.PAID,
    client_1.PaymentStatus.REFUND_PENDING,
    client_1.PaymentStatus.REFUNDED
];
const toSafeNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const toUiOrderPaymentStatus = (status) => {
    const normalized = String(status || '').trim().toUpperCase();
    if (normalized === 'PAID')
        return 'paid';
    if (normalized === 'REFUNDED')
        return 'refunded';
    if (normalized === 'REFUND_PENDING')
        return 'refund_pending';
    return 'pending';
};
const toUiOrderStatus = (status) => {
    const normalized = String(status || '').trim().toUpperCase();
    if (normalized === 'PLACED')
        return 'pending';
    if (['BOOKED', 'ACCEPTED', 'RENTAL_CONFIRMED', 'READY_FOR_PICKUP'].includes(normalized)) {
        return 'confirmed';
    }
    if (['PICKED_UP', 'OUT_FOR_DELIVERY', 'DISPATCHED'].includes(normalized)) {
        return 'dispatched';
    }
    if (normalized === 'DELIVERED')
        return 'delivered';
    if ([
        'RETURN_REQUESTED',
        'RETURN_SCHEDULED',
        'RETURNED',
        'RETURN_RECEIVED',
        'DAMAGE_REVIEW',
        'INSPECTED_GOOD',
        'INSPECTED_DAMAGED',
        'INSPECTED_LOST',
        'LATE_RETURN'
    ].includes(normalized)) {
        return 'returned';
    }
    if (['SECURITY_DEPOSIT_REFUNDED', 'COMPLETED'].includes(normalized)) {
        return 'refunded';
    }
    if (['CANCELLED', 'REJECTED'].includes(normalized)) {
        return 'cancelled';
    }
    return 'pending';
};
const ORDER_STATUS_WEIGHT = {
    cancelled: 0,
    pending: 1,
    confirmed: 2,
    dispatched: 3,
    delivered: 4,
    returned: 5,
    refunded: 6
};
const pickOrderStatus = (statuses) => {
    if (!statuses.length)
        return 'pending';
    const actionable = statuses.filter((status) => status !== 'cancelled');
    if (!actionable.length) {
        return 'cancelled';
    }
    return actionable.reduce((selected, current) => (ORDER_STATUS_WEIGHT[current] || 0) >= (ORDER_STATUS_WEIGHT[selected] || 0) ? current : selected);
};
exports.AdminCustomerService = {
    async getScopedCustomers(filters, roleFilter) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const vendorProfileWhere = (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter);
        const orders = await db_1.default.order.findMany({
            where: {
                paymentStatus: { in: INCLUDED_PAYMENT_STATUSES },
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
                        variant: true,
                        vendorProfile: {
                            include: {
                                user: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        const customerMap = new Map();
        for (const order of orders) {
            const scopedItems = Array.isArray(order.items)
                ? order.items.filter((item) => (0, vendorScope_1.matchesVendorRoleScope)(item?.vendorProfile?.user?.role, roleFilter))
                : [];
            if (!scopedItems.length || !order.customer)
                continue;
            const customerId = order.customer.id.toString();
            const itemsList = scopedItems.map((item) => {
                const quantity = Math.max(1, Number(item.quantity || 1));
                const lineTotal = toSafeNumber(item.rentPrice);
                return {
                    name: String(item.product?.name || 'Product'),
                    quantity,
                    price: quantity > 0 ? Math.round(lineTotal / quantity) : lineTotal
                };
            });
            const totalItems = scopedItems.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
            const totalAmount = scopedItems.reduce((sum, item) => sum + toSafeNumber(item.rentPrice), 0);
            const orderStatus = pickOrderStatus(scopedItems.map((item) => toUiOrderStatus(String(item.status || ''))));
            const returnDateCandidate = scopedItems
                .map((item) => item.returnedAt || item.returnDueDate || null)
                .find(Boolean);
            const deliveryDateCandidate = scopedItems
                .map((item) => item.rentalStartDate || null)
                .find(Boolean);
            if (!customerMap.has(customerId)) {
                customerMap.set(customerId, {
                    id: customerId,
                    publicCode: String(order.customer?.publicCode || (0, publicCodes_1.buildUserPublicCode)('CUSTOMER', order.customer.id)),
                    name: order.customer.name,
                    email: order.customer.email,
                    phone: order.customer.phone,
                    createdAt: order.customer.createdAt || null,
                    lastOrderAt: order.createdAt || null,
                    totalOrders: 0,
                    totalItems: 0,
                    totalRentPaid: 0,
                    orders: []
                });
            }
            const customerEntry = customerMap.get(customerId);
            customerEntry.totalOrders += 1;
            customerEntry.totalItems += totalItems;
            customerEntry.totalRentPaid += totalAmount;
            customerEntry.orders.push({
                id: order.id.toString(),
                orderNumber: String(order.orderNo || (0, publicCodes_1.buildOrderNo)(order.id, order.createdAt)),
                date: order.createdAt.toISOString(),
                items: totalItems,
                totalAmount,
                status: orderStatus,
                paymentStatus: toUiOrderPaymentStatus(String(order.paymentStatus || '')),
                deliveryDate: deliveryDateCandidate ? new Date(deliveryDateCandidate).toISOString() : undefined,
                returnDate: returnDateCandidate ? new Date(returnDateCandidate).toISOString() : undefined,
                itemsList
            });
            if (!customerEntry.lastOrderAt || order.createdAt > customerEntry.lastOrderAt) {
                customerEntry.lastOrderAt = order.createdAt;
            }
        }
        const customerIdBigInts = Array.from(customerMap.keys()).map((id) => BigInt(id));
        const trialCountByCustomer = new Map();
        const noShowCountByCustomer = new Map();
        const damageHistoryCountByCustomer = new Map();
        const damageHistoryAmountByCustomer = new Map();
        const depositDisputeCountByCustomer = new Map();
        if (customerIdBigInts.length > 0) {
            const trialRequests = await db_1.default.trialRequest.groupBy({
                by: ['customerId'],
                where: {
                    customerId: { in: customerIdBigInts },
                    vendor: vendorProfileWhere
                },
                _count: { _all: true }
            });
            for (const row of trialRequests) {
                trialCountByCustomer.set(row.customerId.toString(), Number(row._count._all || 0));
            }
            try {
                const noShows = await db_1.default.trialRequest.groupBy({
                    by: ['customerId'],
                    where: {
                        customerId: { in: customerIdBigInts },
                        vendor: vendorProfileWhere,
                        status: 'NO_SHOW'
                    },
                    _count: { _all: true }
                });
                for (const row of noShows) {
                    noShowCountByCustomer.set(row.customerId.toString(), Number(row._count._all || 0));
                }
            }
            catch {
                // Ignore enum compatibility issues on older schemas.
            }
            const claimRows = await db_1.default.damageClaim.findMany({
                where: {
                    VendorProfile: vendorProfileWhere,
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
            for (const row of claimRows) {
                const customerId = row?.OrderItem?.order?.customerId?.toString();
                if (!customerId)
                    continue;
                damageHistoryCountByCustomer.set(customerId, Number(damageHistoryCountByCustomer.get(customerId) || 0) + 1);
                const impactAmount = Math.max(toSafeNumber(row?.approvedAmount), toSafeNumber(row?.repairCost));
                damageHistoryAmountByCustomer.set(customerId, Number(damageHistoryAmountByCustomer.get(customerId) || 0) + impactAmount);
                if (['PENDING', 'APPROVED_PARTIAL', 'REJECTED'].includes(String(row?.status || ''))) {
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
            createdAt: customer.createdAt,
            lastOrderAt: customer.lastOrderAt,
            totalOrders: customer.totalOrders,
            totalItems: customer.totalItems,
            totalRentPaid: customer.totalRentPaid,
            trialCount: Number(trialCountByCustomer.get(customer.id) || 0),
            noShowCount: Number(noShowCountByCustomer.get(customer.id) || 0),
            damageHistoryCount: Number(damageHistoryCountByCustomer.get(customer.id) || 0),
            damageHistoryAmount: Number(damageHistoryAmountByCustomer.get(customer.id) || 0),
            depositDisputeCount: Number(depositDisputeCountByCustomer.get(customer.id) || 0),
            isRepeatCustomer: customer.totalOrders > 1,
            orders: customer.orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminOrderService = void 0;
const db_1 = __importDefault(require("../config/db"));
const NotificationService_1 = require("./NotificationService");
const vendorScope_1 = require("../utils/vendorScope");
const toSafeNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const getOrderPricingItems = (order, fallbackItems = []) => {
    if (Array.isArray(order?.items) && order.items.length > 0)
        return order.items;
    return fallbackItems.filter(Boolean);
};
const buildOrderPricingBreakdown = (order, fallbackItems = []) => {
    const items = getOrderPricingItems(order, fallbackItems);
    const rentalAmount = roundMoney(items.reduce((sum, item) => sum + toSafeNumber(item?.rentPrice), 0));
    const securityDepositAmount = roundMoney(items.reduce((sum, item) => sum + toSafeNumber(item?.deposit), 0));
    const alterationChargeAmount = roundMoney(items.reduce((sum, item) => sum + toSafeNumber(item?.alterationCharge), 0));
    const deliveryChargeAmount = roundMoney(items.reduce((sum, item) => sum + toSafeNumber(item?.deliveryCharge), 0));
    const grossAmount = roundMoney(rentalAmount + securityDepositAmount + alterationChargeAmount + deliveryChargeAmount);
    const hasFinalPayable = order?.finalPayable !== undefined && order?.finalPayable !== null;
    const finalPayable = hasFinalPayable
        ? roundMoney(Math.max(0, toSafeNumber(order.finalPayable)))
        : grossAmount;
    const discountAmount = roundMoney(Math.min(rentalAmount, Math.max(0, grossAmount - finalPayable)));
    const coupon = order?.Coupon || order?.coupon || null;
    return {
        rentalAmount,
        securityDepositAmount,
        alterationChargeAmount,
        deliveryChargeAmount,
        grossAmount,
        discountAmount,
        rentalAmountAfterDiscount: roundMoney(Math.max(0, rentalAmount - discountAmount)),
        finalPayable: roundMoney(Math.max(0, grossAmount - discountAmount)),
        couponId: order?.couponId ? String(order.couponId) : coupon?.id ? String(coupon.id) : null,
        couponCode: coupon?.code || null,
        coupon: coupon
            ? {
                id: String(coupon.id),
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: toSafeNumber(coupon.discountValue)
            }
            : null
    };
};
const getOrderItemDiscountAllocation = (orderItem) => {
    const order = orderItem?.order || {};
    const pricing = buildOrderPricingBreakdown(order, [orderItem]);
    if (pricing.discountAmount <= 0 || pricing.rentalAmount <= 0)
        return 0;
    const itemRent = toSafeNumber(orderItem?.rentPrice);
    if (itemRent <= 0)
        return 0;
    return roundMoney(Math.min(itemRent, (pricing.discountAmount * itemRent) / pricing.rentalAmount));
};
const buildPaymentBreakdown = (orderItem) => {
    const paymentStatus = String(orderItem?.order?.paymentStatus || '').toUpperCase();
    const itemStatus = String(orderItem?.status || '').toUpperCase();
    const isPaidLike = paymentStatus === 'PAID' || paymentStatus === 'REFUND_PENDING' || paymentStatus === 'REFUNDED';
    const isRejectedOrCancelled = itemStatus === 'CANCELLED' || itemStatus === 'REJECTED';
    const rentalAmount = toSafeNumber(orderItem?.rentPrice);
    const rentalDiscountAmount = getOrderItemDiscountAllocation(orderItem);
    const rentalAmountAfterDiscount = roundMoney(Math.max(0, rentalAmount - rentalDiscountAmount));
    const rentalAmountReceived = isPaidLike && !isRejectedOrCancelled ? rentalAmountAfterDiscount : 0;
    const securityDepositReceived = isPaidLike && !isRejectedOrCancelled ? toSafeNumber(orderItem?.deposit) : 0;
    const securityDepositRefunded = Math.min(securityDepositReceived, Math.max(0, toSafeNumber(orderItem?.securityDepositRefunded)));
    const securityDepositHeldForDamage = Math.min(securityDepositReceived, Math.max(0, toSafeNumber(orderItem?.securityDepositHeld)));
    const securityDepositOutstanding = Math.max(0, securityDepositReceived - securityDepositRefunded - securityDepositHeldForDamage);
    return {
        rentalAmount,
        rentalDiscountAmount,
        rentalAmountAfterDiscount,
        rentalAmountReceived,
        securityDepositReceived,
        securityDepositRefunded,
        securityDepositHeldForDamage,
        securityDepositOutstanding,
        couponCode: orderItem?.order?.Coupon?.code || null
    };
};
const withOrderPaymentBreakdown = (order, roleFilter) => {
    const scopedItems = Array.isArray(order?.items)
        ? order.items.filter((item) => (0, vendorScope_1.matchesVendorRoleScope)(item?.vendorProfile?.user?.role, roleFilter))
        : [];
    return {
        ...order,
        pricingBreakdown: buildOrderPricingBreakdown(order),
        items: scopedItems.map((item) => ({
            ...item,
            paymentBreakdown: buildPaymentBreakdown({
                ...item,
                order
            })
        }))
    };
};
exports.AdminOrderService = {
    async getOrderList(filters) {
        const where = {};
        const vendorProfileWhere = (0, vendorScope_1.getVendorProfileUserWhere)(filters.roleFilter);
        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom)
                where.createdAt.gte = filters.dateFrom;
            if (filters.dateTo)
                where.createdAt.lte = filters.dateTo;
        }
        where.paymentStatus = { in: ['PAID', 'REFUND_PENDING', 'REFUNDED'] };
        if (filters.paymentStatus)
            where.paymentStatus = filters.paymentStatus;
        if (filters.vendorId) {
            where.items = { some: { vendorId: BigInt(filters.vendorId), vendorProfile: vendorProfileWhere } };
        }
        else {
            where.items = { some: { vendorProfile: vendorProfileWhere } };
        }
        if (filters.status) {
            where.items = {
                ...(where.items || {}),
                some: {
                    ...((where.items && where.items.some) || {}),
                    status: filters.status,
                    vendorProfile: vendorProfileWhere
                }
            };
        }
        const orders = await db_1.default.order.findMany({
            where,
            include: {
                customer: true,
                Coupon: true,
                items: {
                    include: {
                        product: true,
                        variant: true,
                        vendorProfile: { include: { user: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return orders
            .map((order) => withOrderPaymentBreakdown(order, filters.roleFilter))
            .filter((order) => order.items.length > 0);
    },
    async getOrderDetail(orderId, roleFilter) {
        const vendorProfileWhere = (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter);
        const order = await db_1.default.order.findUnique({
            where: { id: BigInt(orderId), paymentStatus: { in: ['PAID', 'REFUND_PENDING', 'REFUNDED'] } },
            include: {
                customer: true,
                Coupon: true,
                payments: true,
                items: {
                    include: {
                        product: true,
                        variant: true,
                        vendorProfile: { include: { user: true } }
                    }
                }
            }
        });
        if (!order)
            return null;
        const scopedOrder = withOrderPaymentBreakdown(order, roleFilter);
        return scopedOrder.items.length > 0 ? scopedOrder : null;
    },
    async cancelOrder(orderId, _reason, roleFilter) {
        const order = await db_1.default.order.findUnique({
            where: { id: BigInt(orderId), paymentStatus: { in: ['PAID', 'REFUND_PENDING', 'REFUNDED'] } },
            include: { items: { include: { vendorProfile: { include: { user: true } } } } }
        });
        if (!order)
            throw new Error('Order not found or payment not completed');
        if (roleFilter &&
            order.items.some((item) => !(0, vendorScope_1.matchesVendorRoleScope)(item.vendorProfile?.user?.role, roleFilter))) {
            throw new Error('Admin as vendor can only manage orders belonging to individual vendors');
        }
        const cancellableStatuses = [
            'PLACED',
            'BOOKED',
            'RENTAL_CONFIRMED',
            'ACCEPTED',
            'READY_FOR_PICKUP',
            'PICKED_UP',
            'OUT_FOR_DELIVERY',
            'DISPATCHED'
        ];
        const cancellableItems = order.items.filter((item) => cancellableStatuses.includes(item.status));
        if (cancellableItems.length === 0) {
            throw new Error('Cannot cancel this order');
        }
        const updatedOrder = await db_1.default.$transaction(async (tx) => {
            await tx.orderItem.updateMany({
                where: {
                    orderId: BigInt(orderId),
                    status: { in: cancellableStatuses }
                },
                data: { status: 'CANCELLED' }
            });
            await tx.order.update({
                where: { id: BigInt(orderId) },
                data: { paymentStatus: 'REFUND_PENDING' }
            });
            return tx.order.findUnique({
                where: { id: BigInt(orderId) },
                include: {
                    customer: true,
                    Coupon: true,
                    payments: true,
                    items: {
                        include: {
                            product: true,
                            variant: true,
                            vendorProfile: { include: { user: true } }
                        }
                    }
                }
            });
        });
        if (!updatedOrder)
            return null;
        await NotificationService_1.NotificationService.sendNotification({
            userId: updatedOrder.customerId.toString(),
            type: 'ORDER_REJECTED_CUSTOMER',
            title: 'Order cancelled by admin',
            message: `Order ${updatedOrder.orderNo} was cancelled by admin. Refund processing is pending manual review.`,
            data: { orderId: updatedOrder.id.toString() }
        }).catch(() => null);
        return withOrderPaymentBreakdown(updatedOrder, roleFilter);
    },
    async overrideStatus(orderId, status, roleFilter) {
        if (roleFilter) {
            const scopedOrder = await db_1.default.order.findUnique({
                where: { id: BigInt(orderId), paymentStatus: { in: ['PAID', 'REFUND_PENDING', 'REFUNDED'] } },
                include: { items: { include: { vendorProfile: { include: { user: true } } } } }
            });
            if (!scopedOrder) {
                throw new Error('Order not found or payment not completed');
            }
            if (scopedOrder.items.some((item) => !(0, vendorScope_1.matchesVendorRoleScope)(item.vendorProfile?.user?.role, roleFilter))) {
                throw new Error('Admin as vendor can only manage orders belonging to individual vendors');
            }
        }
        await db_1.default.orderItem.updateMany({
            where: { orderId: BigInt(orderId) },
            data: { status }
        });
        const updatedOrder = await db_1.default.order.findUnique({
            where: { id: BigInt(orderId) },
            include: {
                customer: true,
                Coupon: true,
                payments: true,
                items: {
                    include: {
                        product: true,
                        variant: true,
                        vendorProfile: { include: { user: true } }
                    }
                }
            }
        });
        if (!updatedOrder)
            return null;
        await NotificationService_1.NotificationService.sendNotification({
            userId: updatedOrder.customerId.toString(),
            type: 'ORDER_ACCEPTED_CUSTOMER',
            title: 'Order status changed by admin',
            message: `Order ${updatedOrder.orderNo} status has been updated to ${status.replace(/_/g, ' ')} by admin.`,
            data: { orderId: updatedOrder.id.toString(), status: String(status) }
        }).catch(() => null);
        return withOrderPaymentBreakdown(updatedOrder, roleFilter);
    }
};

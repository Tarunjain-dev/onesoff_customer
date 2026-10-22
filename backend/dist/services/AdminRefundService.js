"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRefundService = void 0;
const db_1 = __importDefault(require("../config/db"));
const PaymentService_1 = require("./PaymentService");
const NotificationService_1 = require("./NotificationService");
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const vendorScope_1 = require("../utils/vendorScope");
const roles_1 = require("../utils/roles");
const socketServer_1 = require("../realtime/socketServer");
const RETURN_REFUND_ACTIONABLE_STATUSES = [
    client_1.OrderItemStatus.RETURN_SCHEDULED,
    client_1.OrderItemStatus.RETURNED,
    client_1.OrderItemStatus.DAMAGE_REVIEW,
    client_1.OrderItemStatus.RETURN_REQUESTED,
    client_1.OrderItemStatus.RETURN_RECEIVED
];
const CANCELLATION_REFUND_ACTIONABLE_STATUSES = [
    client_1.OrderItemStatus.CANCELLED,
    client_1.OrderItemStatus.REJECTED
];
const emitRefundOrderRealtimeUpdate = (orderItem, reason) => {
    const refs = Object.fromEntries(Object.entries({
        orderId: String(orderItem?.orderId || orderItem?.order?.id || '').trim(),
        orderNo: String(orderItem?.order?.orderNo || '').trim(),
        orderItemId: String(orderItem?.id || '').trim(),
        vendorId: String(orderItem?.vendorId || '').trim(),
        customerId: String(orderItem?.order?.customerId || '').trim()
    }).filter(([, value]) => value));
    const domains = [
        'orders',
        'operations',
        'refunds',
        'dashboard'
    ];
    const payload = {
        domains,
        refs,
        reason
    };
    const customerUserId = String(orderItem?.order?.customerId || '').trim();
    const vendorUserId = String(orderItem?.vendorProfile?.user?.id || '').trim();
    if (customerUserId) {
        (0, socketServer_1.emitDataUpdatedToUser)(customerUserId, {
            ...payload,
            domains: ['orders', 'refunds', 'dashboard']
        });
    }
    if (vendorUserId) {
        (0, socketServer_1.emitDataUpdatedToUser)(vendorUserId, payload);
    }
    (0, socketServer_1.emitDataUpdatedToRole)('ADMIN', payload);
    (0, socketServer_1.emitDataUpdatedToRole)('ADMIN_AS_VENDOR', payload);
};
exports.AdminRefundService = {
    async getRefundRequests(roleFilter) {
        const vendorProfileWhere = (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter);
        return db_1.default.orderItem.findMany({
            where: {
                vendorProfile: vendorProfileWhere,
                OR: [
                    {
                        status: {
                            in: RETURN_REFUND_ACTIONABLE_STATUSES
                        }
                    },
                    {
                        status: {
                            in: CANCELLATION_REFUND_ACTIONABLE_STATUSES
                        },
                        refundProcessedByAdminId: null,
                        order: {
                            paymentStatus: {
                                in: ['PAID', 'REFUND_PENDING']
                            }
                        }
                    }
                ]
            },
            include: {
                order: {
                    include: {
                        customer: {
                            include: {
                                customerBankDetail: true
                            }
                        }
                    }
                },
                product: true,
                variant: true,
                vendorProfile: { include: { user: true } }
            },
            orderBy: { id: 'desc' }
        });
    },
    async processRefund(returnId, decision, refundAmount, manualTransfer, adminId, roleFilter) {
        const orderItem = await db_1.default.orderItem.findUnique({
            where: { id: BigInt(returnId) },
            include: {
                vendorProfile: {
                    include: {
                        user: true
                    }
                },
                order: {
                    include: {
                        customer: {
                            include: {
                                customerBankDetail: true
                            }
                        }
                    }
                }
            }
        });
        if (!orderItem)
            throw new Error('Return not found');
        if (roleFilter && !(0, vendorScope_1.matchesVendorRoleScope)(orderItem.vendorProfile?.user?.role, roleFilter)) {
            throw new Error('Refund request not found');
        }
        const isReturnRefund = RETURN_REFUND_ACTIONABLE_STATUSES.includes(orderItem.status);
        const isCancellationRefund = CANCELLATION_REFUND_ACTIONABLE_STATUSES.includes(orderItem.status);
        if (!isReturnRefund && !isCancellationRefund) {
            throw new Error('Refund request is not actionable');
        }
        if (isCancellationRefund && orderItem.refundProcessedByAdminId) {
            throw new Error('Cancellation refund already processed');
        }
        const depositAmount = Number(orderItem.deposit || 0);
        const cancellationBaseAmount = Number(orderItem.rentPrice || 0) + depositAmount;
        const refundableBaseAmount = isCancellationRefund ? cancellationBaseAmount : depositAmount;
        let finalRefundAmount = 0;
        if (decision === 'FULL')
            finalRefundAmount = refundableBaseAmount;
        else if (decision === 'PARTIAL')
            finalRefundAmount = Math.max(0, Math.min(refundAmount || 0, refundableBaseAmount));
        const heldAmount = isCancellationRefund
            ? 0
            : Math.max(0, depositAmount - finalRefundAmount);
        const depositRefundedPortion = Math.max(0, Math.min(depositAmount, finalRefundAmount));
        const transferReference = String(manualTransfer?.transferReference || '').trim();
        const transferMode = String(manualTransfer?.transferMode || 'RAZORPAY_ORIGINAL_SOURCE')
            .trim()
            .toUpperCase();
        const transferNotes = String(manualTransfer?.notes || '').trim() || null;
        const transferTimestampInput = String(manualTransfer?.transferredAt || '').trim();
        const transferredAt = transferTimestampInput ? new Date(transferTimestampInput) : new Date();
        if (transferTimestampInput && !Number.isFinite(transferredAt.getTime())) {
            throw new errors_1.ValidationError('manualTransfer.transferredAt is invalid');
        }
        const nextStatus = isCancellationRefund
            ? orderItem.status
            : finalRefundAmount > 0
                ? client_1.OrderItemStatus.SECURITY_DEPOSIT_REFUNDED
                : client_1.OrderItemStatus.DAMAGE_REVIEW;
        await db_1.default.orderItem.update({
            where: { id: orderItem.id },
            data: {
                status: nextStatus,
                securityDepositRefunded: depositRefundedPortion,
                securityDepositHeld: heldAmount,
                refundTransferMode: finalRefundAmount > 0 ? transferMode : null,
                refundTransferReference: finalRefundAmount > 0 ? (transferReference || null) : null,
                refundTransferredAt: finalRefundAmount > 0 ? transferredAt : null,
                refundTransferNotes: finalRefundAmount > 0 ? transferNotes : null,
                refundProcessedByAdminId: finalRefundAmount > 0 && adminId ? BigInt(adminId) : null
            }
        });
        let refundResult = null;
        if (finalRefundAmount > 0) {
            const idempotencyKey = transferReference || `admin-refund-${returnId}-${finalRefundAmount.toFixed(2)}`;
            refundResult = await PaymentService_1.PaymentService.processRefund(orderItem.order.customerId.toString(), finalRefundAmount, orderItem.orderId.toString(), {
                orderItemId: orderItem.id.toString(),
                adminId,
                reason: `ADMIN_${decision}_REFUND`,
                idempotencyKey
            });
        }
        const updatedOrderItem = await db_1.default.orderItem.findUnique({
            where: { id: orderItem.id },
            include: {
                order: {
                    include: {
                        customer: {
                            include: {
                                customerBankDetail: true
                            }
                        },
                        Coupon: true,
                        payments: true
                    }
                },
                product: true,
                variant: true,
                vendorProfile: { include: { user: true } }
            }
        });
        await NotificationService_1.NotificationService.notifyCustomerRefundDecision(orderItem.order.customerId.toString(), orderItem.id.toString(), finalRefundAmount).catch(() => null);
        emitRefundOrderRealtimeUpdate(updatedOrderItem || orderItem, 'ADMIN_REFUND_PROCESSED');
        return {
            orderItem: updatedOrderItem,
            refundAmount: finalRefundAmount,
            paymentRefund: refundResult,
            manualTransfer: finalRefundAmount > 0
                ? {
                    transferMode,
                    transferReference,
                    transferredAt,
                    notes: transferNotes
                }
                : null
        };
    },
    async remindAdmin(returnId, requesterId, roleFilter) {
        const orderItem = await db_1.default.orderItem.findUnique({
            where: { id: BigInt(returnId) },
            include: {
                vendorProfile: {
                    include: {
                        user: true
                    }
                },
                order: {
                    include: {
                        customer: true
                    }
                },
                product: true
            }
        });
        if (!orderItem) {
            throw new Error('Refund request not found');
        }
        if (roleFilter && !(0, vendorScope_1.matchesVendorRoleScope)(orderItem.vendorProfile?.user?.role, roleFilter)) {
            throw new Error('Refund request not found');
        }
        const admins = await db_1.default.user.findMany({
            where: {
                role: { in: roles_1.ADMIN_PORTAL_ROLES },
                status: 'ACTIVE'
            },
            select: {
                id: true,
                name: true
            }
        });
        if (admins.length === 0) {
            return { notifiedAdmins: 0 };
        }
        const requester = requesterId
            ? await db_1.default.user.findUnique({
                where: { id: BigInt(requesterId) },
                select: { name: true }
            }).catch(() => null)
            : null;
        const requesterName = requester?.name || 'Admin as vendor';
        const orderNo = String(orderItem.order?.orderNo || `ORD-${orderItem.orderId.toString()}`);
        const productName = String(orderItem.product?.name || 'Product');
        await Promise.all(admins.map((admin) => NotificationService_1.NotificationService.sendNotification({
            userId: admin.id.toString(),
            type: 'ORDER_PLACED_VENDOR',
            title: 'Refund reminder pending review',
            message: `${requesterName} requested refund follow-up for ${orderNo} - ${productName}.`,
            data: {
                orderItemId: orderItem.id.toString(),
                orderId: orderItem.orderId.toString(),
                source: 'ADMIN_AS_VENDOR_FINANCE_REMINDER'
            }
        })));
        return {
            notifiedAdmins: admins.length
        };
    }
};

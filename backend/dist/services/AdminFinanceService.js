"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminFinanceService = void 0;
const client_1 = require("@prisma/client");
const db_1 = __importDefault(require("../config/db"));
const CommissionService_1 = require("./CommissionService");
const vendorScope_1 = require("../utils/vendorScope");
const INCLUDED_PAYMENT_STATUSES = [
    client_1.PaymentStatus.PAID,
    client_1.PaymentStatus.REFUND_PENDING,
    client_1.PaymentStatus.REFUNDED
];
const EXCLUDED_ORDER_ITEM_STATUSES = [
    client_1.OrderItemStatus.CANCELLED,
    client_1.OrderItemStatus.REJECTED
];
const PENDING_REFUND_STATUSES = [
    client_1.OrderItemStatus.RETURN_SCHEDULED,
    client_1.OrderItemStatus.RETURNED,
    client_1.OrderItemStatus.DAMAGE_REVIEW,
    client_1.OrderItemStatus.RETURN_REQUESTED,
    client_1.OrderItemStatus.RETURN_RECEIVED
];
const toSafeNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const toRounded = (value) => Number(value.toFixed(2));
const formatPeriod = (start, end, fallback) => {
    const formatter = new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    if (start && end) {
        return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
    }
    if (start) {
        return formatter.format(new Date(start));
    }
    if (fallback) {
        return formatter.format(new Date(fallback));
    }
    return '-';
};
exports.AdminFinanceService = {
    async getOverview(roleFilter) {
        const vendorProfileWhere = (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter);
        const [orderItems, commissionSettings, paidPayments, refundedPayments] = await Promise.all([
            db_1.default.orderItem.findMany({
                where: {
                    order: { paymentStatus: { in: INCLUDED_PAYMENT_STATUSES } },
                    vendorProfile: vendorProfileWhere,
                    status: { notIn: EXCLUDED_ORDER_ITEM_STATUSES }
                },
                include: {
                    order: {
                        include: {
                            customer: true
                        }
                    },
                    product: true,
                    variant: true,
                    vendorProfile: {
                        include: {
                            user: true
                        }
                    },
                    vendorDues: {
                        where: {
                            status: 'SETTLED',
                            reason: {
                                in: [
                                    'RETURN_DEDUCTIONS_EXCEEDED_DEPOSIT',
                                    'DAMAGE_CLAIM_EXCEEDED_DEPOSIT'
                                ]
                            }
                        }
                    }
                },
                orderBy: { id: 'desc' }
            }),
            CommissionService_1.CommissionService.getCommissionSettings(),
            db_1.default.payment.aggregate({
                where: {
                    status: 'PAID',
                    order: {
                        items: {
                            some: {
                                vendorProfile: vendorProfileWhere
                            }
                        }
                    }
                },
                _sum: { amount: true }
            }),
            db_1.default.payment.aggregate({
                where: {
                    status: 'REFUNDED',
                    order: {
                        items: {
                            some: {
                                vendorProfile: vendorProfileWhere
                            }
                        }
                    }
                },
                _sum: { amount: true }
            })
        ]);
        let grossRentalRevenue = 0;
        let totalCommissionEarned = 0;
        let totalLateFeesRecovered = 0;
        let totalDamageRecovered = 0;
        let totalNetVendorPayable = 0;
        let totalSecurityDepositCollected = 0;
        let totalSecurityDepositRefunded = 0;
        let totalSecurityDepositHeld = 0;
        let pendingRefundExposure = 0;
        const revenueRows = orderItems.map((item) => {
            const commissionRate = CommissionService_1.CommissionService.resolveEffectiveCommissionRate(item.vendorProfile, commissionSettings);
            const rentalAmount = toSafeNumber(item.rentPrice);
            const depositCollected = toSafeNumber(item.deposit);
            const depositRefunded = toSafeNumber(item.securityDepositRefunded);
            const depositHeld = toSafeNumber(item.securityDepositHeld);
            const lateFeeRecovered = item.vendorDues
                .filter((due) => due.reason === 'RETURN_DEDUCTIONS_EXCEEDED_DEPOSIT')
                .reduce((sum, due) => sum + toSafeNumber(due.amount), 0);
            const dueDamageRecovered = item.vendorDues
                .filter((due) => due.reason === 'DAMAGE_CLAIM_EXCEEDED_DEPOSIT')
                .reduce((sum, due) => sum + toSafeNumber(due.amount), 0);
            const damageRecovered = depositHeld + dueDamageRecovered;
            const commissionAmount = (rentalAmount * commissionRate) / 100;
            const netVendorPayable = Math.max(0, rentalAmount + lateFeeRecovered + damageRecovered - commissionAmount);
            const outstandingRefund = Math.max(0, depositCollected - depositRefunded - depositHeld);
            grossRentalRevenue += rentalAmount;
            totalCommissionEarned += commissionAmount;
            totalLateFeesRecovered += lateFeeRecovered;
            totalDamageRecovered += damageRecovered;
            totalNetVendorPayable += netVendorPayable;
            totalSecurityDepositCollected += depositCollected;
            totalSecurityDepositRefunded += depositRefunded;
            totalSecurityDepositHeld += depositHeld;
            if (PENDING_REFUND_STATUSES.includes(item.status)) {
                pendingRefundExposure += outstandingRefund;
            }
            return {
                id: item.id.toString(),
                orderId: item.orderId.toString(),
                orderNo: item.order?.orderNo || `ORD-${item.orderId.toString()}`,
                productName: item.product?.name || 'Product',
                sku: item.variant?.sku || '-',
                size: item.variant?.size || 'N/A',
                customerName: item.order?.customer?.name || 'N/A',
                customerPhone: item.order?.customer?.phone || '-',
                period: formatPeriod(item.rentalStartDate, item.returnDueDate, item.order?.createdAt || null),
                rentalAmount: toRounded(rentalAmount),
                securityDepositCollected: toRounded(depositCollected),
                securityDepositRefunded: toRounded(depositRefunded),
                securityDepositHeld: toRounded(depositHeld),
                outstandingRefund: toRounded(outstandingRefund),
                commissionRate: toRounded(commissionRate),
                commissionAmount: toRounded(commissionAmount),
                lateFeeRecovered: toRounded(lateFeeRecovered),
                damageRecovered: toRounded(damageRecovered),
                netVendorPayable: toRounded(netVendorPayable),
                status: String(item.status || ''),
                createdAt: item.order?.createdAt || item.rentalStartDate || new Date()
            };
        });
        return {
            summary: {
                totalOrders: revenueRows.length,
                grossRentalRevenue: toRounded(grossRentalRevenue),
                totalCommissionEarned: toRounded(totalCommissionEarned),
                totalLateFeesRecovered: toRounded(totalLateFeesRecovered),
                totalDamageRecovered: toRounded(totalDamageRecovered),
                totalNetVendorPayable: toRounded(totalNetVendorPayable),
                totalSecurityDepositCollected: toRounded(totalSecurityDepositCollected),
                totalSecurityDepositRefunded: toRounded(totalSecurityDepositRefunded),
                totalSecurityDepositHeld: toRounded(totalSecurityDepositHeld),
                pendingRefundExposure: toRounded(pendingRefundExposure),
                escrowBalance: toRounded(toSafeNumber(paidPayments?._sum?.amount) - toSafeNumber(refundedPayments?._sum?.amount))
            },
            revenueRows
        };
    },
    async getTransactionHistory(roleFilter) {
        const vendorProfileWhere = (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter);
        const [refundTransfers, completedSettlements] = await Promise.all([
            db_1.default.orderItem.findMany({
                where: {
                    vendorProfile: vendorProfileWhere,
                    refundTransferredAt: { not: null },
                    securityDepositRefunded: { gt: 0 }
                },
                include: {
                    order: {
                        include: {
                            customer: true
                        }
                    },
                    product: true,
                    variant: true
                },
                orderBy: [{ refundTransferredAt: 'desc' }, { id: 'desc' }]
            }),
            db_1.default.vendorSettlement.findMany({
                where: {
                    status: 'COMPLETED',
                    paidAt: { not: null },
                    vendor: vendorProfileWhere
                },
                include: {
                    vendor: {
                        include: {
                            user: true
                        }
                    }
                },
                orderBy: [{ paidAt: 'desc' }, { id: 'desc' }]
            })
        ]);
        const refundRows = refundTransfers.map((item) => ({
            id: `REFUND-${item.id.toString()}`,
            date: item.refundTransferredAt || item.order?.createdAt || new Date(),
            description: `Security deposit refunded for ${item.order?.orderNo || `ORD-${item.orderId.toString()}`}`,
            type: 'debit',
            amount: toRounded(toSafeNumber(item.securityDepositRefunded)),
            category: 'refund',
            reference: item.refundTransferReference ||
                `${item.order?.customer?.name || 'Customer'} • ${item.product?.name || 'Product'}`
        }));
        const settlementRows = completedSettlements.map((settlement) => ({
            id: `PAYOUT-${settlement.id.toString()}`,
            date: settlement.paidAt || settlement.createdAt || new Date(),
            description: `Monthly payout paid to ${settlement.vendor?.shopName || settlement.vendor?.ownerName || settlement.vendor?.user?.name || 'Individual Vendor'}`,
            type: 'debit',
            amount: toRounded(toSafeNumber(settlement.amount)),
            category: 'payout',
            reference: settlement.transferReference ||
                settlement.vendor?.shopName ||
                settlement.vendor?.user?.name ||
                `SET-${settlement.id.toString()}`
        }));
        return [...refundRows, ...settlementRows].sort((a, b) => {
            const aTime = new Date(a.date).getTime();
            const bTime = new Date(b.date).getTime();
            return bTime - aTime;
        });
    }
};

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminWalletService = void 0;
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const CommissionService_1 = require("./CommissionService");
exports.AdminWalletService = {
    async getWalletOverview() {
        const [heldDeposits, pendingRefunds, totalPaid, totalRefunded, vendorGrossRows, completedSettlementRows] = await Promise.all([
            db_1.default.orderItem.aggregate({
                where: {
                    status: {
                        in: [
                            'PLACED',
                            'BOOKED',
                            'RENTAL_CONFIRMED',
                            'ACCEPTED',
                            'READY_FOR_PICKUP',
                            'PICKED_UP',
                            'OUT_FOR_DELIVERY',
                            'DISPATCHED',
                            'DELIVERED'
                        ]
                    }
                },
                _sum: { deposit: true }
            }),
            db_1.default.orderItem.aggregate({
                where: {
                    status: {
                        in: [
                            'RETURN_SCHEDULED',
                            'RETURNED',
                            'DAMAGE_REVIEW',
                            'RETURN_REQUESTED',
                            'RETURN_RECEIVED'
                        ]
                    }
                },
                _sum: { deposit: true }
            }),
            db_1.default.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
            db_1.default.payment.aggregate({ where: { status: 'REFUNDED' }, _sum: { amount: true } }),
            db_1.default.orderItem.groupBy({
                by: ['vendorId'],
                where: {
                    order: { paymentStatus: 'PAID' },
                    status: {
                        notIn: [client_1.OrderItemStatus.CANCELLED, client_1.OrderItemStatus.REJECTED]
                    }
                },
                _sum: { rentPrice: true }
            }),
            db_1.default.vendorSettlement.groupBy({
                by: ['vendorId'],
                where: { status: 'COMPLETED' },
                _sum: { amount: true }
            })
        ]);
        const vendorIds = vendorGrossRows.map((row) => row.vendorId);
        const [vendorProfiles, commissionSettings] = await Promise.all([
            vendorIds.length
                ? db_1.default.vendorProfile.findMany({
                    where: { id: { in: vendorIds } },
                    select: {
                        id: true,
                        commissionRate: true,
                        commissionPercentage: true,
                        commissionOverridePercentage: true,
                        user: {
                            select: {
                                role: true
                            }
                        }
                    }
                })
                : Promise.resolve([]),
            CommissionService_1.CommissionService.getCommissionSettings()
        ]);
        const commissionMap = new Map(vendorProfiles.map((vendor) => [
            vendor.id.toString(),
            CommissionService_1.CommissionService.resolveEffectiveCommissionRate(vendor, commissionSettings)
        ]));
        const completedMap = new Map(completedSettlementRows.map((row) => [row.vendorId.toString(), Number(row._sum.amount || 0)]));
        const vendorPayables = vendorGrossRows.reduce((sum, row) => {
            const gross = Number(row._sum.rentPrice || 0);
            const commissionRate = commissionMap.get(row.vendorId.toString()) || 0;
            const netPayable = Math.max(0, gross - (gross * commissionRate) / 100);
            const alreadyPaid = completedMap.get(row.vendorId.toString()) || 0;
            return sum + Math.max(0, netPayable - alreadyPaid);
        }, 0);
        return {
            totalHeldDeposits: Number(heldDeposits._sum.deposit || 0),
            pendingRefunds: Number(pendingRefunds._sum.deposit || 0),
            vendorPayables,
            platformEarnings: Number(totalPaid._sum.amount || 0) - Number(totalRefunded._sum.amount || 0)
        };
    },
    async getTransactions(limit = 50) {
        return db_1.default.payment.findMany({
            take: limit,
            include: {
                order: { include: { customer: true } },
                customer: true
            },
            orderBy: { paidAt: 'desc' }
        });
    }
};

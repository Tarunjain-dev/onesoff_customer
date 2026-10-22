"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSettlementService = void 0;
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const CommissionService_1 = require("./CommissionService");
const vendorScope_1 = require("../utils/vendorScope");
const publicCodes_1 = require("../utils/publicCodes");
const EXCLUDED_SETTLEMENT_STATUSES = [
    client_1.OrderItemStatus.CANCELLED,
    client_1.OrderItemStatus.REJECTED
];
const toRounded = (value) => Number(value.toFixed(2));
const parseVendorProfileId = async (vendorIdentifier) => {
    let vendorIdBig;
    try {
        vendorIdBig = BigInt(vendorIdentifier);
    }
    catch {
        throw new errors_1.ValidationError('Invalid vendorId');
    }
    const vendor = await db_1.default.vendorProfile.findFirst({
        where: {
            OR: [{ id: vendorIdBig }, { userId: vendorIdBig }]
        },
        select: { id: true }
    });
    if (!vendor) {
        throw new errors_1.ValidationError('Vendor not found');
    }
    return vendor.id;
};
const parseVendorProfileIdInScope = async (vendorIdentifier, roleFilter) => {
    let vendorIdBig;
    try {
        vendorIdBig = BigInt(vendorIdentifier);
    }
    catch {
        throw new errors_1.ValidationError('Invalid vendorId');
    }
    const vendor = await db_1.default.vendorProfile.findFirst({
        where: {
            ...(0, vendorScope_1.getVendorProfileUserWhere)(roleFilter),
            OR: [{ id: vendorIdBig }, { userId: vendorIdBig }]
        },
        select: { id: true }
    });
    if (!vendor) {
        throw new errors_1.ValidationError('Vendor not found');
    }
    return vendor.id;
};
const computeVendorPayable = async (vendorProfileId, commissionRate, period) => {
    const orderWhere = {
        vendorId: vendorProfileId,
        order: { paymentStatus: { in: ['PAID', 'REFUND_PENDING', 'REFUNDED'] } },
        status: { notIn: EXCLUDED_SETTLEMENT_STATUSES }
    };
    if (period) {
        orderWhere.order.createdAt = { gte: period.from, lte: period.to };
    }
    const completedWhere = { vendorId: vendorProfileId, status: 'COMPLETED' };
    const pendingWhere = { vendorId: vendorProfileId, status: 'PENDING' };
    const settledDamageDuesWhere = {
        vendorId: vendorProfileId,
        status: 'SETTLED',
        reason: 'DAMAGE_CLAIM_EXCEEDED_DEPOSIT'
    };
    const settledLateDuesWhere = {
        vendorId: vendorProfileId,
        status: 'SETTLED',
        reason: 'RETURN_DEDUCTIONS_EXCEEDED_DEPOSIT'
    };
    if (period) {
        completedWhere.createdAt = { gte: period.from, lte: period.to };
        pendingWhere.createdAt = { gte: period.from, lte: period.to };
        settledDamageDuesWhere.createdAt = { gte: period.from, lte: period.to };
        settledLateDuesWhere.createdAt = { gte: period.from, lte: period.to };
    }
    const [orderAggregate, completedAgg, pendingAgg, settledDamageDues, settledLateDues] = await Promise.all([
        db_1.default.orderItem.aggregate({
            where: orderWhere,
            _sum: { rentPrice: true, securityDepositHeld: true },
            _count: { id: true }
        }),
        db_1.default.vendorSettlement.aggregate({
            where: completedWhere,
            _sum: { amount: true }
        }),
        db_1.default.vendorSettlement.aggregate({
            where: pendingWhere,
            _sum: { amount: true }
        }),
        db_1.default.vendorDue.aggregate({
            where: settledDamageDuesWhere,
            _sum: { amount: true }
        }),
        db_1.default.vendorDue.aggregate({
            where: settledLateDuesWhere,
            _sum: { amount: true }
        })
    ]);
    const grossRentalRevenue = Number(orderAggregate._sum.rentPrice || 0);
    const depositHeldCompensation = Number(orderAggregate._sum.securityDepositHeld || 0);
    const dueDamageCompensation = Number(settledDamageDues._sum.amount || 0);
    const dueLateCompensation = Number(settledLateDues._sum.amount || 0);
    const lateFeeAmount = Math.max(0, dueLateCompensation);
    const damageAmount = Math.max(0, depositHeldCompensation + dueDamageCompensation);
    const commissionDeducted = Math.max(0, (grossRentalRevenue * commissionRate) / 100);
    const netPayable = Math.max(0, grossRentalRevenue + lateFeeAmount + damageAmount - commissionDeducted);
    const alreadyPaid = Number(completedAgg._sum.amount || 0);
    const pendingGenerated = Number(pendingAgg._sum.amount || 0);
    const pendingAmount = Math.max(0, netPayable - alreadyPaid);
    const availableForNewSettlement = Math.max(0, pendingAmount - pendingGenerated);
    const orderCount = Number(orderAggregate._count.id || 0);
    return {
        grossRentalRevenue,
        lateFeeAmount,
        damageAmount,
        commissionDeducted,
        netPayable,
        alreadyPaid,
        pendingGenerated,
        pendingAmount,
        availableForNewSettlement,
        orderCount
    };
};
exports.AdminSettlementService = {
    async getOwnerPayoutSummaries(roleFilter) {
        const [vendors, commissionSettings] = await Promise.all([
            db_1.default.vendorProfile.findMany({
                where: (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter),
                include: { user: true },
                orderBy: { createdAt: 'desc' }
            }),
            CommissionService_1.CommissionService.getCommissionSettings()
        ]);
        return Promise.all(vendors.map(async (vendor) => {
            const commissionRate = CommissionService_1.CommissionService.resolveEffectiveCommissionRate(vendor, commissionSettings);
            const payable = await computeVendorPayable(vendor.id, commissionRate);
            const latestCompletedSettlement = await db_1.default.vendorSettlement.findFirst({
                where: { vendorId: vendor.id, status: 'COMPLETED' },
                orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }]
            });
            return {
                vendorId: vendor.id.toString(),
                vendorUserId: vendor.userId.toString(),
                vendorCode: String(vendor.user?.publicCode || (0, publicCodes_1.buildUserPublicCode)(vendor.user?.role, vendor.userId)),
                ownerName: vendor.ownerName || vendor.user?.name || 'Individual Vendor',
                shopName: vendor.shopName || vendor.ownerName || vendor.user?.name || 'Individual Vendor',
                grossRentalRevenue: toRounded(payable.grossRentalRevenue),
                commissionRate: toRounded(commissionRate),
                commissionAmount: toRounded(payable.commissionDeducted),
                netPayable: toRounded(payable.netPayable),
                pendingPayout: toRounded(payable.pendingAmount),
                totalPaid: toRounded(payable.alreadyPaid),
                pendingGenerated: toRounded(payable.pendingGenerated),
                latestPaidAt: latestCompletedSettlement?.paidAt || latestCompletedSettlement?.createdAt || null,
                bankDetails: {
                    accountHolderName: vendor.accountHolder || vendor.ownerName || vendor.shopName || '',
                    accountNumber: vendor.accountNumber || '',
                    bankName: vendor.bankName || '',
                    ifscCode: vendor.ifscCode || ''
                }
            };
        }));
    },
    async getOwnerPayoutDetail(vendorId, roleFilter) {
        const vendorProfileId = await parseVendorProfileIdInScope(vendorId, roleFilter);
        const [vendor, commissionSettings, settlements] = await Promise.all([
            db_1.default.vendorProfile.findUnique({
                where: { id: vendorProfileId },
                include: { user: true }
            }),
            CommissionService_1.CommissionService.getCommissionSettings(),
            db_1.default.vendorSettlement.findMany({
                where: { vendorId: vendorProfileId },
                orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }]
            })
        ]);
        if (!vendor) {
            throw new errors_1.ValidationError('Vendor not found');
        }
        const commissionRate = CommissionService_1.CommissionService.resolveEffectiveCommissionRate(vendor, commissionSettings);
        const payable = await computeVendorPayable(vendor.id, commissionRate);
        return {
            vendorId: vendor.id.toString(),
            vendorUserId: vendor.userId.toString(),
            vendorCode: String(vendor.user?.publicCode || (0, publicCodes_1.buildUserPublicCode)(vendor.user?.role, vendor.userId)),
            ownerName: vendor.ownerName || vendor.user?.name || 'Individual Vendor',
            shopName: vendor.shopName || vendor.ownerName || vendor.user?.name || 'Individual Vendor',
            summary: {
                grossRentalRevenue: toRounded(payable.grossRentalRevenue),
                commissionRate: toRounded(commissionRate),
                commissionAmount: toRounded(payable.commissionDeducted),
                netPayable: toRounded(payable.netPayable),
                pendingPayout: toRounded(payable.pendingAmount),
                totalPaid: toRounded(payable.alreadyPaid),
                pendingGenerated: toRounded(payable.pendingGenerated)
            },
            bankDetails: {
                accountHolderName: vendor.accountHolder || vendor.ownerName || vendor.shopName || '',
                accountNumber: vendor.accountNumber || '',
                bankName: vendor.bankName || '',
                ifscCode: vendor.ifscCode || ''
            },
            transactions: settlements.map((settlement) => ({
                id: settlement.id.toString(),
                date: settlement.paidAt || settlement.createdAt,
                description: settlement.status === 'COMPLETED'
                    ? 'Monthly payout paid by admin'
                    : 'Monthly payout pending approval',
                amount: toRounded(Number(settlement.amount || 0)),
                status: String(settlement.status || 'PENDING'),
                transferMode: settlement.transferMode || null,
                transferReference: settlement.transferReference || null
            }))
        };
    },
    async getSettlementList() {
        const [vendors, completedSettlements, failedSettlements, commissionSettings] = await Promise.all([
            db_1.default.vendorProfile.findMany({
                include: { user: true },
                orderBy: { createdAt: 'desc' }
            }),
            db_1.default.vendorSettlement.findMany({
                where: { status: 'COMPLETED' },
                include: {
                    vendor: {
                        include: { user: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            db_1.default.vendorSettlement.findMany({
                where: { status: 'FAILED' },
                include: {
                    vendor: {
                        include: { user: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            CommissionService_1.CommissionService.getCommissionSettings()
        ]);
        const pendingRows = await Promise.all(vendors.map(async (vendor) => {
            const commissionRate = CommissionService_1.CommissionService.resolveEffectiveCommissionRate(vendor, commissionSettings);
            const payable = await computeVendorPayable(vendor.id, commissionRate);
            if (payable.pendingAmount <= 0) {
                return null;
            }
            const pendingAmount = toRounded(payable.pendingAmount);
            const now = new Date();
            return {
                id: `PENDING-${vendor.id.toString()}`,
                vendorId: vendor.id,
                vendorCode: String(vendor.user?.publicCode || (0, publicCodes_1.buildUserPublicCode)(vendor.user?.role, vendor.userId)),
                status: 'PENDING',
                amount: pendingAmount,
                periodFrom: null,
                periodTo: null,
                rentalAmount: toRounded(payable.grossRentalRevenue),
                lateFeeAmount: toRounded(payable.lateFeeAmount),
                damageAmount: toRounded(payable.damageAmount),
                commissionAmount: toRounded(payable.commissionDeducted),
                netPayable: toRounded(payable.netPayable),
                transferMode: null,
                transferReference: null,
                paidAt: null,
                paidByAdminId: null,
                notes: null,
                createdAt: now,
                _sum: { amount: pendingAmount },
                _count: { id: payable.orderCount },
                grossRentalRevenue: toRounded(payable.grossRentalRevenue),
                commissionRate: toRounded(commissionRate),
                commissionDeducted: toRounded(payable.commissionDeducted),
                alreadyPaid: toRounded(payable.alreadyPaid),
                pendingGenerated: toRounded(payable.pendingGenerated),
                vendor: {
                    ...vendor,
                    bankDetails: {
                        accountName: vendor.accountHolder || vendor.ownerName || vendor.shopName || '',
                        accountNumber: vendor.accountNumber || '',
                        bankName: vendor.bankName || '',
                        ifsc: vendor.ifscCode || ''
                    }
                }
            };
        }));
        const completedRows = completedSettlements.map((row) => {
            const grossRentalRevenue = Number(row.rentalAmount || 0);
            const commissionAmount = Number(row.commissionAmount || 0);
            const derivedCommissionRate = grossRentalRevenue > 0 ? (commissionAmount / grossRentalRevenue) * 100 : 0;
            return {
                ...row,
                vendorCode: String(row.vendor?.user?.publicCode ||
                    (0, publicCodes_1.buildUserPublicCode)(row.vendor?.user?.role, row.vendor?.userId || row.vendor?.user?.id)),
                grossRentalRevenue: toRounded(grossRentalRevenue),
                commissionRate: toRounded(derivedCommissionRate),
                commissionDeducted: toRounded(commissionAmount),
                vendor: {
                    ...row.vendor,
                    bankDetails: {
                        accountName: row.vendor.accountHolder || row.vendor.ownerName || row.vendor.shopName || '',
                        accountNumber: row.vendor.accountNumber || '',
                        bankName: row.vendor.bankName || '',
                        ifsc: row.vendor.ifscCode || ''
                    }
                }
            };
        });
        const failedRows = failedSettlements.map((row) => {
            const grossRentalRevenue = Number(row.rentalAmount || 0);
            const commissionAmount = Number(row.commissionAmount || 0);
            const derivedCommissionRate = grossRentalRevenue > 0 ? (commissionAmount / grossRentalRevenue) * 100 : 0;
            return {
                ...row,
                vendorCode: String(row.vendor?.user?.publicCode ||
                    (0, publicCodes_1.buildUserPublicCode)(row.vendor?.user?.role, row.vendor?.userId || row.vendor?.user?.id)),
                grossRentalRevenue: toRounded(grossRentalRevenue),
                commissionRate: toRounded(derivedCommissionRate),
                commissionDeducted: toRounded(commissionAmount),
                vendor: {
                    ...row.vendor,
                    bankDetails: {
                        accountName: row.vendor.accountHolder || row.vendor.ownerName || row.vendor.shopName || '',
                        accountNumber: row.vendor.accountNumber || '',
                        bankName: row.vendor.bankName || '',
                        ifsc: row.vendor.ifscCode || ''
                    }
                }
            };
        });
        return [...completedRows, ...failedRows, ...pendingRows.filter(Boolean)].sort((a, b) => {
            const aTime = new Date(a.createdAt).getTime();
            const bTime = new Date(b.createdAt).getTime();
            return bTime - aTime;
        });
    },
    async markSettlementPaid(vendorId, input) {
        const vendorProfileId = await parseVendorProfileId(vendorId);
        const vendor = await db_1.default.vendorProfile.findUnique({
            where: { id: vendorProfileId },
            include: { user: true }
        });
        if (!vendor) {
            throw new errors_1.ValidationError('Vendor not found');
        }
        const period = input?.period;
        const transferReference = String(input?.transferReference || '').trim() || null;
        const transferMode = String(input?.transferMode || 'BANK_TRANSFER_MANUAL').trim().toUpperCase() ||
            'BANK_TRANSFER_MANUAL';
        const notes = String(input?.notes || '').trim() || null;
        const paidAt = input?.paidAt || new Date();
        if (!Number.isFinite(paidAt.getTime())) {
            throw new errors_1.ValidationError('Invalid paidAt');
        }
        const paidByAdminId = input?.paidByAdminId ? BigInt(input.paidByAdminId) : null;
        const settlementFilter = { vendorId: vendorProfileId, status: 'PENDING' };
        if (period) {
            settlementFilter.createdAt = { gte: period.from, lte: period.to };
        }
        const existingPending = await db_1.default.vendorSettlement.findMany({
            where: settlementFilter,
            orderBy: { createdAt: 'desc' }
        });
        if (existingPending.length > 0) {
            await db_1.default.vendorSettlement.updateMany({
                where: { id: { in: existingPending.map((item) => item.id) } },
                data: {
                    status: 'COMPLETED',
                    transferMode,
                    transferReference,
                    notes,
                    paidAt,
                    paidByAdminId
                }
            });
        }
        const commissionSettings = await CommissionService_1.CommissionService.getCommissionSettings();
        const commissionRate = CommissionService_1.CommissionService.resolveEffectiveCommissionRate(vendor, commissionSettings);
        const payable = await computeVendorPayable(vendorProfileId, commissionRate, period);
        let manualSettlement = null;
        if (payable.pendingAmount > 0) {
            manualSettlement = await db_1.default.vendorSettlement.create({
                data: {
                    vendorId: vendorProfileId,
                    amount: payable.pendingAmount,
                    status: 'COMPLETED',
                    periodFrom: period?.from || null,
                    periodTo: period?.to || null,
                    rentalAmount: payable.grossRentalRevenue,
                    lateFeeAmount: payable.lateFeeAmount,
                    damageAmount: payable.damageAmount,
                    commissionAmount: payable.commissionDeducted,
                    netPayable: payable.netPayable,
                    transferMode,
                    transferReference,
                    notes,
                    paidAt,
                    paidByAdminId
                }
            });
        }
        const completedRows = [
            ...existingPending.map((item) => ({
                ...item,
                status: 'COMPLETED',
                transferMode,
                transferReference,
                notes,
                paidAt,
                paidByAdminId
            })),
            ...(manualSettlement ? [manualSettlement] : [])
        ];
        return completedRows.map((row) => ({
            ...row,
            vendorCode: String(vendor.user?.publicCode || (0, publicCodes_1.buildUserPublicCode)(vendor.user?.role, vendor.userId)),
            vendor,
            grossRentalRevenue: toRounded(payable.grossRentalRevenue),
            lateFeeAmount: toRounded(payable.lateFeeAmount),
            damageAmount: toRounded(payable.damageAmount),
            commissionRate: toRounded(commissionRate),
            commissionDeducted: toRounded(payable.commissionDeducted),
            netPayable: toRounded(payable.netPayable),
            bankDetails: {
                accountName: vendor.accountHolder || vendor.ownerName || vendor.shopName || '',
                accountNumber: vendor.accountNumber || '',
                bankName: vendor.bankName || '',
                ifsc: vendor.ifscCode || ''
            }
        }));
    },
    async rejectSettlement(vendorId, input) {
        const vendorProfileId = await parseVendorProfileId(vendorId);
        const vendor = await db_1.default.vendorProfile.findUnique({
            where: { id: vendorProfileId },
            include: { user: true }
        });
        if (!vendor) {
            throw new errors_1.ValidationError('Vendor not found');
        }
        const period = input?.period;
        const reason = String(input?.reason || '').trim() || null;
        const notes = String(input?.notes || '').trim() || reason;
        const rejectedByAdminId = input?.rejectedByAdminId ? BigInt(input.rejectedByAdminId) : null;
        const settlementFilter = { vendorId: vendorProfileId, status: 'PENDING' };
        if (period) {
            settlementFilter.createdAt = { gte: period.from, lte: period.to };
        }
        const existingPending = await db_1.default.vendorSettlement.findMany({
            where: settlementFilter,
            orderBy: { createdAt: 'desc' }
        });
        if (existingPending.length === 0) {
            return [];
        }
        await db_1.default.vendorSettlement.updateMany({
            where: { id: { in: existingPending.map((item) => item.id) } },
            data: {
                status: 'FAILED',
                notes,
                paidByAdminId: rejectedByAdminId
            }
        });
        const updatedSettlements = await db_1.default.vendorSettlement.findMany({
            where: { id: { in: existingPending.map((item) => item.id) } },
            include: { vendor: { include: { user: true } } }
        });
        const commissionSettings = await CommissionService_1.CommissionService.getCommissionSettings();
        const commissionRate = CommissionService_1.CommissionService.resolveEffectiveCommissionRate(vendor, commissionSettings);
        const payable = await computeVendorPayable(vendorProfileId, commissionRate, period);
        const rejectedRows = updatedSettlements.map((row) => {
            const grossRentalRevenue = Number(row.rentalAmount || 0);
            const commissionAmount = Number(row.commissionAmount || 0);
            const derivedCommissionRate = grossRentalRevenue > 0 ? (commissionAmount / grossRentalRevenue) * 100 : 0;
            return {
                ...row,
                vendorCode: String(row.vendor?.user?.publicCode ||
                    (0, publicCodes_1.buildUserPublicCode)(row.vendor?.user?.role, row.vendor?.userId || row.vendor?.user?.id)),
                grossRentalRevenue: toRounded(grossRentalRevenue),
                commissionRate: toRounded(derivedCommissionRate),
                commissionDeducted: toRounded(commissionAmount),
                vendor: {
                    ...row.vendor,
                    bankDetails: {
                        accountName: row.vendor.accountHolder || row.vendor.ownerName || row.vendor.shopName || '',
                        accountNumber: row.vendor.accountNumber || '',
                        bankName: row.vendor.bankName || '',
                        ifsc: row.vendor.ifscCode || ''
                    }
                }
            };
        });
        return rejectedRows.map((row) => ({
            ...row,
            grossRentalRevenue: toRounded(payable.grossRentalRevenue),
            lateFeeAmount: toRounded(payable.lateFeeAmount),
            damageAmount: toRounded(payable.damageAmount),
            commissionRate: toRounded(commissionRate),
            commissionDeducted: toRounded(payable.commissionDeducted),
            netPayable: toRounded(payable.netPayable)
        }));
    }
};

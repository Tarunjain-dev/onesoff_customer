"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReturnService = void 0;
const PaymentService_1 = require("./PaymentService");
const VendorEarningService_1 = require("./VendorEarningService");
const NotificationService_1 = require("./NotificationService");
const S3Service_1 = require("./S3Service");
const VendorProfileService_1 = require("./VendorProfileService");
const socketServer_1 = require("../realtime/socketServer");
const errors_1 = require("../utils/errors");
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const orderStatus_1 = require("../constants/orderStatus");
const vendorScope_1 = require("../utils/vendorScope");
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LATE_FEE_PER_DAY = Number(process.env.LATE_FEE_PER_DAY || 100);
const RETURN_STATUSES = [
    client_1.OrderItemStatus.RETURN_SCHEDULED,
    client_1.OrderItemStatus.LATE_RETURN,
    client_1.OrderItemStatus.RETURNED,
    client_1.OrderItemStatus.DAMAGE_REVIEW,
    client_1.OrderItemStatus.SECURITY_DEPOSIT_REFUNDED,
    client_1.OrderItemStatus.RETURN_REQUESTED,
    client_1.OrderItemStatus.RETURN_RECEIVED,
    client_1.OrderItemStatus.INSPECTED_GOOD,
    client_1.OrderItemStatus.INSPECTED_DAMAGED,
    client_1.OrderItemStatus.INSPECTED_LOST,
    client_1.OrderItemStatus.COMPLETED
];
const LEGACY_STATUS_MAP = {
    PENDING_PICKUP: 'RETURN_SCHEDULED',
    LATE: 'LATE_RETURN',
    LATE_RETURN: 'LATE_RETURN',
    PENDING_INSPECTION: 'RETURNED',
    PENDING_ADMIN: 'DAMAGE_REVIEW',
    COMPLETED: 'SECURITY_DEPOSIT_REFUNDED'
};
const DAMAGE_CLAIMABLE_STATUSES = [
    client_1.OrderItemStatus.RETURN_SCHEDULED,
    client_1.OrderItemStatus.LATE_RETURN,
    client_1.OrderItemStatus.RETURNED,
    client_1.OrderItemStatus.DAMAGE_REVIEW,
    client_1.OrderItemStatus.SECURITY_DEPOSIT_REFUNDED,
    client_1.OrderItemStatus.RETURN_REQUESTED,
    client_1.OrderItemStatus.RETURN_RECEIVED,
    client_1.OrderItemStatus.COMPLETED
];
const normalizeToUtcDay = (value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const parseReturnedAt = (value) => {
    if (!value || String(value).trim() === '') {
        return new Date();
    }
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
        throw new errors_1.ValidationError('Invalid returnedAt');
    }
    return parsed;
};
const resolveLateDays = (dueDate, returnedAt) => {
    if (!dueDate || !returnedAt)
        return 0;
    const due = normalizeToUtcDay(new Date(dueDate));
    const returned = normalizeToUtcDay(new Date(returnedAt));
    const diffDays = Math.floor((returned.getTime() - due.getTime()) / DAY_MS);
    return Math.max(0, diffDays);
};
const resolveLateFeePerDay = (input, vendorDefaultLateFeePerDay) => {
    const candidate = Number(input);
    if (Number.isFinite(candidate) && candidate > 0)
        return candidate;
    const vendorDefault = Number(vendorDefaultLateFeePerDay);
    if (Number.isFinite(vendorDefault) && vendorDefault > 0)
        return vendorDefault;
    return Number.isFinite(DEFAULT_LATE_FEE_PER_DAY) && DEFAULT_LATE_FEE_PER_DAY > 0
        ? DEFAULT_LATE_FEE_PER_DAY
        : 100;
};
const isMissingColumnError = (error) => {
    const code = error?.code;
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return code === 'P2022' || message.includes('does not exist in the current database');
};
const isInvalidOrderItemStatusError = (error, statusValue = 'late_return') => {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (message.includes('invalid input value for enum "orderitemstatus"') &&
        message.includes(statusValue.toLowerCase()));
};
const removeLateReturnStatus = (statuses) => statuses.filter((status) => String(status) !== 'LATE_RETURN');
const withLateReturnFallback = async (run, statuses) => {
    try {
        return await run(statuses);
    }
    catch (error) {
        if (!isInvalidOrderItemStatusError(error) || !statuses.some((status) => String(status) === 'LATE_RETURN')) {
            throw error;
        }
        const fallbackStatuses = removeLateReturnStatus(statuses);
        return run(fallbackStatuses);
    }
};
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
        if (!isMissingColumnError(error))
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
const ensureVendorEarningCredit = async (tx, orderItem) => {
    const existing = await tx.vendorTransaction.findFirst({
        where: {
            orderItemId: orderItem.id,
            vendorId: orderItem.vendorId,
            type: 'CREDIT'
        },
        select: { id: true }
    });
    if (!existing) {
        await VendorEarningService_1.VendorEarningService.createVendorEarning(tx, orderItem.vendorId.toString(), orderItem.id.toString(), Number(orderItem.rentPrice));
    }
};
const createVendorDueIfNeeded = async (tx, payload) => {
    const amount = Math.max(0, Number(payload.amount || 0));
    if (!Number.isFinite(amount) || amount <= 0)
        return null;
    return tx.vendorDue.create({
        data: {
            orderItemId: payload.orderItemId,
            customerId: payload.customerId,
            vendorId: payload.vendorId,
            amount,
            reason: payload.reason,
            notes: payload.notes || null,
            resolvedByAdminId: payload.resolvedByAdminId ? BigInt(payload.resolvedByAdminId) : null,
            status: 'PENDING'
        }
    });
};
const mapLegacyStatus = (status) => {
    if (!status)
        return undefined;
    const normalized = String(status).trim().toUpperCase();
    const mapped = LEGACY_STATUS_MAP[normalized] || normalized;
    const expanded = (0, orderStatus_1.expandOrderItemStatusFilter)(mapped);
    if (!expanded)
        return undefined;
    const returnStatuses = expanded.filter((item) => RETURN_STATUSES.includes(item));
    return returnStatuses.length > 0 ? returnStatuses : undefined;
};
const normalizeDamageClaimRecord = async (claim) => {
    const orderItem = claim?.orderItem ?? claim?.OrderItem ?? null;
    const vendor = claim?.vendor ?? claim?.VendorProfile ?? null;
    const vendorRole = String(vendor?.user?.role || '').trim().toUpperCase();
    const claimSource = vendorRole === 'INDIVIDUAL_VENDOR' ? 'ADMIN_AS_VENDOR' : 'VENDOR';
    const refundedAmountRaw = claim?.refundedAmount ?? orderItem?.securityDepositRefunded ?? 0;
    const refundedAmount = Number(refundedAmountRaw);
    const actualCostRaw = claim?.actualCost ?? orderItem?.repairTask?.actualCost ?? null;
    const actualCost = actualCostRaw != null && Number.isFinite(Number(actualCostRaw))
        ? Number(actualCostRaw)
        : null;
    const photoProofRaw = Array.isArray(claim?.photoProof)
        ? claim.photoProof.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    const accessiblePhotoProof = photoProofRaw.length > 0
        ? await S3Service_1.S3Service.getAccessibleImageUrls(photoProofRaw)
        : [];
    return {
        ...claim,
        orderItem,
        vendor,
        vendorRole,
        claimSource,
        photoProof: accessiblePhotoProof,
        refundedAmount: Number.isFinite(refundedAmount) ? refundedAmount : 0,
        actualCost
    };
};
const getVendorRealtimeRole = (value) => String(value || '').trim().toUpperCase() === 'INDIVIDUAL_VENDOR'
    ? 'ADMIN_AS_VENDOR'
    : 'ADMIN';
const buildReturnRealtimeRefs = (payload) => Object.fromEntries(Object.entries({
    orderItemId: String(payload.orderItemId || '').trim(),
    orderNo: String(payload.orderNo || '').trim(),
    claimId: String(payload.claimId || '').trim(),
    vendorId: String(payload.vendorId || '').trim(),
    customerId: String(payload.customerId || '').trim()
}).filter(([, value]) => value));
const resolveVendorRealtimeContext = async (vendorProfileId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: vendorProfileId },
        include: {
            user: {
                select: {
                    id: true,
                    role: true
                }
            }
        }
    });
    return {
        vendorUserId: vendor?.user?.id ? vendor.user.id.toString() : '',
        vendorRole: String(vendor?.user?.role || '').trim().toUpperCase()
    };
};
const emitReturnRealtimeUpdate = async (payload) => {
    const context = payload.vendorUserId || payload.vendorRole
        ? {
            vendorUserId: String(payload.vendorUserId || '').trim(),
            vendorRole: String(payload.vendorRole || '').trim().toUpperCase()
        }
        : await resolveVendorRealtimeContext(payload.vendorProfileId);
    const refs = buildReturnRealtimeRefs({
        orderItemId: payload.orderItemId,
        orderNo: payload.orderNo,
        claimId: payload.claimId,
        vendorId: payload.vendorProfileId.toString(),
        customerId: payload.customerUserId
    });
    const vendorPayload = {
        domains: payload.domains,
        refs,
        reason: payload.reason
    };
    if (context.vendorUserId) {
        (0, socketServer_1.emitDataUpdatedToUser)(context.vendorUserId, vendorPayload);
    }
    (0, socketServer_1.emitDataUpdatedToRole)(getVendorRealtimeRole(context.vendorRole), vendorPayload);
    if (payload.customerUserId) {
        (0, socketServer_1.emitDataUpdatedToUser)(payload.customerUserId, {
            domains: payload.customerDomains || payload.domains,
            refs,
            reason: payload.reason
        });
    }
};
exports.ReturnService = {
    async initiateReturn(customerId, orderItemId, returnReason) {
        const orderItem = await db_1.default.orderItem.findFirst({
            where: { id: BigInt(orderItemId), order: { customerId: BigInt(customerId) }, status: 'DELIVERED' },
            include: { order: true }
        });
        if (!orderItem)
            throw new errors_1.ValidationError('Order not eligible for return');
        const updatedOrderItem = await db_1.default.orderItem.update({
            where: { id: BigInt(orderItemId) },
            data: { status: client_1.OrderItemStatus.RETURN_SCHEDULED }
        });
        await NotificationService_1.NotificationService.notifyVendorReturnInitiated(orderItem.vendorId.toString(), orderItemId);
        return {
            id: updatedOrderItem.id.toString(),
            orderItemId: updatedOrderItem.id.toString(),
            status: updatedOrderItem.status,
            returnReason
        };
    },
    async submitVendorInspection(vendorId, returnId, inspectionData) {
        const { vendorAccepted = true, damageCharge = 0, vendorNotes, returnedAt, lateFeePerDay } = inspectionData;
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const vendorOperationalSettings = await VendorProfileService_1.VendorProfileService.getOperationalSettingsByVendorProfileId(vendorProfileId);
        const inspectionEligibleStatuses = [
            client_1.OrderItemStatus.RETURN_SCHEDULED,
            client_1.OrderItemStatus.LATE_RETURN,
            client_1.OrderItemStatus.RETURNED,
            client_1.OrderItemStatus.RETURN_REQUESTED,
            client_1.OrderItemStatus.RETURN_RECEIVED
        ];
        const orderItem = await withLateReturnFallback((safeStatuses) => db_1.default.orderItem.findFirst({
            where: {
                id: BigInt(returnId),
                vendorId: vendorProfileId,
                status: { in: safeStatuses }
            }
        }), inspectionEligibleStatuses);
        if (!orderItem)
            throw new errors_1.ValidationError('Return not found');
        const returnedAtDate = parseReturnedAt(returnedAt);
        const lateDays = resolveLateDays(orderItem.returnDueDate, returnedAtDate);
        const resolvedLateFeePerDay = resolveLateFeePerDay(lateFeePerDay, vendorOperationalSettings.lateFeePerDay);
        const lateFee = lateDays * resolvedLateFeePerDay;
        const nextStatus = lateDays > 0 ? client_1.OrderItemStatus.LATE_RETURN : client_1.OrderItemStatus.RETURNED;
        let updated;
        try {
            updated = await db_1.default.orderItem.update({
                where: { id: orderItem.id },
                data: {
                    status: nextStatus,
                    returnedAt: returnedAtDate
                }
            });
        }
        catch (error) {
            if (!(lateDays > 0 && isInvalidOrderItemStatusError(error))) {
                throw error;
            }
            updated = await db_1.default.orderItem.update({
                where: { id: orderItem.id },
                data: {
                    status: client_1.OrderItemStatus.RETURNED,
                    returnedAt: returnedAtDate
                }
            });
        }
        await NotificationService_1.NotificationService.notifyAdminReturnReview(returnId);
        return {
            id: updated.id.toString(),
            orderItemId: updated.id.toString(),
            status: updated.status,
            vendorAccepted,
            lateFee,
            lateDays,
            lateFeePerDay: resolvedLateFeePerDay,
            isLateReturn: lateDays > 0,
            damageCharge,
            vendorNotes
        };
    },
    async processAdminRefundDecision(adminId, returnId, refundDecision) {
        const { approved = true, finalLateFee = 0, finalDamageCharge = 0, adminNotes, manualTransfer } = refundDecision;
        const adminReviewStatuses = [
            client_1.OrderItemStatus.RETURN_SCHEDULED,
            client_1.OrderItemStatus.LATE_RETURN,
            client_1.OrderItemStatus.RETURNED,
            client_1.OrderItemStatus.DAMAGE_REVIEW,
            client_1.OrderItemStatus.RETURN_REQUESTED,
            client_1.OrderItemStatus.RETURN_RECEIVED
        ];
        const orderItem = await withLateReturnFallback((safeStatuses) => db_1.default.orderItem.findFirst({
            where: {
                id: BigInt(returnId),
                status: { in: safeStatuses }
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
                }
            }
        }), adminReviewStatuses);
        if (!orderItem)
            throw new errors_1.ValidationError('Return not pending admin review');
        const deposit = Number(orderItem.deposit);
        const vendorOperationalSettings = await VendorProfileService_1.VendorProfileService.getOperationalSettingsByVendorProfileId(orderItem.vendorId);
        const autoLateDays = resolveLateDays(orderItem.returnDueDate, orderItem.returnedAt || new Date());
        const autoLateFee = autoLateDays * resolveLateFeePerDay(undefined, vendorOperationalSettings.lateFeePerDay);
        const effectiveLateFee = finalLateFee !== undefined && finalLateFee !== null
            ? Math.max(0, Number(finalLateFee))
            : autoLateFee;
        const effectiveDamageCharge = Math.max(0, Number(finalDamageCharge || 0));
        const totalDeductions = Math.max(0, effectiveLateFee + effectiveDamageCharge);
        const finalRefund = approved ? Math.max(0, deposit - totalDeductions) : 0;
        const heldAmount = Math.min(deposit, Math.max(0, totalDeductions));
        const outstandingAmount = Math.max(0, totalDeductions - deposit);
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
        const nextStatus = finalRefund > 0
            ? client_1.OrderItemStatus.SECURITY_DEPOSIT_REFUNDED
            : client_1.OrderItemStatus.DAMAGE_REVIEW;
        const result = await db_1.default.$transaction(async (tx) => {
            const updatedItem = await tx.orderItem.update({
                where: { id: orderItem.id },
                data: {
                    status: nextStatus,
                    returnedAt: orderItem.returnedAt ?? new Date(),
                    securityDepositRefunded: finalRefund,
                    securityDepositHeld: heldAmount,
                    refundTransferMode: finalRefund > 0 ? transferMode : null,
                    refundTransferReference: finalRefund > 0 ? (transferReference || null) : null,
                    refundTransferredAt: finalRefund > 0 ? transferredAt : null,
                    refundTransferNotes: finalRefund > 0 ? transferNotes : null,
                    refundProcessedByAdminId: finalRefund > 0 ? BigInt(adminId) : null
                }
            });
            if (outstandingAmount > 0) {
                await createVendorDueIfNeeded(tx, {
                    orderItemId: orderItem.id,
                    customerId: orderItem.order.customerId,
                    vendorId: orderItem.vendorId,
                    amount: outstandingAmount,
                    reason: 'RETURN_DEDUCTIONS_EXCEEDED_DEPOSIT',
                    notes: `Late fee + damage (${totalDeductions.toFixed(2)}) exceeded deposit (${deposit.toFixed(2)}).`,
                    resolvedByAdminId: adminId
                });
            }
            if (finalRefund < deposit) {
                await ensureVendorEarningCredit(tx, orderItem);
            }
            return updatedItem;
        });
        if (finalRefund > 0) {
            await PaymentService_1.PaymentService.processRefund(orderItem.order.customerId.toString(), finalRefund, orderItem.orderId.toString(), {
                orderItemId: orderItem.id.toString(),
                adminId,
                reason: 'RETURN_REFUND_APPROVED',
                idempotencyKey: transferReference || `return-refund-${returnId}-${finalRefund.toFixed(2)}`
            });
        }
        await NotificationService_1.NotificationService.notifyCustomerRefundDecision(orderItem.order.customerId.toString(), orderItem.id.toString(), finalRefund);
        await NotificationService_1.NotificationService.notifyVendorReturnCompleted(orderItem.vendorId.toString(), orderItem.id.toString());
        await emitReturnRealtimeUpdate({
            vendorProfileId: orderItem.vendorId,
            orderItemId: orderItem.id.toString(),
            orderNo: String(orderItem.order.orderNo || ''),
            customerUserId: orderItem.order.customerId.toString(),
            reason: 'RETURN_REFUND_DECISION',
            domains: ['orders', 'operations', 'refunds', 'dashboard'],
            customerDomains: ['orders', 'refunds', 'dashboard']
        });
        return {
            id: result.id.toString(),
            orderItemId: result.id.toString(),
            status: result.status,
            finalRefund,
            lateFeeApplied: effectiveLateFee,
            lateDays: autoLateDays,
            damageChargeApplied: effectiveDamageCharge,
            outstandingAmount,
            approved,
            adminNotes,
            manualTransfer: finalRefund > 0
                ? {
                    transferMode,
                    transferReference,
                    transferredAt,
                    notes: transferNotes
                }
                : null
        };
    },
    async raiseDamageClaim(vendorId, payload) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const orderItemId = String(payload.orderItemId || payload.returnId || '').trim();
        const damageType = String(payload.damageType || '').trim();
        const repairCost = Math.max(0, Number(payload.repairCost || 0));
        const photoProof = Array.isArray(payload.photoProof)
            ? payload.photoProof.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
        const vendorNotes = String(payload.vendorNotes || '').trim() || null;
        if (!orderItemId)
            throw new errors_1.ValidationError('orderItemId (or returnId) is required');
        if (!damageType)
            throw new errors_1.ValidationError('damageType is required');
        if (!Number.isFinite(repairCost) || repairCost <= 0) {
            throw new errors_1.ValidationError('repairCost must be greater than 0');
        }
        if (photoProof.length === 0) {
            throw new errors_1.ValidationError('photoProof is required');
        }
        const orderItem = await withLateReturnFallback((safeStatuses) => db_1.default.orderItem.findFirst({
            where: {
                id: BigInt(orderItemId),
                vendorId: vendorProfileId,
                status: { in: safeStatuses }
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
                variant: true
            }
        }), DAMAGE_CLAIMABLE_STATUSES);
        if (!orderItem) {
            throw new errors_1.ValidationError('Order item not found for damage claim');
        }
        const existing = await db_1.default.damageClaim.findUnique({
            where: { orderItemId: orderItem.id }
        });
        if (existing && existing.status !== client_1.DamageClaimStatus.PENDING) {
            throw new errors_1.ValidationError('Damage claim already reviewed for this return');
        }
        const claim = existing
            ? await db_1.default.damageClaim.update({
                where: { id: existing.id },
                data: {
                    damageType,
                    repairCost,
                    photoProof,
                    vendorNotes,
                    status: client_1.DamageClaimStatus.PENDING,
                    approvedAmount: 0,
                    rejectionReason: null,
                    adminNotes: null,
                    reviewedAt: null,
                    adminId: null
                }
            })
            : await db_1.default.damageClaim.create({
                data: {
                    orderItemId: orderItem.id,
                    vendorId: vendorProfileId,
                    damageType,
                    repairCost,
                    photoProof,
                    vendorNotes,
                    status: client_1.DamageClaimStatus.PENDING
                }
            });
        await db_1.default.orderItem.update({
            where: { id: orderItem.id },
            data: { status: client_1.OrderItemStatus.DAMAGE_REVIEW }
        });
        const normalizedClaim = await normalizeDamageClaimRecord(claim);
        await emitReturnRealtimeUpdate({
            vendorProfileId,
            orderItemId: orderItem.id.toString(),
            orderNo: String(orderItem.order?.orderNo || ''),
            claimId: String(claim.id || ''),
            reason: 'DAMAGE_CLAIM_RAISED',
            domains: ['orders', 'operations', 'refunds', 'dashboard']
        });
        return {
            claim: normalizedClaim,
            orderItemId: orderItem.id.toString(),
            status: client_1.OrderItemStatus.DAMAGE_REVIEW,
            message: 'Damage claim raised for admin review'
        };
    },
    async getVendorDamageClaims(vendorId, filters) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 10;
        const skip = (page - 1) * limit;
        const normalizedStatus = String(filters.status || '').trim().toUpperCase();
        const allowedStatuses = new Set(Object.values(client_1.DamageClaimStatus));
        const where = { vendorId: vendorProfileId };
        if (normalizedStatus) {
            if (!allowedStatuses.has(normalizedStatus)) {
                throw new errors_1.ValidationError('Invalid damage claim status');
            }
            where.status = normalizedStatus;
        }
        const claimsRaw = await db_1.default.damageClaim.findMany({
            where,
            include: {
                OrderItem: {
                    include: {
                        product: true,
                        variant: true,
                        repairTask: true,
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
                }
            },
            orderBy: { id: 'desc' },
            skip,
            take: limit
        });
        const claims = Array.isArray(claimsRaw)
            ? await Promise.all(claimsRaw.map((claim) => normalizeDamageClaimRecord(claim)))
            : [];
        const total = await db_1.default.damageClaim.count({ where });
        return {
            claims,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        };
    },
    async getAdminDamageClaims(filters, roleFilter, options) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 10;
        const skip = (page - 1) * limit;
        const normalizedStatus = String(filters.status || '').trim().toUpperCase();
        const allowedStatuses = new Set(Object.values(client_1.DamageClaimStatus));
        const where = {};
        if (normalizedStatus) {
            if (!allowedStatuses.has(normalizedStatus)) {
                throw new errors_1.ValidationError('Invalid damage claim status');
            }
            where.status = normalizedStatus;
        }
        if (roleFilter) {
            where.VendorProfile = (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter);
        }
        if (options?.completedAdminAsVendorOnly) {
            where.OR = [
                {
                    VendorProfile: {
                        user: {
                            role: {
                                not: 'INDIVIDUAL_VENDOR'
                            }
                        }
                    }
                },
                {
                    VendorProfile: {
                        user: {
                            role: 'INDIVIDUAL_VENDOR'
                        }
                    },
                    OrderItem: {
                        repairTask: {
                            is: {
                                status: 'COMPLETED'
                            }
                        }
                    }
                }
            ];
        }
        const claimsRaw = await db_1.default.damageClaim.findMany({
            where,
            include: {
                VendorProfile: { include: { user: true } },
                OrderItem: {
                    include: {
                        product: true,
                        variant: true,
                        repairTask: true,
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
                }
            },
            orderBy: { id: 'desc' },
            skip,
            take: limit
        });
        const claims = Array.isArray(claimsRaw)
            ? await Promise.all(claimsRaw.map((claim) => normalizeDamageClaimRecord(claim)))
            : [];
        const total = await db_1.default.damageClaim.count({ where });
        return {
            claims,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        };
    },
    async reviewDamageClaim(adminId, claimId, payload, roleFilter) {
        const rawAction = String(payload.action || '').trim().toUpperCase();
        const actionAliases = {
            APPROVE_FULL: 'APPROVE_FULL_DEDUCTION',
            APPROVE_PARTIAL: 'APPROVE_PARTIAL_DEDUCTION',
            REJECT: 'REJECT_CLAIM'
        };
        const action = actionAliases[rawAction] || rawAction;
        const claim = await db_1.default.damageClaim.findFirst({
            where: { id: BigInt(claimId) },
            include: {
                OrderItem: {
                    include: {
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
                },
                VendorProfile: { include: { user: true } }
            }
        });
        if (!claim)
            throw new errors_1.ValidationError('Damage claim not found');
        if (roleFilter && !(0, vendorScope_1.matchesVendorRoleScope)(claim?.VendorProfile?.user?.role, roleFilter)) {
            throw new errors_1.ValidationError('Damage claim not found');
        }
        if (claim.status !== client_1.DamageClaimStatus.PENDING) {
            throw new errors_1.ValidationError('Damage claim already reviewed');
        }
        const claimOrderItem = claim.OrderItem || claim.orderItem;
        if (!claimOrderItem) {
            throw new errors_1.ValidationError('Order item not found for this claim');
        }
        const depositAmount = Number(claimOrderItem.deposit || 0);
        const alreadyRefunded = Math.max(0, Number(claimOrderItem.securityDepositRefunded || 0));
        const alreadyHeld = Math.max(0, Number(claimOrderItem.securityDepositHeld || 0));
        const remainingDepositBalance = Math.max(0, depositAmount - alreadyRefunded - alreadyHeld);
        const requestedAmount = Math.max(0, Number(claim.repairCost || 0));
        const maxDeduction = Math.min(remainingDepositBalance, requestedAmount);
        let approvedAmount = 0;
        let approvedTotal = 0;
        let outstandingAmount = 0;
        let nextClaimStatus = client_1.DamageClaimStatus.REJECTED;
        if (action === 'APPROVE_FULL_DEDUCTION') {
            approvedTotal = requestedAmount;
            approvedAmount = maxDeduction;
            outstandingAmount = Math.max(0, approvedTotal - approvedAmount);
            nextClaimStatus = client_1.DamageClaimStatus.APPROVED_FULL;
        }
        else if (action === 'APPROVE_PARTIAL_DEDUCTION') {
            const partial = Math.max(0, Number(payload.approvedAmount || 0));
            if (!Number.isFinite(partial) || partial <= 0) {
                throw new errors_1.ValidationError('approvedAmount is required for partial approval');
            }
            approvedTotal = Math.min(requestedAmount, partial);
            approvedAmount = Math.min(remainingDepositBalance, approvedTotal);
            outstandingAmount = Math.max(0, approvedTotal - approvedAmount);
            nextClaimStatus = client_1.DamageClaimStatus.APPROVED_PARTIAL;
        }
        else if (action === 'REJECT_CLAIM') {
            approvedTotal = 0;
            approvedAmount = 0;
            outstandingAmount = 0;
            nextClaimStatus = client_1.DamageClaimStatus.REJECTED;
        }
        else {
            throw new errors_1.ValidationError('Invalid action');
        }
        const finalRefund = Math.max(0, remainingDepositBalance - approvedAmount);
        const transferReference = String(payload.manualTransfer?.transferReference || '').trim();
        const transferMode = String(payload.manualTransfer?.transferMode || 'RAZORPAY_ORIGINAL_SOURCE')
            .trim()
            .toUpperCase();
        const transferNotes = String(payload.manualTransfer?.notes || '').trim() || null;
        const transferTimestampInput = String(payload.manualTransfer?.transferredAt || '').trim();
        const transferredAt = transferTimestampInput ? new Date(transferTimestampInput) : new Date();
        if (transferTimestampInput && !Number.isFinite(transferredAt.getTime())) {
            throw new errors_1.ValidationError('manualTransfer.transferredAt is invalid');
        }
        const nextSecurityDepositHeld = alreadyHeld + approvedAmount;
        const nextSecurityDepositRefunded = alreadyRefunded + finalRefund;
        const nextOrderStatus = nextSecurityDepositRefunded > 0
            ? client_1.OrderItemStatus.SECURITY_DEPOSIT_REFUNDED
            : client_1.OrderItemStatus.DAMAGE_REVIEW;
        const updated = await db_1.default.$transaction(async (tx) => {
            const updatedClaim = await tx.damageClaim.update({
                where: { id: claim.id },
                data: {
                    adminId: BigInt(adminId),
                    status: nextClaimStatus,
                    approvedAmount: approvedTotal,
                    adminNotes: String(payload.adminNotes || '').trim() || null,
                    rejectionReason: nextClaimStatus === client_1.DamageClaimStatus.REJECTED
                        ? String(payload.rejectionReason || '').trim() || 'Claim rejected by admin'
                        : null,
                    reviewedAt: new Date()
                }
            });
            const updatedOrderItem = await tx.orderItem.update({
                where: { id: claimOrderItem.id },
                data: {
                    status: nextOrderStatus,
                    returnedAt: claimOrderItem.returnedAt ?? new Date(),
                    securityDepositHeld: nextSecurityDepositHeld,
                    securityDepositRefunded: nextSecurityDepositRefunded,
                    refundTransferMode: finalRefund > 0 ? transferMode : claimOrderItem.refundTransferMode ?? null,
                    refundTransferReference: finalRefund > 0
                        ? (transferReference || null)
                        : claimOrderItem.refundTransferReference ?? null,
                    refundTransferredAt: finalRefund > 0 ? transferredAt : claimOrderItem.refundTransferredAt ?? null,
                    refundTransferNotes: finalRefund > 0 ? transferNotes : claimOrderItem.refundTransferNotes ?? null,
                    refundProcessedByAdminId: finalRefund > 0
                        ? BigInt(adminId)
                        : claimOrderItem.refundProcessedByAdminId ?? null
                }
            });
            if (outstandingAmount > 0) {
                await createVendorDueIfNeeded(tx, {
                    orderItemId: claimOrderItem.id,
                    customerId: claimOrderItem.order.customerId,
                    vendorId: claimOrderItem.vendorId,
                    amount: outstandingAmount,
                    reason: 'DAMAGE_CLAIM_EXCEEDED_DEPOSIT',
                    notes: `Approved damage amount (${approvedTotal.toFixed(2)}) exceeded deposit cover (${approvedAmount.toFixed(2)}).`,
                    resolvedByAdminId: adminId
                });
            }
            if (approvedAmount > 0) {
                await ensureVendorEarningCredit(tx, claimOrderItem);
            }
            return { updatedClaim, updatedOrderItem };
        });
        if (finalRefund > 0) {
            await PaymentService_1.PaymentService.processRefund(claimOrderItem.order.customerId.toString(), finalRefund, claimOrderItem.orderId.toString(), {
                orderItemId: claimOrderItem.id.toString(),
                adminId,
                reason: `DAMAGE_CLAIM_${nextClaimStatus}`,
                idempotencyKey: transferReference || `damage-refund-${claimId}-${finalRefund.toFixed(2)}`
            });
        }
        await emitReturnRealtimeUpdate({
            vendorProfileId: claim.vendorId,
            vendorUserId: claim?.VendorProfile?.user?.id
                ? claim.VendorProfile.user.id.toString()
                : '',
            vendorRole: String(claim?.VendorProfile?.user?.role || ''),
            orderItemId: claimOrderItem.id.toString(),
            orderNo: String(claimOrderItem.order?.orderNo || ''),
            claimId: String(claim.id || ''),
            customerUserId: claimOrderItem.order.customerId.toString(),
            reason: 'DAMAGE_CLAIM_REVIEWED',
            domains: ['orders', 'operations', 'refunds', 'dashboard'],
            customerDomains: ['orders', 'refunds', 'dashboard']
        });
        return {
            claim: updated.updatedClaim,
            orderItem: updated.updatedOrderItem,
            deductedAmount: approvedAmount,
            approvedTotal,
            outstandingAmount,
            refundedAmount: finalRefund,
            manualTransfer: finalRefund > 0
                ? {
                    transferMode,
                    transferReference,
                    transferredAt,
                    notes: transferNotes
                }
                : null
        };
    },
    async getVendorReturns(vendorId, filters) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 10;
        const skip = (page - 1) * limit;
        const mappedStatus = mapLegacyStatus(filters.status);
        const requestedStatuses = mappedStatus || RETURN_STATUSES;
        const { returns, total } = await withLateReturnFallback(async (safeStatuses) => {
            const where = {
                vendorId: vendorProfileId,
                status: { in: safeStatuses }
            };
            const [rows, count] = await Promise.all([
                db_1.default.orderItem.findMany({
                    where,
                    skip,
                    take: limit,
                    include: {
                        product: true,
                        variant: true,
                        order: {
                            include: {
                                customer: {
                                    include: {
                                        customerBankDetail: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: { id: 'desc' }
                }),
                db_1.default.orderItem.count({ where })
            ]);
            return { returns: rows, total: count };
        }, requestedStatuses);
        return { returns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    },
    async getAdminReturns(filters) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 10;
        const skip = (page - 1) * limit;
        const mappedStatus = mapLegacyStatus(filters.status);
        const requestedStatuses = mappedStatus || RETURN_STATUSES;
        const { returns, total } = await withLateReturnFallback(async (safeStatuses) => {
            const where = { status: { in: safeStatuses } };
            const [rows, count] = await Promise.all([
                db_1.default.orderItem.findMany({
                    where,
                    skip,
                    take: limit,
                    include: {
                        product: true,
                        variant: true,
                        vendorProfile: { include: { user: true } },
                        order: {
                            include: {
                                customer: {
                                    include: {
                                        customerBankDetail: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: { id: 'desc' }
                }),
                db_1.default.orderItem.count({ where })
            ]);
            return { returns: rows, total: count };
        }, requestedStatuses);
        return { returns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    },
    async getAdminReturnStats() {
        const statuses = [
            client_1.OrderItemStatus.RETURN_SCHEDULED,
            client_1.OrderItemStatus.LATE_RETURN,
            client_1.OrderItemStatus.RETURNED,
            client_1.OrderItemStatus.DAMAGE_REVIEW,
            client_1.OrderItemStatus.SECURITY_DEPOSIT_REFUNDED,
            client_1.OrderItemStatus.RETURN_REQUESTED,
            client_1.OrderItemStatus.RETURN_RECEIVED,
            client_1.OrderItemStatus.INSPECTED_GOOD,
            client_1.OrderItemStatus.INSPECTED_DAMAGED,
            client_1.OrderItemStatus.INSPECTED_LOST,
            client_1.OrderItemStatus.COMPLETED
        ];
        const { groupedCounts, groupedAmounts } = await withLateReturnFallback(async (safeStatuses) => {
            const [countRows, amountRows] = await Promise.all([
                db_1.default.orderItem.groupBy({
                    by: ['status'],
                    where: { status: { in: [...safeStatuses] } },
                    _count: { _all: true }
                }),
                db_1.default.orderItem.groupBy({
                    by: ['status'],
                    where: { status: { in: [...safeStatuses] } },
                    _sum: { deposit: true }
                })
            ]);
            return { groupedCounts: countRows, groupedAmounts: amountRows };
        }, [...statuses]);
        const countByStatus = groupedCounts.reduce((acc, row) => {
            acc[String(row.status)] = Number(row._count?._all || 0);
            return acc;
        }, {});
        const amountByStatus = groupedAmounts.reduce((acc, row) => {
            acc[String(row.status)] = Number(row._sum?.deposit || 0);
            return acc;
        }, {});
        const pending = Number(countByStatus.RETURN_SCHEDULED || 0) +
            Number(countByStatus.RETURN_REQUESTED || 0);
        const processing = Number(countByStatus.LATE_RETURN || 0) +
            Number(countByStatus.RETURNED || 0) +
            Number(countByStatus.RETURN_RECEIVED || 0);
        const approved = Number(countByStatus.SECURITY_DEPOSIT_REFUNDED || 0) +
            Number(countByStatus.INSPECTED_GOOD || 0) +
            Number(countByStatus.INSPECTED_DAMAGED || 0) +
            Number(countByStatus.COMPLETED || 0);
        const rejected = Number(countByStatus.DAMAGE_REVIEW || 0) +
            Number(countByStatus.INSPECTED_LOST || 0);
        const completed = Number(countByStatus.SECURITY_DEPOSIT_REFUNDED || 0) +
            Number(countByStatus.COMPLETED || 0);
        const totalRefunds = pending + processing + approved + rejected + completed;
        const pendingRefundAmount = Number(amountByStatus.RETURN_SCHEDULED || 0) +
            Number(amountByStatus.LATE_RETURN || 0) +
            Number(amountByStatus.RETURNED || 0) +
            Number(amountByStatus.RETURN_REQUESTED || 0) +
            Number(amountByStatus.RETURN_RECEIVED || 0);
        return {
            totalRefunds,
            pending,
            processing,
            approved,
            rejected,
            completed,
            pendingRefundAmount
        };
    },
    async getCustomerReturns(customerId, filters) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 10;
        const skip = (page - 1) * limit;
        const { returns, total } = await withLateReturnFallback(async (safeStatuses) => {
            const where = {
                order: { customerId: BigInt(customerId) },
                status: { in: safeStatuses }
            };
            const [rows, count] = await Promise.all([
                db_1.default.orderItem.findMany({
                    where,
                    skip,
                    take: limit,
                    include: {
                        product: true,
                        variant: true,
                        vendorProfile: { include: { user: true } }
                    },
                    orderBy: { id: 'desc' }
                }),
                db_1.default.orderItem.count({ where })
            ]);
            return { returns: rows, total: count };
        }, RETURN_STATUSES);
        return { returns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    }
};

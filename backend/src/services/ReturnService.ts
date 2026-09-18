import { PaymentService } from './PaymentService';
import { VendorEarningService } from './VendorEarningService';
import { NotificationService } from './NotificationService';
import { S3Service } from './S3Service';
import { VendorProfileService } from './VendorProfileService';
import {
  emitDataUpdatedToRole,
  emitDataUpdatedToUser
} from '../realtime/socketServer';
import { ValidationError } from '../utils/errors';
import prisma from '../config/db';
import { OrderItemStatus, DamageClaimStatus } from '@prisma/client';
import { expandOrderItemStatusFilter } from '../constants/orderStatus';
import { getVendorProfileUserWhere, matchesVendorRoleScope } from '../utils/vendorScope';

type InspectionData = {
  vendorAccepted?: boolean;
  lateFee?: number;
  damageCharge?: number;
  vendorNotes?: string;
  returnedAt?: string;
  lateFeePerDay?: number;
};

type RefundDecision = {
  approved?: boolean;
  finalLateFee?: number;
  finalDamageCharge?: number;
  adminNotes?: string;
  manualTransfer?: {
    transferMode?: string;
    transferReference?: string;
    transferredAt?: string;
    notes?: string;
  };
};

type ReturnFilters = {
  status?: string;
  page?: number;
  limit?: number;
};

type DamageClaimInput = {
  returnId?: string;
  orderItemId?: string;
  damageType: string;
  repairCost: number;
  photoProof: string[];
  vendorNotes?: string;
};

type DamageClaimReviewInput = {
  action: 'APPROVE_FULL_DEDUCTION' | 'APPROVE_PARTIAL_DEDUCTION' | 'REJECT_CLAIM';
  approvedAmount?: number;
  adminNotes?: string;
  rejectionReason?: string;
  manualTransfer?: {
    transferMode?: string;
    transferReference?: string;
    transferredAt?: string;
    notes?: string;
  };
};

type RealtimeDomain =
  | 'orders'
  | 'products'
  | 'trials'
  | 'operations'
  | 'refunds'
  | 'finance'
  | 'support'
  | 'dashboard';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LATE_FEE_PER_DAY = Number(process.env.LATE_FEE_PER_DAY || 100);

const RETURN_STATUSES: OrderItemStatus[] = [
  OrderItemStatus.RETURN_SCHEDULED,
  OrderItemStatus.LATE_RETURN,
  OrderItemStatus.RETURNED,
  OrderItemStatus.DAMAGE_REVIEW,
  OrderItemStatus.SECURITY_DEPOSIT_REFUNDED,
  OrderItemStatus.RETURN_REQUESTED,
  OrderItemStatus.RETURN_RECEIVED,
  OrderItemStatus.INSPECTED_GOOD,
  OrderItemStatus.INSPECTED_DAMAGED,
  OrderItemStatus.INSPECTED_LOST,
  OrderItemStatus.COMPLETED
];

const LEGACY_STATUS_MAP: Record<string, string> = {
  PENDING_PICKUP: 'RETURN_SCHEDULED',
  LATE: 'LATE_RETURN',
  LATE_RETURN: 'LATE_RETURN',
  PENDING_INSPECTION: 'RETURNED',
  PENDING_ADMIN: 'DAMAGE_REVIEW',
  COMPLETED: 'SECURITY_DEPOSIT_REFUNDED'
};

const DAMAGE_CLAIMABLE_STATUSES: OrderItemStatus[] = [
  OrderItemStatus.RETURN_SCHEDULED,
  OrderItemStatus.LATE_RETURN,
  OrderItemStatus.RETURNED,
  OrderItemStatus.DAMAGE_REVIEW,
  OrderItemStatus.SECURITY_DEPOSIT_REFUNDED,
  OrderItemStatus.RETURN_REQUESTED,
  OrderItemStatus.RETURN_RECEIVED,
  OrderItemStatus.COMPLETED
];

const normalizeToUtcDay = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const parseReturnedAt = (value?: string): Date => {
  if (!value || String(value).trim() === '') {
    return new Date();
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new ValidationError('Invalid returnedAt');
  }

  return parsed;
};

const resolveLateDays = (dueDate?: Date | null, returnedAt?: Date | null): number => {
  if (!dueDate || !returnedAt) return 0;

  const due = normalizeToUtcDay(new Date(dueDate));
  const returned = normalizeToUtcDay(new Date(returnedAt));
  const diffDays = Math.floor((returned.getTime() - due.getTime()) / DAY_MS);
  return Math.max(0, diffDays);
};

const resolveLateFeePerDay = (input?: number, vendorDefaultLateFeePerDay?: number): number => {
  const candidate = Number(input);
  if (Number.isFinite(candidate) && candidate > 0) return candidate;
  const vendorDefault = Number(vendorDefaultLateFeePerDay);
  if (Number.isFinite(vendorDefault) && vendorDefault > 0) return vendorDefault;
  return Number.isFinite(DEFAULT_LATE_FEE_PER_DAY) && DEFAULT_LATE_FEE_PER_DAY > 0
    ? DEFAULT_LATE_FEE_PER_DAY
    : 100;
};

const isMissingColumnError = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return code === 'P2022' || message.includes('does not exist in the current database');
};

const isInvalidOrderItemStatusError = (error: unknown, statusValue = 'late_return') => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('invalid input value for enum "orderitemstatus"') &&
    message.includes(statusValue.toLowerCase())
  );
};

const removeLateReturnStatus = (statuses: OrderItemStatus[]) =>
  statuses.filter((status) => String(status) !== 'LATE_RETURN');

const withLateReturnFallback = async <T>(
  run: (statuses: OrderItemStatus[]) => Promise<T>,
  statuses: OrderItemStatus[]
) => {
  try {
    return await run(statuses);
  } catch (error) {
    if (!isInvalidOrderItemStatusError(error) || !statuses.some((status) => String(status) === 'LATE_RETURN')) {
      throw error;
    }

    const fallbackStatuses = removeLateReturnStatus(statuses);
    return run(fallbackStatuses);
  }
};

const resolveVendorProfileId = async (vendorIdentifier: string): Promise<bigint> => {
  let vendorIdBig: bigint;
  try {
    vendorIdBig = BigInt(vendorIdentifier);
  } catch {
    throw new ValidationError('Invalid vendor identifier');
  }

  let vendor: { id: bigint } | null = null;
  try {
    vendor = await prisma.vendorProfile.findFirst({
      where: {
        OR: [
          { id: vendorIdBig },
          { userId: vendorIdBig }
        ]
      },
      select: { id: true }
    });
  } catch (error: any) {
    if (!isMissingColumnError(error)) throw error;

    const rows = await prisma.$queryRawUnsafe<Array<{ id: string | number | bigint }>>(
      `SELECT "id"
       FROM "VendorProfile"
       WHERE "id" = $1 OR "userId" = $1
       LIMIT 1`,
      vendorIdBig.toString()
    );

    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id !== undefined && rows[0]?.id !== null) {
      vendor = { id: BigInt(rows[0].id) };
    }
  }

  if (!vendor) {
    throw new ValidationError('Vendor not found');
  }

  return vendor.id;
};

const ensureVendorEarningCredit = async (tx: any, orderItem: { id: bigint; vendorId: bigint; rentPrice: any }) => {
  const existing = await tx.vendorTransaction.findFirst({
    where: {
      orderItemId: orderItem.id,
      vendorId: orderItem.vendorId,
      type: 'CREDIT'
    },
    select: { id: true }
  });

  if (!existing) {
    await VendorEarningService.createVendorEarning(
      tx,
      orderItem.vendorId.toString(),
      orderItem.id.toString(),
      Number(orderItem.rentPrice)
    );
  }
};

const createVendorDueIfNeeded = async (
  tx: any,
  payload: {
    orderItemId: bigint;
    customerId: bigint;
    vendorId: bigint;
    amount: number;
    reason: string;
    notes?: string | null;
    resolvedByAdminId?: string;
  }
) => {
  const amount = Math.max(0, Number(payload.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0) return null;

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

const mapLegacyStatus = (status?: string): OrderItemStatus[] | undefined => {
  if (!status) return undefined;
  const normalized = String(status).trim().toUpperCase();
  const mapped = LEGACY_STATUS_MAP[normalized] || normalized;
  const expanded = expandOrderItemStatusFilter(mapped);
  if (!expanded) return undefined;

  const returnStatuses = expanded.filter((item) => RETURN_STATUSES.includes(item));
  return returnStatuses.length > 0 ? returnStatuses : undefined;
};

const normalizeDamageClaimRecord = async (claim: any) => {
  const orderItem = claim?.orderItem ?? claim?.OrderItem ?? null;
  const vendor = claim?.vendor ?? claim?.VendorProfile ?? null;
  const vendorRole = String(vendor?.user?.role || '').trim().toUpperCase();
  const claimSource = vendorRole === 'INDIVIDUAL_VENDOR' ? 'ADMIN_AS_VENDOR' : 'VENDOR';
  const refundedAmountRaw = claim?.refundedAmount ?? orderItem?.securityDepositRefunded ?? 0;
  const refundedAmount = Number(refundedAmountRaw);
  const actualCostRaw = claim?.actualCost ?? orderItem?.repairTask?.actualCost ?? null;
  const actualCost =
    actualCostRaw != null && Number.isFinite(Number(actualCostRaw))
      ? Number(actualCostRaw)
      : null;
  const photoProofRaw = Array.isArray(claim?.photoProof)
    ? claim.photoProof.map((item: any) => String(item || '').trim()).filter(Boolean)
    : [];
  const accessiblePhotoProof = photoProofRaw.length > 0
    ? await S3Service.getAccessibleImageUrls(photoProofRaw)
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

const getVendorRealtimeRole = (value?: string | null) =>
  String(value || '').trim().toUpperCase() === 'INDIVIDUAL_VENDOR'
    ? 'ADMIN_AS_VENDOR'
    : 'ADMIN';

const buildReturnRealtimeRefs = (payload: {
  orderItemId?: string;
  orderNo?: string;
  claimId?: string;
  vendorId?: string;
  customerId?: string;
}) =>
  Object.fromEntries(
    Object.entries({
      orderItemId: String(payload.orderItemId || '').trim(),
      orderNo: String(payload.orderNo || '').trim(),
      claimId: String(payload.claimId || '').trim(),
      vendorId: String(payload.vendorId || '').trim(),
      customerId: String(payload.customerId || '').trim()
    }).filter(([, value]) => value)
  );

const resolveVendorRealtimeContext = async (vendorProfileId: bigint) => {
  const vendor = await prisma.vendorProfile.findUnique({
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

const emitReturnRealtimeUpdate = async (payload: {
  vendorProfileId: bigint;
  orderItemId: string;
  orderNo?: string;
  claimId?: string;
  customerUserId?: string;
  reason: string;
  domains: RealtimeDomain[];
  customerDomains?: RealtimeDomain[];
  vendorUserId?: string;
  vendorRole?: string;
}) => {
  const context =
    payload.vendorUserId || payload.vendorRole
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
    emitDataUpdatedToUser(context.vendorUserId, vendorPayload);
  }

  emitDataUpdatedToRole(getVendorRealtimeRole(context.vendorRole), vendorPayload);

  if (payload.customerUserId) {
    emitDataUpdatedToUser(payload.customerUserId, {
      domains: payload.customerDomains || payload.domains,
      refs,
      reason: payload.reason
    });
  }
};

export const ReturnService = {
  async initiateReturn(customerId: string, orderItemId: string, returnReason: string) {
    const orderItem = await prisma.orderItem.findFirst({
      where: { id: BigInt(orderItemId), order: { customerId: BigInt(customerId) }, status: 'DELIVERED' },
      include: { order: true }
    });

    if (!orderItem) throw new ValidationError('Order not eligible for return');

    const updatedOrderItem = await prisma.orderItem.update({
      where: { id: BigInt(orderItemId) },
      data: { status: OrderItemStatus.RETURN_SCHEDULED }
    });

    await NotificationService.notifyVendorReturnInitiated(orderItem.vendorId.toString(), orderItemId);

    return {
      id: updatedOrderItem.id.toString(),
      orderItemId: updatedOrderItem.id.toString(),
      status: updatedOrderItem.status,
      returnReason
    };
  },

  async submitVendorInspection(vendorId: string, returnId: string, inspectionData: InspectionData) {
    const { vendorAccepted = true, damageCharge = 0, vendorNotes, returnedAt, lateFeePerDay } = inspectionData;
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const vendorOperationalSettings =
      await VendorProfileService.getOperationalSettingsByVendorProfileId(vendorProfileId);

    const inspectionEligibleStatuses: OrderItemStatus[] = [
      OrderItemStatus.RETURN_SCHEDULED,
      OrderItemStatus.LATE_RETURN,
      OrderItemStatus.RETURNED,
      OrderItemStatus.RETURN_REQUESTED,
      OrderItemStatus.RETURN_RECEIVED
    ];

    const orderItem = await withLateReturnFallback(
      (safeStatuses) =>
        prisma.orderItem.findFirst({
          where: {
            id: BigInt(returnId),
            vendorId: vendorProfileId,
            status: { in: safeStatuses }
          }
        }),
      inspectionEligibleStatuses
    );

    if (!orderItem) throw new ValidationError('Return not found');

    const returnedAtDate = parseReturnedAt(returnedAt);
    const lateDays = resolveLateDays(orderItem.returnDueDate, returnedAtDate);
    const resolvedLateFeePerDay = resolveLateFeePerDay(
      lateFeePerDay,
      vendorOperationalSettings.lateFeePerDay
    );
    const lateFee = lateDays * resolvedLateFeePerDay;

    const nextStatus = lateDays > 0 ? OrderItemStatus.LATE_RETURN : OrderItemStatus.RETURNED;

    let updated;
    try {
      updated = await prisma.orderItem.update({
        where: { id: orderItem.id },
        data: {
          status: nextStatus,
          returnedAt: returnedAtDate
        }
      });
    } catch (error) {
      if (!(lateDays > 0 && isInvalidOrderItemStatusError(error))) {
        throw error;
      }

      updated = await prisma.orderItem.update({
        where: { id: orderItem.id },
        data: {
          status: OrderItemStatus.RETURNED,
          returnedAt: returnedAtDate
        }
      });
    }

    await NotificationService.notifyAdminReturnReview(returnId);

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

  async processAdminRefundDecision(adminId: string, returnId: string, refundDecision: RefundDecision) {
    const {
      approved = true,
      finalLateFee = 0,
      finalDamageCharge = 0,
      adminNotes,
      manualTransfer
    } = refundDecision;

    const adminReviewStatuses: OrderItemStatus[] = [
      OrderItemStatus.RETURN_SCHEDULED,
      OrderItemStatus.LATE_RETURN,
      OrderItemStatus.RETURNED,
      OrderItemStatus.DAMAGE_REVIEW,
      OrderItemStatus.RETURN_REQUESTED,
      OrderItemStatus.RETURN_RECEIVED
    ];

    const orderItem = await withLateReturnFallback(
      (safeStatuses) =>
        prisma.orderItem.findFirst({
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
        }),
      adminReviewStatuses
    );

    if (!orderItem) throw new ValidationError('Return not pending admin review');

    const deposit = Number(orderItem.deposit);
    const vendorOperationalSettings =
      await VendorProfileService.getOperationalSettingsByVendorProfileId(orderItem.vendorId);
    const autoLateDays = resolveLateDays(
      orderItem.returnDueDate,
      orderItem.returnedAt || new Date()
    );
    const autoLateFee =
      autoLateDays * resolveLateFeePerDay(undefined, vendorOperationalSettings.lateFeePerDay);
    const effectiveLateFee =
      finalLateFee !== undefined && finalLateFee !== null
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
      throw new ValidationError('manualTransfer.transferredAt is invalid');
    }

    const nextStatus =
      finalRefund > 0
        ? OrderItemStatus.SECURITY_DEPOSIT_REFUNDED
        : OrderItemStatus.DAMAGE_REVIEW;

    const result = await prisma.$transaction(async (tx) => {
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
      await PaymentService.processRefund(
        orderItem.order.customerId.toString(),
        finalRefund,
        orderItem.orderId.toString(),
        {
          orderItemId: orderItem.id.toString(),
          adminId,
          reason: 'RETURN_REFUND_APPROVED',
          idempotencyKey:
            transferReference || `return-refund-${returnId}-${finalRefund.toFixed(2)}`
        }
      );
    }
    await NotificationService.notifyCustomerRefundDecision(
      orderItem.order.customerId.toString(),
      orderItem.id.toString(),
      finalRefund
    );
    await NotificationService.notifyVendorReturnCompleted(
      orderItem.vendorId.toString(),
      orderItem.id.toString()
    );
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
      manualTransfer:
        finalRefund > 0
          ? {
              transferMode,
              transferReference,
              transferredAt,
              notes: transferNotes
            }
          : null
    };
  },

  async raiseDamageClaim(vendorId: string, payload: DamageClaimInput) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const orderItemId = String(payload.orderItemId || payload.returnId || '').trim();
    const damageType = String(payload.damageType || '').trim();
    const repairCost = Math.max(0, Number(payload.repairCost || 0));
    const photoProof = Array.isArray(payload.photoProof)
      ? payload.photoProof.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const vendorNotes = String(payload.vendorNotes || '').trim() || null;

    if (!orderItemId) throw new ValidationError('orderItemId (or returnId) is required');
    if (!damageType) throw new ValidationError('damageType is required');
    if (!Number.isFinite(repairCost) || repairCost <= 0) {
      throw new ValidationError('repairCost must be greater than 0');
    }
    if (photoProof.length === 0) {
      throw new ValidationError('photoProof is required');
    }

    const orderItem = await withLateReturnFallback(
      (safeStatuses) =>
        prisma.orderItem.findFirst({
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
        }),
      DAMAGE_CLAIMABLE_STATUSES
    );

    if (!orderItem) {
      throw new ValidationError('Order item not found for damage claim');
    }

    const existing = await (prisma as any).damageClaim.findUnique({
      where: { orderItemId: orderItem.id }
    });

    if (existing && existing.status !== DamageClaimStatus.PENDING) {
      throw new ValidationError('Damage claim already reviewed for this return');
    }

    const claim = existing
      ? await (prisma as any).damageClaim.update({
          where: { id: existing.id },
          data: {
            damageType,
            repairCost,
            photoProof,
            vendorNotes,
            status: DamageClaimStatus.PENDING,
            approvedAmount: 0,
            rejectionReason: null,
            adminNotes: null,
            reviewedAt: null,
            adminId: null
          }
        })
      : await (prisma as any).damageClaim.create({
          data: {
            orderItemId: orderItem.id,
            vendorId: vendorProfileId,
            damageType,
            repairCost,
            photoProof,
            vendorNotes,
            status: DamageClaimStatus.PENDING
          }
        });

    await prisma.orderItem.update({
      where: { id: orderItem.id },
      data: { status: OrderItemStatus.DAMAGE_REVIEW }
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
      status: OrderItemStatus.DAMAGE_REVIEW,
      message: 'Damage claim raised for admin review'
    };
  },

  async getVendorDamageClaims(vendorId: string, filters: { status?: string; page?: number; limit?: number }) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const normalizedStatus = String(filters.status || '').trim().toUpperCase();
    const allowedStatuses = new Set(Object.values(DamageClaimStatus));

    const where: any = { vendorId: vendorProfileId };
    if (normalizedStatus) {
      if (!allowedStatuses.has(normalizedStatus as DamageClaimStatus)) {
        throw new ValidationError('Invalid damage claim status');
      }
      where.status = normalizedStatus;
    }

    const claimsRaw = await (prisma as any).damageClaim.findMany({
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
      ? await Promise.all(claimsRaw.map((claim: any) => normalizeDamageClaimRecord(claim)))
      : [];

    const total = await (prisma as any).damageClaim.count({ where });
    return {
      claims,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  },

  async getAdminDamageClaims(
    filters: { status?: string; page?: number; limit?: number },
    roleFilter?: Record<string, any>,
    options?: { completedAdminAsVendorOnly?: boolean }
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const normalizedStatus = String(filters.status || '').trim().toUpperCase();
    const allowedStatuses = new Set(Object.values(DamageClaimStatus));

    const where: any = {};
    if (normalizedStatus) {
      if (!allowedStatuses.has(normalizedStatus as DamageClaimStatus)) {
        throw new ValidationError('Invalid damage claim status');
      }
      where.status = normalizedStatus;
    }

    if (roleFilter) {
      where.VendorProfile = getVendorProfileUserWhere(roleFilter);
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

    const claimsRaw = await (prisma as any).damageClaim.findMany({
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
      ? await Promise.all(claimsRaw.map((claim: any) => normalizeDamageClaimRecord(claim)))
      : [];

    const total = await (prisma as any).damageClaim.count({ where });
    return {
      claims,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  },

  async reviewDamageClaim(
    adminId: string,
    claimId: string,
    payload: DamageClaimReviewInput,
    roleFilter?: Record<string, any>
  ) {
    const rawAction = String(payload.action || '').trim().toUpperCase();
    const actionAliases: Record<string, DamageClaimReviewInput['action']> = {
      APPROVE_FULL: 'APPROVE_FULL_DEDUCTION',
      APPROVE_PARTIAL: 'APPROVE_PARTIAL_DEDUCTION',
      REJECT: 'REJECT_CLAIM'
    };
    const action = actionAliases[rawAction] || rawAction;
    const claim = await (prisma as any).damageClaim.findFirst({
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

    if (!claim) throw new ValidationError('Damage claim not found');
    if (roleFilter && !matchesVendorRoleScope(claim?.VendorProfile?.user?.role, roleFilter)) {
      throw new ValidationError('Damage claim not found');
    }
    if (claim.status !== DamageClaimStatus.PENDING) {
      throw new ValidationError('Damage claim already reviewed');
    }

    const claimOrderItem = claim.OrderItem || claim.orderItem;
    if (!claimOrderItem) {
      throw new ValidationError('Order item not found for this claim');
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
    let nextClaimStatus: DamageClaimStatus = DamageClaimStatus.REJECTED;

    if (action === 'APPROVE_FULL_DEDUCTION') {
      approvedTotal = requestedAmount;
      approvedAmount = maxDeduction;
      outstandingAmount = Math.max(0, approvedTotal - approvedAmount);
      nextClaimStatus = DamageClaimStatus.APPROVED_FULL;
    } else if (action === 'APPROVE_PARTIAL_DEDUCTION') {
      const partial = Math.max(0, Number(payload.approvedAmount || 0));
      if (!Number.isFinite(partial) || partial <= 0) {
        throw new ValidationError('approvedAmount is required for partial approval');
      }
      approvedTotal = Math.min(requestedAmount, partial);
      approvedAmount = Math.min(remainingDepositBalance, approvedTotal);
      outstandingAmount = Math.max(0, approvedTotal - approvedAmount);
      nextClaimStatus = DamageClaimStatus.APPROVED_PARTIAL;
    } else if (action === 'REJECT_CLAIM') {
      approvedTotal = 0;
      approvedAmount = 0;
      outstandingAmount = 0;
      nextClaimStatus = DamageClaimStatus.REJECTED;
    } else {
      throw new ValidationError('Invalid action');
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
      throw new ValidationError('manualTransfer.transferredAt is invalid');
    }

    const nextSecurityDepositHeld = alreadyHeld + approvedAmount;
    const nextSecurityDepositRefunded = alreadyRefunded + finalRefund;
    const nextOrderStatus =
      nextSecurityDepositRefunded > 0
        ? OrderItemStatus.SECURITY_DEPOSIT_REFUNDED
        : OrderItemStatus.DAMAGE_REVIEW;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedClaim = await (tx as any).damageClaim.update({
        where: { id: claim.id },
        data: {
          adminId: BigInt(adminId),
          status: nextClaimStatus,
          approvedAmount: approvedTotal,
          adminNotes: String(payload.adminNotes || '').trim() || null,
          rejectionReason:
            nextClaimStatus === DamageClaimStatus.REJECTED
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
          refundTransferMode:
            finalRefund > 0 ? transferMode : claimOrderItem.refundTransferMode ?? null,
          refundTransferReference:
            finalRefund > 0
              ? (transferReference || null)
              : claimOrderItem.refundTransferReference ?? null,
          refundTransferredAt:
            finalRefund > 0 ? transferredAt : claimOrderItem.refundTransferredAt ?? null,
          refundTransferNotes:
            finalRefund > 0 ? transferNotes : claimOrderItem.refundTransferNotes ?? null,
          refundProcessedByAdminId:
            finalRefund > 0
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
      await PaymentService.processRefund(
        claimOrderItem.order.customerId.toString(),
        finalRefund,
        claimOrderItem.orderId.toString(),
        {
          orderItemId: claimOrderItem.id.toString(),
          adminId,
          reason: `DAMAGE_CLAIM_${nextClaimStatus}`,
          idempotencyKey:
            transferReference || `damage-refund-${claimId}-${finalRefund.toFixed(2)}`
        }
      );
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
      manualTransfer:
        finalRefund > 0
          ? {
              transferMode,
              transferReference,
              transferredAt,
              notes: transferNotes
            }
          : null
    };
  },

  async getVendorReturns(vendorId: string, filters: ReturnFilters) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const mappedStatus = mapLegacyStatus(filters.status);

    const requestedStatuses = mappedStatus || RETURN_STATUSES;

    const { returns, total } = await withLateReturnFallback(
      async (safeStatuses) => {
        const where: { vendorId: bigint; status: { in: OrderItemStatus[] } } = {
          vendorId: vendorProfileId,
          status: { in: safeStatuses }
        };

        const [rows, count] = await Promise.all([
          prisma.orderItem.findMany({
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
          prisma.orderItem.count({ where })
        ]);

        return { returns: rows, total: count };
      },
      requestedStatuses
    );

    return { returns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },

  async getAdminReturns(filters: ReturnFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const mappedStatus = mapLegacyStatus(filters.status);

    const requestedStatuses = mappedStatus || RETURN_STATUSES;

    const { returns, total } = await withLateReturnFallback(
      async (safeStatuses) => {
        const where = { status: { in: safeStatuses } };
        const [rows, count] = await Promise.all([
          prisma.orderItem.findMany({
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
          prisma.orderItem.count({ where })
        ]);

        return { returns: rows, total: count };
      },
      requestedStatuses
    );

    return { returns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },

  async getAdminReturnStats() {
    const statuses = [
      OrderItemStatus.RETURN_SCHEDULED,
      OrderItemStatus.LATE_RETURN,
      OrderItemStatus.RETURNED,
      OrderItemStatus.DAMAGE_REVIEW,
      OrderItemStatus.SECURITY_DEPOSIT_REFUNDED,
      OrderItemStatus.RETURN_REQUESTED,
      OrderItemStatus.RETURN_RECEIVED,
      OrderItemStatus.INSPECTED_GOOD,
      OrderItemStatus.INSPECTED_DAMAGED,
      OrderItemStatus.INSPECTED_LOST,
      OrderItemStatus.COMPLETED
    ] as const;

    const { groupedCounts, groupedAmounts } = await withLateReturnFallback(
      async (safeStatuses) => {
        const [countRows, amountRows] = await Promise.all([
          prisma.orderItem.groupBy({
            by: ['status'],
            where: { status: { in: [...safeStatuses] } },
            _count: { _all: true }
          }),
          prisma.orderItem.groupBy({
            by: ['status'],
            where: { status: { in: [...safeStatuses] } },
            _sum: { deposit: true }
          })
        ]);

        return { groupedCounts: countRows, groupedAmounts: amountRows };
      },
      [...statuses]
    );

    const countByStatus = groupedCounts.reduce<Record<string, number>>(
      (acc, row) => {
        acc[String(row.status)] = Number(row._count?._all || 0);
        return acc;
      },
      {}
    );

    const amountByStatus = groupedAmounts.reduce<Record<string, number>>(
      (acc, row) => {
        acc[String(row.status)] = Number(row._sum?.deposit || 0);
        return acc;
      },
      {}
    );

    const pending =
      Number(countByStatus.RETURN_SCHEDULED || 0) +
      Number(countByStatus.RETURN_REQUESTED || 0);
    const processing =
      Number(countByStatus.LATE_RETURN || 0) +
      Number(countByStatus.RETURNED || 0) +
      Number(countByStatus.RETURN_RECEIVED || 0);
    const approved =
      Number(countByStatus.SECURITY_DEPOSIT_REFUNDED || 0) +
      Number(countByStatus.INSPECTED_GOOD || 0) +
      Number(countByStatus.INSPECTED_DAMAGED || 0) +
      Number(countByStatus.COMPLETED || 0);
    const rejected =
      Number(countByStatus.DAMAGE_REVIEW || 0) +
      Number(countByStatus.INSPECTED_LOST || 0);
    const completed = Number(countByStatus.SECURITY_DEPOSIT_REFUNDED || 0) +
      Number(countByStatus.COMPLETED || 0);

    const totalRefunds =
      pending + processing + approved + rejected + completed;

    const pendingRefundAmount =
      Number(amountByStatus.RETURN_SCHEDULED || 0) +
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

  async getCustomerReturns(customerId: string, filters: ReturnFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const { returns, total } = await withLateReturnFallback(
      async (safeStatuses) => {
        const where = {
          order: { customerId: BigInt(customerId) },
          status: { in: safeStatuses }
        };

        const [rows, count] = await Promise.all([
          prisma.orderItem.findMany({
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
          prisma.orderItem.count({ where })
        ]);

        return { returns: rows, total: count };
      },
      RETURN_STATUSES
    );

    return { returns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

};

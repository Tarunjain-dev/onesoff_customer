import prisma from '../config/db';
import { PaymentService } from './PaymentService';
import { NotificationService } from './NotificationService';
import { OrderItemStatus } from '@prisma/client';
import { ValidationError } from '../utils/errors';
import { getVendorProfileUserWhere, matchesVendorRoleScope } from '../utils/vendorScope';
import { ADMIN_PORTAL_ROLES } from '../utils/roles';
import {
  emitDataUpdatedToRole,
  emitDataUpdatedToUser
} from '../realtime/socketServer';

const RETURN_REFUND_ACTIONABLE_STATUSES: OrderItemStatus[] = [
  OrderItemStatus.RETURN_SCHEDULED,
  OrderItemStatus.RETURNED,
  OrderItemStatus.DAMAGE_REVIEW,
  OrderItemStatus.RETURN_REQUESTED,
  OrderItemStatus.RETURN_RECEIVED
];

const CANCELLATION_REFUND_ACTIONABLE_STATUSES: OrderItemStatus[] = [
  OrderItemStatus.CANCELLED,
  OrderItemStatus.REJECTED
];

const emitRefundOrderRealtimeUpdate = (orderItem: any, reason: string) => {
  const refs = Object.fromEntries(
    Object.entries({
      orderId: String(orderItem?.orderId || orderItem?.order?.id || '').trim(),
      orderNo: String(orderItem?.order?.orderNo || '').trim(),
      orderItemId: String(orderItem?.id || '').trim(),
      vendorId: String(orderItem?.vendorId || '').trim(),
      customerId: String(orderItem?.order?.customerId || '').trim()
    }).filter(([, value]) => value)
  );
  const domains: Array<'orders' | 'operations' | 'refunds' | 'dashboard'> = [
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
    emitDataUpdatedToUser(customerUserId, {
      ...payload,
      domains: ['orders', 'refunds', 'dashboard'] as Array<
        'orders' | 'refunds' | 'dashboard'
      >
    });
  }
  if (vendorUserId) {
    emitDataUpdatedToUser(vendorUserId, payload);
  }

  emitDataUpdatedToRole('ADMIN', payload);
  emitDataUpdatedToRole('ADMIN_AS_VENDOR', payload);
};

export const AdminRefundService = {
  async getRefundRequests(roleFilter?: Record<string, any>) {
    const vendorProfileWhere = getVendorProfileUserWhere(roleFilter);
    return prisma.orderItem.findMany({
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

  async processRefund(
    returnId: string,
    decision: 'FULL' | 'PARTIAL' | 'FORFEIT',
    refundAmount?: number,
    manualTransfer?: {
      transferMode?: string;
      transferReference?: string;
      transferredAt?: string;
      notes?: string;
    },
    adminId?: string,
    roleFilter?: Record<string, any>
  ) {
    const orderItem = await prisma.orderItem.findUnique({
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

    if (!orderItem) throw new Error('Return not found');
    if (roleFilter && !matchesVendorRoleScope(orderItem.vendorProfile?.user?.role, roleFilter)) {
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
    if (decision === 'FULL') finalRefundAmount = refundableBaseAmount;
    else if (decision === 'PARTIAL') finalRefundAmount = Math.max(0, Math.min(refundAmount || 0, refundableBaseAmount));
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
      throw new ValidationError('manualTransfer.transferredAt is invalid');
    }

    const nextStatus = isCancellationRefund
      ? orderItem.status
      : finalRefundAmount > 0
        ? OrderItemStatus.SECURITY_DEPOSIT_REFUNDED
        : OrderItemStatus.DAMAGE_REVIEW;

    await prisma.orderItem.update({
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

    let refundResult: Awaited<ReturnType<typeof PaymentService.processRefund>> | null = null;
    if (finalRefundAmount > 0) {
      const idempotencyKey =
        transferReference || `admin-refund-${returnId}-${finalRefundAmount.toFixed(2)}`;
      refundResult = await PaymentService.processRefund(
        orderItem.order.customerId.toString(),
        finalRefundAmount,
        orderItem.orderId.toString(),
        {
          orderItemId: orderItem.id.toString(),
          adminId,
          reason: `ADMIN_${decision}_REFUND`,
          idempotencyKey
        }
      );
    }

    const updatedOrderItem = await prisma.orderItem.findUnique({
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

    await NotificationService.notifyCustomerRefundDecision(
      orderItem.order.customerId.toString(),
      orderItem.id.toString(),
      finalRefundAmount
    ).catch(() => null);
    emitRefundOrderRealtimeUpdate(updatedOrderItem || orderItem, 'ADMIN_REFUND_PROCESSED');

    return {
      orderItem: updatedOrderItem,
      refundAmount: finalRefundAmount,
      paymentRefund: refundResult,
      manualTransfer:
        finalRefundAmount > 0
          ? {
              transferMode,
              transferReference,
              transferredAt,
              notes: transferNotes
            }
          : null
    };
  },

  async remindAdmin(
    returnId: string,
    requesterId?: string,
    roleFilter?: Record<string, any>
  ) {
    const orderItem = await prisma.orderItem.findUnique({
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

    if (roleFilter && !matchesVendorRoleScope(orderItem.vendorProfile?.user?.role, roleFilter)) {
      throw new Error('Refund request not found');
    }

    const admins = await prisma.user.findMany({
      where: {
        role: { in: ADMIN_PORTAL_ROLES },
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
      ? await prisma.user.findUnique({
          where: { id: BigInt(requesterId) },
          select: { name: true }
        }).catch(() => null)
      : null;

    const requesterName = requester?.name || 'Admin as vendor';
    const orderNo = String(orderItem.order?.orderNo || `ORD-${orderItem.orderId.toString()}`);
    const productName = String(orderItem.product?.name || 'Product');

    await Promise.all(
      admins.map((admin) =>
        NotificationService.sendNotification({
          userId: admin.id.toString(),
          type: 'ORDER_PLACED_VENDOR',
          title: 'Refund reminder pending review',
          message: `${requesterName} requested refund follow-up for ${orderNo} - ${productName}.`,
          data: {
            orderItemId: orderItem.id.toString(),
            orderId: orderItem.orderId.toString(),
            source: 'ADMIN_AS_VENDOR_FINANCE_REMINDER'
          }
        })
      )
    );

    return {
      notifiedAdmins: admins.length
    };
  }
};

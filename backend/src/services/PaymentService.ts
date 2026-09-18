import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { OrderItemStatus } from '@prisma/client';
import { BusinessLogicError, ValidationError } from '../utils/errors';
import { RazorpayService } from './RazorpayService';

type CapturePaymentInput = {
  amount: number;
  customerId: string;
  orderId: string;
  paymentDetails?: unknown;
};

type InitializePaymentInput = {
  customerId: string;
  orderId: string;
  provider: string;
  providerOrderId?: string | null;
  currency?: string;
  amount?: number;
  paymentMeta?: unknown;
};

type RefundOptions = {
  orderItemId?: string;
  adminId?: string;
  reason?: string;
  idempotencyKey?: string;
};

const REFUND_EPSILON = 0.0001;

const toSafeNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeProvider = (value?: string) => {
  const normalized = String(value || 'INTERNAL').trim().toUpperCase();
  return normalized || 'INTERNAL';
};

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parsePaymentDetails = (paymentDetails?: unknown) => {
  const details = isRecordObject(paymentDetails) ? paymentDetails : {};
  const providerOrderId = String(
    details.providerOrderId ||
      details.razorpayOrderId ||
      ''
  ).trim();
  const providerPaymentId = String(
    details.providerPaymentId ||
      details.razorpayPaymentId ||
      ''
  ).trim();
  const provider = normalizeProvider(
    String(details.provider || (providerPaymentId || providerOrderId ? 'RAZORPAY' : 'INTERNAL'))
  );
  const currency = String(details.currency || 'INR').trim().toUpperCase() || 'INR';

  return {
    provider,
    providerOrderId: providerOrderId || null,
    providerPaymentId: providerPaymentId || null,
    currency,
    paymentMeta:
      Object.keys(details).length > 0
        ? (details as Prisma.InputJsonValue)
        : undefined
  };
};

const computeOrderSplit = async (orderId: bigint) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        select: {
          rentPrice: true,
          deposit: true
        }
      }
    }
  });

  if (!order) {
    throw new BusinessLogicError('Order not found for payment capture');
  }

  const rentalAmount = order.items.reduce((sum, item) => sum + toSafeNumber(item.rentPrice), 0);
  const depositAmount = order.items.reduce((sum, item) => sum + toSafeNumber(item.deposit), 0);
  const totalAmount = toSafeNumber(order.finalPayable, rentalAmount + depositAmount);

  return {
    order,
    rentalAmount,
    depositAmount,
    totalAmount
  };
};

const updateOrderPaymentStatusByAmounts = async (
  tx: any,
  paymentId: bigint,
  orderId: bigint
) => {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    select: {
      capturedAmount: true,
      totalAmount: true,
      amount: true,
      refundedAmount: true
    }
  });

  if (!payment) {
    throw new BusinessLogicError('Payment not found');
  }

  const paidAmount = toSafeNumber(payment.capturedAmount, toSafeNumber(payment.totalAmount, toSafeNumber(payment.amount)));
  const refundedAmount = Math.max(0, toSafeNumber(payment.refundedAmount));
  const fullyRefunded = refundedAmount >= paidAmount - REFUND_EPSILON;
  const partiallyRefunded = refundedAmount > REFUND_EPSILON && !fullyRefunded;

  await tx.payment.update({
    where: { id: paymentId },
    data: {
      status: fullyRefunded ? 'REFUNDED' : partiallyRefunded ? 'REFUND_PENDING' : 'PAID'
    }
  });

  await tx.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: fullyRefunded ? 'REFUNDED' : partiallyRefunded ? 'REFUND_PENDING' : 'PAID'
    }
  });
};

const toRupeesFromPaise = (paise: unknown) => {
  const parsed = toSafeNumber(paise, 0);
  return Math.max(0, parsed / 100);
};

const parseOrderBigInt = (orderId?: unknown): bigint | null => {
  if (orderId === undefined || orderId === null || String(orderId).trim() === '') {
    return null;
  }
  try {
    return BigInt(String(orderId));
  } catch {
    return null;
  }
};

export const PaymentService = {
  async initializePayment(input: InitializePaymentInput) {
    const customerIdBig = BigInt(input.customerId);
    const orderIdBig = BigInt(input.orderId);
    const provider = normalizeProvider(input.provider);
    const providerOrderId = String(input.providerOrderId || '').trim() || null;
    const currency = String(input.currency || 'INR').trim().toUpperCase() || 'INR';
    const split = await computeOrderSplit(orderIdBig);
    const totalAmount = Math.max(0, toSafeNumber(input.amount, split.totalAmount));

    let existingPayment = null as any;
    if (providerOrderId) {
      existingPayment = await prisma.payment.findFirst({
        where: { providerOrderId }
      });
    }

    if (!existingPayment) {
      existingPayment = await prisma.payment.findFirst({
        where: {
          orderId: orderIdBig,
          customerId: customerIdBig,
          status: { in: ['INITIATED', 'UNPAID', 'PENDING'] }
        },
        orderBy: { paidAt: 'desc' }
      });
    }

    const payload = {
      amount: totalAmount,
      status: 'INITIATED',
      provider,
      providerOrderId,
      currency,
      totalAmount: split.totalAmount,
      rentalAmount: split.rentalAmount,
      depositAmount: split.depositAmount,
      capturedAmount: 0,
      captureStatus: 'INITIATED',
      paymentMeta: isRecordObject(input.paymentMeta)
        ? (input.paymentMeta as Prisma.InputJsonValue)
        : undefined
    };

    const payment = existingPayment
      ? await prisma.payment.update({
          where: { id: existingPayment.id },
          data: payload
        })
      : await prisma.payment.create({
          data: {
            orderId: orderIdBig,
            customerId: customerIdBig,
            ...payload
          }
        });

    return payment;
  },

  async capturePayment(paymentData: CapturePaymentInput) {
    const { amount, customerId, orderId, paymentDetails } = paymentData;

    if (!orderId) {
      throw new BusinessLogicError('Order ID is required for payment capture');
    }

    const orderIdBig = BigInt(orderId);
    const customerIdBig = BigInt(customerId);
    const split = await computeOrderSplit(orderIdBig);
    const details = parsePaymentDetails(paymentDetails);
    const capturedAmount = Math.max(0, toSafeNumber(amount, split.totalAmount));
    const now = new Date();

    let existingPayment = null as any;
    if (details.providerPaymentId) {
      existingPayment = await prisma.payment.findFirst({
        where: { providerPaymentId: details.providerPaymentId }
      });
    }

    if (!existingPayment) {
      existingPayment = await prisma.payment.findFirst({
        where: {
          orderId: orderIdBig,
          customerId: customerIdBig
        },
        orderBy: { paidAt: 'desc' }
      });
    }

    if (
      existingPayment &&
      details.providerOrderId &&
      existingPayment.providerOrderId &&
      String(existingPayment.providerOrderId) !== String(details.providerOrderId)
    ) {
      throw new BusinessLogicError('Provider order mismatch for payment capture');
    }

    const payload = {
      amount: capturedAmount,
      status: 'PAID',
      provider: details.provider,
      providerOrderId: details.providerOrderId,
      providerPaymentId: details.providerPaymentId,
      currency: details.currency,
      totalAmount: split.totalAmount,
      rentalAmount: split.rentalAmount,
      depositAmount: split.depositAmount,
      capturedAmount,
      captureStatus: 'CAPTURED',
      paidAt: now,
      paymentMeta: details.paymentMeta
    };

    const payment = existingPayment
      ? await prisma.payment.update({
          where: { id: existingPayment.id },
          data: payload
        })
      : await prisma.payment.create({
          data: {
            orderId: orderIdBig,
            customerId: customerIdBig,
            ...payload
          }
        });

    return {
      status: 'CAPTURED',
      payment
    };
  },

  async processRefund(customerId: string, amount: number, orderId?: string, options?: RefundOptions) {
    const requestedAmount = Math.max(0, toSafeNumber(amount, 0));
    if (requestedAmount <= 0) {
      throw new ValidationError('Refund amount must be greater than 0');
    }

    const customerIdBig = BigInt(customerId);
    const orderIdBig = parseOrderBigInt(orderId);
    const orderItemIdBig = parseOrderBigInt(options?.orderItemId);
    const idempotencyKey = String(options?.idempotencyKey || '').trim() || null;
    const reason = String(options?.reason || '').trim() || null;

    if (idempotencyKey) {
      const existingRefund = await prisma.refund.findFirst({
        where: { idempotencyKey },
        include: { payment: true, order: true }
      });

      if (existingRefund) {
        return {
          status: existingRefund.status,
          refundAmount: toSafeNumber(existingRefund.amount),
          payment: existingRefund.payment,
          order: existingRefund.order,
          refund: existingRefund
        };
      }
    }

    const payment = await prisma.payment.findFirst({
      where: {
        customerId: customerIdBig,
        ...(orderIdBig ? { orderId: orderIdBig } : {}),
        status: { in: ['PAID', 'REFUND_PENDING', 'REFUNDED'] }
      },
      orderBy: { paidAt: 'desc' }
    });

    if (!payment) {
      throw new BusinessLogicError('No eligible payment found for refund');
    }

    const paidAmount = Math.max(
      0,
      toSafeNumber(payment.capturedAmount, toSafeNumber(payment.totalAmount, toSafeNumber(payment.amount)))
    );
    const refundedSoFar = Math.max(0, toSafeNumber(payment.refundedAmount));
    const maxRefundable = Math.max(0, paidAmount - refundedSoFar);

    if (requestedAmount > maxRefundable + REFUND_EPSILON) {
      throw new ValidationError(`Refund amount exceeds remaining refundable amount (${maxRefundable.toFixed(2)})`);
    }

    const reservation = await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.refund.findFirst({
          where: { idempotencyKey },
          include: { payment: true, order: true }
        });
        if (existing) {
          return { existing };
        }
      }

      const latestPayment = await tx.payment.findUnique({
        where: { id: payment.id },
        select: {
          id: true,
          orderId: true,
          provider: true,
          providerPaymentId: true,
          capturedAmount: true,
          totalAmount: true,
          amount: true,
          refundedAmount: true
        }
      });

      if (!latestPayment) {
        throw new BusinessLogicError('Payment not found');
      }

      const latestPaidAmount = Math.max(
        0,
        toSafeNumber(latestPayment.capturedAmount, toSafeNumber(latestPayment.totalAmount, toSafeNumber(latestPayment.amount)))
      );
      const latestRefunded = Math.max(0, toSafeNumber(latestPayment.refundedAmount));
      const latestRemaining = Math.max(0, latestPaidAmount - latestRefunded);
      if (requestedAmount > latestRemaining + REFUND_EPSILON) {
        throw new ValidationError(`Refund amount exceeds remaining refundable amount (${latestRemaining.toFixed(2)})`);
      }

      const allowableBefore = Math.max(0, latestPaidAmount - requestedAmount);
      const reserveResult = await tx.payment.updateMany({
        where: {
          id: latestPayment.id,
          refundedAmount: { lte: allowableBefore + REFUND_EPSILON }
        },
        data: {
          refundedAmount: { increment: requestedAmount },
          status: 'REFUND_PENDING'
        }
      });

      if (reserveResult.count === 0) {
        throw new ValidationError('Concurrent refund detected. Please retry.');
      }

      await tx.order.update({
        where: { id: latestPayment.orderId },
        data: { paymentStatus: 'REFUND_PENDING' }
      });

      const refund = await tx.refund.create({
        data: {
          paymentId: latestPayment.id,
          orderId: latestPayment.orderId,
          orderItemId: orderItemIdBig,
          amount: requestedAmount,
          status: 'INITIATED',
          reason,
          idempotencyKey,
          processedByAdminId: options?.adminId ? BigInt(options.adminId) : null
        }
      });

      return {
        existing: null,
        refundId: refund.id,
        paymentId: latestPayment.id,
        orderId: latestPayment.orderId,
        provider: normalizeProvider(latestPayment.provider || undefined),
        providerPaymentId: latestPayment.providerPaymentId
      };
    });

    if (reservation.existing) {
      return {
        status: reservation.existing.status,
        refundAmount: toSafeNumber(reservation.existing.amount),
        payment: reservation.existing.payment,
        order: reservation.existing.order,
        refund: reservation.existing
      };
    }

    const reservationPaymentId = reservation.paymentId as bigint | undefined;
    const reservationOrderId = reservation.orderId as bigint | undefined;
    const reservationRefundId = reservation.refundId as bigint | undefined;
    if (!reservationPaymentId || !reservationOrderId || !reservationRefundId) {
      throw new BusinessLogicError('Refund reservation state is invalid');
    }

    let providerResponse: any = null;
    try {
      const shouldCallRazorpay =
        reservation.provider === 'RAZORPAY' && Boolean(reservation.providerPaymentId);

      if (shouldCallRazorpay) {
        providerResponse = await RazorpayService.processRefund(
          String(reservation.providerPaymentId),
          requestedAmount,
          {
            orderId: reservationOrderId.toString(),
            refundId: reservationRefundId.toString(),
            reason: reason || 'ADMIN_APPROVED_REFUND'
          }
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.refund.update({
          where: { id: reservationRefundId },
          data: {
            status: 'PROCESSED',
            providerRefundId: providerResponse?.id || null,
            providerResponse: providerResponse || null,
            processedAt: new Date()
          }
        });

        await updateOrderPaymentStatusByAmounts(tx, reservationPaymentId, reservationOrderId);

        const [updatedPayment, updatedOrder, updatedRefund] = await Promise.all([
          tx.payment.findUnique({ where: { id: reservationPaymentId } }),
          tx.order.findUnique({ where: { id: reservationOrderId } }),
          tx.refund.findUnique({ where: { id: reservationRefundId } })
        ]);

        return {
          payment: updatedPayment,
          order: updatedOrder,
          refund: updatedRefund
        };
      });

      return {
        status: result.refund?.status || 'PROCESSED',
        refundAmount: requestedAmount,
        payment: result.payment,
        order: result.order,
        refund: result.refund
      };
    } catch (error: any) {
      const rollbackMessage = error?.message || 'Refund failed';
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: reservationPaymentId },
          data: {
            refundedAmount: { decrement: requestedAmount }
          }
        });

        await updateOrderPaymentStatusByAmounts(tx, reservationPaymentId, reservationOrderId);

        await tx.refund.update({
          where: { id: reservationRefundId },
          data: {
            status: 'FAILED',
            reason: rollbackMessage,
            providerResponse: providerResponse
              ? providerResponse
              : {
                  error: rollbackMessage
                }
          }
        });
      });
      throw new BusinessLogicError(rollbackMessage);
    }
  },

  async processVendorPayout(vendorId: string, amount: number) {
    const vendor = await prisma.vendorProfile.findUnique({ where: { id: BigInt(vendorId) } });
    if (!vendor) {
      throw new BusinessLogicError('Vendor not found');
    }

    const payoutRef = `MANUAL_PAYOUT_${Date.now()}`;
    return { payoutRef, amount, status: 'MANUAL_PENDING', vendor };
  },

  async handlePaymentFailure(customerId: string, orderId: string) {
    if (!orderId) {
      throw new ValidationError('Order ID is required');
    }

    const order = await prisma.order.findUnique({
      where: { id: BigInt(orderId) },
      include: { items: true }
    });

    if (!order) {
      return { success: true, message: 'Order not found' };
    }

    if (order.customerId.toString() !== String(customerId)) {
      throw new ValidationError('Order not found');
    }

    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUND_PENDING' || order.paymentStatus === 'REFUNDED') {
      throw new BusinessLogicError('Cannot rollback paid orders');
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { orderId: order.id } });
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await tx.order.delete({ where: { id: order.id } });
    });

    return { success: true, message: 'Order cancelled and dates released for rebooking' };
  },

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    try {
      return RazorpayService.verifyPaymentSignature(orderId, paymentId, signature);
    } catch {
      return false;
    }
  },

  async handleRazorpayWebhook(payload: any) {
    const event = String(payload?.event || '').trim();
    if (!event) {
      throw new ValidationError('Missing Razorpay webhook event');
    }

    if (event === 'payment.failed') {
      const entity = payload?.payload?.payment?.entity;
      if (!entity) {
        return { event, handled: false, reason: 'payment entity missing' };
      }

      const providerOrderId = String(entity.order_id || '').trim();
      const providerPaymentId = String(entity.id || '').trim();

      let payment = await prisma.payment.findFirst({
        where: {
          OR: [
            ...(providerPaymentId ? [{ providerPaymentId }] : []),
            ...(providerOrderId ? [{ providerOrderId }] : [])
          ]
        },
        include: { order: true }
      });

      if (!payment) {
        return { event, handled: false, reason: 'payment not found' };
      }

      const orderPaymentStatus = String(payment.order.paymentStatus || '').toUpperCase();
      if (orderPaymentStatus === 'UNPAID' || orderPaymentStatus === 'INITIATED') {
        await prisma.$transaction(async (tx) => {
          await tx.payment.deleteMany({ where: { orderId: payment!.orderId } });
          await tx.orderItem.deleteMany({ where: { orderId: payment!.orderId } });
          await tx.order.delete({ where: { id: payment!.orderId } });
        });
      }

      return { event, handled: true, paymentId: payment.id.toString(), message: 'Payment failed - order cancelled' };
    }

    if (event === 'payment.captured') {
      const entity = payload?.payload?.payment?.entity;
      if (!entity) {
        return { event, handled: false, reason: 'payment entity missing' };
      }

      const providerOrderId = String(entity.order_id || '').trim();
      const providerPaymentId = String(entity.id || '').trim();
      const capturedAmount = toRupeesFromPaise(entity.amount);
      const currency = String(entity.currency || 'INR').trim().toUpperCase();
      const orderNo = String(entity?.notes?.orderId || entity?.notes?.orderNo || entity?.receipt || '').trim();

      let payment = await prisma.payment.findFirst({
        where: {
          OR: [
            ...(providerPaymentId ? [{ providerPaymentId }] : []),
            ...(providerOrderId ? [{ providerOrderId }] : [])
          ]
        }
      });

      if (!payment && orderNo) {
        const order = await prisma.order.findFirst({
          where: { orderNo },
          include: {
            items: {
              select: {
                rentPrice: true,
                deposit: true
              }
            }
          }
        });

        if (order) {
          const rentalAmount = order.items.reduce((sum, item) => sum + toSafeNumber(item.rentPrice), 0);
          const depositAmount = order.items.reduce((sum, item) => sum + toSafeNumber(item.deposit), 0);
          const totalAmount = Math.max(0, toSafeNumber(order.finalPayable, capturedAmount));

          payment = await prisma.payment.create({
            data: {
              orderId: order.id,
              customerId: order.customerId,
              amount: totalAmount,
              status: 'PAID',
              provider: 'RAZORPAY',
              providerOrderId: providerOrderId || null,
              providerPaymentId: providerPaymentId || null,
              currency,
              totalAmount,
              rentalAmount,
              depositAmount,
              capturedAmount,
              captureStatus: 'CAPTURED',
              paidAt: new Date(),
              paymentMeta: payload
            }
          });
        }
      }

      if (!payment) {
        return { event, handled: false, reason: 'payment mapping not found' };
      }

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment!.id },
          data: {
            status: 'PAID',
            provider: 'RAZORPAY',
            providerOrderId: providerOrderId || payment!.providerOrderId,
            providerPaymentId: providerPaymentId || payment!.providerPaymentId,
            currency,
            capturedAmount: capturedAmount || payment!.capturedAmount,
            captureStatus: 'CAPTURED',
            paidAt: payment!.paidAt || new Date(),
            paymentMeta: payload
          }
        });

        await tx.order.update({
          where: { id: payment!.orderId },
          data: { paymentStatus: 'PAID' }
        });

        await tx.orderItem.updateMany({
          where: {
            orderId: payment!.orderId,
            status: OrderItemStatus.PLACED
          },
          data: {
            status: OrderItemStatus.BOOKED
          }
        });
      });

      return { event, handled: true, paymentId: payment.id.toString() };
    }

    if (event === 'refund.processed') {
      const entity = payload?.payload?.refund?.entity;
      if (!entity) {
        return { event, handled: false, reason: 'refund entity missing' };
      }

      const providerRefundId = String(entity.id || '').trim();
      const providerPaymentId = String(entity.payment_id || '').trim();
      const refundAmount = toRupeesFromPaise(entity.amount);

      if (!providerRefundId || !providerPaymentId || refundAmount <= 0) {
        return { event, handled: false, reason: 'refund payload incomplete' };
      }

      const payment = await prisma.payment.findFirst({
        where: { providerPaymentId }
      });

      if (!payment) {
        return { event, handled: false, reason: 'payment not found for refund webhook' };
      }

      const existing = await prisma.refund.findFirst({
        where: { providerRefundId }
      });
      if (existing) {
        return { event, handled: true, refundId: existing.id.toString(), duplicate: true };
      }

      await prisma.$transaction(async (tx) => {
        await tx.refund.create({
          data: {
            paymentId: payment.id,
            orderId: payment.orderId,
            amount: refundAmount,
            status: 'PROCESSED',
            providerRefundId,
            providerResponse: payload,
            processedAt: new Date()
          }
        });

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            refundedAmount: { increment: refundAmount }
          }
        });

        await updateOrderPaymentStatusByAmounts(tx, payment.id, payment.orderId);
      });

      return { event, handled: true, paymentId: payment.id.toString() };
    }

    if (event === 'payout.processed') {
      const entity = payload?.payload?.payout?.entity;
      const referenceId = String(entity?.reference_id || '').trim();
      if (!referenceId) {
        return { event, handled: false, reason: 'reference id missing' };
      }

      await prisma.vendorSettlement.updateMany({
        where: {
          transferReference: referenceId,
          status: 'PENDING'
        },
        data: {
          status: 'COMPLETED',
          paidAt: new Date()
        }
      });

      return { event, handled: true, referenceId };
    }

    return { event, handled: false, reason: 'event not mapped' };
  }
};

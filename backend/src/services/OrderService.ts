import { PaymentService } from './PaymentService';
import { NotificationService } from './NotificationService';
import { CouponService } from './CouponService';
import { S3Service } from './S3Service';
import { RentalAvailabilityService } from './RentalAvailabilityService';
import { VendorProfileService } from './VendorProfileService';
import { emitDataUpdatedToRole } from '../realtime/socketServer';
import { ValidationError, BusinessLogicError } from '../utils/errors';
import { buildOrderNo, buildTemporaryOrderNo, buildUserPublicCode } from '../utils/publicCodes';
import prisma from '../config/db';
import { FulfillmentType, OrderItemStatus, PaymentStatus, UserRole } from '@prisma/client';
import { expandOrderItemStatusFilter, normalizeOrderItemStatus } from '../constants/orderStatus';
import { getCustomerReviewEligibility } from '../utils/customerReviewEligibility';

type OrderItemInput = {
  productId?: string | number;
  variantId: string | number;
  vendorId?: string | number;
  quantity: number;
  startDate?: string;
  endDate?: string;
  fulfillmentType?: string;
  alterationRequired?: boolean | string | number;
};

type CreateOrderData = {
  items: OrderItemInput[];
  startDate?: string;
  endDate?: string;
  paymentDetails?: unknown;
  couponCode?: string;
};

type PaginationFilters = {
  status?: string;
  page?: number;
  limit?: number;
};

type SubmitReviewData = {
  orderItemId?: string | number;
  productId?: string | number;
  rating: number;
  comment?: string;
  images?: string[];
};

type ValidatedOrderItem = {
  productId: bigint;
  variantId: bigint;
  vendorId: bigint;
  quantity: number;
  rentPrice: number;
  deposit: number;
  alterationRequired: boolean;
  alterationCharge: number;
  deliveryCharge: number;
  lateFeePerDay: number;
  fulfillmentType: FulfillmentType;
  rentalStartDate: Date;
  returnDueDate: Date;
};

type RetryHoldSelection = {
  variantId: bigint;
  vendorId: bigint;
  rentalStartDate: Date;
  returnDueDate: Date;
};

const assertSingleUnitVariantSelections = (items: OrderItemInput[]) => {
  const seenVariantIds = new Set<string>();

  for (const item of items) {
    const variantKey = String(item?.variantId ?? '').trim();
    if (!variantKey) continue;

    const quantity = Number(item.quantity);
    if (quantity !== 1) {
      throw new ValidationError('Only one quantity is allowed per variant');
    }

    if (seenVariantIds.has(variantKey)) {
      throw new BusinessLogicError('This variant is already selected in the order. Each variant can only be booked once.');
    }

    seenVariantIds.add(variantKey);
  }
};

const VISIBLE_ORDER_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.REFUND_PENDING,
  PaymentStatus.REFUNDED
];

const calculateRentalDays = (startDate?: string, endDate?: string): number => {
  if (!startDate && !endDate) return 1;
  if (!startDate || !endDate) {
    throw new ValidationError('Both startDate and endDate are required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new ValidationError('Invalid startDate/endDate');
  }
  if (end < start) {
    throw new ValidationError('End date must be on or after start date');
  }

  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
};

const normalizeFulfillmentType = (input?: string | null): FulfillmentType => {
  const normalized = String(input || '').trim().toUpperCase();
  if (normalized === 'HOME_DELIVERY' || normalized === 'DELIVERY') {
    return FulfillmentType.HOME_DELIVERY;
  }
  return FulfillmentType.SELF_PICKUP;
};

const normalizeBooleanFlag = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y'].includes(normalized);
};

const parseCurrencyLikeValue = (value: unknown): number => {
  const normalized = String(value ?? '').replace(/[^0-9.]/g, '').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveProductAlterationCharge = (product: any) => {
  const direct = parseCurrencyLikeValue(
    product?.alterationCharge ?? product?.productDetailsFull?.alterationCharge
  );
  if (direct > 0) return direct;

  const additionalInfo = Array.isArray(product?.productDetailsFull?.additionalInfo)
    ? product.productDetailsFull.additionalInfo
    : [];

  const entry = additionalInfo.find((row: any) =>
    /alteration\s*charge/i.test(String(row?.label || ''))
  );

  return parseCurrencyLikeValue(entry?.value);
};

const toUtcDateFromLocalCalendar = (date: Date) =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

const parseDateInput = (value?: string): Date | undefined => {
  if (!value || value.trim() === '') return undefined;

  const trimmed = value.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(Date.UTC(year, month, day));
  }

  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) {
    throw new ValidationError('Invalid startDate/endDate');
  }

  return toUtcDateFromLocalCalendar(parsed);
};

const resolveRentalWindow = (startDate?: string, endDate?: string, fallbackDays = 1) => {
  const rentalStartDate = parseDateInput(startDate);
  const returnDueDate = parseDateInput(endDate);

  if ((rentalStartDate && !returnDueDate) || (!rentalStartDate && returnDueDate)) {
    throw new ValidationError('Both startDate and endDate are required');
  }

  if (rentalStartDate && returnDueDate) {
    if (returnDueDate < rentalStartDate) {
      throw new ValidationError('End date must be on or after start date');
    }

    return { rentalStartDate, returnDueDate };
  }

  const now = new Date();
  const inferredStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const inferredEnd = new Date(inferredStart);
  inferredEnd.setUTCDate(inferredEnd.getUTCDate() + Math.max(1, fallbackDays) - 1);

  return {
    rentalStartDate: inferredStart,
    returnDueDate: inferredEnd
  };
};

const resolvePersistedOrderItemWindow = (
  orderCreatedAt: Date,
  orderItem: { rentalStartDate?: Date | null; returnDueDate?: Date | null }
) => {
  const start = orderItem.rentalStartDate
    ? toUtcDateFromLocalCalendar(new Date(orderItem.rentalStartDate))
    : toUtcDateFromLocalCalendar(new Date(orderCreatedAt));

  let end = orderItem.returnDueDate
    ? toUtcDateFromLocalCalendar(new Date(orderItem.returnDueDate))
    : new Date(start);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new ValidationError('Order contains invalid rental dates');
  }

  if (end < start) {
    end = new Date(start);
  }

  return {
    rentalStartDate: start,
    returnDueDate: end
  };
};

const rollbackUnpaidOrderRecord = async (orderId: bigint, customerId?: bigint) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      paymentStatus: true
    }
  });

  if (!order) return false;
  if (customerId && order.customerId !== customerId) {
    throw new ValidationError('Order not found');
  }
  if (order.paymentStatus !== 'UNPAID') {
    throw new BusinessLogicError('Only unpaid orders can be rolled back');
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({
      where: { orderId: order.id }
    });
    await tx.orderItem.deleteMany({
      where: { orderId: order.id }
    });
    await tx.order.delete({
      where: { id: order.id }
    });
  });

  return true;
};

const releaseConflictingCustomerRetryHolds = async (
  customerId: bigint,
  selection: RetryHoldSelection,
  releasedOrderIds: Set<string>
) => {
  const matchingRows = await prisma.orderItem.findMany({
    where: {
      variantId: selection.variantId,
      vendorId: selection.vendorId,
      rentalStartDate: selection.rentalStartDate,
      returnDueDate: selection.returnDueDate,
      status: 'PLACED',
      order: {
        customerId,
        paymentStatus: 'UNPAID'
      }
    },
    select: {
      orderId: true
    }
  });

  const uniqueOrderIds = Array.from(
    new Set(matchingRows.map((row) => row.orderId.toString()).filter(Boolean))
  ).filter((orderId) => !releasedOrderIds.has(orderId));

  for (const orderId of uniqueOrderIds) {
    await rollbackUnpaidOrderRecord(BigInt(orderId), customerId).catch(() => null);
    releasedOrderIds.add(orderId);
  }
};

const resolveVendorProfileId = async (vendorIdentifier: string): Promise<bigint> => {
  const vendorProfile = await prisma.vendorProfile.findFirst({
    where: {
      OR: [
        { id: BigInt(vendorIdentifier) },
        { userId: BigInt(vendorIdentifier) }
      ]
    },
    select: { id: true }
  });

  if (!vendorProfile) {
    throw new ValidationError('Vendor profile not found');
  }

  return vendorProfile.id;
};

const emitAdminOrderRealtimeUpdate = (
  refs: Record<string, string | bigint | number | null | undefined>,
  reason: string
) => {
  const normalizedRefs = Object.fromEntries(
    Object.entries(refs)
      .map(([key, value]) => [key, value === undefined || value === null ? '' : String(value).trim()])
      .filter(([, value]) => value)
  );

  emitDataUpdatedToRole('ADMIN', {
    domains: ['orders', 'operations', 'refunds', 'dashboard'],
    refs: normalizedRefs,
    reason
  });
};

const getVendorForOrder = async (vendorProfileId: bigint) => {
  try {
    return await prisma.vendorProfile.findFirst({
      where: { id: vendorProfileId },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            status: true,
            onboardingStatus: true
          }
        }
      }
    });
  } catch (error: any) {
    if (error?.code !== 'P2022') throw error;
    return prisma.vendorProfile.findFirst({
      where: { id: vendorProfileId },
      select: {
        id: true,
        userId: true
      }
    });
  }
};

const processOrderRejection = async (
  orderItem: { id: bigint; orderId: bigint; variantId: bigint; quantity: number; rentPrice: unknown; deposit: unknown; order: { customerId: bigint } }
) => {
  await prisma.$transaction(async (tx) => {
    await tx.orderItem.update({
      where: { id: orderItem.id },
      data: { status: 'CANCELLED' }
    });

    await tx.order.update({
      where: { id: orderItem.orderId },
      data: { paymentStatus: 'REFUND_PENDING' }
    });
  });

  await NotificationService.notifyCustomerOrderRejected(orderItem.order.customerId.toString(), orderItem.id.toString());
  emitAdminOrderRealtimeUpdate(
    {
      orderId: orderItem.orderId,
      orderItemId: orderItem.id
    },
    'ORDER_REJECTED'
  );

  return { message: 'Order rejected. Refund marked for manual admin processing' };
};

const sortProductImagesByCover = (images: any[]) => {
  if (!Array.isArray(images) || images.length <= 1) {
    return Array.isArray(images) ? images : [];
  }

  return [...images].sort((left, right) => {
    const leftScore = left?.isCover ? 1 : 0;
    const rightScore = right?.isCover ? 1 : 0;
    return rightScore - leftScore;
  });
};

const withAccessibleOrderImages = async (orderItem: any) => {
  const product = orderItem?.product;
  if (!product || !Array.isArray(product.images) || product.images.length === 0) {
    return orderItem;
  }

  const sortedImages = sortProductImagesByCover(product.images);
  const signedUrls = await S3Service.getAccessibleImageUrls(
    sortedImages.map((image: any) => image?.imageUrl || '')
  );

  return {
    ...orderItem,
    product: {
      ...product,
      images: sortedImages.map((image: any, index: number) => ({
        ...image,
        imageUrl: signedUrls[index] || image?.imageUrl
      }))
    }
  };
};

const toSafeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const getOrderPricingItems = (order: any, fallbackItems: any[] = []) => {
  if (Array.isArray(order?.items) && order.items.length > 0) return order.items;
  return fallbackItems.filter(Boolean);
};

const buildOrderPricingBreakdown = (order: any, fallbackItems: any[] = []) => {
  const items = getOrderPricingItems(order, fallbackItems);
  const rentalAmount = roundMoney(
    items.reduce((sum: number, item: any) => sum + toSafeNumber(item?.rentPrice), 0)
  );
  const securityDepositAmount = roundMoney(
    items.reduce((sum: number, item: any) => sum + toSafeNumber(item?.deposit), 0)
  );
  const alterationChargeAmount = roundMoney(
    items.reduce((sum: number, item: any) => sum + toSafeNumber(item?.alterationCharge), 0)
  );
  const deliveryChargeAmount = roundMoney(
    items.reduce((sum: number, item: any) => sum + toSafeNumber(item?.deliveryCharge), 0)
  );
  const grossAmount = roundMoney(
    rentalAmount + securityDepositAmount + alterationChargeAmount + deliveryChargeAmount
  );
  const hasFinalPayable = order?.finalPayable !== undefined && order?.finalPayable !== null;
  const finalPayable = hasFinalPayable
    ? roundMoney(Math.max(0, toSafeNumber(order.finalPayable)))
    : grossAmount;
  const discountAmount = roundMoney(
    Math.min(rentalAmount, Math.max(0, grossAmount - finalPayable))
  );
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

const getOrderItemDiscountAllocation = (orderItem: any): number => {
  const order = orderItem?.order || {};
  const pricing = buildOrderPricingBreakdown(order, [orderItem]);
  if (pricing.discountAmount <= 0 || pricing.rentalAmount <= 0) return 0;

  const itemRent = toSafeNumber(orderItem?.rentPrice);
  if (itemRent <= 0) return 0;

  return roundMoney(Math.min(itemRent, (pricing.discountAmount * itemRent) / pricing.rentalAmount));
};

const isMissingColumnError = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    code === 'P2022' ||
    message.includes('does not exist in the current database') ||
    message.includes('unknown argument') ||
    message.includes('unknown field')
  );
};

const buildPaymentBreakdown = (orderItem: any) => {
  const paymentStatus = String(orderItem?.order?.paymentStatus || '').toUpperCase();
  const itemStatus = String(orderItem?.status || '').toUpperCase();

  const isPaidLike = paymentStatus === 'PAID' || paymentStatus === 'REFUND_PENDING' || paymentStatus === 'REFUNDED';
  const isRejectedOrCancelled = itemStatus === 'CANCELLED' || itemStatus === 'REJECTED';

  const rentalAmount = toSafeNumber(orderItem?.rentPrice);
  const rentalDiscountAmount = getOrderItemDiscountAllocation(orderItem);
  const rentalAmountAfterDiscount = roundMoney(Math.max(0, rentalAmount - rentalDiscountAmount));
  const rentalAmountReceived = isPaidLike && !isRejectedOrCancelled ? rentalAmountAfterDiscount : 0;
  const securityDepositReceived = isPaidLike && !isRejectedOrCancelled ? toSafeNumber(orderItem?.deposit) : 0;
  const securityDepositRefunded = Math.min(
    securityDepositReceived,
    Math.max(0, toSafeNumber(orderItem?.securityDepositRefunded))
  );
  const securityDepositHeldForDamage = Math.min(
    securityDepositReceived,
    Math.max(0, toSafeNumber(orderItem?.securityDepositHeld))
  );
  const securityDepositOutstanding = Math.max(
    0,
    securityDepositReceived - securityDepositRefunded - securityDepositHeldForDamage
  );

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

const withCustomerPublicCode = (customer: any) => {
  if (!customer?.id) return customer;

  return {
    ...customer,
    publicCode: String(
      customer?.publicCode || buildUserPublicCode(UserRole.CUSTOMER, customer.id)
    )
  };
};

const withVendorUserPublicCode = (user: any) => {
  if (!user?.id || !user?.role) return user;

  return {
    ...user,
    publicCode: String(user?.publicCode || buildUserPublicCode(user.role, user.id))
  };
};

const PAID_VENDOR_ORDER_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.REFUND_PENDING,
  PaymentStatus.REFUNDED
];

const markOrderItemsBooked = async (
  executor: {
    orderItem: {
      updateMany: (args: {
        where: { orderId: bigint; status: OrderItemStatus };
        data: { status: OrderItemStatus };
      }) => Promise<unknown>;
    };
  },
  orderId: bigint
) => {
  await executor.orderItem.updateMany({
    where: {
      orderId,
      status: OrderItemStatus.PLACED
    },
    data: {
      status: OrderItemStatus.BOOKED
    }
  });
};

const VENDOR_LIFECYCLE_TARGET_STATUSES = new Set<OrderItemStatus>([
  OrderItemStatus.READY_FOR_PICKUP,
  OrderItemStatus.PICKED_UP,
  OrderItemStatus.RETURN_SCHEDULED,
  OrderItemStatus.RETURNED
]);

const ORDER_STATUS_TRANSITIONS: Partial<Record<OrderItemStatus, OrderItemStatus[]>> = {
  [OrderItemStatus.BOOKED]: [
    OrderItemStatus.PLACED
  ],
  [OrderItemStatus.READY_FOR_PICKUP]: [
    OrderItemStatus.BOOKED,
    OrderItemStatus.RENTAL_CONFIRMED,
    OrderItemStatus.ACCEPTED,
    OrderItemStatus.PLACED
  ],
  [OrderItemStatus.PICKED_UP]: [
    OrderItemStatus.READY_FOR_PICKUP
  ],
  [OrderItemStatus.RETURN_SCHEDULED]: [
    OrderItemStatus.PICKED_UP,
    OrderItemStatus.OUT_FOR_DELIVERY,
    OrderItemStatus.DISPATCHED,
    OrderItemStatus.DELIVERED,
    OrderItemStatus.RETURN_REQUESTED
  ],
  [OrderItemStatus.RETURNED]: [
    OrderItemStatus.RETURN_SCHEDULED,
    OrderItemStatus.RETURN_REQUESTED,
    OrderItemStatus.RETURN_RECEIVED
  ]
};

const parseVendorLifecycleTargetStatus = (statusInput: string): OrderItemStatus => {
  const normalized = normalizeOrderItemStatus(statusInput);
  if (!normalized || !VENDOR_LIFECYCLE_TARGET_STATUSES.has(normalized)) {
    throw new ValidationError('Unsupported status transition');
  }
  return normalized;
};

const createOrderWithReadableOrderNo = async (
  tx: any,
  data: {
    customerId: bigint;
    finalPayable: number;
    paymentStatus?: PaymentStatus;
    couponId?: bigint;
  }
) => {
  const createdOrder = await tx.order.create({
    data: {
      customerId: data.customerId,
      orderNo: buildTemporaryOrderNo(),
      finalPayable: data.finalPayable,
      paymentStatus: data.paymentStatus || PaymentStatus.UNPAID,
      couponId: data.couponId
    }
  });

  const orderNo = buildOrderNo(createdOrder.id, createdOrder.createdAt);

  return tx.order.update({
    where: { id: createdOrder.id },
    data: { orderNo }
  });
};

export const OrderService = {
  async createEscrowOrder(customerId: string, orderData: CreateOrderData) {
    if (!customerId) {
      throw new ValidationError('Customer ID is required');
    }

    const { items, startDate, endDate, paymentDetails, couponCode } = orderData;
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required');
    }
    assertSingleUnitVariantSelections(items);

    const defaultRentalDays = calculateRentalDays(startDate, endDate);

    let totalRent = 0;
    let totalDeposit = 0;
    let totalAlterationCharge = 0;
    let totalDeliveryCharge = 0;
    const validatedItems: ValidatedOrderItem[] = [];
    const vendorOperationalSettingsByUserId = new Map<
      string,
      Awaited<ReturnType<typeof VendorProfileService.getOperationalSettings>>
    >();

    for (const item of items) {
      if (item.variantId === undefined || item.variantId === null || String(item.variantId).trim() === '') {
        throw new ValidationError('variantId is required');
      }

      if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
        throw new ValidationError('Quantity must be greater than 0');
      }

      let variantIdBig: bigint;
      try {
        variantIdBig = BigInt(item.variantId);
      } catch {
        throw new ValidationError('Invalid variantId');
      }

      const variant = await prisma.productVariant.findUnique({
        where: { id: variantIdBig },
        include: { product: true }
      });

      if (!variant || variant.product.status !== 'ACTIVE') {
        throw new ValidationError('Product variant not available');
      }

      const requestedVendorId = item.vendorId !== undefined && item.vendorId !== null && String(item.vendorId).trim() !== ''
        ? String(item.vendorId)
        : null;

      const vendorProfileId = requestedVendorId
        ? await resolveVendorProfileId(requestedVendorId)
        : variant.product.vendorId;

      const vendor = await getVendorForOrder(vendorProfileId);
      const vendorUser = (vendor as any)?.user;
      const hasVendorStatusInfo = Boolean(vendorUser);
      const vendorInactive = hasVendorStatusInfo && String(vendorUser?.status || '').toUpperCase() !== 'ACTIVE';
      const vendorNotApproved = hasVendorStatusInfo && String(vendorUser?.onboardingStatus || '').toUpperCase() !== 'APPROVED';

      if (!vendor || vendorInactive || vendorNotApproved) {
        throw new BusinessLogicError('Vendor not available for orders');
      }

      if (variant.product.vendorId !== vendor.id) {
        throw new ValidationError('Variant does not belong to vendor');
      }

      if (!variant || variant.quantity < item.quantity) {
        throw new ValidationError('Product variant not available in requested quantity');
      }

      if (item.productId !== undefined && item.productId !== null && String(item.productId).trim() !== '') {
        let productIdBig: bigint;
        try {
          productIdBig = BigInt(item.productId);
        } catch {
          throw new ValidationError('Invalid productId');
        }

        if (variant.productId !== productIdBig) {
          throw new ValidationError('Product and variant mismatch');
        }
      }

      const quantity = Number(item.quantity);
      const fulfillmentType = normalizeFulfillmentType(item.fulfillmentType);
      const vendorUserId = String((vendor as any)?.userId || '').trim();
      let vendorOperationalSettings = {
        lateFeePerDay: 0,
        homeDeliveryApplicable: false,
        deliveryCharges: 0
      };

      if (vendorUserId) {
        const cached = vendorOperationalSettingsByUserId.get(vendorUserId);
        if (cached) {
          vendorOperationalSettings = cached;
        } else {
          const resolved = await VendorProfileService.getOperationalSettings(vendorUserId);
          vendorOperationalSettingsByUserId.set(vendorUserId, resolved);
          vendorOperationalSettings = resolved;
        }
      }

      const homeDeliveryAllowed = vendorOperationalSettings.homeDeliveryApplicable;
      const vendorDeliveryCharges = Math.max(
        0,
        Number(vendorOperationalSettings.deliveryCharges || 0)
      );
      const vendorLateFeePerDay = Math.max(
        0,
        Number(vendorOperationalSettings.lateFeePerDay || 0)
      );

      if (fulfillmentType === FulfillmentType.HOME_DELIVERY && !homeDeliveryAllowed) {
        throw new ValidationError('Home delivery is not available for this vendor');
      }

      const resolvedStartDate = item.startDate ?? startDate;
      const resolvedEndDate = item.endDate ?? endDate;
      const itemRentalDays = calculateRentalDays(resolvedStartDate, resolvedEndDate) || defaultRentalDays;
      const rentalWindow = resolveRentalWindow(resolvedStartDate, resolvedEndDate, itemRentalDays);

      await RentalAvailabilityService.assertRangeAvailableForOrder(
        vendorProfileId,
        variant.productId,
        rentalWindow.rentalStartDate,
        rentalWindow.returnDueDate,
        quantity,
        variant.id,
        {
          includePendingHolds: true
        }
      );

      const itemRent = Number(variant.product.rentalPrice) * itemRentalDays * quantity;
      const itemDeposit = Number(variant.product.securityDeposit) * itemRentalDays * quantity;
      const alterationRequired = normalizeBooleanFlag(item.alterationRequired);
      if (alterationRequired && !Boolean((variant.product as any)?.alterationAvailable)) {
        throw new ValidationError('Alteration is not available for this product');
      }
      const itemAlterationCharge = alterationRequired
        ? resolveProductAlterationCharge(variant.product) * quantity
        : 0;
      const itemDeliveryCharge =
        fulfillmentType === FulfillmentType.HOME_DELIVERY
          ? vendorDeliveryCharges * quantity
          : 0;

      totalRent += itemRent;
      totalDeposit += itemDeposit;
      totalAlterationCharge += itemAlterationCharge;
      totalDeliveryCharge += itemDeliveryCharge;

      validatedItems.push({
        productId: variant.productId,
        variantId: variant.id,
        vendorId: vendor.id,
        quantity,
        rentPrice: itemRent,
        deposit: itemDeposit,
        alterationRequired,
        alterationCharge: itemAlterationCharge,
        deliveryCharge: itemDeliveryCharge,
        lateFeePerDay: vendorLateFeePerDay,
        fulfillmentType,
        rentalStartDate: rentalWindow.rentalStartDate,
        returnDueDate: rentalWindow.returnDueDate
      });
    }

    let discount = 0;
    let couponUsed: { id: bigint } | null = null;
    if (couponCode) {
      const couponResult = await CouponService.validateCoupon(couponCode, customerId, totalRent);
      discount = couponResult.discount;
      couponUsed = { id: couponResult.coupon.id };
    }

    const gstAmount = 0;
    const finalPayable = Math.max(
      0,
      totalRent + totalDeposit + totalDeliveryCharge + totalAlterationCharge - discount
    );

    const itemBreakdowns = validatedItems.map(item => {
      const rentalDays = Math.max(1, Math.floor((item.returnDueDate.getTime() - item.rentalStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const perDayRent = item.quantity > 0 ? Math.round(item.rentPrice / item.quantity / rentalDays) : 0;
      return {
        productId: item.productId.toString(),
        variantId: item.variantId.toString(),
        rentalDays,
        perDayRent,
        quantity: item.quantity,
        rentPrice: item.rentPrice,
        deposit: item.deposit,
        alterationRequired: item.alterationRequired,
        alterationCharge: item.alterationCharge
      };
    });

    const pricingBreakdown = {
      rentalAmount: totalRent,
      securityDepositAmount: totalDeposit,
      alterationChargeAmount: totalAlterationCharge,
      deliveryCharge: totalDeliveryCharge,
      gstAmount,
      discountAmount: discount,
      finalPayable,
      itemBreakdowns
    };

    const result = await prisma.$transaction(async (tx) => {
      const order = await createOrderWithReadableOrderNo(tx, {
        customerId: BigInt(customerId),
        finalPayable,
        paymentStatus: PaymentStatus.UNPAID,
        couponId: couponUsed?.id
      });

      const orderItems = await Promise.all(
        validatedItems.map((item) =>
          tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              variantId: item.variantId,
              vendorId: item.vendorId,
              quantity: item.quantity,
              rentPrice: item.rentPrice,
              deposit: item.deposit,
              alterationRequired: item.alterationRequired,
              alterationCharge: item.alterationCharge,
              fulfillmentType: item.fulfillmentType,
              rentalStartDate: item.rentalStartDate,
              returnDueDate: item.returnDueDate,
              status: 'PLACED'
            } as any
          })
        )
      );

      return { order, orderItems };
    });

    let paymentResult: Awaited<ReturnType<typeof PaymentService.capturePayment>>;
    try {
      // Re-check rental capacity just before payment capture to avoid race-based overbooking.
      for (const item of validatedItems) {
        await RentalAvailabilityService.assertRangeAvailableForOrder(
          item.vendorId,
          item.productId,
          item.rentalStartDate,
          item.returnDueDate,
          item.quantity,
          item.variantId,
          {
            includePendingHolds: true,
            excludeOrderId: result.order.id,
            pendingHoldBefore: {
              createdAt: result.order.createdAt,
              orderId: result.order.id
            }
          }
        );
      }

      paymentResult = await PaymentService.capturePayment({
        amount: finalPayable,
        customerId,
        paymentDetails,
        orderId: result.order.id.toString()
      });
    } catch (error) {
      await OrderService.rollbackUnpaidOrder(result.order.id.toString()).catch(() => null);
      throw error;
    }

    if (paymentResult.status !== 'CAPTURED') {
      await OrderService.rollbackUnpaidOrder(result.order.id.toString()).catch(() => null);
      throw new BusinessLogicError('Payment failed');
    }

    await prisma.order.update({
      where: { id: result.order.id },
      data: { paymentStatus: 'PAID' }
    });
    await markOrderItemsBooked(prisma, result.order.id);

    if (couponUsed) {
      await CouponService.applyCoupon(couponUsed.id.toString(), customerId, result.order.id.toString(), discount);
    }

    for (const item of validatedItems) {
      await NotificationService.notifyVendorNewOrder(item.vendorId.toString(), result.order.id.toString());
    }

    return {
      ...result.order,
      pricingBreakdown
    };
  },

  async createUnpaidOrder(customerId: string, orderData: CreateOrderData) {
    if (!customerId) {
      throw new ValidationError('Customer ID is required');
    }
    const customerIdBig = BigInt(customerId);

    const { items, startDate, endDate, couponCode } = orderData;
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required');
    }
    assertSingleUnitVariantSelections(items);

    const defaultRentalDays = calculateRentalDays(startDate, endDate);

    let totalRent = 0;
    let totalDeposit = 0;
    let totalAlterationCharge = 0;
    let totalDeliveryCharge = 0;
    const validatedItems: ValidatedOrderItem[] = [];
    const releasedRetryOrderIds = new Set<string>();
    const vendorOperationalSettingsByUserId = new Map<
      string,
      Awaited<ReturnType<typeof VendorProfileService.getOperationalSettings>>
    >();

    for (const item of items) {
      if (item.variantId === undefined || item.variantId === null || String(item.variantId).trim() === '') {
        throw new ValidationError('variantId is required');
      }

      if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
        throw new ValidationError('Quantity must be greater than 0');
      }

      let variantIdBig: bigint;
      try {
        variantIdBig = BigInt(item.variantId);
      } catch {
        throw new ValidationError('Invalid variantId');
      }

      const variant = await prisma.productVariant.findUnique({
        where: { id: variantIdBig },
        include: { product: true }
      });

      if (!variant || variant.product.status !== 'ACTIVE') {
        throw new ValidationError('Product variant not available');
      }

      const requestedVendorId = item.vendorId !== undefined && item.vendorId !== null && String(item.vendorId).trim() !== ''
        ? String(item.vendorId)
        : null;

      const vendorProfileId = requestedVendorId
        ? await resolveVendorProfileId(requestedVendorId)
        : variant.product.vendorId;

      const vendor = await getVendorForOrder(vendorProfileId);
      const vendorUser = (vendor as any)?.user;
      const hasVendorStatusInfo = Boolean(vendorUser);
      const vendorInactive = hasVendorStatusInfo && String(vendorUser?.status || '').toUpperCase() !== 'ACTIVE';
      const vendorNotApproved = hasVendorStatusInfo && String(vendorUser?.onboardingStatus || '').toUpperCase() !== 'APPROVED';

      if (!vendor || vendorInactive || vendorNotApproved) {
        throw new BusinessLogicError('Vendor not available for orders');
      }

      if (variant.product.vendorId !== vendor.id) {
        throw new ValidationError('Variant does not belong to vendor');
      }

      if (variant.quantity < Number(item.quantity)) {
        throw new ValidationError('Product variant not available in requested quantity');
      }

      if (item.productId !== undefined && item.productId !== null && String(item.productId).trim() !== '') {
        let productIdBig: bigint;
        try {
          productIdBig = BigInt(item.productId);
        } catch {
          throw new ValidationError('Invalid productId');
        }

        if (variant.productId !== productIdBig) {
          throw new ValidationError('Product and variant mismatch');
        }
      }

      const quantity = Number(item.quantity);
      const fulfillmentType = normalizeFulfillmentType(item.fulfillmentType);
      const vendorUserId = String((vendor as any)?.userId || '').trim();
      let vendorOperationalSettings = {
        lateFeePerDay: 0,
        homeDeliveryApplicable: false,
        deliveryCharges: 0
      };

      if (vendorUserId) {
        const cached = vendorOperationalSettingsByUserId.get(vendorUserId);
        if (cached) {
          vendorOperationalSettings = cached;
        } else {
          const resolved = await VendorProfileService.getOperationalSettings(vendorUserId);
          vendorOperationalSettingsByUserId.set(vendorUserId, resolved);
          vendorOperationalSettings = resolved;
        }
      }

      const homeDeliveryAllowed = vendorOperationalSettings.homeDeliveryApplicable;
      const vendorDeliveryCharges = Math.max(
        0,
        Number(vendorOperationalSettings.deliveryCharges || 0)
      );
      const vendorLateFeePerDay = Math.max(
        0,
        Number(vendorOperationalSettings.lateFeePerDay || 0)
      );

      if (fulfillmentType === FulfillmentType.HOME_DELIVERY && !homeDeliveryAllowed) {
        throw new ValidationError('Home delivery is not available for this vendor');
      }

      const resolvedStartDate = item.startDate ?? startDate;
      const resolvedEndDate = item.endDate ?? endDate;
      const itemRentalDays = calculateRentalDays(resolvedStartDate, resolvedEndDate) || defaultRentalDays;
      const rentalWindow = resolveRentalWindow(resolvedStartDate, resolvedEndDate, itemRentalDays);

      await releaseConflictingCustomerRetryHolds(
        customerIdBig,
        {
          variantId: variant.id,
          vendorId: vendorProfileId,
          rentalStartDate: rentalWindow.rentalStartDate,
          returnDueDate: rentalWindow.returnDueDate
        },
        releasedRetryOrderIds
      );

      await RentalAvailabilityService.assertRangeAvailableForOrder(
        vendorProfileId,
        variant.productId,
        rentalWindow.rentalStartDate,
        rentalWindow.returnDueDate,
        quantity,
        variant.id,
        {
          includePendingHolds: true
        }
      );

      const itemRent = Number(variant.product.rentalPrice) * itemRentalDays * quantity;
      const itemDeposit = Number(variant.product.securityDeposit) * itemRentalDays * quantity;
      const alterationRequired = normalizeBooleanFlag(item.alterationRequired);
      if (alterationRequired && !Boolean((variant.product as any)?.alterationAvailable)) {
        throw new ValidationError('Alteration is not available for this product');
      }
      const itemAlterationCharge = alterationRequired
        ? resolveProductAlterationCharge(variant.product) * quantity
        : 0;
      const itemDeliveryCharge =
        fulfillmentType === FulfillmentType.HOME_DELIVERY
          ? vendorDeliveryCharges * quantity
          : 0;

      totalRent += itemRent;
      totalDeposit += itemDeposit;
      totalAlterationCharge += itemAlterationCharge;
      totalDeliveryCharge += itemDeliveryCharge;

      validatedItems.push({
        productId: variant.productId,
        variantId: variant.id,
        vendorId: vendor.id,
        quantity,
        rentPrice: itemRent,
        deposit: itemDeposit,
        alterationRequired,
        alterationCharge: itemAlterationCharge,
        deliveryCharge: itemDeliveryCharge,
        lateFeePerDay: vendorLateFeePerDay,
        fulfillmentType,
        rentalStartDate: rentalWindow.rentalStartDate,
        returnDueDate: rentalWindow.returnDueDate
      });
    }

    let discount = 0;
    let couponUsed: { id: bigint } | null = null;
    if (couponCode) {
      const couponResult = await CouponService.validateCoupon(couponCode, customerId, totalRent);
      discount = couponResult.discount;
      couponUsed = { id: couponResult.coupon.id };
    }

    const gstAmount = 0;
    const finalPayable = Math.max(
      0,
      totalRent + totalDeposit + totalDeliveryCharge + totalAlterationCharge - discount
    );

    const itemBreakdowns = validatedItems.map(item => {
      const rentalDays = Math.max(1, Math.floor((item.returnDueDate.getTime() - item.rentalStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const perDayRent = item.quantity > 0 ? Math.round(item.rentPrice / item.quantity / rentalDays) : 0;
      return {
        productId: item.productId.toString(),
        variantId: item.variantId.toString(),
        rentalDays,
        perDayRent,
        quantity: item.quantity,
        rentPrice: item.rentPrice,
        deposit: item.deposit,
        alterationRequired: item.alterationRequired,
        alterationCharge: item.alterationCharge
      };
    });

    const pricingBreakdown = {
      rentalAmount: totalRent,
      securityDepositAmount: totalDeposit,
      alterationChargeAmount: totalAlterationCharge,
      deliveryCharge: totalDeliveryCharge,
      gstAmount,
      discountAmount: discount,
      finalPayable,
      itemBreakdowns
    };

      const result = await prisma.$transaction(async (tx) => {
      const order = await createOrderWithReadableOrderNo(tx, {
        customerId: customerIdBig,
        finalPayable,
        paymentStatus: PaymentStatus.UNPAID,
        couponId: couponUsed?.id
      });

      await Promise.all(
        validatedItems.map((item) =>
          tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              variantId: item.variantId,
              vendorId: item.vendorId,
              quantity: item.quantity,
              rentPrice: item.rentPrice,
              deposit: item.deposit,
              alterationRequired: item.alterationRequired,
              alterationCharge: item.alterationCharge,
              fulfillmentType: item.fulfillmentType,
              rentalStartDate: item.rentalStartDate,
              returnDueDate: item.returnDueDate,
              status: 'PLACED'
            } as any
          })
        )
      );

      return order;
    });

    return {
      ...result,
      pricingBreakdown
    };
  },

  async rollbackUnpaidOrder(orderId: string, customerId?: string) {
    if (!orderId) throw new ValidationError('Order ID is required');
    const orderIdBig = BigInt(orderId);
    const customerIdBig =
      customerId !== undefined && customerId !== null && String(customerId).trim() !== ''
        ? BigInt(String(customerId))
        : undefined;

    await rollbackUnpaidOrderRecord(orderIdBig, customerIdBig);

    return { success: true };
  },

  async confirmOrderPayment(customerId: string, orderId: string, paymentDetails?: unknown) {
    if (!customerId) throw new ValidationError('Customer ID is required');
    if (!orderId) throw new ValidationError('Order ID is required');

    const order = await prisma.order.findFirst({
      where: { id: BigInt(orderId), customerId: BigInt(customerId) },
      include: { items: true }
    });

    if (!order) {
      throw new ValidationError('Order not found');
    }

    if (order.paymentStatus === 'PAID') {
      return order;
    }

    for (const item of order.items) {
      const rentalWindow = resolvePersistedOrderItemWindow(order.createdAt, item);
      await RentalAvailabilityService.assertRangeAvailableForOrder(
        item.vendorId,
        item.productId,
        rentalWindow.rentalStartDate,
        rentalWindow.returnDueDate,
        item.quantity,
        item.variantId,
        {
          includePendingHolds: true,
          excludeOrderId: order.id,
          pendingHoldBefore: {
            createdAt: order.createdAt,
            orderId: order.id
          }
        }
      );
    }

    const amount = Number(order.finalPayable);
    const paymentResult = await PaymentService.capturePayment({
      amount,
      customerId,
      paymentDetails,
      orderId: order.id.toString()
    });

    if (paymentResult.status !== 'CAPTURED') {
      throw new BusinessLogicError('Payment failed');
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'PAID' }
      });
      await markOrderItemsBooked(tx, order.id);
    });

    const updatedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true }
    });

    if (updatedOrder.couponId) {
      await CouponService.applyCoupon(updatedOrder.couponId.toString(), customerId, updatedOrder.id.toString(), 0);
    }

    const vendorIds = Array.from(new Set(updatedOrder.items.map((item) => item.vendorId.toString())));
    for (const vendorId of vendorIds) {
      await NotificationService.notifyVendorNewOrder(vendorId, updatedOrder.id.toString());
    }
    await NotificationService.notifyCustomerOrderPlaced(customerId, updatedOrder.id.toString()).catch(() => null);
    emitAdminOrderRealtimeUpdate(
      {
        orderId: updatedOrder.id,
        customerId
      },
      'ORDER_CONFIRMED'
    );

    return updatedOrder;
  },

  async handleVendorResponse(vendorId: string, orderItemId: string, action: 'ACCEPT' | 'REJECT') {
    const vendorProfileId = await resolveVendorProfileId(vendorId);

    const orderItem = await prisma.orderItem.findFirst({
      where: {
        id: BigInt(orderItemId),
        vendorId: vendorProfileId,
        status: { in: [OrderItemStatus.PLACED, OrderItemStatus.BOOKED] }
      },
      include: { order: true }
    });

    if (!orderItem) {
      throw new ValidationError('Order item not found or already processed');
    }

    if (action === 'ACCEPT') {
      await prisma.orderItem.update({
        where: { id: BigInt(orderItemId) },
        data: { status: OrderItemStatus.BOOKED }
      });

      await NotificationService.notifyCustomerOrderAccepted(orderItem.order.customerId.toString(), orderItemId);
      emitAdminOrderRealtimeUpdate(
        {
          orderId: orderItem.orderId,
          orderItemId
        },
        'ORDER_ACCEPTED'
      );
      return { message: 'Order booked successfully' };
    }

    return processOrderRejection(orderItem);
  },

  async getVendorOrders(vendorId: string, filters: PaginationFilters) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: {
      vendorId: bigint;
      status?: OrderItemStatus | { in: OrderItemStatus[] };
      order?: { paymentStatus: { in: PaymentStatus[] } };
    } = {
      vendorId: vendorProfileId,
      order: {
        paymentStatus: {
          in: VISIBLE_ORDER_PAYMENT_STATUSES
        }
      }
    };
    if (filters.status) {
      const statusFilter = expandOrderItemStatusFilter(filters.status);
      if (!statusFilter) {
        throw new ValidationError('Invalid status filter');
      }
      where.status = { in: statusFilter };
    }

    let orders: any[] = [];
    try {
      orders = await prisma.orderItem.findMany({
        where,
        include: {
          order: {
            include: {
              customer: {
                include: {
                  addresses: {
                    orderBy: { id: 'desc' },
                    take: 1
                  }
                }
              },
              Coupon: true,
              items: {
                select: {
                  id: true,
                  rentPrice: true,
                  deposit: true,
                  alterationCharge: true,
                  status: true
                }
              }
            }
          },
          product: {
            include: {
              images: true,
              category: true
            }
          },
          variant: true,
          vendorProfile: {
            select: {
              id: true,
              shopName: true,
              ownerName: true,
              address: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { id: 'desc' }
      });
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;

      orders = await prisma.orderItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          orderId: true,
          productId: true,
          variantId: true,
          vendorId: true,
          quantity: true,
          rentPrice: true,
          deposit: true,
          status: true,
          order: {
            select: {
              id: true,
              orderNo: true,
              customerId: true,
              paymentStatus: true,
              finalPayable: true,
              couponId: true,
              createdAt: true,
              Coupon: {
                select: {
                  id: true,
                  code: true,
                  discountType: true,
                  discountValue: true
                }
              },
              items: {
                select: {
                  id: true,
                  rentPrice: true,
                  deposit: true,
                  alterationCharge: true,
                  status: true
                }
              },
              customer: {
                select: {
                  id: true,
                  publicCode: true,
                  name: true,
                  email: true,
                  phone: true
                } as any
              }
            }
          },
          product: {
            select: {
              id: true,
              name: true,
              description: true,
              rentalPrice: true,
              securityDeposit: true,
              status: true,
              images: {
                select: {
                  id: true,
                  imageUrl: true,
                  isCover: true
                }
              },
              category: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          variant: {
            select: {
              id: true,
              size: true,
              sku: true,
              quantity: true
            }
          },
          vendorProfile: {
            select: {
              id: true,
              shopName: true,
              ownerName: true,
              address: true
            }
          }
        }
      });
    }

    const ordersWithAccessibleImages = await Promise.all(orders.map(withAccessibleOrderImages));
    const ordersWithPaymentBreakdown = ordersWithAccessibleImages.map((orderItem: any) => ({
      ...orderItem,
      order: orderItem?.order
        ? {
            ...orderItem.order,
            customer: withCustomerPublicCode(orderItem.order.customer),
            pricingBreakdown: buildOrderPricingBreakdown(orderItem.order)
          }
        : orderItem?.order,
      paymentBreakdown: buildPaymentBreakdown(orderItem)
    }));
    const total = await prisma.orderItem.count({ where });
    return { orders: ordersWithPaymentBreakdown, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },

  async getCustomerOrders(customerId: string, filters: PaginationFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const orders = await prisma.order.findMany({
      where: {
        customerId: BigInt(customerId),
        paymentStatus: { in: VISIBLE_ORDER_PAYMENT_STATUSES }
      },
      include: {
        Coupon: true,
        payments: {
          select: { refundedAmount: true }
        },
        items: {
          include: {
            product: {
              include: {
                images: {
                  select: {
                    id: true,
                    imageUrl: true,
                    isCover: true
                  }
                }
              }
            },
            variant: true,
            vendorProfile: { include: { user: true } },
            reviews: {
              where: { customerId: BigInt(customerId) },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                rating: true,
                comment: true,
                images: true,
                status: true,
                moderationReason: true,
                moderatedAt: true,
                createdAt: true,
                updatedAt: true
              }
            }
          }
        }
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const ordersWithAccessibleImages = await Promise.all(
      orders.map(async (order: any) => ({
        ...order,
        pricingBreakdown: buildOrderPricingBreakdown(order),
        refundAmount: (order.payments || []).reduce(
          (sum: number, payment: any) => sum + toSafeNumber(payment.refundedAmount),
          0
        ),
        items: await Promise.all(
          (order?.items || []).map(async (item: any) => {
            const accessibleItem = await withAccessibleOrderImages(item);
            const customerReview = Array.isArray(accessibleItem?.reviews)
              ? accessibleItem.reviews[0] || null
              : null;
            return {
              ...accessibleItem,
              reviews: undefined,
              customerReview,
              reviewEligibility: getCustomerReviewEligibility(
                accessibleItem?.status
              ),
              vendorProfile: accessibleItem?.vendorProfile
                ? {
                    ...accessibleItem.vendorProfile,
                    user: withVendorUserPublicCode(accessibleItem?.vendorProfile?.user)
                  }
                : accessibleItem?.vendorProfile
            };
          })
        )
      }))
    );

    const total = await prisma.order.count({
      where: {
        customerId: BigInt(customerId),
        paymentStatus: { in: VISIBLE_ORDER_PAYMENT_STATUSES }
      }
    });
    return { orders: ordersWithAccessibleImages, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },

  async cancelCustomerOrder(customerId: string, orderId: string, _reason: string) {
    const cancellableStatuses: OrderItemStatus[] = [
      'PLACED',
      'BOOKED',
      'RENTAL_CONFIRMED',
      'ACCEPTED',
      'READY_FOR_PICKUP'
    ];
    const order = await prisma.order.findFirst({
      where: {
        id: BigInt(orderId),
        customerId: BigInt(customerId),
        paymentStatus: 'PAID'
      },
      include: { Coupon: true, items: { include: { product: { select: { name: true } } } } }
    });

    if (!order) throw new ValidationError('Order not found or payment not completed');
    const activeItems = order.items.filter(
      (item) => !['CANCELLED', 'REJECTED', 'COMPLETED'].includes(item.status)
    );
    if (activeItems.length === 0) {
      throw new BusinessLogicError('This order is already cancelled or closed');
    }
    if (activeItems.some((item) => !cancellableStatuses.includes(item.status))) {
      throw new BusinessLogicError('This order cannot be cancelled after pickup has started');
    }
    const cancellableItems = activeItems;

    const now = new Date();
    const refundBreakdown = cancellableItems.map((item: any) => {
      const rentalWindow = resolvePersistedOrderItemWindow(order.createdAt, item);
      const pickupDistanceInDays = Math.floor(
        (rentalWindow.rentalStartDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      const bookingAgeInHours = (now.getTime() - order.createdAt.getTime()) / (60 * 60 * 1000);
      const rentalRefundPercent = bookingAgeInHours <= 24
        ? 100
        : pickupDistanceInDays >= 7
          ? 80
          : pickupDistanceInDays >= 3
            ? 50
            : 0;
      const rentalAmount = roundMoney(toSafeNumber(item.rentPrice));
      const rentalDiscountAmount = getOrderItemDiscountAllocation({ ...item, order });
      const paidRentalAmount = roundMoney(Math.max(0, rentalAmount - rentalDiscountAmount));
      const rentalRefundAmount = roundMoney(paidRentalAmount * rentalRefundPercent / 100);
      const securityDepositAmount = roundMoney(toSafeNumber(item.deposit));

      return {
        orderItemId: item.id.toString(),
        productName: item.product?.name || 'Rental item',
        pickupDate: rentalWindow.rentalStartDate.toISOString(),
        rentalAmount,
        rentalDiscountAmount,
        paidRentalAmount,
        rentalRefundPercent,
        rentalRefundAmount,
        securityDepositAmount,
        totalRefundAmount: roundMoney(rentalRefundAmount + securityDepositAmount)
      };
    });
    const totalRefundAmount = roundMoney(
      refundBreakdown.reduce((sum, item) => sum + item.totalRefundAmount, 0)
    );

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { orderId: order.id, status: { in: cancellableStatuses } },
        data: { status: 'CANCELLED' }
      });
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'REFUND_PENDING' }
      });
    });

    await NotificationService.notifyCustomerOrderRejected(customerId, order.id.toString()).catch(() => null);
    return {
      order: {
        id: order.id.toString(),
        orderNo: order.orderNo,
        paymentStatus: 'REFUND_PENDING',
        items: cancellableItems.map((item) => ({ id: item.id.toString(), status: 'CANCELLED' }))
      },
      refundBreakdown,
      totalRefundAmount,
      paymentRefunds: [],
      refundWindow: '7-10 working days'
    };
  },

  async updateOrderStatus(vendorId: string, orderItemId: string, status: string) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const targetStatus = parseVendorLifecycleTargetStatus(status);

    const orderItem = await prisma.orderItem.findFirst({
      where: {
        id: BigInt(orderItemId),
        vendorId: vendorProfileId
      },
      select: {
        id: true,
        status: true,
        fulfillmentType: true,
        order: {
          select: {
            customerId: true
          }
        }
      }
    });

    if (!orderItem) {
      throw new ValidationError('Order item not found');
    }

    const fulfillmentType = orderItem.fulfillmentType || FulfillmentType.SELF_PICKUP;
    const allowedPrevious = ORDER_STATUS_TRANSITIONS[targetStatus] || [];

    if (allowedPrevious.length === 0) {
      throw new ValidationError(`Status transition ${targetStatus} is not allowed`);
    }

    if (!allowedPrevious.includes(orderItem.status)) {
      throw new ValidationError('Order item not found for this status transition');
    }

    await prisma.orderItem.update({
      where: { id: orderItem.id },
      data: { status: targetStatus }
    });

    await NotificationService.notifyCustomerOrderStatusUpdate(
      orderItem.order.customerId.toString(),
      orderItem.id.toString(),
      targetStatus
    ).catch(() => null);

    emitAdminOrderRealtimeUpdate(
      {
        orderItemId: orderItem.id,
        customerId: orderItem.order.customerId,
        status: targetStatus
      },
      'ORDER_STATUS_UPDATED'
    );

    return { message: 'Status updated successfully', status: targetStatus, fulfillmentType };
  },

  async submitCustomerReview(customerId: string, payload: SubmitReviewData) {
    if (!customerId) {
      throw new ValidationError('Customer ID is required');
    }

    const rating = Number(payload?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ValidationError('Rating must be an integer between 1 and 5');
    }

    const normalizedComment = String(payload?.comment || '').trim();
    const commentWords = normalizedComment ? normalizedComment.split(/\s+/).length : 0;
    if (commentWords > 50) {
      throw new ValidationError('Comment must be at most 50 words');
    }

    let orderItemIdBigInt: bigint | null = null;
    if (payload?.orderItemId !== undefined && payload?.orderItemId !== null && String(payload.orderItemId).trim() !== '') {
      try {
        orderItemIdBigInt = BigInt(payload.orderItemId);
      } catch {
        throw new ValidationError('Invalid orderItemId');
      }
    }

    let productIdBigInt: bigint | null = null;
    if (payload?.productId !== undefined && payload?.productId !== null && String(payload.productId).trim() !== '') {
      try {
        productIdBigInt = BigInt(payload.productId);
      } catch {
        throw new ValidationError('Invalid productId');
      }
    }

    if (!orderItemIdBigInt) {
      throw new ValidationError(
        'Please submit your product review from order history after the item is returned.'
      );
    }

    let targetOrderItem = null as null | { id: bigint; productId: bigint; vendorId: bigint; status: string };

    targetOrderItem = await prisma.orderItem.findFirst({
      where: {
        id: orderItemIdBigInt,
        order: { customerId: BigInt(customerId) }
      },
      select: {
        id: true,
        productId: true,
        vendorId: true,
        status: true
      }
    });

    const reviewModel = (prisma as any).review;
    const canCreateReview = Boolean(reviewModel?.create);
    const canFindReview = Boolean(reviewModel?.findFirst);
    const canUpdateReview = Boolean(reviewModel?.update);
    const reviewPayload = {
      customerId: BigInt(customerId),
      rating,
      comment: normalizedComment,
      images: Array.isArray(payload?.images) ? payload.images : [],
      status: 'APPROVED' as const
    };

    const createReviewWithFallback = async (
      vendorId: bigint,
      productId: bigint,
      orderItemId: bigint | null
    ) => {
      if (canCreateReview) {
        return reviewModel.create({
          data: {
            ...reviewPayload,
            vendorId,
            productId,
            orderItemId
          }
        });
      }

      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `INSERT INTO "Review"
            ("customerId", "vendorId", "productId", "orderItemId", "rating", "comment", "images", "status", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING "id", "customerId", "vendorId", "productId", "orderItemId", "rating", "comment", "images", "status", "createdAt", "updatedAt"`,
          reviewPayload.customerId.toString(),
          vendorId.toString(),
          productId.toString(),
          orderItemId ? orderItemId.toString() : null,
          reviewPayload.rating,
          reviewPayload.comment,
          reviewPayload.images,
          reviewPayload.status
        );
        return rows?.[0] || null;
      } catch (error: any) {
        throw new BusinessLogicError(
          error?.message?.includes('relation "Review" does not exist')
            ? 'Review table does not exist. Run prisma migration and prisma generate.'
            : 'Failed to submit review'
        );
      }
    };

    const findExistingReviewByOrderItem = async (orderItemId: bigint) => {
      if (canFindReview) {
        return reviewModel.findFirst({
          where: {
            customerId: BigInt(customerId),
            orderItemId
          },
          select: { id: true, status: true }
        });
      }

      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "status" FROM "Review" WHERE "customerId" = $1 AND "orderItemId" = $2 LIMIT 1`,
        BigInt(customerId).toString(),
        orderItemId.toString()
      );
      return rows?.[0] || null;
    };

    const parseExistingReviewId = (row: any): bigint => {
      try {
        const raw = row?.id;
        return typeof raw === 'bigint' ? raw : BigInt(String(raw));
      } catch {
        throw new BusinessLogicError('Failed to resolve existing review id');
      }
    };

    const updateExistingReview = async (row: any) => {
      const reviewId = parseExistingReviewId(row);
      const currentStatus = String(row?.status || '').toUpperCase();

      if (canUpdateReview) {
        return reviewModel.update({
          where: { id: reviewId },
          data: {
            rating: reviewPayload.rating,
            comment: reviewPayload.comment,
            images: reviewPayload.images,
            status: currentStatus === 'REJECTED' ? 'PENDING' : row?.status,
            moderationReason: currentStatus === 'REJECTED' ? null : undefined,
            moderatedAt: currentStatus === 'REJECTED' ? null : undefined
          }
        });
      }

      const nextStatus = currentStatus === 'REJECTED' ? 'PENDING' : String(row?.status || 'APPROVED');
      await prisma.$executeRawUnsafe(
        `UPDATE "Review"
         SET "rating" = $1,
             "comment" = $2,
             "images" = $3,
             "status" = $4,
             "moderationReason" = CASE WHEN $4 = 'PENDING' THEN NULL ELSE "moderationReason" END,
             "moderatedAt" = CASE WHEN $4 = 'PENDING' THEN NULL ELSE "moderatedAt" END,
             "updatedAt" = NOW()
         WHERE "id" = $5`,
        reviewPayload.rating,
        reviewPayload.comment,
        reviewPayload.images,
        nextStatus,
        reviewId.toString()
      );

      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
           "id", "customerId", "vendorId", "productId", "orderItemId",
           "rating", "comment", "images", "status", "createdAt", "updatedAt"
         FROM "Review" WHERE "id" = $1 LIMIT 1`,
        reviewId.toString()
      );
      return rows?.[0] || null;
    };

    const resubmitRejectedReview = async (row: any) => {
      const reviewId = parseExistingReviewId(row);
      const nextStatus = 'PENDING';

      if (canUpdateReview) {
        return reviewModel.update({
          where: { id: reviewId },
          data: {
            rating: reviewPayload.rating,
            comment: reviewPayload.comment,
            images: reviewPayload.images,
            status: nextStatus,
            moderationReason: null,
            moderatedAt: null
          }
        });
      }

      await prisma.$executeRawUnsafe(
        `UPDATE "Review"
         SET "rating" = $1,
             "comment" = $2,
             "images" = $3,
             "status" = $4,
             "moderationReason" = NULL,
             "moderatedAt" = NULL,
             "updatedAt" = NOW()
         WHERE "id" = $5`,
        reviewPayload.rating,
        reviewPayload.comment,
        reviewPayload.images,
        nextStatus,
        reviewId.toString()
      );

      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
           "id", "customerId", "vendorId", "productId", "orderItemId",
           "rating", "comment", "images", "status", "createdAt", "updatedAt"
         FROM "Review" WHERE "id" = $1 LIMIT 1`,
        reviewId.toString()
      );
      return rows?.[0] || null;
    };
    if (targetOrderItem) {
      const reviewEligibility = getCustomerReviewEligibility(
        targetOrderItem.status
      );
      if (!reviewEligibility.eligible) {
        throw new ValidationError(reviewEligibility.reason);
      }

      if (
        productIdBigInt &&
        targetOrderItem.productId.toString() !== productIdBigInt.toString()
      ) {
        throw new ValidationError(
          'Selected product does not match the reviewed order item'
        );
      }

      const alreadyReviewed = await findExistingReviewByOrderItem(targetOrderItem.id);

      if (alreadyReviewed) {
        if (String(alreadyReviewed?.status).toUpperCase() === 'REJECTED') {
          return resubmitRejectedReview(alreadyReviewed);
        }
        return updateExistingReview(alreadyReviewed);
      }

      return createReviewWithFallback(
        targetOrderItem.vendorId,
        targetOrderItem.productId,
        targetOrderItem.id
      );
    }

    throw new ValidationError('Order item not found for this review');
  }
};

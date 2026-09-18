import { OrderItemStatus } from '@prisma/client';
import { normalizeOrderItemStatus } from '../constants/orderStatus';

export type CustomerReviewEligibility = {
  eligible: boolean;
  state: 'OPEN' | 'NOT_READY' | 'CLOSED' | 'INELIGIBLE';
  status: OrderItemStatus | null;
  reason: string;
};

const REVIEW_OPEN_STATUSES = new Set<OrderItemStatus>([
  OrderItemStatus.RETURNED,
  OrderItemStatus.LATE_RETURN,
  OrderItemStatus.DAMAGE_REVIEW
]);

const REVIEW_CLOSED_STATUSES = new Set<OrderItemStatus>([
  OrderItemStatus.SECURITY_DEPOSIT_REFUNDED
]);

export const getCustomerReviewEligibility = (
  statusInput?: string | null
): CustomerReviewEligibility => {
  const normalizedStatus = normalizeOrderItemStatus(statusInput);

  if (!normalizedStatus) {
    return {
      eligible: false,
      state: 'INELIGIBLE',
      status: null,
      reason: 'Review is unavailable for this order item.'
    };
  }

  if (
    normalizedStatus === OrderItemStatus.CANCELLED ||
    normalizedStatus === OrderItemStatus.REJECTED
  ) {
    return {
      eligible: false,
      state: 'INELIGIBLE',
      status: normalizedStatus,
      reason: 'Review is unavailable for cancelled or rejected orders.'
    };
  }

  if (REVIEW_OPEN_STATUSES.has(normalizedStatus)) {
    return {
      eligible: true,
      state: 'OPEN',
      status: normalizedStatus,
      reason:
        'You can review this product now because the item has been returned and the security deposit refund is still pending.'
    };
  }

  if (REVIEW_CLOSED_STATUSES.has(normalizedStatus)) {
    return {
      eligible: false,
      state: 'CLOSED',
      status: normalizedStatus,
      reason:
        'Review window has closed because the security deposit refund has already been processed.'
    };
  }

  return {
    eligible: false,
    state: 'NOT_READY',
    status: normalizedStatus,
    reason:
      'Review can be submitted only after the product is returned and before the security deposit refund is processed.'
  };
};

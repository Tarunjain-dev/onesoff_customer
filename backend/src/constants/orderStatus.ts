import { OrderItemStatus } from '@prisma/client';

const ORDER_ITEM_STATUS_VALUES = new Set<string>(Object.values(OrderItemStatus));

const ORDER_STATUS_ALIAS_TO_CANONICAL: Record<string, OrderItemStatus> = {
  ACCEPTED: OrderItemStatus.RENTAL_CONFIRMED,
  DISPATCHED: OrderItemStatus.OUT_FOR_DELIVERY,
  RETURN_REQUESTED: OrderItemStatus.RETURN_SCHEDULED,
  RETURN_RECEIVED: OrderItemStatus.RETURNED,
  INSPECTED_GOOD: OrderItemStatus.SECURITY_DEPOSIT_REFUNDED,
  INSPECTED_DAMAGED: OrderItemStatus.DAMAGE_REVIEW,
  INSPECTED_LOST: OrderItemStatus.DAMAGE_REVIEW,
  COMPLETED: OrderItemStatus.SECURITY_DEPOSIT_REFUNDED
};

const ORDER_STATUS_GROUPS: Partial<Record<OrderItemStatus, OrderItemStatus[]>> = {
  [OrderItemStatus.BOOKED]: [
    OrderItemStatus.BOOKED,
    OrderItemStatus.PLACED,
    OrderItemStatus.RENTAL_CONFIRMED,
    OrderItemStatus.ACCEPTED
  ],
  [OrderItemStatus.RENTAL_CONFIRMED]: [
    OrderItemStatus.RENTAL_CONFIRMED,
    OrderItemStatus.ACCEPTED
  ],
  [OrderItemStatus.OUT_FOR_DELIVERY]: [
    OrderItemStatus.OUT_FOR_DELIVERY,
    OrderItemStatus.DISPATCHED
  ],
  [OrderItemStatus.RETURN_SCHEDULED]: [
    OrderItemStatus.RETURN_SCHEDULED,
    OrderItemStatus.RETURN_REQUESTED
  ],
  [OrderItemStatus.RETURNED]: [
    OrderItemStatus.RETURNED,
    OrderItemStatus.RETURN_RECEIVED
  ],
  [OrderItemStatus.DAMAGE_REVIEW]: [
    OrderItemStatus.DAMAGE_REVIEW,
    OrderItemStatus.INSPECTED_DAMAGED,
    OrderItemStatus.INSPECTED_LOST
  ],
  [OrderItemStatus.SECURITY_DEPOSIT_REFUNDED]: [
    OrderItemStatus.SECURITY_DEPOSIT_REFUNDED,
    OrderItemStatus.INSPECTED_GOOD,
    OrderItemStatus.COMPLETED
  ]
};

export const normalizeOrderItemStatus = (statusInput?: string | null): OrderItemStatus | null => {
  const normalized = String(statusInput || '').trim().toUpperCase();
  if (!normalized) return null;

  if (ORDER_STATUS_ALIAS_TO_CANONICAL[normalized]) {
    return ORDER_STATUS_ALIAS_TO_CANONICAL[normalized];
  }

  if (!ORDER_ITEM_STATUS_VALUES.has(normalized)) {
    return null;
  }

  return normalized as OrderItemStatus;
};

export const expandOrderItemStatusFilter = (statusInput?: string | null): OrderItemStatus[] | null => {
  const normalized = normalizeOrderItemStatus(statusInput);
  if (!normalized) return null;
  return ORDER_STATUS_GROUPS[normalized] || [normalized];
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandOrderItemStatusFilter = exports.normalizeOrderItemStatus = void 0;
const client_1 = require("@prisma/client");
const ORDER_ITEM_STATUS_VALUES = new Set(Object.values(client_1.OrderItemStatus));
const ORDER_STATUS_ALIAS_TO_CANONICAL = {
    ACCEPTED: client_1.OrderItemStatus.RENTAL_CONFIRMED,
    DISPATCHED: client_1.OrderItemStatus.OUT_FOR_DELIVERY,
    RETURN_REQUESTED: client_1.OrderItemStatus.RETURN_SCHEDULED,
    RETURN_RECEIVED: client_1.OrderItemStatus.RETURNED,
    INSPECTED_GOOD: client_1.OrderItemStatus.SECURITY_DEPOSIT_REFUNDED,
    INSPECTED_DAMAGED: client_1.OrderItemStatus.DAMAGE_REVIEW,
    INSPECTED_LOST: client_1.OrderItemStatus.DAMAGE_REVIEW,
    COMPLETED: client_1.OrderItemStatus.SECURITY_DEPOSIT_REFUNDED
};
const ORDER_STATUS_GROUPS = {
    [client_1.OrderItemStatus.BOOKED]: [
        client_1.OrderItemStatus.BOOKED,
        client_1.OrderItemStatus.PLACED,
        client_1.OrderItemStatus.RENTAL_CONFIRMED,
        client_1.OrderItemStatus.ACCEPTED
    ],
    [client_1.OrderItemStatus.RENTAL_CONFIRMED]: [
        client_1.OrderItemStatus.RENTAL_CONFIRMED,
        client_1.OrderItemStatus.ACCEPTED
    ],
    [client_1.OrderItemStatus.OUT_FOR_DELIVERY]: [
        client_1.OrderItemStatus.OUT_FOR_DELIVERY,
        client_1.OrderItemStatus.DISPATCHED
    ],
    [client_1.OrderItemStatus.RETURN_SCHEDULED]: [
        client_1.OrderItemStatus.RETURN_SCHEDULED,
        client_1.OrderItemStatus.RETURN_REQUESTED
    ],
    [client_1.OrderItemStatus.RETURNED]: [
        client_1.OrderItemStatus.RETURNED,
        client_1.OrderItemStatus.RETURN_RECEIVED
    ],
    [client_1.OrderItemStatus.DAMAGE_REVIEW]: [
        client_1.OrderItemStatus.DAMAGE_REVIEW,
        client_1.OrderItemStatus.INSPECTED_DAMAGED,
        client_1.OrderItemStatus.INSPECTED_LOST
    ],
    [client_1.OrderItemStatus.SECURITY_DEPOSIT_REFUNDED]: [
        client_1.OrderItemStatus.SECURITY_DEPOSIT_REFUNDED,
        client_1.OrderItemStatus.INSPECTED_GOOD,
        client_1.OrderItemStatus.COMPLETED
    ]
};
const normalizeOrderItemStatus = (statusInput) => {
    const normalized = String(statusInput || '').trim().toUpperCase();
    if (!normalized)
        return null;
    if (ORDER_STATUS_ALIAS_TO_CANONICAL[normalized]) {
        return ORDER_STATUS_ALIAS_TO_CANONICAL[normalized];
    }
    if (!ORDER_ITEM_STATUS_VALUES.has(normalized)) {
        return null;
    }
    return normalized;
};
exports.normalizeOrderItemStatus = normalizeOrderItemStatus;
const expandOrderItemStatusFilter = (statusInput) => {
    const normalized = (0, exports.normalizeOrderItemStatus)(statusInput);
    if (!normalized)
        return null;
    return ORDER_STATUS_GROUPS[normalized] || [normalized];
};
exports.expandOrderItemStatusFilter = expandOrderItemStatusFilter;

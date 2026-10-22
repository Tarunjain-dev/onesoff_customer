"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomerReviewEligibility = void 0;
const client_1 = require("@prisma/client");
const orderStatus_1 = require("../constants/orderStatus");
const REVIEW_OPEN_STATUSES = new Set([
    client_1.OrderItemStatus.RETURNED,
    client_1.OrderItemStatus.LATE_RETURN,
    client_1.OrderItemStatus.DAMAGE_REVIEW
]);
const REVIEW_CLOSED_STATUSES = new Set([
    client_1.OrderItemStatus.SECURITY_DEPOSIT_REFUNDED
]);
const getCustomerReviewEligibility = (statusInput) => {
    const normalizedStatus = (0, orderStatus_1.normalizeOrderItemStatus)(statusInput);
    if (!normalizedStatus) {
        return {
            eligible: false,
            state: 'INELIGIBLE',
            status: null,
            reason: 'Review is unavailable for this order item.'
        };
    }
    if (normalizedStatus === client_1.OrderItemStatus.CANCELLED ||
        normalizedStatus === client_1.OrderItemStatus.REJECTED) {
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
            reason: 'You can review this product now because the item has been returned and the security deposit refund is still pending.'
        };
    }
    if (REVIEW_CLOSED_STATUSES.has(normalizedStatus)) {
        return {
            eligible: false,
            state: 'CLOSED',
            status: normalizedStatus,
            reason: 'Review window has closed because the security deposit refund has already been processed.'
        };
    }
    return {
        eligible: false,
        state: 'NOT_READY',
        status: normalizedStatus,
        reason: 'Review can be submitted only after the product is returned and before the security deposit refund is processed.'
    };
};
exports.getCustomerReviewEligibility = getCustomerReviewEligibility;

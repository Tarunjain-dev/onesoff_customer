"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerReviewService = void 0;
const db_1 = __importDefault(require("../config/db"));
const errors_1 = require("../utils/errors");
const customerReviewEligibility_1 = require("../utils/customerReviewEligibility");
const parseBigInt = (raw, fieldName) => {
    try {
        return BigInt(String(raw));
    }
    catch {
        throw new errors_1.ValidationError(`Invalid ${fieldName}`);
    }
};
exports.CustomerReviewService = {
    async getMyReview(customerId, query) {
        const customerIdBig = parseBigInt(customerId, 'customerId');
        const productId = query.productId ? parseBigInt(query.productId, 'productId') : null;
        const orderItemId = query.orderItemId ? parseBigInt(query.orderItemId, 'orderItemId') : null;
        if (!productId && !orderItemId) {
            throw new errors_1.ValidationError('Provide productId or orderItemId');
        }
        const where = { customerId: customerIdBig };
        if (productId)
            where.productId = productId;
        if (orderItemId)
            where.orderItemId = orderItemId;
        const reviewModel = db_1.default.review;
        const review = reviewModel?.findFirst
            ? await reviewModel.findFirst({
                where,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    images: true,
                    status: true,
                    moderationReason: true,
                    moderatedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    productId: true,
                    orderItemId: true,
                    vendorId: true
                }
            })
            : null;
        return { review };
    },
    async updateMyReview(customerId, reviewId, payload) {
        const customerIdBig = parseBigInt(customerId, 'customerId');
        const reviewIdBig = parseBigInt(reviewId, 'reviewId');
        const rating = payload.rating !== undefined ? Number(payload.rating) : undefined;
        if (rating !== undefined && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
            throw new errors_1.ValidationError('Invalid rating');
        }
        const comment = payload.comment !== undefined ? String(payload.comment || '').trim() : undefined;
        if (comment !== undefined && comment.length < 1) {
            throw new errors_1.ValidationError('Comment is required');
        }
        const images = Array.isArray(payload.images) ? payload.images : undefined;
        const reviewModel = db_1.default.review;
        const existing = reviewModel?.findUnique
            ? await reviewModel.findUnique({ where: { id: reviewIdBig } })
            : null;
        if (!existing) {
            throw new errors_1.NotFoundError('Review not found');
        }
        if (existing.customerId !== customerIdBig) {
            throw new errors_1.ValidationError('You can only edit your own review');
        }
        if (!existing.orderItemId) {
            throw new errors_1.ValidationError('Only order-based product reviews can be edited from this flow');
        }
        const orderItem = await db_1.default.orderItem.findUnique({
            where: { id: existing.orderItemId },
            select: { status: true }
        });
        const reviewEligibility = (0, customerReviewEligibility_1.getCustomerReviewEligibility)(orderItem?.status);
        if (!reviewEligibility.eligible) {
            throw new errors_1.ValidationError(reviewEligibility.reason);
        }
        const currentStatus = String(existing.status || '').toUpperCase();
        const nextStatus = currentStatus === 'REJECTED' ? 'PENDING' : existing.status;
        if (reviewModel?.update) {
            return reviewModel.update({
                where: { id: reviewIdBig },
                data: {
                    ...(rating !== undefined ? { rating } : null),
                    ...(comment !== undefined ? { comment } : null),
                    ...(images !== undefined ? { images } : null),
                    status: nextStatus,
                    moderationReason: currentStatus === 'REJECTED' ? null : existing.moderationReason,
                    moderatedAt: currentStatus === 'REJECTED' ? null : existing.moderatedAt
                }
            });
        }
        throw new errors_1.ValidationError('Review update is not supported in this environment');
    }
};

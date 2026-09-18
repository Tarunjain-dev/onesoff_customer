import prisma from '../config/db';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getCustomerReviewEligibility } from '../utils/customerReviewEligibility';

const parseBigInt = (raw: any, fieldName: string) => {
  try {
    return BigInt(String(raw));
  } catch {
    throw new ValidationError(`Invalid ${fieldName}`);
  }
};

export const CustomerReviewService = {
  async getMyReview(customerId: string, query: { productId?: any; orderItemId?: any }) {
    const customerIdBig = parseBigInt(customerId, 'customerId');
    const productId = query.productId ? parseBigInt(query.productId, 'productId') : null;
    const orderItemId = query.orderItemId ? parseBigInt(query.orderItemId, 'orderItemId') : null;

    if (!productId && !orderItemId) {
      throw new ValidationError('Provide productId or orderItemId');
    }

    const where: any = { customerId: customerIdBig };
    if (productId) where.productId = productId;
    if (orderItemId) where.orderItemId = orderItemId;

    const reviewModel = (prisma as any).review;
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

  async updateMyReview(
    customerId: string,
    reviewId: string,
    payload: { rating?: any; comment?: any; images?: any }
  ) {
    const customerIdBig = parseBigInt(customerId, 'customerId');
    const reviewIdBig = parseBigInt(reviewId, 'reviewId');

    const rating = payload.rating !== undefined ? Number(payload.rating) : undefined;
    if (rating !== undefined && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
      throw new ValidationError('Invalid rating');
    }
    const comment =
      payload.comment !== undefined ? String(payload.comment || '').trim() : undefined;
    if (comment !== undefined && comment.length < 1) {
      throw new ValidationError('Comment is required');
    }
    const images = Array.isArray(payload.images) ? payload.images : undefined;

    const reviewModel = (prisma as any).review;
    const existing = reviewModel?.findUnique
      ? await reviewModel.findUnique({ where: { id: reviewIdBig } })
      : null;

    if (!existing) {
      throw new NotFoundError('Review not found');
    }
    if (existing.customerId !== customerIdBig) {
      throw new ValidationError('You can only edit your own review');
    }

    if (!existing.orderItemId) {
      throw new ValidationError(
        'Only order-based product reviews can be edited from this flow'
      );
    }

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: existing.orderItemId },
      select: { status: true }
    });

    const reviewEligibility = getCustomerReviewEligibility(orderItem?.status);
    if (!reviewEligibility.eligible) {
      throw new ValidationError(reviewEligibility.reason);
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

    throw new ValidationError('Review update is not supported in this environment');
  }
};


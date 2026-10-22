"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewModerationService = void 0;
const db_1 = __importDefault(require("../config/db"));
const errors_1 = require("../utils/errors");
const normalizeReviewStatus = (status) => {
    const normalized = String(status || '').trim().toUpperCase();
    if (!normalized || normalized === 'ALL')
        return undefined;
    if (normalized === 'PENDING' || normalized === 'APPROVED' || normalized === 'REJECTED') {
        return normalized;
    }
    throw new errors_1.ValidationError('Invalid review status filter');
};
const parseReviewId = (reviewId) => {
    try {
        return BigInt(reviewId);
    }
    catch {
        throw new errors_1.ValidationError('Invalid review id');
    }
};
const mapRawReviewRow = (row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    images: Array.isArray(row.images) ? row.images : [],
    status: row.status,
    moderationReason: row.moderationReason,
    moderatedAt: row.moderatedAt,
    createdAt: row.createdAt,
    customerId: row.customerId,
    vendorId: row.vendorId,
    productId: row.productId,
    orderItemId: row.orderItemId,
    customer: {
        id: row.customerId,
        name: row.customerName,
        email: row.customerEmail,
        phone: row.customerPhone
    },
    vendor: {
        id: row.vendorId,
        shopName: row.vendorShopName,
        ownerName: row.vendorOwnerName
    },
    product: {
        id: row.productId,
        name: row.productName
    },
    orderItem: row.orderItemId
        ? {
            id: row.orderItemId,
            orderId: row.orderId,
            status: row.orderItemStatus
        }
        : null
});
const selectRawReviewsBase = `
SELECT
  r."id" AS "id",
  r."rating" AS "rating",
  r."comment" AS "comment",
  r."images" AS "images",
  r."status" AS "status",
  r."moderationReason" AS "moderationReason",
  r."moderatedAt" AS "moderatedAt",
  r."createdAt" AS "createdAt",
  r."customerId" AS "customerId",
  r."vendorId" AS "vendorId",
  r."productId" AS "productId",
  r."orderItemId" AS "orderItemId",
  u."name" AS "customerName",
  u."email" AS "customerEmail",
  u."phone" AS "customerPhone",
  vp."shopName" AS "vendorShopName",
  vp."ownerName" AS "vendorOwnerName",
  p."name" AS "productName",
  oi."orderId" AS "orderId",
  oi."status" AS "orderItemStatus"
FROM "Review" r
LEFT JOIN "User" u ON u."id" = r."customerId"
LEFT JOIN "VendorProfile" vp ON vp."id" = r."vendorId"
LEFT JOIN "Product" p ON p."id" = r."productId"
LEFT JOIN "OrderItem" oi ON oi."id" = r."orderItemId"
`;
exports.ReviewModerationService = {
    async getReviews(status) {
        const normalizedStatus = normalizeReviewStatus(status);
        const reviewModel = db_1.default.review;
        if (reviewModel?.findMany) {
            return reviewModel.findMany({
                where: normalizedStatus ? { status: normalizedStatus } : undefined,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true
                        }
                    },
                    vendor: {
                        select: {
                            id: true,
                            shopName: true,
                            ownerName: true,
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    },
                    product: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    orderItem: {
                        select: {
                            id: true,
                            orderId: true,
                            status: true
                        }
                    }
                }
            });
        }
        try {
            const query = normalizedStatus
                ? `${selectRawReviewsBase} WHERE r."status" = $1 ORDER BY r."createdAt" DESC`
                : `${selectRawReviewsBase} ORDER BY r."createdAt" DESC`;
            const rows = normalizedStatus
                ? await db_1.default.$queryRawUnsafe(query, normalizedStatus)
                : await db_1.default.$queryRawUnsafe(query);
            return rows.map(mapRawReviewRow);
        }
        catch (error) {
            throw new errors_1.BusinessLogicError(error?.message?.includes('relation "Review" does not exist')
                ? 'Review table does not exist. Run prisma migration and prisma generate.'
                : 'Failed to fetch reviews');
        }
    },
    async moderateReview(reviewId, action, reason) {
        if (action !== 'APPROVE' && action !== 'REJECT') {
            throw new errors_1.ValidationError('Invalid moderation action');
        }
        const reviewIdBigInt = parseReviewId(reviewId);
        const reviewModel = db_1.default.review;
        const review = reviewModel?.findUnique
            ? await reviewModel.findUnique({ where: { id: reviewIdBigInt } })
            : (await db_1.default.$queryRawUnsafe(`SELECT "id", "status" FROM "Review" WHERE "id" = $1 LIMIT 1`, reviewIdBigInt.toString()))?.[0];
        if (!review) {
            throw new errors_1.NotFoundError('Review not found');
        }
        const currentStatus = String(review.status || '').toUpperCase();
        if (currentStatus !== 'PENDING' && currentStatus !== 'APPROVED' && currentStatus !== 'REJECTED') {
            throw new errors_1.ValidationError('Invalid review status');
        }
        if (action === 'APPROVE' && currentStatus === 'APPROVED') {
            throw new errors_1.ValidationError('Review is already approved');
        }
        if (action === 'REJECT' && currentStatus === 'REJECTED') {
            throw new errors_1.ValidationError('Review is already rejected');
        }
        const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        const trimmedReason = reason?.trim() || null;
        const moderationReason = action === 'REJECT' ? trimmedReason : null;
        if (reviewModel?.update) {
            return reviewModel.update({
                where: { id: reviewIdBigInt },
                data: {
                    status,
                    moderationReason,
                    moderatedAt: new Date()
                },
                include: {
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    vendor: {
                        select: {
                            id: true,
                            shopName: true
                        }
                    },
                    product: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
        }
        try {
            await db_1.default.$executeRawUnsafe(`UPDATE "Review"
         SET "status" = $1, "moderationReason" = $2, "moderatedAt" = NOW(), "updatedAt" = NOW()
         WHERE "id" = $3`, status, moderationReason, reviewIdBigInt.toString());
            const rows = await db_1.default.$queryRawUnsafe(`${selectRawReviewsBase} WHERE r."id" = $1 LIMIT 1`, reviewIdBigInt.toString());
            return rows[0] ? mapRawReviewRow(rows[0]) : null;
        }
        catch (error) {
            throw new errors_1.BusinessLogicError(error?.message?.includes('relation "Review" does not exist')
                ? 'Review table does not exist. Run prisma migration and prisma generate.'
                : 'Failed to moderate review');
        }
    },
    async deleteReview(reviewId) {
        const reviewIdBigInt = parseReviewId(reviewId);
        const reviewModel = db_1.default.review;
        const review = reviewModel?.findUnique
            ? await reviewModel.findUnique({ where: { id: reviewIdBigInt } })
            : (await db_1.default.$queryRawUnsafe(`SELECT "id" FROM "Review" WHERE "id" = $1 LIMIT 1`, reviewIdBigInt.toString()))?.[0];
        if (!review) {
            throw new errors_1.NotFoundError('Review not found');
        }
        if (reviewModel?.delete) {
            return reviewModel.delete({ where: { id: reviewIdBigInt } });
        }
        try {
            await db_1.default.$executeRawUnsafe(`DELETE FROM "Review" WHERE "id" = $1`, reviewIdBigInt.toString());
            return { id: reviewIdBigInt.toString() };
        }
        catch (error) {
            throw new errors_1.BusinessLogicError(error?.message?.includes('relation "Review" does not exist')
                ? 'Review table does not exist. Run prisma migration and prisma generate.'
                : 'Failed to delete review');
        }
    }
};

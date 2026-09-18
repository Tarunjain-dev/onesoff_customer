import prisma from '../config/db';
import { BusinessLogicError, NotFoundError, ValidationError } from '../utils/errors';

const normalizeReviewStatus = (status?: string) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (!normalized || normalized === 'ALL') return undefined;
  if (normalized === 'PENDING' || normalized === 'APPROVED' || normalized === 'REJECTED') {
    return normalized as 'PENDING' | 'APPROVED' | 'REJECTED';
  }
  throw new ValidationError('Invalid review status filter');
};

const parseReviewId = (reviewId: string) => {
  try {
    return BigInt(reviewId);
  } catch {
    throw new ValidationError('Invalid review id');
  }
};

const mapRawReviewRow = (row: any) => ({
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

export const ReviewModerationService = {
  async getReviews(status?: string) {
    const normalizedStatus = normalizeReviewStatus(status);
    const reviewModel = (prisma as any).review;
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
      const rows: any[] = normalizedStatus
        ? await prisma.$queryRawUnsafe(query, normalizedStatus)
        : await prisma.$queryRawUnsafe(query);
      return rows.map(mapRawReviewRow);
    } catch (error: any) {
      throw new BusinessLogicError(
        error?.message?.includes('relation "Review" does not exist')
          ? 'Review table does not exist. Run prisma migration and prisma generate.'
          : 'Failed to fetch reviews'
      );
    }
  },

  async moderateReview(reviewId: string, action: 'APPROVE' | 'REJECT', reason?: string) {
    if (action !== 'APPROVE' && action !== 'REJECT') {
      throw new ValidationError('Invalid moderation action');
    }

    const reviewIdBigInt = parseReviewId(reviewId);
    const reviewModel = (prisma as any).review;
    const review = reviewModel?.findUnique
      ? await reviewModel.findUnique({ where: { id: reviewIdBigInt } })
      : (
          await prisma.$queryRawUnsafe<any[]>(
            `SELECT "id", "status" FROM "Review" WHERE "id" = $1 LIMIT 1`,
            reviewIdBigInt.toString()
          )
        )?.[0];

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    const currentStatus = String(review.status || '').toUpperCase();
    if (currentStatus !== 'PENDING' && currentStatus !== 'APPROVED' && currentStatus !== 'REJECTED') {
      throw new ValidationError('Invalid review status');
    }

    if (action === 'APPROVE' && currentStatus === 'APPROVED') {
      throw new ValidationError('Review is already approved');
    }
    if (action === 'REJECT' && currentStatus === 'REJECTED') {
      throw new ValidationError('Review is already rejected');
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
      await prisma.$executeRawUnsafe(
        `UPDATE "Review"
         SET "status" = $1, "moderationReason" = $2, "moderatedAt" = NOW(), "updatedAt" = NOW()
         WHERE "id" = $3`,
        status,
        moderationReason,
        reviewIdBigInt.toString()
      );

      const rows: any[] = await prisma.$queryRawUnsafe(
        `${selectRawReviewsBase} WHERE r."id" = $1 LIMIT 1`,
        reviewIdBigInt.toString()
      );
      return rows[0] ? mapRawReviewRow(rows[0]) : null;
    } catch (error: any) {
      throw new BusinessLogicError(
        error?.message?.includes('relation "Review" does not exist')
          ? 'Review table does not exist. Run prisma migration and prisma generate.'
          : 'Failed to moderate review'
      );
    }
  },

  async deleteReview(reviewId: string) {
    const reviewIdBigInt = parseReviewId(reviewId);
    const reviewModel = (prisma as any).review;
    const review = reviewModel?.findUnique
      ? await reviewModel.findUnique({ where: { id: reviewIdBigInt } })
      : (
          await prisma.$queryRawUnsafe<any[]>(
            `SELECT "id" FROM "Review" WHERE "id" = $1 LIMIT 1`,
            reviewIdBigInt.toString()
          )
        )?.[0];

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    if (reviewModel?.delete) {
      return reviewModel.delete({ where: { id: reviewIdBigInt } });
    }

    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "Review" WHERE "id" = $1`,
        reviewIdBigInt.toString()
      );
      return { id: reviewIdBigInt.toString() };
    } catch (error: any) {
      throw new BusinessLogicError(
        error?.message?.includes('relation "Review" does not exist')
          ? 'Review table does not exist. Run prisma migration and prisma generate.'
          : 'Failed to delete review'
      );
    }
  }
};

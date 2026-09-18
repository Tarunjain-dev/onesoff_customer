import prisma from '../config/db';
import { NotFoundError, ValidationError } from '../utils/errors';
import { S3Service } from './S3Service';

type ReviewListQuery = {
  page?: number | string;
  limit?: number | string;
  productId?: number | string;
};

type RatingBreakdown = {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
};

type RatingCount = {
  rating: number;
  count: number;
};

type ProductAggregate = {
  productId: bigint;
  averageRating: number;
  totalReviews: number;
};

type ProductRatingCount = {
  productId: bigint;
  rating: number;
  count: number;
};

type VendorReviewItem = {
  id: bigint;
  rating: number;
  comment: string;
  images: string[];
  createdAt: Date;
  customer: {
    id: bigint | null;
    name: string | null;
  };
  product: {
    id: bigint | null;
    name: string | null;
  };
};

type ProductReviewItem = {
  id: bigint;
  rating: number;
  comment: string;
  images: string[];
  createdAt: Date;
  customer: {
    id: bigint | null;
    name: string | null;
  };
  vendor: {
    id: bigint | null;
    shopName: string | null;
  };
};

const parseBigIntId = (value: string | number, fieldName: string): bigint => {
  try {
    return BigInt(value);
  } catch {
    throw new ValidationError(`Invalid ${fieldName}`);
  }
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toBigInt = (value: unknown, fieldName: string): bigint => {
  try {
    return BigInt(String(value));
  } catch {
    throw new ValidationError(`Invalid ${fieldName}`);
  }
};

const round = (value: number) => Number(value.toFixed(2));

const getPagination = (query: ReviewListQuery) => {
  const pageRaw = Number(query.page ?? 1);
  const limitRaw = Number(query.limit ?? 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : 10;
  return { page, limit, skip: (page - 1) * limit };
};

const buildRatingBreakdown = (rows: RatingCount[]): RatingBreakdown => {
  const breakdown: RatingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) {
    if (row.rating >= 1 && row.rating <= 5) {
      breakdown[row.rating as keyof RatingBreakdown] = row.count;
    }
  }
  return breakdown;
};

const buildProductBreakdownMap = (rows: ProductRatingCount[]) => {
  const map = new Map<string, RatingBreakdown>();
  for (const row of rows) {
    const key = String(row.productId);
    if (!map.has(key)) {
      map.set(key, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    }
    const current = map.get(key)!;
    if (row.rating >= 1 && row.rating <= 5) {
      current[row.rating as keyof RatingBreakdown] = row.count;
    }
  }
  return map;
};

const resolveVendorProfile = async (vendorIdentifier: string) => {
  const vendorId = parseBigIntId(vendorIdentifier, 'vendorId');
  const vendor = await prisma.vendorProfile.findFirst({
    where: {
      OR: [{ id: vendorId }, { userId: vendorId }]
    },
    select: {
      id: true,
      shopName: true,
      ownerName: true,
      city: true,
      state: true,
      address: true
      ,
      currentBadgeAssignment: {
        include: {
          badgeRule: true
        }
      }
    }
  });

  if (!vendor) {
    throw new NotFoundError('Vendor not found');
  }

  return vendor;
};

const mapVendorReview = (row: any): VendorReviewItem => ({
  id: row.id,
  rating: toNumber(row.rating),
  comment: row.comment || '',
  images: Array.isArray(row.images) ? row.images : [],
  createdAt: row.createdAt,
  customer: {
    id: row.customer?.id ?? row.customerId ?? null,
    name: row.customer?.name ?? row.customerName ?? null
  },
  product: {
    id: row.product?.id ?? row.productId ?? null,
    name: row.product?.name ?? row.productName ?? null
  }
});

const mapProductReview = (row: any): ProductReviewItem => ({
  id: row.id,
  rating: toNumber(row.rating),
  comment: row.comment || '',
  images: Array.isArray(row.images) ? row.images : [],
  createdAt: row.createdAt,
  customer: {
    id: row.customer?.id ?? row.customerId ?? null,
    name: row.customer?.name ?? row.customerName ?? null
  },
  vendor: {
    id: row.vendor?.id ?? row.vendorId ?? null,
    shopName: row.vendor?.shopName ?? row.vendorShopName ?? null
  }
});

export const ReviewService = {
  async getVendorApprovedReviews(vendorIdentifier: string, query: ReviewListQuery) {
    const vendor = await resolveVendorProfile(vendorIdentifier);
    const { page, limit, skip } = getPagination(query);
    const reviewModel = (prisma as any).review;

    const productIdFilter =
      query.productId !== undefined && query.productId !== null && String(query.productId).trim() !== ''
        ? parseBigIntId(String(query.productId), 'productId')
        : undefined;

    let totalReviews = 0;
    let reviews: VendorReviewItem[] = [];
    let vendorRatingRows: RatingCount[] = [];
    let productAverages: ProductAggregate[] = [];
    let productRatingRows: ProductRatingCount[] = [];

    if (reviewModel?.findMany && reviewModel?.count && reviewModel?.groupBy) {
      const where: any = { vendorId: vendor.id, status: 'APPROVED' };
      if (productIdFilter) {
        where.productId = productIdFilter;
      }

      const [count, reviewRows, ratingRows, productAvgRows, productRatingCountRows] = await Promise.all([
        reviewModel.count({ where }),
        reviewModel.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            rating: true,
            comment: true,
            images: true,
            createdAt: true,
            customer: { select: { id: true, name: true } },
            product: { select: { id: true, name: true } }
          }
        }),
        reviewModel.groupBy({
          by: ['rating'],
          where,
          _count: { _all: true }
        }),
        reviewModel.groupBy({
          by: ['productId'],
          where,
          _avg: { rating: true },
          _count: { _all: true }
        }),
        reviewModel.groupBy({
          by: ['productId', 'rating'],
          where,
          _count: { _all: true }
        })
      ]);

      totalReviews = toNumber(count);
      reviews = (reviewRows as any[]).map(mapVendorReview);
      vendorRatingRows = (ratingRows as any[]).map((row) => ({
        rating: toNumber(row.rating),
        count: toNumber(row._count?._all)
      }));
      productAverages = (productAvgRows as any[]).map((row) => ({
        productId: toBigInt(row.productId, 'productId'),
        averageRating: toNumber(row._avg?.rating),
        totalReviews: toNumber(row._count?._all)
      }));
      productRatingRows = (productRatingCountRows as any[]).map((row) => ({
        productId: toBigInt(row.productId, 'productId'),
        rating: toNumber(row.rating),
        count: toNumber(row._count?._all)
      }));
    } else {
      if (productIdFilter) {
        const [countRows, reviewRows, ratingRows, productAvgRows, productRatingCountRows] = await Promise.all([
          prisma.$queryRawUnsafe<any[]>(
            `SELECT COUNT(*)::int AS "count"
             FROM "Review"
             WHERE "vendorId" = $1 AND "productId" = $2 AND "status" = 'APPROVED'`,
            vendor.id.toString(),
            productIdFilter.toString()
          ),
          prisma.$queryRawUnsafe<any[]>(
            `SELECT
               r."id",
               r."rating",
               r."comment",
               r."images",
               r."createdAt",
               u."id" AS "customerId",
               u."name" AS "customerName",
               p."id" AS "productId",
               p."name" AS "productName"
             FROM "Review" r
             LEFT JOIN "User" u ON u."id" = r."customerId"
             LEFT JOIN "Product" p ON p."id" = r."productId"
             WHERE r."vendorId" = $1 AND r."productId" = $2 AND r."status" = 'APPROVED'
             ORDER BY r."createdAt" DESC
             OFFSET $3 LIMIT $4`,
            vendor.id.toString(),
            productIdFilter.toString(),
            skip,
            limit
          ),
          prisma.$queryRawUnsafe<any[]>(
            `SELECT "rating", COUNT(*)::int AS "count"
             FROM "Review"
             WHERE "vendorId" = $1 AND "productId" = $2 AND "status" = 'APPROVED'
             GROUP BY "rating"`,
            vendor.id.toString(),
            productIdFilter.toString()
          ),
          prisma.$queryRawUnsafe<any[]>(
            `SELECT
               "productId",
               AVG("rating")::float AS "averageRating",
               COUNT(*)::int AS "totalReviews"
             FROM "Review"
             WHERE "vendorId" = $1 AND "productId" = $2 AND "status" = 'APPROVED'
             GROUP BY "productId"`,
            vendor.id.toString(),
            productIdFilter.toString()
          ),
          prisma.$queryRawUnsafe<any[]>(
            `SELECT "productId", "rating", COUNT(*)::int AS "count"
             FROM "Review"
             WHERE "vendorId" = $1 AND "productId" = $2 AND "status" = 'APPROVED'
             GROUP BY "productId", "rating"`,
            vendor.id.toString(),
            productIdFilter.toString()
          )
        ]);

        totalReviews = toNumber(countRows[0]?.count);
        reviews = reviewRows.map(mapVendorReview);
        vendorRatingRows = ratingRows.map((row) => ({
          rating: toNumber(row.rating),
          count: toNumber(row.count)
        }));
        productAverages = productAvgRows.map((row) => ({
          productId: toBigInt(row.productId, 'productId'),
          averageRating: toNumber(row.averageRating),
          totalReviews: toNumber(row.totalReviews)
        }));
        productRatingRows = productRatingCountRows.map((row) => ({
          productId: toBigInt(row.productId, 'productId'),
          rating: toNumber(row.rating),
          count: toNumber(row.count)
        }));
      } else {
        const [countRows, reviewRows, ratingRows, productAvgRows, productRatingCountRows] = await Promise.all([
          prisma.$queryRawUnsafe<any[]>(
            `SELECT COUNT(*)::int AS "count"
             FROM "Review"
             WHERE "vendorId" = $1 AND "status" = 'APPROVED'`,
            vendor.id.toString()
          ),
          prisma.$queryRawUnsafe<any[]>(
            `SELECT
               r."id",
               r."rating",
               r."comment",
               r."images",
               r."createdAt",
               u."id" AS "customerId",
               u."name" AS "customerName",
               p."id" AS "productId",
               p."name" AS "productName"
             FROM "Review" r
             LEFT JOIN "User" u ON u."id" = r."customerId"
             LEFT JOIN "Product" p ON p."id" = r."productId"
             WHERE r."vendorId" = $1 AND r."status" = 'APPROVED'
             ORDER BY r."createdAt" DESC
             OFFSET $2 LIMIT $3`,
            vendor.id.toString(),
            skip,
            limit
          ),
          prisma.$queryRawUnsafe<any[]>(
            `SELECT "rating", COUNT(*)::int AS "count"
             FROM "Review"
             WHERE "vendorId" = $1 AND "status" = 'APPROVED'
             GROUP BY "rating"`,
            vendor.id.toString()
          ),
          prisma.$queryRawUnsafe<any[]>(
            `SELECT
               "productId",
               AVG("rating")::float AS "averageRating",
               COUNT(*)::int AS "totalReviews"
             FROM "Review"
             WHERE "vendorId" = $1 AND "status" = 'APPROVED'
             GROUP BY "productId"`,
            vendor.id.toString()
          ),
          prisma.$queryRawUnsafe<any[]>(
            `SELECT "productId", "rating", COUNT(*)::int AS "count"
             FROM "Review"
             WHERE "vendorId" = $1 AND "status" = 'APPROVED'
             GROUP BY "productId", "rating"`,
            vendor.id.toString()
          )
        ]);

        totalReviews = toNumber(countRows[0]?.count);
        reviews = reviewRows.map(mapVendorReview);
        vendorRatingRows = ratingRows.map((row) => ({
          rating: toNumber(row.rating),
          count: toNumber(row.count)
        }));
        productAverages = productAvgRows.map((row) => ({
          productId: toBigInt(row.productId, 'productId'),
          averageRating: toNumber(row.averageRating),
          totalReviews: toNumber(row.totalReviews)
        }));
        productRatingRows = productRatingCountRows.map((row) => ({
          productId: toBigInt(row.productId, 'productId'),
          rating: toNumber(row.rating),
          count: toNumber(row.count)
        }));
      }
    }

    const productIds = Array.from(new Set(productAverages.map((item) => item.productId.toString()))).map((id) =>
      BigInt(id)
    );
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true }
        })
      : [];

    const productNameById = new Map(products.map((item) => [String(item.id), item.name]));
    const ratingBreakdown = buildRatingBreakdown(vendorRatingRows);
    const productBreakdownMap = buildProductBreakdownMap(productRatingRows);

    const totalFromProducts = productAverages.reduce((sum, item) => sum + item.totalReviews, 0);
    const weightedSum = productAverages.reduce(
      (sum, item) => sum + item.averageRating * item.totalReviews,
      0
    );
    const shopRating = totalFromProducts > 0 ? round(weightedSum / totalFromProducts) : 0;

    const productRatings = productAverages.map((item) => {
      const key = String(item.productId);
      return {
        productId: item.productId,
        productName: productNameById.get(key) || 'Product',
        averageRating: round(item.averageRating),
        totalReviews: item.totalReviews,
        ratingBreakdown: productBreakdownMap.get(key) || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    });

    const vendorBadgeImageUrl = vendor.currentBadgeAssignment?.badgeRule?.imageUrl
      ? await S3Service.getAccessibleImageUrl(
          String(vendor.currentBadgeAssignment.badgeRule.imageUrl)
        )
      : null;

    return {
      vendor: {
        id: vendor.id,
        shopName: vendor.shopName,
        ownerName: vendor.ownerName,
        city: vendor.city,
        state: vendor.state,
        address: vendor.address,
        badgeName: vendor.currentBadgeAssignment?.badgeRule?.name || null,
        badgeImageUrl: vendorBadgeImageUrl
      },
      summary: {
        totalReviews,
        averageRating: shopRating,
        totalProductsReviewed: productAverages.length,
        ratingBreakdown
      },
      productRatings,
      reviews,
      pagination: {
        page,
        limit,
        total: totalReviews,
        pages: Math.ceil(totalReviews / limit)
      }
    };
  },

  async getProductApprovedReviews(productIdentifier: string, query: ReviewListQuery) {
    const productId = parseBigIntId(productIdentifier, 'productId');
    const { page, limit, skip } = getPagination(query);
    const reviewModel = (prisma as any).review;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        vendorId: true,
        vendor: { select: { shopName: true } }
      }
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    let totalReviews = 0;
    let averageRating = 0;
    let ratingRows: RatingCount[] = [];
    let reviews: ProductReviewItem[] = [];

    if (reviewModel?.findMany && reviewModel?.count && reviewModel?.groupBy && reviewModel?.aggregate) {
      const where = { productId, status: 'APPROVED' };
      const [count, avgRow, groupedRatings, reviewRows] = await Promise.all([
        reviewModel.count({ where }),
        reviewModel.aggregate({
          where,
          _avg: { rating: true }
        }),
        reviewModel.groupBy({
          by: ['rating'],
          where,
          _count: { _all: true }
        }),
        reviewModel.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            rating: true,
            comment: true,
            images: true,
            createdAt: true,
            customer: { select: { id: true, name: true } },
            vendor: { select: { id: true, shopName: true } }
          }
        })
      ]);

      totalReviews = toNumber(count);
      averageRating = toNumber(avgRow?._avg?.rating);
      ratingRows = (groupedRatings as any[]).map((row) => ({
        rating: toNumber(row.rating),
        count: toNumber(row._count?._all)
      }));
      reviews = (reviewRows as any[]).map(mapProductReview);
    } else {
      const [countRows, averageRows, groupedRatings, reviewRows] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `SELECT COUNT(*)::int AS "count"
           FROM "Review"
           WHERE "productId" = $1 AND "status" = 'APPROVED'`,
          productId.toString()
        ),
        prisma.$queryRawUnsafe<any[]>(
          `SELECT AVG("rating")::float AS "averageRating"
           FROM "Review"
           WHERE "productId" = $1 AND "status" = 'APPROVED'`,
          productId.toString()
        ),
        prisma.$queryRawUnsafe<any[]>(
          `SELECT "rating", COUNT(*)::int AS "count"
           FROM "Review"
           WHERE "productId" = $1 AND "status" = 'APPROVED'
           GROUP BY "rating"`,
          productId.toString()
        ),
        prisma.$queryRawUnsafe<any[]>(
          `SELECT
             r."id",
             r."rating",
             r."comment",
             r."images",
             r."createdAt",
             u."id" AS "customerId",
             u."name" AS "customerName",
             vp."id" AS "vendorId",
             vp."shopName" AS "vendorShopName"
           FROM "Review" r
           LEFT JOIN "User" u ON u."id" = r."customerId"
           LEFT JOIN "VendorProfile" vp ON vp."id" = r."vendorId"
           WHERE r."productId" = $1 AND r."status" = 'APPROVED'
           ORDER BY r."createdAt" DESC
           OFFSET $2 LIMIT $3`,
          productId.toString(),
          skip,
          limit
        )
      ]);

      totalReviews = toNumber(countRows[0]?.count);
      averageRating = toNumber(averageRows[0]?.averageRating);
      ratingRows = groupedRatings.map((row) => ({
        rating: toNumber(row.rating),
        count: toNumber(row.count)
      }));
      reviews = reviewRows.map(mapProductReview);
    }

    return {
      product: {
        id: product.id,
        name: product.name,
        vendorId: product.vendorId,
        vendorShopName: product.vendor.shopName
      },
      summary: {
        totalReviews,
        averageRating: round(averageRating),
        ratingBreakdown: buildRatingBreakdown(ratingRows)
      },
      reviews,
      pagination: {
        page,
        limit,
        total: totalReviews,
        pages: Math.ceil(totalReviews / limit)
      }
    };
  }
};

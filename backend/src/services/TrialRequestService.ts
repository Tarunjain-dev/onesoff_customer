import prisma from '../config/db';
import { TrialRequestStatus } from '@prisma/client';
import { BusinessLogicError, NotFoundError, ValidationError } from '../utils/errors';
import { S3Service } from './S3Service';
import { NotificationService } from './NotificationService';
import { RentalAvailabilityService } from './RentalAvailabilityService';
import { getVendorProfileUserWhere } from '../utils/vendorScope';

type TrialRequestFilters = {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
};

type CreateTrialRequestInput = {
  productId: string | number;
  variantId?: string | number;
  preferredDate?: string;
};

type VendorAction = 'ACCEPT' | 'REJECT';
const hasNoShowTrialStatus = Boolean((TrialRequestStatus as unknown as Record<string, string>).NO_SHOW);
const hasStartedTrialStatus = Boolean((TrialRequestStatus as unknown as Record<string, string>).STARTED);

const getOpenTrialStatuses = () =>
  hasStartedTrialStatus
    ? (['PENDING', 'ACCEPTED', 'STARTED'] as const)
    : (['PENDING', 'ACCEPTED'] as const);

const getCompletionSourceStatuses = () =>
  hasStartedTrialStatus
    ? (['STARTED'] as const)
    : (['ACCEPTED'] as const);

const withAccessibleTrialProductImages = async (request: any) => {
  if (!request?.product || !Array.isArray(request.product.images) || request.product.images.length === 0) {
    return request;
  }

  const signedUrls = await S3Service.getAccessibleImageUrls(
    request.product.images.map((image: any) => image?.imageUrl || '')
  );

  return {
    ...request,
    product: {
      ...request.product,
      images: request.product.images.map((image: any, index: number) => ({
        ...image,
        imageUrl: signedUrls[index] || image?.imageUrl
      }))
    }
  };
};

const normalizeStatus = (status?: string) => {
  if (!status) return undefined;
  const normalized = status.trim().toUpperCase();
  if (normalized === 'ALL') return undefined;
  const allowedStatuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED'];
  if (hasStartedTrialStatus) {
    allowedStatuses.push('STARTED');
  }
  if (hasNoShowTrialStatus) {
    allowedStatuses.push('NO_SHOW');
  }
  if (!allowedStatuses.includes(normalized)) {
    throw new ValidationError('Invalid status filter');
  }
  return normalized as 'PENDING' | 'ACCEPTED' | 'STARTED' | 'REJECTED' | 'COMPLETED' | 'NO_SHOW';
};

const resolveVendorProfileId = async (vendorIdentifier: string): Promise<bigint> => {
  let vendorIdBig: bigint;
  try {
    vendorIdBig = BigInt(vendorIdentifier);
  } catch {
    throw new ValidationError('Invalid vendor identifier');
  }

  let vendorProfile: { id: bigint } | null = null;
  try {
    vendorProfile = await prisma.vendorProfile.findFirst({
      where: {
        OR: [
          { id: vendorIdBig },
          { userId: vendorIdBig }
        ]
      },
      select: { id: true }
    });
  } catch (error: any) {
    if (error?.code !== 'P2022') throw error;

    const rows = await prisma.$queryRawUnsafe<Array<{ id: string | number | bigint }>>(
      `SELECT "id"
       FROM "VendorProfile"
       WHERE "id" = $1 OR "userId" = $1
       LIMIT 1`,
      vendorIdBig.toString()
    );

    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id !== undefined && rows[0]?.id !== null) {
      vendorProfile = { id: BigInt(rows[0].id) };
    }
  }

  if (!vendorProfile) {
    throw new ValidationError('Vendor profile not found');
  }

  return vendorProfile.id;
};

const generateTrialCode = () => `TRL-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

const generateUniqueTrialCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateTrialCode();
    const existing = await prisma.trialRequest.findUnique({ where: { trialCode: code } });
    if (!existing) return code;
  }

  throw new BusinessLogicError('Unable to generate trial code. Please retry.');
};

const buildVendorStats = async (vendorProfileId: bigint) => {
  const trialModel = (prisma as any).trialRequest;
  const canGroupBy = Boolean(trialModel?.groupBy);

  const grouped = canGroupBy
    ? await trialModel.groupBy({
        by: ['status'],
        where: { vendorId: vendorProfileId },
        _count: { _all: true }
      })
    : await prisma.$queryRawUnsafe<any[]>(
        `SELECT "status", COUNT(*)::int AS "count"
         FROM "TrialRequest"
         WHERE "vendorId" = $1
         GROUP BY "status"`,
        vendorProfileId.toString()
      );

  const stats = {
    total: 0,
    pending: 0,
    accepted: 0,
    started: 0,
    rejected: 0,
    completed: 0,
    noShow: 0
  };

  for (const row of grouped) {
    const count = toNumber((row as any)?._count?._all ?? (row as any)?.count);
    stats.total += count;
    const status = String((row as any).status || '').toUpperCase();
    if (status === 'PENDING') stats.pending = count;
    if (status === 'ACCEPTED') stats.accepted = count;
    if (status === 'STARTED') stats.started = count;
    if (status === 'REJECTED') stats.rejected = count;
    if (status === 'COMPLETED') stats.completed = count;
    if (status === 'NO_SHOW') stats.noShow = count;
  }

  return stats;
};

const parsePreferredDate = (value?: string): Date | undefined => {
  if (!value || value.trim() === '') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  if (normalized === 'TODAY') {
    return todayUtc;
  }

  if (normalized === 'TOMORROW') {
    const tomorrow = new Date(todayUtc);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow;
  }

  const dateOnlyMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(Date.UTC(year, month, day));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError('Invalid preferredDate. Use ISO date or TODAY/TOMORROW');
  }

  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const TrialRequestService = {
  async createTrialRequest(customerId: string, input: CreateTrialRequestInput) {
    if (!input?.productId) {
      throw new ValidationError('productId is required');
    }

    let productIdBig: bigint;
    try {
      productIdBig = BigInt(input.productId);
    } catch {
      throw new ValidationError('Invalid productId');
    }

    let variantIdBig: bigint | undefined;
    if (input.variantId !== undefined && input.variantId !== null && String(input.variantId).trim() !== '') {
      try {
        variantIdBig = BigInt(input.variantId);
      } catch {
        throw new ValidationError('Invalid variantId');
      }
    }

    let product: any;
    try {
      product = await prisma.product.findUnique({
        where: { id: productIdBig },
        select: {
          id: true,
          name: true,
          status: true,
          vendorId: true,
          vendor: {
            select: {
              userId: true,
              user: {
                select: {
                  role: true,
                  status: true,
                  onboardingStatus: true
                }
              }
            }
          },
          variants: { select: { id: true, quantity: true } }
        }
      });
    } catch (error: any) {
      if (error?.code !== 'P2022') throw error;

      // Backward-compatible fallback for deployments where newer columns are
      // not yet present in the database.
      product = await prisma.product.findUnique({
        where: { id: productIdBig },
        select: {
          id: true,
          name: true,
          status: true,
          vendorId: true,
          vendor: {
            select: {
              userId: true
            }
          },
          variants: { select: { id: true, quantity: true } }
        }
      });
    }

    if (!product || product.status !== 'ACTIVE') {
      throw new ValidationError('Product not available for trial');
    }

    const vendorUser = (product as any)?.vendor?.user;
    const hasVendorStatusInfo = Boolean(vendorUser);
    const vendorInactive = hasVendorStatusInfo && String(vendorUser?.status || '').toUpperCase() !== 'ACTIVE';
    const vendorNotApproved = hasVendorStatusInfo && String(vendorUser?.onboardingStatus || '').toUpperCase() !== 'APPROVED';

    if (!product.vendor || vendorInactive || vendorNotApproved) {
      throw new BusinessLogicError('Vendor not available for trial requests');
    }

    const variants = Array.isArray((product as any).variants) ? (product as any).variants : [];
    if (variants.length === 0) {
      throw new BusinessLogicError('Trial not available: item is out of stock');
    }

    const selectedVariant = variantIdBig
      ? variants.find((v: any) => String(v.id) === String(variantIdBig))
      : null;

    if (variantIdBig && !selectedVariant) {
      throw new ValidationError('Variant does not belong to product');
    }

    const totalStock = selectedVariant
      ? (toNumber(selectedVariant.quantity) > 0 ? 1 : 0)
      : variants.filter((v: any) => toNumber(v?.quantity) > 0).length;

    if (totalStock <= 0) {
      throw new BusinessLogicError('Trial not available: item is out of stock');
    }

    const preferredDate = parsePreferredDate(input.preferredDate);

    const existingActiveRequest = await prisma.trialRequest.findFirst({
      where: {
        customerId: BigInt(customerId),
        productId: productIdBig,
        ...(variantIdBig ? { OR: [{ variantId: variantIdBig }, { variantId: null }] } : { variantId: null }),
        status: { in: [...getOpenTrialStatuses()] as any }
      }
    });

    if (existingActiveRequest) {
      throw new BusinessLogicError('You already have an active trial request for this item');
    }

    if (preferredDate) {
      await RentalAvailabilityService.assertDateAvailableForOrder(
        product.vendorId,
        productIdBig,
        preferredDate,
        1,
        variantIdBig
      );
    } else {
      const activeTrialCount = await prisma.trialRequest.count({
        where: {
          productId: productIdBig,
          ...(variantIdBig ? { variantId: variantIdBig } : {}),
          status: { in: [...getOpenTrialStatuses()] as any }
        }
      });

      if (activeTrialCount >= totalStock) {
        throw new BusinessLogicError('Trial not available: all trial slots are full');
      }
    }

    const created = await prisma.trialRequest.create({
      data: {
        customerId: BigInt(customerId),
        vendorId: product.vendorId,
        productId: productIdBig,
        variantId: variantIdBig,
        preferredDate,
        status: 'PENDING'
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, size: true, sku: true } }
      }
    });

    // Best-effort vendor notification (do not fail trial creation if notifications fail).
    const preferredLabel = created.preferredDate
      ? new Date(created.preferredDate).toLocaleDateString('en-IN')
      : 'today/tomorrow';

    NotificationService.sendNotification({
      userId: product.vendor.userId.toString(),
      type: 'TRIAL_BOOKED',
      title: 'New trial request',
      message: `New trial request for ${product.name}. Preferred date: ${preferredLabel}.`,
      data: { trialRequestId: created.id.toString(), productId: created.productId.toString() }
    }).catch(() => null);

    if (String(product?.vendor?.user?.role || '').toUpperCase() === 'INDIVIDUAL_VENDOR') {
      NotificationService.notifyAdminAsVendorOrderUpdate({
        title: 'New trial request',
        message: `A trial request was created for ${product.name}. Preferred date: ${preferredLabel}.`,
        trialRequestId: created.id.toString(),
        productId: created.productId.toString(),
        status: 'PENDING'
      }).catch(() => null);
    }

    return created;
  },

  async getVendorTrialRequests(vendorId: string, filters: TrialRequestFilters) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const status = normalizeStatus(filters.status);
    const search = filters.search?.trim();

    const where: any = { vendorId: vendorProfileId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { trialCode: { contains: search, mode: 'insensitive' } }
      ];
    }

    const trialModel = (prisma as any).trialRequest;
    const canUseTrialModel = Boolean(trialModel?.findMany && trialModel?.count);

    const [requests, total, stats] = await Promise.all(
      canUseTrialModel
        ? [
            trialModel.findMany({
              where,
              include: {
                customer: { select: { id: true, name: true, email: true, phone: true } },
                product: {
                  select: {
                    id: true,
                    name: true,
                    images: {
                      select: {
                        imageUrl: true,
                        isCover: true
                      }
                    }
                  }
                },
                variant: { select: { id: true, size: true, sku: true } }
              },
              orderBy: { createdAt: 'desc' },
              skip,
              take: limit
            }),
            trialModel.count({ where }),
            buildVendorStats(vendorProfileId)
          ]
        : [
            (async () => {
              const params: any[] = [vendorProfileId.toString()];
              let paramIndex = 2;
              let whereSql = `tr."vendorId" = $1`;

              if (status) {
                whereSql += ` AND tr."status" = $${paramIndex}`;
                params.push(status);
                paramIndex += 1;
              }

              if (search) {
                whereSql += ` AND (` +
                  `u."name" ILIKE $${paramIndex} OR p."name" ILIKE $${paramIndex} OR tr."trialCode" ILIKE $${paramIndex}` +
                  `)`;
                params.push(`%${search}%`);
                paramIndex += 1;
              }

              const rows = await prisma.$queryRawUnsafe<any[]>(
                `SELECT
                  tr."id",
                  tr."status",
                  tr."trialCode",
                  tr."rejectionReason",
                  tr."preferredDate",
                  tr."createdAt",
                  tr."completedAt",
                  u."id" AS "customerId",
                  u."name" AS "customerName",
                  u."email" AS "customerEmail",
                  u."phone" AS "customerPhone",
                  p."id" AS "productId",
                  p."name" AS "productName",
                  pv."id" AS "variantId",
                  pv."size" AS "variantSize",
                  pv."sku" AS "variantSku"
                 FROM "TrialRequest" tr
                 LEFT JOIN "User" u ON u."id" = tr."customerId"
                 LEFT JOIN "Product" p ON p."id" = tr."productId"
                 LEFT JOIN "ProductVariant" pv ON pv."id" = tr."variantId"
                 WHERE ${whereSql}
                 ORDER BY tr."createdAt" DESC
                 OFFSET $${paramIndex} LIMIT $${paramIndex + 1}`,
                ...params,
                skip,
                limit
              );

              const productIds = Array.from(
                new Set(rows.map((r) => String(r.productId)).filter(Boolean))
              );

              const images = productIds.length
                ? await prisma.$queryRawUnsafe<any[]>(
                    `SELECT "productId", "imageUrl", "isCover"
                     FROM "ProductImage"
                     WHERE "productId" IN (${productIds
                       .map((_, i) => `$${i + 1}`)
                       .join(', ')})`,
                    ...productIds
                  )
                : [];

              const imagesByProduct = new Map<string, any[]>();
              for (const img of images) {
                const key = String(img.productId);
                if (!imagesByProduct.has(key)) imagesByProduct.set(key, []);
                imagesByProduct.get(key)!.push({
                  imageUrl: img.imageUrl,
                  isCover: Boolean(img.isCover)
                });
              }

              return rows.map((row) => ({
                id: row.id,
                status: row.status,
                trialCode: row.trialCode,
                rejectionReason: row.rejectionReason,
                preferredDate: row.preferredDate,
                createdAt: row.createdAt,
                completedAt: row.completedAt,
                customer: {
                  id: row.customerId,
                  name: row.customerName,
                  email: row.customerEmail,
                  phone: row.customerPhone
                },
                product: {
                  id: row.productId,
                  name: row.productName,
                  images: imagesByProduct.get(String(row.productId)) || []
                },
                variant: row.variantId
                  ? { id: row.variantId, size: row.variantSize, sku: row.variantSku }
                  : null
              }));
            })(),
            (async () => {
              const params: any[] = [vendorProfileId.toString()];
              let paramIndex = 2;
              let whereSql = `tr."vendorId" = $1`;

              if (status) {
                whereSql += ` AND tr."status" = $${paramIndex}`;
                params.push(status);
                paramIndex += 1;
              }

              if (search) {
                whereSql += ` AND (` +
                  `u."name" ILIKE $${paramIndex} OR p."name" ILIKE $${paramIndex} OR tr."trialCode" ILIKE $${paramIndex}` +
                  `)`;
                params.push(`%${search}%`);
                paramIndex += 1;
              }

              const rows = await prisma.$queryRawUnsafe<any[]>(
                `SELECT COUNT(*)::int AS "count"
                 FROM "TrialRequest" tr
                 LEFT JOIN "User" u ON u."id" = tr."customerId"
                 LEFT JOIN "Product" p ON p."id" = tr."productId"
                 WHERE ${whereSql}`,
                ...params
              );

              return toNumber(rows?.[0]?.count);
            })(),
            buildVendorStats(vendorProfileId)
          ]
    );

    const requestsWithAccessibleImages = await Promise.all(
      requests.map(withAccessibleTrialProductImages)
    );

    return {
      requests: requestsWithAccessibleImages,
      pagination: {
        page,
        limit,
        total: toNumber(total),
        pages: Math.ceil(toNumber(total) / limit)
      },
      stats
    };
  },

  async respondToTrialRequest(vendorId: string, trialRequestId: string, action: VendorAction, rejectionReason?: string) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    let requestId: bigint;
    try {
      requestId = BigInt(trialRequestId);
    } catch {
      throw new ValidationError('Invalid trialRequestId');
    }

    const request = await prisma.trialRequest.findFirst({
      where: { id: requestId, vendorId: vendorProfileId }
    });

    if (!request) {
      throw new NotFoundError('Trial request not found');
    }

    if (request.status !== 'PENDING') {
      throw new ValidationError('Only pending requests can be updated');
    }

    const normalizedAction = String(action).toUpperCase() as VendorAction;
    if (!['ACCEPT', 'REJECT'].includes(normalizedAction)) {
      throw new ValidationError('Invalid action');
    }

    if (normalizedAction === 'REJECT') {
      const updated = await prisma.trialRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectionReason: rejectionReason?.trim() || null,
          respondedAt: new Date()
        },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          product: { select: { id: true, name: true } },
          variant: { select: { id: true, size: true, sku: true } }
        }
      });

      NotificationService.sendNotification({
        userId: updated.customerId.toString(),
        type: 'TRIAL_CANCELLED',
        title: 'Trial request rejected',
        message: `Your trial request for ${updated.product?.name || 'this item'} was rejected.${updated.rejectionReason ? ` Reason: ${updated.rejectionReason}` : ''}`,
        data: { trialRequestId: updated.id.toString(), productId: updated.productId.toString() }
      }).catch(() => null);

      return updated;
    }

    const trialCode = await generateUniqueTrialCode();
    const updated = await prisma.trialRequest.update({
      where: { id: requestId },
      data: {
        status: 'ACCEPTED',
        trialCode,
        rejectionReason: null,
        respondedAt: new Date()
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, size: true, sku: true } }
      }
    });

    NotificationService.sendNotification({
      userId: updated.customerId.toString(),
      type: 'TRIAL_APPROVED',
      title: 'Trial request accepted',
      message: `Your trial request for ${updated.product?.name || 'this item'} is accepted. Your code: ${trialCode}`,
      data: { trialRequestId: updated.id.toString(), productId: updated.productId.toString(), trialCode }
    }).catch(() => null);

    return updated;
  },

  async startTrialRequest(vendorId: string, trialRequestId: string, trialCode?: string) {
    if (!hasStartedTrialStatus) {
      throw new ValidationError('STARTED status is not available in current database. Run pending migrations and prisma generate.');
    }

    const vendorProfileId = await resolveVendorProfileId(vendorId);
    let requestId: bigint;
    try {
      requestId = BigInt(trialRequestId);
    } catch {
      throw new ValidationError('Invalid trialRequestId');
    }

    const request = await prisma.trialRequest.findFirst({
      where: { id: requestId, vendorId: vendorProfileId }
    });

    if (!request) {
      throw new NotFoundError('Trial request not found');
    }

    if (request.status !== 'ACCEPTED') {
      throw new ValidationError('Only accepted requests can be started');
    }

    if (trialCode && request.trialCode && trialCode.trim() !== request.trialCode) {
      throw new ValidationError('Invalid trial code');
    }

    const updated = await prisma.trialRequest.update({
      where: { id: requestId },
      data: {
        status: 'STARTED' as any,
        completedAt: null
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, size: true, sku: true } }
      }
    });

    NotificationService.notifyCustomerTrialStarted(
      updated.customerId.toString(),
      updated.id.toString(),
      updated.product?.name || 'this item',
      updated.product?.id?.toString()
    ).catch(() => null);

    return updated;
  },

  async completeTrialRequest(vendorId: string, trialRequestId: string, trialCode?: string) {
    const vendorProfileId = await resolveVendorProfileId(vendorId);
    let requestId: bigint;
    try {
      requestId = BigInt(trialRequestId);
    } catch {
      throw new ValidationError('Invalid trialRequestId');
    }

    const request = await prisma.trialRequest.findFirst({
      where: { id: requestId, vendorId: vendorProfileId }
    });

    if (!request) {
      throw new NotFoundError('Trial request not found');
    }

    if (!(getCompletionSourceStatuses() as readonly string[]).includes(String(request.status || '').toUpperCase())) {
      throw new ValidationError(hasStartedTrialStatus ? 'Only started requests can be completed' : 'Only accepted requests can be completed');
    }

    if (!hasStartedTrialStatus && trialCode && request.trialCode && trialCode.trim() !== request.trialCode) {
      throw new ValidationError('Invalid trial code');
    }

    const updated = await prisma.trialRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, size: true, sku: true } }
      }
    });

    NotificationService.notifyCustomerTrialCompleted(
      updated.customerId.toString(),
      updated.id.toString(),
      updated.product?.name || 'this item',
      updated.product?.id?.toString()
    ).catch(() => null);

    return updated;
  },

  async markTrialNoShow(vendorId: string, trialRequestId: string, reason?: string) {
    if (!hasNoShowTrialStatus) {
      throw new ValidationError('NO_SHOW status is not available in current database. Run pending migrations and prisma generate.');
    }

    const vendorProfileId = await resolveVendorProfileId(vendorId);
    let requestId: bigint;
    try {
      requestId = BigInt(trialRequestId);
    } catch {
      throw new ValidationError('Invalid trialRequestId');
    }

    const request = await prisma.trialRequest.findFirst({
      where: { id: requestId, vendorId: vendorProfileId }
    });

    if (!request) {
      throw new NotFoundError('Trial request not found');
    }

    if (request.status !== 'ACCEPTED') {
      throw new ValidationError('Only accepted requests can be marked as no-show');
    }

    const updated: any = await prisma.trialRequest.update({
      where: { id: requestId },
      data: {
        status: 'NO_SHOW' as any,
        rejectionReason: reason?.trim() || 'Customer marked as no-show',
        respondedAt: new Date(),
        completedAt: null
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, size: true, sku: true } }
      }
    });

    NotificationService.sendNotification({
      userId: updated.customerId.toString(),
      type: 'TRIAL_CANCELLED',
      title: 'Trial marked as no-show',
      message: `Your trial for ${updated.product?.name || 'this item'} was marked as no-show by the vendor.`,
      data: { trialRequestId: updated.id.toString(), productId: updated.productId.toString() }
    }).catch(() => null);

    return updated;
  },

  async getAdminScopedTrialRequests(roleFilter: Record<string, any> | undefined, filters: TrialRequestFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const status = normalizeStatus(filters.status);
    const search = filters.search?.trim();
    const vendorWhere = getVendorProfileUserWhere(roleFilter);

    const where: any = {
      vendor: vendorWhere
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { trialCode: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [requests, total, grouped] = await Promise.all([
      prisma.trialRequest.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          product: {
            select: {
              id: true,
              name: true,
              images: {
                select: {
                  imageUrl: true,
                  isCover: true
                }
              }
            }
          },
          variant: { select: { id: true, size: true, sku: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.trialRequest.count({ where }),
      prisma.trialRequest.groupBy({
        by: ['status'],
        where: {
          vendor: vendorWhere
        },
        _count: { _all: true }
      })
    ]);

    const stats = {
      total: 0,
      pending: 0,
      accepted: 0,
      started: 0,
      rejected: 0,
      completed: 0,
      noShow: 0
    };

    for (const row of grouped) {
      const count = toNumber(row?._count?._all);
      stats.total += count;
      const groupedStatus = String(row.status || '').toUpperCase();
      if (groupedStatus === 'PENDING') stats.pending = count;
      if (groupedStatus === 'ACCEPTED') stats.accepted = count;
      if (groupedStatus === 'STARTED') stats.started = count;
      if (groupedStatus === 'REJECTED') stats.rejected = count;
      if (groupedStatus === 'COMPLETED') stats.completed = count;
      if (groupedStatus === 'NO_SHOW') stats.noShow = count;
    }

    const requestsWithAccessibleImages = await Promise.all(
      requests.map(withAccessibleTrialProductImages)
    );

    return {
      requests: requestsWithAccessibleImages,
      pagination: {
        page,
        limit,
        total: toNumber(total),
        pages: Math.ceil(toNumber(total) / limit)
      },
      stats
    };
  },

  async respondToAdminScopedTrialRequest(
    trialRequestId: string,
    action: VendorAction,
    roleFilter?: Record<string, any>,
    rejectionReason?: string
  ) {
    let requestId: bigint;
    try {
      requestId = BigInt(trialRequestId);
    } catch {
      throw new ValidationError('Invalid trialRequestId');
    }

    const request = await prisma.trialRequest.findFirst({
      where: {
        id: requestId,
        vendor: getVendorProfileUserWhere(roleFilter)
      }
    });

    if (!request) {
      throw new NotFoundError('Trial request not found');
    }

    if (request.status !== 'PENDING') {
      throw new ValidationError('Only pending requests can be updated');
    }

    const normalizedAction = String(action).toUpperCase() as VendorAction;
    if (!['ACCEPT', 'REJECT'].includes(normalizedAction)) {
      throw new ValidationError('Invalid action');
    }

    if (normalizedAction === 'REJECT') {
      const updated = await prisma.trialRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectionReason: rejectionReason?.trim() || null,
          respondedAt: new Date()
        },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          product: { select: { id: true, name: true } },
          variant: { select: { id: true, size: true, sku: true } }
        }
      });

      NotificationService.sendNotification({
        userId: updated.customerId.toString(),
        type: 'TRIAL_CANCELLED',
        title: 'Trial request rejected',
        message: `Your trial request for ${updated.product?.name || 'this item'} was rejected.${updated.rejectionReason ? ` Reason: ${updated.rejectionReason}` : ''}`,
        data: { trialRequestId: updated.id.toString(), productId: updated.productId.toString() }
      }).catch(() => null);

      return updated;
    }

    const trialCode = await generateUniqueTrialCode();
    const updated = await prisma.trialRequest.update({
      where: { id: requestId },
      data: {
        status: 'ACCEPTED',
        trialCode,
        rejectionReason: null,
        respondedAt: new Date()
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, size: true, sku: true } }
      }
    });

    NotificationService.sendNotification({
      userId: updated.customerId.toString(),
      type: 'TRIAL_APPROVED',
      title: 'Trial request accepted',
      message: `Your trial request for ${updated.product?.name || 'this item'} is accepted. Your code: ${trialCode}`,
      data: { trialRequestId: updated.id.toString(), productId: updated.productId.toString(), trialCode }
    }).catch(() => null);

    return updated;
  },

  async startAdminScopedTrialRequest(
    trialRequestId: string,
    trialCode?: string,
    roleFilter?: Record<string, any>
  ) {
    if (!hasStartedTrialStatus) {
      throw new ValidationError('STARTED status is not available in current database. Run pending migrations and prisma generate.');
    }

    let requestId: bigint;
    try {
      requestId = BigInt(trialRequestId);
    } catch {
      throw new ValidationError('Invalid trialRequestId');
    }

    const request = await prisma.trialRequest.findFirst({
      where: {
        id: requestId,
        vendor: getVendorProfileUserWhere(roleFilter)
      }
    });

    if (!request) {
      throw new NotFoundError('Trial request not found');
    }

    if (request.status !== 'ACCEPTED') {
      throw new ValidationError('Only accepted requests can be started');
    }

    if (trialCode && request.trialCode && trialCode.trim() !== request.trialCode) {
      throw new ValidationError('Invalid trial code');
    }

    const updated = await prisma.trialRequest.update({
      where: { id: requestId },
      data: {
        status: 'STARTED' as any,
        completedAt: null
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, size: true, sku: true } }
      }
    });

    NotificationService.notifyCustomerTrialStarted(
      updated.customerId.toString(),
      updated.id.toString(),
      updated.product?.name || 'this item',
      updated.product?.id?.toString()
    ).catch(() => null);

    return updated;
  },

  async completeAdminScopedTrialRequest(
    trialRequestId: string,
    trialCode?: string,
    roleFilter?: Record<string, any>
  ) {
    let requestId: bigint;
    try {
      requestId = BigInt(trialRequestId);
    } catch {
      throw new ValidationError('Invalid trialRequestId');
    }

    const request = await prisma.trialRequest.findFirst({
      where: {
        id: requestId,
        vendor: getVendorProfileUserWhere(roleFilter)
      }
    });

    if (!request) {
      throw new NotFoundError('Trial request not found');
    }

    if (!(getCompletionSourceStatuses() as readonly string[]).includes(String(request.status || '').toUpperCase())) {
      throw new ValidationError(hasStartedTrialStatus ? 'Only started requests can be completed' : 'Only accepted requests can be completed');
    }

    if (!hasStartedTrialStatus && trialCode && request.trialCode && trialCode.trim() !== request.trialCode) {
      throw new ValidationError('Invalid trial code');
    }

    const updated = await prisma.trialRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, size: true, sku: true } }
      }
    });

    NotificationService.notifyCustomerTrialCompleted(
      updated.customerId.toString(),
      updated.id.toString(),
      updated.product?.name || 'this item',
      updated.product?.id?.toString()
    ).catch(() => null);

    return updated;
  },

  async getCustomerTrialRequests(customerId: string, filters: TrialRequestFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const status = normalizeStatus(filters.status);

    const where: any = { customerId: BigInt(customerId) };
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.trialRequest.findMany({
        where,
        include: {
          product: { select: { id: true, name: true } },
          variant: { select: { id: true, size: true, sku: true } },
          vendor: {
            include: {
              user: { select: { id: true, name: true, phone: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.trialRequest.count({ where })
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  },

  async getCustomerTrialRequestById(customerId: string, trialRequestId: string) {
    let requestId: bigint;
    try {
      requestId = BigInt(trialRequestId);
    } catch {
      throw new ValidationError('Invalid trialRequestId');
    }

    const request = await prisma.trialRequest.findFirst({
      where: {
        id: requestId,
        customerId: BigInt(customerId)
      },
      include: {
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, size: true, sku: true } },
        vendor: {
          include: {
            user: { select: { id: true, name: true, phone: true } }
          }
        }
      }
    });

    if (!request) {
      throw new NotFoundError('Trial request not found');
    }

    return request;
  }
};

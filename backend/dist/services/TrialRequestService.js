"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrialRequestService = void 0;
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const S3Service_1 = require("./S3Service");
const NotificationService_1 = require("./NotificationService");
const RentalAvailabilityService_1 = require("./RentalAvailabilityService");
const vendorScope_1 = require("../utils/vendorScope");
const hasNoShowTrialStatus = Boolean(client_1.TrialRequestStatus.NO_SHOW);
const hasStartedTrialStatus = Boolean(client_1.TrialRequestStatus.STARTED);
const getOpenTrialStatuses = () => hasStartedTrialStatus
    ? ['PENDING', 'ACCEPTED', 'STARTED']
    : ['PENDING', 'ACCEPTED'];
const getCompletionSourceStatuses = () => hasStartedTrialStatus
    ? ['STARTED']
    : ['ACCEPTED'];
const withAccessibleTrialProductImages = async (request) => {
    if (!request?.product || !Array.isArray(request.product.images) || request.product.images.length === 0) {
        return request;
    }
    const signedUrls = await S3Service_1.S3Service.getAccessibleImageUrls(request.product.images.map((image) => image?.imageUrl || ''));
    return {
        ...request,
        product: {
            ...request.product,
            images: request.product.images.map((image, index) => ({
                ...image,
                imageUrl: signedUrls[index] || image?.imageUrl
            }))
        }
    };
};
const normalizeStatus = (status) => {
    if (!status)
        return undefined;
    const normalized = status.trim().toUpperCase();
    if (normalized === 'ALL')
        return undefined;
    const allowedStatuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED'];
    if (hasStartedTrialStatus) {
        allowedStatuses.push('STARTED');
    }
    if (hasNoShowTrialStatus) {
        allowedStatuses.push('NO_SHOW');
    }
    if (!allowedStatuses.includes(normalized)) {
        throw new errors_1.ValidationError('Invalid status filter');
    }
    return normalized;
};
const resolveVendorProfileId = async (vendorIdentifier) => {
    let vendorIdBig;
    try {
        vendorIdBig = BigInt(vendorIdentifier);
    }
    catch {
        throw new errors_1.ValidationError('Invalid vendor identifier');
    }
    let vendorProfile = null;
    try {
        vendorProfile = await db_1.default.vendorProfile.findFirst({
            where: {
                OR: [
                    { id: vendorIdBig },
                    { userId: vendorIdBig }
                ]
            },
            select: { id: true }
        });
    }
    catch (error) {
        if (error?.code !== 'P2022')
            throw error;
        const rows = await db_1.default.$queryRawUnsafe(`SELECT "id"
       FROM "VendorProfile"
       WHERE "id" = $1 OR "userId" = $1
       LIMIT 1`, vendorIdBig.toString());
        if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id !== undefined && rows[0]?.id !== null) {
            vendorProfile = { id: BigInt(rows[0].id) };
        }
    }
    if (!vendorProfile) {
        throw new errors_1.ValidationError('Vendor profile not found');
    }
    return vendorProfile.id;
};
const generateTrialCode = () => `TRL-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
const generateUniqueTrialCode = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const code = generateTrialCode();
        const existing = await db_1.default.trialRequest.findUnique({ where: { trialCode: code } });
        if (!existing)
            return code;
    }
    throw new errors_1.BusinessLogicError('Unable to generate trial code. Please retry.');
};
const buildVendorStats = async (vendorProfileId) => {
    const trialModel = db_1.default.trialRequest;
    const canGroupBy = Boolean(trialModel?.groupBy);
    const grouped = canGroupBy
        ? await trialModel.groupBy({
            by: ['status'],
            where: { vendorId: vendorProfileId },
            _count: { _all: true }
        })
        : await db_1.default.$queryRawUnsafe(`SELECT "status", COUNT(*)::int AS "count"
         FROM "TrialRequest"
         WHERE "vendorId" = $1
         GROUP BY "status"`, vendorProfileId.toString());
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
        const count = toNumber(row?._count?._all ?? row?.count);
        stats.total += count;
        const status = String(row.status || '').toUpperCase();
        if (status === 'PENDING')
            stats.pending = count;
        if (status === 'ACCEPTED')
            stats.accepted = count;
        if (status === 'STARTED')
            stats.started = count;
        if (status === 'REJECTED')
            stats.rejected = count;
        if (status === 'COMPLETED')
            stats.completed = count;
        if (status === 'NO_SHOW')
            stats.noShow = count;
    }
    return stats;
};
const parsePreferredDate = (value) => {
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
        throw new errors_1.ValidationError('Invalid preferredDate. Use ISO date or TODAY/TOMORROW');
    }
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
};
const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
exports.TrialRequestService = {
    async createTrialRequest(customerId, input) {
        if (!input?.productId) {
            throw new errors_1.ValidationError('productId is required');
        }
        let productIdBig;
        try {
            productIdBig = BigInt(input.productId);
        }
        catch {
            throw new errors_1.ValidationError('Invalid productId');
        }
        let variantIdBig;
        if (input.variantId !== undefined && input.variantId !== null && String(input.variantId).trim() !== '') {
            try {
                variantIdBig = BigInt(input.variantId);
            }
            catch {
                throw new errors_1.ValidationError('Invalid variantId');
            }
        }
        let product;
        try {
            product = await db_1.default.product.findUnique({
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
        }
        catch (error) {
            if (error?.code !== 'P2022')
                throw error;
            // Backward-compatible fallback for deployments where newer columns are
            // not yet present in the database.
            product = await db_1.default.product.findUnique({
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
            throw new errors_1.ValidationError('Product not available for trial');
        }
        const vendorUser = product?.vendor?.user;
        const hasVendorStatusInfo = Boolean(vendorUser);
        const vendorInactive = hasVendorStatusInfo && String(vendorUser?.status || '').toUpperCase() !== 'ACTIVE';
        const vendorNotApproved = hasVendorStatusInfo && String(vendorUser?.onboardingStatus || '').toUpperCase() !== 'APPROVED';
        if (!product.vendor || vendorInactive || vendorNotApproved) {
            throw new errors_1.BusinessLogicError('Vendor not available for trial requests');
        }
        const variants = Array.isArray(product.variants) ? product.variants : [];
        if (variants.length === 0) {
            throw new errors_1.BusinessLogicError('Trial not available: item is out of stock');
        }
        const selectedVariant = variantIdBig
            ? variants.find((v) => String(v.id) === String(variantIdBig))
            : null;
        if (variantIdBig && !selectedVariant) {
            throw new errors_1.ValidationError('Variant does not belong to product');
        }
        const totalStock = selectedVariant
            ? (toNumber(selectedVariant.quantity) > 0 ? 1 : 0)
            : variants.filter((v) => toNumber(v?.quantity) > 0).length;
        if (totalStock <= 0) {
            throw new errors_1.BusinessLogicError('Trial not available: item is out of stock');
        }
        const preferredDate = parsePreferredDate(input.preferredDate);
        const existingActiveRequest = await db_1.default.trialRequest.findFirst({
            where: {
                customerId: BigInt(customerId),
                productId: productIdBig,
                ...(variantIdBig ? { OR: [{ variantId: variantIdBig }, { variantId: null }] } : { variantId: null }),
                status: { in: [...getOpenTrialStatuses()] }
            }
        });
        if (existingActiveRequest) {
            throw new errors_1.BusinessLogicError('You already have an active trial request for this item');
        }
        if (preferredDate) {
            await RentalAvailabilityService_1.RentalAvailabilityService.assertDateAvailableForOrder(product.vendorId, productIdBig, preferredDate, 1, variantIdBig);
        }
        else {
            const activeTrialCount = await db_1.default.trialRequest.count({
                where: {
                    productId: productIdBig,
                    ...(variantIdBig ? { variantId: variantIdBig } : {}),
                    status: { in: [...getOpenTrialStatuses()] }
                }
            });
            if (activeTrialCount >= totalStock) {
                throw new errors_1.BusinessLogicError('Trial not available: all trial slots are full');
            }
        }
        const created = await db_1.default.trialRequest.create({
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
        NotificationService_1.NotificationService.sendNotification({
            userId: product.vendor.userId.toString(),
            type: 'TRIAL_BOOKED',
            title: 'New trial request',
            message: `New trial request for ${product.name}. Preferred date: ${preferredLabel}.`,
            data: { trialRequestId: created.id.toString(), productId: created.productId.toString() }
        }).catch(() => null);
        if (String(product?.vendor?.user?.role || '').toUpperCase() === 'INDIVIDUAL_VENDOR') {
            NotificationService_1.NotificationService.notifyAdminAsVendorOrderUpdate({
                title: 'New trial request',
                message: `A trial request was created for ${product.name}. Preferred date: ${preferredLabel}.`,
                trialRequestId: created.id.toString(),
                productId: created.productId.toString(),
                status: 'PENDING'
            }).catch(() => null);
        }
        return created;
    },
    async getVendorTrialRequests(vendorId, filters) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 10;
        const skip = (page - 1) * limit;
        const status = normalizeStatus(filters.status);
        const search = filters.search?.trim();
        const where = { vendorId: vendorProfileId };
        if (status)
            where.status = status;
        if (search) {
            where.OR = [
                { customer: { name: { contains: search, mode: 'insensitive' } } },
                { product: { name: { contains: search, mode: 'insensitive' } } },
                { trialCode: { contains: search, mode: 'insensitive' } }
            ];
        }
        const trialModel = db_1.default.trialRequest;
        const canUseTrialModel = Boolean(trialModel?.findMany && trialModel?.count);
        const [requests, total, stats] = await Promise.all(canUseTrialModel
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
                    const params = [vendorProfileId.toString()];
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
                    const rows = await db_1.default.$queryRawUnsafe(`SELECT
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
                 OFFSET $${paramIndex} LIMIT $${paramIndex + 1}`, ...params, skip, limit);
                    const productIds = Array.from(new Set(rows.map((r) => String(r.productId)).filter(Boolean)));
                    const images = productIds.length
                        ? await db_1.default.$queryRawUnsafe(`SELECT "productId", "imageUrl", "isCover"
                     FROM "ProductImage"
                     WHERE "productId" IN (${productIds
                            .map((_, i) => `$${i + 1}`)
                            .join(', ')})`, ...productIds)
                        : [];
                    const imagesByProduct = new Map();
                    for (const img of images) {
                        const key = String(img.productId);
                        if (!imagesByProduct.has(key))
                            imagesByProduct.set(key, []);
                        imagesByProduct.get(key).push({
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
                    const params = [vendorProfileId.toString()];
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
                    const rows = await db_1.default.$queryRawUnsafe(`SELECT COUNT(*)::int AS "count"
                 FROM "TrialRequest" tr
                 LEFT JOIN "User" u ON u."id" = tr."customerId"
                 LEFT JOIN "Product" p ON p."id" = tr."productId"
                 WHERE ${whereSql}`, ...params);
                    return toNumber(rows?.[0]?.count);
                })(),
                buildVendorStats(vendorProfileId)
            ]);
        const requestsWithAccessibleImages = await Promise.all(requests.map(withAccessibleTrialProductImages));
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
    async respondToTrialRequest(vendorId, trialRequestId, action, rejectionReason) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        let requestId;
        try {
            requestId = BigInt(trialRequestId);
        }
        catch {
            throw new errors_1.ValidationError('Invalid trialRequestId');
        }
        const request = await db_1.default.trialRequest.findFirst({
            where: { id: requestId, vendorId: vendorProfileId }
        });
        if (!request) {
            throw new errors_1.NotFoundError('Trial request not found');
        }
        if (request.status !== 'PENDING') {
            throw new errors_1.ValidationError('Only pending requests can be updated');
        }
        const normalizedAction = String(action).toUpperCase();
        if (!['ACCEPT', 'REJECT'].includes(normalizedAction)) {
            throw new errors_1.ValidationError('Invalid action');
        }
        if (normalizedAction === 'REJECT') {
            const updated = await db_1.default.trialRequest.update({
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
            NotificationService_1.NotificationService.sendNotification({
                userId: updated.customerId.toString(),
                type: 'TRIAL_CANCELLED',
                title: 'Trial request rejected',
                message: `Your trial request for ${updated.product?.name || 'this item'} was rejected.${updated.rejectionReason ? ` Reason: ${updated.rejectionReason}` : ''}`,
                data: { trialRequestId: updated.id.toString(), productId: updated.productId.toString() }
            }).catch(() => null);
            return updated;
        }
        const trialCode = await generateUniqueTrialCode();
        const updated = await db_1.default.trialRequest.update({
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
        NotificationService_1.NotificationService.sendNotification({
            userId: updated.customerId.toString(),
            type: 'TRIAL_APPROVED',
            title: 'Trial request accepted',
            message: `Your trial request for ${updated.product?.name || 'this item'} is accepted. Your code: ${trialCode}`,
            data: { trialRequestId: updated.id.toString(), productId: updated.productId.toString(), trialCode }
        }).catch(() => null);
        return updated;
    },
    async startTrialRequest(vendorId, trialRequestId, trialCode) {
        if (!hasStartedTrialStatus) {
            throw new errors_1.ValidationError('STARTED status is not available in current database. Run pending migrations and prisma generate.');
        }
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        let requestId;
        try {
            requestId = BigInt(trialRequestId);
        }
        catch {
            throw new errors_1.ValidationError('Invalid trialRequestId');
        }
        const request = await db_1.default.trialRequest.findFirst({
            where: { id: requestId, vendorId: vendorProfileId }
        });
        if (!request) {
            throw new errors_1.NotFoundError('Trial request not found');
        }
        if (request.status !== 'ACCEPTED') {
            throw new errors_1.ValidationError('Only accepted requests can be started');
        }
        if (trialCode && request.trialCode && trialCode.trim() !== request.trialCode) {
            throw new errors_1.ValidationError('Invalid trial code');
        }
        const updated = await db_1.default.trialRequest.update({
            where: { id: requestId },
            data: {
                status: 'STARTED',
                completedAt: null
            },
            include: {
                customer: { select: { id: true, name: true, email: true, phone: true } },
                product: { select: { id: true, name: true } },
                variant: { select: { id: true, size: true, sku: true } }
            }
        });
        NotificationService_1.NotificationService.notifyCustomerTrialStarted(updated.customerId.toString(), updated.id.toString(), updated.product?.name || 'this item', updated.product?.id?.toString()).catch(() => null);
        return updated;
    },
    async completeTrialRequest(vendorId, trialRequestId, trialCode) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        let requestId;
        try {
            requestId = BigInt(trialRequestId);
        }
        catch {
            throw new errors_1.ValidationError('Invalid trialRequestId');
        }
        const request = await db_1.default.trialRequest.findFirst({
            where: { id: requestId, vendorId: vendorProfileId }
        });
        if (!request) {
            throw new errors_1.NotFoundError('Trial request not found');
        }
        if (!getCompletionSourceStatuses().includes(String(request.status || '').toUpperCase())) {
            throw new errors_1.ValidationError(hasStartedTrialStatus ? 'Only started requests can be completed' : 'Only accepted requests can be completed');
        }
        if (!hasStartedTrialStatus && trialCode && request.trialCode && trialCode.trim() !== request.trialCode) {
            throw new errors_1.ValidationError('Invalid trial code');
        }
        const updated = await db_1.default.trialRequest.update({
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
        NotificationService_1.NotificationService.notifyCustomerTrialCompleted(updated.customerId.toString(), updated.id.toString(), updated.product?.name || 'this item', updated.product?.id?.toString()).catch(() => null);
        return updated;
    },
    async markTrialNoShow(vendorId, trialRequestId, reason) {
        if (!hasNoShowTrialStatus) {
            throw new errors_1.ValidationError('NO_SHOW status is not available in current database. Run pending migrations and prisma generate.');
        }
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        let requestId;
        try {
            requestId = BigInt(trialRequestId);
        }
        catch {
            throw new errors_1.ValidationError('Invalid trialRequestId');
        }
        const request = await db_1.default.trialRequest.findFirst({
            where: { id: requestId, vendorId: vendorProfileId }
        });
        if (!request) {
            throw new errors_1.NotFoundError('Trial request not found');
        }
        if (request.status !== 'ACCEPTED') {
            throw new errors_1.ValidationError('Only accepted requests can be marked as no-show');
        }
        const updated = await db_1.default.trialRequest.update({
            where: { id: requestId },
            data: {
                status: 'NO_SHOW',
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
        NotificationService_1.NotificationService.sendNotification({
            userId: updated.customerId.toString(),
            type: 'TRIAL_CANCELLED',
            title: 'Trial marked as no-show',
            message: `Your trial for ${updated.product?.name || 'this item'} was marked as no-show by the vendor.`,
            data: { trialRequestId: updated.id.toString(), productId: updated.productId.toString() }
        }).catch(() => null);
        return updated;
    },
    async getAdminScopedTrialRequests(roleFilter, filters) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 10;
        const skip = (page - 1) * limit;
        const status = normalizeStatus(filters.status);
        const search = filters.search?.trim();
        const vendorWhere = (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter);
        const where = {
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
            db_1.default.trialRequest.findMany({
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
            db_1.default.trialRequest.count({ where }),
            db_1.default.trialRequest.groupBy({
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
            if (groupedStatus === 'PENDING')
                stats.pending = count;
            if (groupedStatus === 'ACCEPTED')
                stats.accepted = count;
            if (groupedStatus === 'STARTED')
                stats.started = count;
            if (groupedStatus === 'REJECTED')
                stats.rejected = count;
            if (groupedStatus === 'COMPLETED')
                stats.completed = count;
            if (groupedStatus === 'NO_SHOW')
                stats.noShow = count;
        }
        const requestsWithAccessibleImages = await Promise.all(requests.map(withAccessibleTrialProductImages));
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
    async respondToAdminScopedTrialRequest(trialRequestId, action, roleFilter, rejectionReason) {
        let requestId;
        try {
            requestId = BigInt(trialRequestId);
        }
        catch {
            throw new errors_1.ValidationError('Invalid trialRequestId');
        }
        const request = await db_1.default.trialRequest.findFirst({
            where: {
                id: requestId,
                vendor: (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter)
            }
        });
        if (!request) {
            throw new errors_1.NotFoundError('Trial request not found');
        }
        if (request.status !== 'PENDING') {
            throw new errors_1.ValidationError('Only pending requests can be updated');
        }
        const normalizedAction = String(action).toUpperCase();
        if (!['ACCEPT', 'REJECT'].includes(normalizedAction)) {
            throw new errors_1.ValidationError('Invalid action');
        }
        if (normalizedAction === 'REJECT') {
            const updated = await db_1.default.trialRequest.update({
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
            NotificationService_1.NotificationService.sendNotification({
                userId: updated.customerId.toString(),
                type: 'TRIAL_CANCELLED',
                title: 'Trial request rejected',
                message: `Your trial request for ${updated.product?.name || 'this item'} was rejected.${updated.rejectionReason ? ` Reason: ${updated.rejectionReason}` : ''}`,
                data: { trialRequestId: updated.id.toString(), productId: updated.productId.toString() }
            }).catch(() => null);
            return updated;
        }
        const trialCode = await generateUniqueTrialCode();
        const updated = await db_1.default.trialRequest.update({
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
        NotificationService_1.NotificationService.sendNotification({
            userId: updated.customerId.toString(),
            type: 'TRIAL_APPROVED',
            title: 'Trial request accepted',
            message: `Your trial request for ${updated.product?.name || 'this item'} is accepted. Your code: ${trialCode}`,
            data: { trialRequestId: updated.id.toString(), productId: updated.productId.toString(), trialCode }
        }).catch(() => null);
        return updated;
    },
    async startAdminScopedTrialRequest(trialRequestId, trialCode, roleFilter) {
        if (!hasStartedTrialStatus) {
            throw new errors_1.ValidationError('STARTED status is not available in current database. Run pending migrations and prisma generate.');
        }
        let requestId;
        try {
            requestId = BigInt(trialRequestId);
        }
        catch {
            throw new errors_1.ValidationError('Invalid trialRequestId');
        }
        const request = await db_1.default.trialRequest.findFirst({
            where: {
                id: requestId,
                vendor: (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter)
            }
        });
        if (!request) {
            throw new errors_1.NotFoundError('Trial request not found');
        }
        if (request.status !== 'ACCEPTED') {
            throw new errors_1.ValidationError('Only accepted requests can be started');
        }
        if (trialCode && request.trialCode && trialCode.trim() !== request.trialCode) {
            throw new errors_1.ValidationError('Invalid trial code');
        }
        const updated = await db_1.default.trialRequest.update({
            where: { id: requestId },
            data: {
                status: 'STARTED',
                completedAt: null
            },
            include: {
                customer: { select: { id: true, name: true, email: true, phone: true } },
                product: { select: { id: true, name: true } },
                variant: { select: { id: true, size: true, sku: true } }
            }
        });
        NotificationService_1.NotificationService.notifyCustomerTrialStarted(updated.customerId.toString(), updated.id.toString(), updated.product?.name || 'this item', updated.product?.id?.toString()).catch(() => null);
        return updated;
    },
    async completeAdminScopedTrialRequest(trialRequestId, trialCode, roleFilter) {
        let requestId;
        try {
            requestId = BigInt(trialRequestId);
        }
        catch {
            throw new errors_1.ValidationError('Invalid trialRequestId');
        }
        const request = await db_1.default.trialRequest.findFirst({
            where: {
                id: requestId,
                vendor: (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter)
            }
        });
        if (!request) {
            throw new errors_1.NotFoundError('Trial request not found');
        }
        if (!getCompletionSourceStatuses().includes(String(request.status || '').toUpperCase())) {
            throw new errors_1.ValidationError(hasStartedTrialStatus ? 'Only started requests can be completed' : 'Only accepted requests can be completed');
        }
        if (!hasStartedTrialStatus && trialCode && request.trialCode && trialCode.trim() !== request.trialCode) {
            throw new errors_1.ValidationError('Invalid trial code');
        }
        const updated = await db_1.default.trialRequest.update({
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
        NotificationService_1.NotificationService.notifyCustomerTrialCompleted(updated.customerId.toString(), updated.id.toString(), updated.product?.name || 'this item', updated.product?.id?.toString()).catch(() => null);
        return updated;
    },
    async getCustomerTrialRequests(customerId, filters) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 10;
        const skip = (page - 1) * limit;
        const status = normalizeStatus(filters.status);
        const where = { customerId: BigInt(customerId) };
        if (status)
            where.status = status;
        const [requests, total] = await Promise.all([
            db_1.default.trialRequest.findMany({
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
            db_1.default.trialRequest.count({ where })
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
    async getCustomerTrialRequestById(customerId, trialRequestId) {
        let requestId;
        try {
            requestId = BigInt(trialRequestId);
        }
        catch {
            throw new errors_1.ValidationError('Invalid trialRequestId');
        }
        const request = await db_1.default.trialRequest.findFirst({
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
            throw new errors_1.NotFoundError('Trial request not found');
        }
        return request;
    }
};

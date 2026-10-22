"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RentalAvailabilityService = void 0;
const client_1 = require("@prisma/client");
const db_1 = __importDefault(require("../config/db"));
const errors_1 = require("../utils/errors");
const ORDER_ITEM_STATUS = client_1.OrderItemStatus;
const ACTIVE_BOOKED_STATUSES = [
    'PLACED',
    'BOOKED',
    'RENTAL_CONFIRMED',
    'ACCEPTED',
    'READY_FOR_PICKUP',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'DISPATCHED',
    'DELIVERED',
    'RETURN_SCHEDULED',
    'RETURNED',
    'DAMAGE_REVIEW',
    'RETURN_REQUESTED',
    'RETURN_RECEIVED'
]
    .map((statusKey) => ORDER_ITEM_STATUS[statusKey])
    .filter((status) => Boolean(status));
const TRIAL_REQUEST_STATUS = client_1.TrialRequestStatus;
const ACTIVE_TRIAL_HOLD_STATUSES = ['PENDING', 'ACCEPTED', 'STARTED']
    .map((statusKey) => TRIAL_REQUEST_STATUS[statusKey])
    .filter((status) => Boolean(status));
const BOOKED_PAYMENT_STATUSES = ['PAID', 'REFUND_PENDING', 'REFUNDED'];
const PENDING_HOLD_WINDOW_MINUTES = 20;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 180;
const OVERRIDE_BLOCKED = 'BLOCKED';
const OVERRIDE_MAINTENANCE = 'MAINTENANCE';
const isMissingColumnError = (error) => {
    const code = error?.code;
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (code === 'P2022' ||
        message.includes('does not exist in the current database') ||
        message.includes('unknown field `cleaningbufferdays`') ||
        message.includes('unknown argument `cleaningbufferdays`') ||
        message.includes('unknown field `rentalstartdate`') ||
        message.includes('unknown argument `rentalstartdate`') ||
        message.includes('unknown field `returnduedate`') ||
        message.includes('unknown argument `returnduedate`'));
};
const toDateKey = (date) => date.toISOString().slice(0, 10);
const normalizeToUtcDate = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const parseDateOnly = (value, fieldName) => {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        throw new errors_1.ValidationError(`${fieldName} must be in YYYY-MM-DD format`);
    }
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(Date.UTC(year, month, day));
};
const parseMonth = (month) => {
    const normalized = month?.trim() || '';
    const match = normalized.match(/^(\d{4})-(\d{2})$/);
    const now = new Date();
    if (!match) {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        return { month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`, start, end };
    }
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const start = new Date(Date.UTC(year, monthIndex, 1));
    const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
    return { month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`, start, end };
};
const getTodayUtc = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};
const listDateKeysInRange = (startDate, endDate) => {
    const keys = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
        keys.push(toDateKey(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return keys;
};
const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const estimateRangeFromLegacyOrder = (row) => {
    const bufferDays = Math.max(0, Math.trunc(toNumber(row.product?.cleaningBufferDays)));
    if (row.rentalStartDate && row.returnDueDate) {
        const end = normalizeToUtcDate(new Date(row.returnDueDate));
        if (bufferDays > 0) {
            end.setUTCDate(end.getUTCDate() + bufferDays);
        }
        return {
            start: normalizeToUtcDate(new Date(row.rentalStartDate)),
            end
        };
    }
    const start = normalizeToUtcDate(new Date(row.order.createdAt));
    const denominator = toNumber(row.product.rentalPrice) * Math.max(1, toNumber(row.quantity));
    const estimatedDays = denominator > 0 ? Math.max(1, Math.round(toNumber(row.rentPrice) / denominator)) : 1;
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + estimatedDays - 1);
    if (bufferDays > 0) {
        end.setUTCDate(end.getUTCDate() + bufferDays);
    }
    return { start, end };
};
const resolveVendorProfileId = async (vendorIdentifier) => {
    let vendorIdBig;
    try {
        vendorIdBig = BigInt(vendorIdentifier);
    }
    catch {
        throw new errors_1.ValidationError('Invalid vendor identifier');
    }
    let vendor = null;
    try {
        vendor = await db_1.default.vendorProfile.findFirst({
            where: {
                OR: [{ id: vendorIdBig }, { userId: vendorIdBig }]
            },
            select: { id: true }
        });
    }
    catch (error) {
        if (!isMissingColumnError(error))
            throw error;
        const rows = await db_1.default.$queryRawUnsafe(`SELECT "id"
       FROM "VendorProfile"
       WHERE "id" = $1 OR "userId" = $1
       LIMIT 1`, vendorIdBig.toString());
        if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id !== undefined && rows[0]?.id !== null) {
            vendor = { id: BigInt(rows[0].id) };
        }
    }
    if (!vendor) {
        throw new errors_1.ValidationError('Vendor not found');
    }
    return vendor.id;
};
const resolveVendorProductId = async (vendorProfileId, productId) => {
    let productIdBig;
    try {
        productIdBig = BigInt(productId);
    }
    catch {
        throw new errors_1.ValidationError('Invalid productId');
    }
    const product = await db_1.default.product.findFirst({
        where: {
            id: productIdBig,
            vendorId: vendorProfileId
        },
        select: { id: true }
    });
    if (!product) {
        throw new errors_1.ValidationError('Product not found for this vendor');
    }
    return product.id;
};
const resolveProductVendorAndId = async (productId) => {
    let productIdBig;
    try {
        productIdBig = BigInt(productId);
    }
    catch {
        throw new errors_1.ValidationError('Invalid productId');
    }
    const product = await db_1.default.product.findFirst({
        where: { id: productIdBig },
        select: { id: true, vendorId: true }
    });
    if (!product) {
        throw new errors_1.ValidationError('Product not found');
    }
    return {
        vendorProfileId: product.vendorId,
        productId: product.id
    };
};
const resolveOptionalVariantId = async (productId, variantId) => {
    const candidate = String(variantId || '').trim();
    if (!candidate)
        return undefined;
    let variantIdBig;
    try {
        variantIdBig = BigInt(candidate);
    }
    catch {
        throw new errors_1.ValidationError('Invalid variantId');
    }
    const variant = await db_1.default.productVariant.findFirst({
        where: {
            id: variantIdBig,
            productId
        },
        select: { id: true }
    });
    if (!variant) {
        throw new errors_1.ValidationError('Product variant not found for this product');
    }
    return variant.id;
};
const getProductStockQuantity = async (productId) => {
    const variants = await db_1.default.productVariant.findMany({
        where: {
            productId,
            quantity: { gt: 0 }
        },
        select: { id: true }
    });
    return variants.length;
};
const getVariantStockQuantity = async (productId, variantId) => {
    const variant = await db_1.default.productVariant.findFirst({
        where: {
            id: variantId,
            productId
        },
        select: {
            quantity: true
        }
    });
    if (!variant) {
        throw new errors_1.ValidationError('Product variant not found for this product');
    }
    return toNumber(variant.quantity) > 0 ? 1 : 0;
};
const buildCalendar = async (vendorProfileId, productId, month, variantId) => {
    const monthInfo = parseMonth(month);
    const todayUtc = getTodayUtc();
    const [overrides, bookedByDate, totalStock] = await Promise.all([
        listOverrides(db_1.default, vendorProfileId, productId, monthInfo.start, monthInfo.end, undefined, variantId),
        getBookedDateQuantities(vendorProfileId, productId, monthInfo.start, monthInfo.end, variantId),
        variantId ? getVariantStockQuantity(productId, variantId) : getProductStockQuantity(productId)
    ]);
    const overrideByDate = new Map();
    for (const row of overrides) {
        const key = toDateKey(new Date(row.date));
        const current = overrideByDate.get(key);
        const isVariantSpecific = row.variantId !== null && row.variantId !== undefined;
        if (!current || (isVariantSpecific && (current.variantId === null || current.variantId === undefined))) {
            overrideByDate.set(key, row);
        }
    }
    const blockedDates = new Set();
    const maintenanceDates = new Set();
    for (const row of overrideByDate.values()) {
        const key = toDateKey(new Date(row.date));
        if (row.type === OVERRIDE_BLOCKED)
            blockedDates.add(key);
        if (row.type === OVERRIDE_MAINTENANCE)
            maintenanceDates.add(key);
    }
    let booked = 0;
    let partiallyBooked = 0;
    let blocked = 0;
    let maintenance = 0;
    let available = 0;
    for (const key of listDateKeysInRange(monthInfo.start, monthInfo.end)) {
        const currentDate = parseDateOnly(key, 'date');
        if (currentDate < todayUtc)
            continue;
        const bookedQuantity = Number(bookedByDate.get(key) || 0);
        const isAtCapacity = totalStock <= 0 || bookedQuantity >= totalStock;
        const isPartiallyBooked = bookedQuantity > 0 && !isAtCapacity;
        if (isAtCapacity) {
            booked += 1;
        }
        else if (isPartiallyBooked) {
            partiallyBooked += 1;
        }
        else if (blockedDates.has(key)) {
            blocked += 1;
        }
        else if (maintenanceDates.has(key)) {
            maintenance += 1;
        }
        else {
            available += 1;
        }
    }
    const upcomingFrom = todayUtc;
    const upcomingTo = new Date(todayUtc);
    upcomingTo.setUTCDate(upcomingTo.getUTCDate() + 6);
    const upcomingDays = listDateKeysInRange(upcomingFrom, upcomingTo);
    const upcoming = {
        booked: upcomingDays.filter((key) => {
            const bookedQuantity = Number(bookedByDate.get(key) || 0);
            return totalStock <= 0 || bookedQuantity >= totalStock;
        }).length,
        partiallyBooked: upcomingDays.filter((key) => {
            const bookedQuantity = Number(bookedByDate.get(key) || 0);
            return bookedQuantity > 0 && bookedQuantity < totalStock;
        }).length,
        blocked: upcomingDays.filter((key) => blockedDates.has(key)).length,
        maintenance: upcomingDays.filter((key) => maintenanceDates.has(key)).length,
        available: upcomingDays.filter((key) => {
            const bookedQuantity = Number(bookedByDate.get(key) || 0);
            const isAtCapacity = totalStock <= 0 || bookedQuantity >= totalStock;
            return !isAtCapacity && !blockedDates.has(key) && !maintenanceDates.has(key);
        }).length
    };
    const bookedDates = Array.from(bookedByDate.entries())
        .filter(([, qty]) => totalStock <= 0 || qty >= totalStock)
        .map(([key]) => key)
        .sort();
    const partiallyBookedDates = Array.from(bookedByDate.entries())
        .filter(([, qty]) => qty > 0 && qty < totalStock)
        .map(([key]) => key)
        .sort();
    return {
        productId: productId.toString(),
        variantId: variantId?.toString() ?? null,
        month: monthInfo.month,
        stock: {
            total: totalStock
        },
        dates: {
            booked: bookedDates,
            partiallyBooked: partiallyBookedDates,
            blocked: Array.from(blockedDates).sort(),
            maintenance: Array.from(maintenanceDates).sort(),
            bookedQuantityByDate: Object.fromEntries(Array.from(bookedByDate.entries()).sort(([a], [b]) => a.localeCompare(b)))
        },
        summary: { booked, partiallyBooked, blocked, maintenance, available },
        upcoming
    };
};
const getTrialHoldDateQuantities = async (vendorProfileId, productId, rangeStart, rangeEnd, variantId) => {
    const dateQuantities = new Map();
    if (ACTIVE_TRIAL_HOLD_STATUSES.length === 0)
        return dateQuantities;
    const trialRows = await db_1.default.trialRequest.findMany({
        where: {
            vendorId: vendorProfileId,
            productId,
            ...(variantId ? { OR: [{ variantId }, { variantId: null }] } : {}),
            status: { in: ACTIVE_TRIAL_HOLD_STATUSES },
            preferredDate: {
                gte: rangeStart,
                lte: rangeEnd
            }
        },
        select: {
            preferredDate: true
        }
    });
    for (const row of trialRows) {
        if (!row.preferredDate)
            continue;
        const key = toDateKey(normalizeToUtcDate(new Date(row.preferredDate)));
        dateQuantities.set(key, Number(dateQuantities.get(key) || 0) + 1);
    }
    return dateQuantities;
};
const getBookedDateQuantities = async (vendorProfileId, productId, rangeStart, rangeEnd, variantId, options) => {
    const includePendingHolds = Boolean(options?.includePendingHolds);
    const holdWindowStart = new Date(Date.now() - PENDING_HOLD_WINDOW_MINUTES * 60 * 1000);
    const pendingHoldBefore = options?.pendingHoldBefore;
    const pendingHoldConditions = [];
    if (includePendingHolds) {
        const pendingCondition = {
            paymentStatus: 'UNPAID',
            createdAt: { gte: holdWindowStart }
        };
        if (pendingHoldBefore?.createdAt) {
            const beforeCreatedAt = new Date(pendingHoldBefore.createdAt);
            const tieBreakerOrderId = pendingHoldBefore.orderId;
            pendingCondition.OR = tieBreakerOrderId
                ? [
                    { createdAt: { lt: beforeCreatedAt } },
                    {
                        createdAt: beforeCreatedAt,
                        id: { lt: tieBreakerOrderId }
                    }
                ]
                : [{ createdAt: { lt: beforeCreatedAt } }];
        }
        pendingHoldConditions.push(pendingCondition);
    }
    const orderWhere = {
        OR: [
            { paymentStatus: { in: BOOKED_PAYMENT_STATUSES } },
            ...pendingHoldConditions
        ]
    };
    if (options?.excludeOrderId) {
        orderWhere.id = { not: options.excludeOrderId };
    }
    let orderItems = [];
    try {
        orderItems = await db_1.default.orderItem.findMany({
            where: {
                vendorId: vendorProfileId,
                productId,
                ...(variantId ? { variantId } : {}),
                status: { in: ACTIVE_BOOKED_STATUSES },
                order: orderWhere
            },
            select: {
                rentalStartDate: true,
                returnDueDate: true,
                rentPrice: true,
                quantity: true,
                order: {
                    select: { createdAt: true }
                },
                product: {
                    select: { rentalPrice: true, cleaningBufferDays: true }
                }
            }
        });
    }
    catch (error) {
        if (!isMissingColumnError(error))
            throw error;
        const fallbackItems = await db_1.default.orderItem.findMany({
            where: {
                vendorId: vendorProfileId,
                productId,
                ...(variantId ? { variantId } : {}),
                status: { in: ACTIVE_BOOKED_STATUSES },
                order: orderWhere
            },
            select: {
                rentPrice: true,
                quantity: true,
                order: {
                    select: { createdAt: true }
                },
                product: {
                    select: { rentalPrice: true }
                }
            }
        });
        orderItems = fallbackItems.map((row) => ({
            ...row,
            rentalStartDate: null,
            returnDueDate: null
        }));
    }
    const dateQuantities = new Map();
    for (const row of orderItems) {
        const range = estimateRangeFromLegacyOrder(row);
        if (range.end < rangeStart || range.start > rangeEnd)
            continue;
        const overlapStart = range.start < rangeStart ? rangeStart : range.start;
        const overlapEnd = range.end > rangeEnd ? rangeEnd : range.end;
        const bookedQty = Math.max(1, Math.trunc(toNumber(row.quantity)));
        listDateKeysInRange(overlapStart, overlapEnd).forEach((key) => {
            dateQuantities.set(key, Number(dateQuantities.get(key) || 0) + bookedQty);
        });
    }
    const trialHoldQuantities = await getTrialHoldDateQuantities(vendorProfileId, productId, rangeStart, rangeEnd, variantId);
    for (const [key, quantity] of trialHoldQuantities.entries()) {
        dateQuantities.set(key, Number(dateQuantities.get(key) || 0) + Number(quantity || 0));
    }
    return dateQuantities;
};
const assertFutureDate = (date, mode) => {
    if (mode === 'AVAILABLE')
        return;
    if (date < getTodayUtc()) {
        throw new errors_1.ValidationError('Past dates cannot be marked as blocked or maintenance');
    }
};
const ensureMode = (modeInput) => {
    const mode = String(modeInput || '').trim().toUpperCase();
    if (!['BLOCKED', 'MAINTENANCE', 'AVAILABLE'].includes(mode)) {
        throw new errors_1.ValidationError('mode must be BLOCKED, MAINTENANCE, or AVAILABLE');
    }
    return mode;
};
const getOverrideDelegate = (client) => client?.productAvailabilityOverride;
const normalizeOverrideType = (mode) => mode === 'BLOCKED' ? OVERRIDE_BLOCKED : OVERRIDE_MAINTENANCE;
const listOverrides = async (client, vendorId, productId, startDate, endDate, take, variantId) => {
    const delegate = getOverrideDelegate(client);
    if (delegate?.findMany) {
        const rows = await delegate.findMany({
            where: {
                vendorId,
                productId,
                ...(variantId !== undefined
                    ? {
                        OR: [{ variantId }, { variantId: null }]
                    }
                    : { variantId: null }),
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { date: 'asc' },
            ...(take ? { take } : {})
        });
        return rows.map((row) => ({
            date: new Date(row.date),
            type: String(row.type || ''),
            note: row.note ?? null,
            variantId: row.variantId ?? null
        }));
    }
    const rows = (await client.$queryRawUnsafe(`SELECT "date", "type", "note", "variantId"
     FROM "ProductAvailabilityOverride"
     WHERE "vendorId" = $1
       AND "productId" = $2
       AND ${variantId !== undefined
        ? `("variantId" = $5 OR "variantId" IS NULL)`
        : `"variantId" IS NULL`}
       AND "date" >= $3
       AND "date" <= $4
     ORDER BY "date" ASC
     ${take ? `LIMIT ${Number(take)}` : ''}`, vendorId.toString(), productId.toString(), startDate, endDate, ...(variantId !== undefined ? [variantId.toString()] : [])));
    return rows.map((row) => ({
        date: new Date(row.date),
        type: String(row.type || ''),
        note: row.note ?? null,
        variantId: row.variantId === undefined || row.variantId === null
            ? null
            : BigInt(row.variantId)
    }));
};
const findOverride = async (client, vendorId, productId, date, variantId) => {
    const delegate = getOverrideDelegate(client);
    if (delegate?.findMany) {
        const rows = await delegate.findMany({
            where: {
                vendorId,
                productId,
                date,
                ...(variantId !== undefined
                    ? {
                        OR: [{ variantId }, { variantId: null }]
                    }
                    : { variantId: null })
            },
            select: {
                type: true,
                date: true,
                note: true,
                variantId: true
            }
        });
        if (!Array.isArray(rows) || rows.length === 0)
            return null;
        const exactMatch = variantId !== undefined
            ? rows.find((row) => row?.variantId !== null && row?.variantId !== undefined)
            : undefined;
        const fallback = exactMatch || rows[0];
        return {
            date: new Date(fallback.date),
            type: String(fallback.type || ''),
            note: fallback.note ?? null,
            variantId: fallback.variantId ?? null
        };
    }
    const rows = (await client.$queryRawUnsafe(`SELECT "date", "type", "note", "variantId"
     FROM "ProductAvailabilityOverride"
     WHERE "vendorId" = $1
       AND "productId" = $2
       AND "date" = $3
       AND ${variantId !== undefined
        ? `("variantId" = $4 OR "variantId" IS NULL)`
        : `"variantId" IS NULL`}
     LIMIT 1`, vendorId.toString(), productId.toString(), date, ...(variantId !== undefined ? [variantId.toString()] : [])));
    if (!Array.isArray(rows) || rows.length === 0)
        return null;
    const exactMatch = variantId !== undefined
        ? rows.find((row) => row?.variantId !== null && row?.variantId !== undefined)
        : undefined;
    const fallback = exactMatch || rows[0];
    return {
        date: new Date(fallback.date),
        type: String(fallback.type || ''),
        note: fallback.note ?? null,
        variantId: fallback.variantId === undefined || fallback.variantId === null
            ? null
            : BigInt(fallback.variantId)
    };
};
const deleteOverrides = async (client, vendorId, productId, filter) => {
    const delegate = getOverrideDelegate(client);
    if (delegate?.deleteMany) {
        return delegate.deleteMany({
            where: {
                vendorId,
                productId,
                ...(filter.variantId !== undefined ? { variantId: filter.variantId } : { variantId: null }),
                ...(filter.date
                    ? { date: filter.date }
                    : {
                        date: {
                            gte: filter.startDate,
                            lte: filter.endDate
                        }
                    })
            }
        });
    }
    const countRows = (await client.$queryRawUnsafe(`SELECT COUNT(*)::int AS "count"
     FROM "ProductAvailabilityOverride"
     WHERE "vendorId" = $1
       AND "productId" = $2
       AND ${filter.variantId !== undefined
        ? `"variantId" = $5`
        : `"variantId" IS NULL`}
       AND ${filter.date
        ? `"date" = $3`
        : `"date" >= $3 AND "date" <= $4`}`, vendorId.toString(), productId.toString(), filter.date || filter.startDate, ...(filter.date ? [] : [filter.endDate]), ...(filter.variantId !== undefined ? [filter.variantId.toString()] : [])));
    await client.$executeRawUnsafe(`DELETE FROM "ProductAvailabilityOverride"
     WHERE "vendorId" = $1
       AND "productId" = $2
       AND ${filter.variantId !== undefined
        ? `"variantId" = $5`
        : `"variantId" IS NULL`}
       AND ${filter.date
        ? `"date" = $3`
        : `"date" >= $3 AND "date" <= $4`}`, vendorId.toString(), productId.toString(), filter.date || filter.startDate, ...(filter.date ? [] : [filter.endDate]), ...(filter.variantId !== undefined ? [filter.variantId.toString()] : []));
    return { count: Number(countRows?.[0]?.count || 0) };
};
const upsertOverride = async (client, vendorId, productId, variantId, date, mode, note) => {
    const type = normalizeOverrideType(mode);
    const trimmedNote = note?.trim() || null;
    const delegate = getOverrideDelegate(client);
    if (delegate?.findFirst && delegate?.create && delegate?.update) {
        const existing = await delegate.findFirst({
            where: {
                vendorId,
                productId,
                date,
                ...(variantId !== undefined ? { variantId } : { variantId: null })
            },
            select: { id: true }
        });
        if (existing?.id) {
            return delegate.update({
                where: { id: existing.id },
                data: {
                    type,
                    note: trimmedNote
                }
            });
        }
        return delegate.create({
            data: {
                vendorId,
                productId,
                variantId: variantId ?? null,
                date,
                type,
                note: trimmedNote
            }
        });
    }
    const existingRows = (await client.$queryRawUnsafe(`SELECT "id"
     FROM "ProductAvailabilityOverride"
     WHERE "vendorId" = $1
       AND "productId" = $2
       AND "date" = $3
       AND ${variantId !== undefined ? `"variantId" = $4` : `"variantId" IS NULL`}
     LIMIT 1`, vendorId.toString(), productId.toString(), date, ...(variantId !== undefined ? [variantId.toString()] : [])));
    if (Array.isArray(existingRows) && existingRows.length > 0 && existingRows[0]?.id !== undefined) {
        await client.$executeRawUnsafe(`UPDATE "ProductAvailabilityOverride"
       SET "type" = $2, "note" = $3, "updatedAt" = NOW()
       WHERE "id" = $1`, String(existingRows[0].id), type, trimmedNote);
        return;
    }
    await client.$executeRawUnsafe(`INSERT INTO "ProductAvailabilityOverride" ("vendorId", "productId", "variantId", "date", "type", "note", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`, vendorId.toString(), productId.toString(), variantId !== undefined ? variantId.toString() : null, date, type, trimmedNote);
};
exports.RentalAvailabilityService = {
    async getVendorProducts(vendorId, filters) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const page = Number(filters.page || 1);
        const limit = Number(filters.limit || 20);
        const skip = (page - 1) * limit;
        const search = String(filters.search || '').trim();
        const where = { vendorId: vendorProfileId };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { category: { name: { contains: search, mode: 'insensitive' } } },
                { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } }
            ];
        }
        const [rows, total] = await Promise.all([
            db_1.default.product.findMany({
                where,
                include: {
                    category: true,
                    variants: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            db_1.default.product.count({ where })
        ]);
        const products = rows.map((row) => ({
            id: row.id.toString(),
            name: row.name,
            category: row.category?.name || '',
            productCode: `PRD-${row.id.toString().padStart(6, '0')}`,
            totalStock: (row.variants || []).length,
            sizes: (row.variants || []).map((variant) => variant.size)
        }));
        return {
            products,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    },
    async getCalendar(vendorId, input) {
        if (!input?.productId) {
            throw new errors_1.ValidationError('productId is required');
        }
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const productId = await resolveVendorProductId(vendorProfileId, input.productId);
        const variantId = await resolveOptionalVariantId(productId, input.variantId);
        return buildCalendar(vendorProfileId, productId, input.month, variantId);
    },
    async getPublicCalendar(productId, input) {
        if (!productId) {
            throw new errors_1.ValidationError('productId is required');
        }
        const resolved = await resolveProductVendorAndId(productId);
        const variantId = await resolveOptionalVariantId(resolved.productId, input.variantId);
        return buildCalendar(resolved.vendorProfileId, resolved.productId, input.month, variantId);
    },
    async upsertDate(vendorId, input) {
        const mode = ensureMode(input.mode);
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const productId = await resolveVendorProductId(vendorProfileId, input.productId);
        const variantId = await resolveOptionalVariantId(productId, input.variantId);
        const date = parseDateOnly(input.date, 'date');
        assertFutureDate(date, mode);
        if (mode !== 'AVAILABLE') {
            const [bookedByDate, totalStock] = await Promise.all([
                getBookedDateQuantities(vendorProfileId, productId, date, date, variantId),
                variantId ? getVariantStockQuantity(productId, variantId) : getProductStockQuantity(productId)
            ]);
            const key = toDateKey(date);
            const bookedQuantity = Number(bookedByDate.get(key) || 0);
            if (totalStock <= 0 || bookedQuantity >= totalStock) {
                throw new errors_1.BusinessLogicError('Selected date is already booked by customers');
            }
            await upsertOverride(db_1.default, vendorProfileId, productId, variantId, date, mode, input.note);
        }
        else {
            await deleteOverrides(db_1.default, vendorProfileId, productId, { date, variantId });
        }
        return {
            productId: productId.toString(),
            variantId: variantId?.toString() ?? null,
            date: toDateKey(date),
            mode
        };
    },
    async upsertRange(vendorId, input) {
        const mode = ensureMode(input.mode);
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const productId = await resolveVendorProductId(vendorProfileId, input.productId);
        const variantId = await resolveOptionalVariantId(productId, input.variantId);
        const startDate = parseDateOnly(input.startDate, 'startDate');
        const endDate = parseDateOnly(input.endDate, 'endDate');
        if (endDate < startDate) {
            throw new errors_1.ValidationError('endDate must be on or after startDate');
        }
        const dateKeys = listDateKeysInRange(startDate, endDate);
        if (dateKeys.length > MAX_RANGE_DAYS) {
            throw new errors_1.ValidationError(`Range cannot exceed ${MAX_RANGE_DAYS} days`);
        }
        if (mode !== 'AVAILABLE') {
            assertFutureDate(startDate, mode);
            const [bookedByDate, totalStock] = await Promise.all([
                getBookedDateQuantities(vendorProfileId, productId, startDate, endDate, variantId),
                variantId ? getVariantStockQuantity(productId, variantId) : getProductStockQuantity(productId)
            ]);
            const conflicts = dateKeys.filter((key) => {
                const bookedQuantity = Number(bookedByDate.get(key) || 0);
                return totalStock <= 0 || bookedQuantity >= totalStock;
            });
            if (conflicts.length > 0) {
                throw new errors_1.BusinessLogicError(`Cannot update range. Some dates are already booked: ${conflicts.slice(0, 5).join(', ')}`);
            }
        }
        await db_1.default.$transaction(async (tx) => {
            if (mode === 'AVAILABLE') {
                await deleteOverrides(tx, vendorProfileId, productId, { startDate, endDate, variantId });
                return;
            }
            for (const key of dateKeys) {
                const date = parseDateOnly(key, 'date');
                await upsertOverride(tx, vendorProfileId, productId, variantId, date, mode, input.note);
            }
        });
        return {
            productId: productId.toString(),
            variantId: variantId?.toString() ?? null,
            mode,
            updatedDates: dateKeys.length
        };
    },
    async clearMonth(vendorId, input) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const productId = await resolveVendorProductId(vendorProfileId, input.productId);
        const variantId = await resolveOptionalVariantId(productId, input.variantId);
        const monthInfo = parseMonth(input.month);
        const result = await deleteOverrides(db_1.default, vendorProfileId, productId, {
            startDate: monthInfo.start,
            endDate: monthInfo.end,
            variantId
        });
        return {
            productId: productId.toString(),
            variantId: variantId?.toString() ?? null,
            month: monthInfo.month,
            cleared: result.count
        };
    },
    async assertDateAvailableForOrder(vendorProfileId, productId, date, requestedQuantity = 1, variantId, options) {
        const normalizedDate = normalizeToUtcDate(date);
        const stockPromise = variantId
            ? getVariantStockQuantity(productId, variantId)
            : getProductStockQuantity(productId);
        const [bookedByDate, totalStock] = await Promise.all([
            getBookedDateQuantities(vendorProfileId, productId, normalizedDate, normalizedDate, variantId, options),
            stockPromise
        ]);
        const key = toDateKey(normalizedDate);
        const bookedQuantity = Number(bookedByDate.get(key) || 0);
        const incomingQuantity = Math.max(1, Math.trunc(toNumber(requestedQuantity)));
        if (totalStock <= 0 || bookedQuantity + incomingQuantity > totalStock) {
            throw new errors_1.BusinessLogicError(`Date ${toDateKey(normalizedDate)} is already booked by customers`);
        }
        const override = await findOverride(db_1.default, vendorProfileId, productId, normalizedDate, variantId);
        if (override?.type === OVERRIDE_BLOCKED) {
            throw new errors_1.BusinessLogicError(`Date ${toDateKey(normalizedDate)} is blocked by vendor`);
        }
        if (override?.type === OVERRIDE_MAINTENANCE) {
            throw new errors_1.BusinessLogicError(`Date ${toDateKey(normalizedDate)} is under maintenance`);
        }
    },
    async assertRangeAvailableForOrder(vendorProfileId, productId, startDate, endDate, requestedQuantity = 1, variantId, options) {
        const normalizedStart = normalizeToUtcDate(startDate);
        const normalizedEnd = normalizeToUtcDate(endDate);
        const stockPromise = variantId
            ? getVariantStockQuantity(productId, variantId)
            : getProductStockQuantity(productId);
        const [bookedByDate, totalStock] = await Promise.all([
            getBookedDateQuantities(vendorProfileId, productId, normalizedStart, normalizedEnd, variantId, options),
            stockPromise
        ]);
        const incomingQuantity = Math.max(1, Math.trunc(toNumber(requestedQuantity)));
        const conflicts = Array.from(bookedByDate.entries())
            .filter(([, qty]) => totalStock <= 0 || Number(qty || 0) + incomingQuantity > totalStock)
            .map(([key]) => key)
            .sort();
        if (conflicts.length > 0) {
            const conflictDate = conflicts[0];
            throw new errors_1.BusinessLogicError(`Selected window includes already booked date ${conflictDate}`);
        }
        const overrides = await listOverrides(db_1.default, vendorProfileId, productId, normalizedStart, normalizedEnd, 1, variantId);
        if (overrides.length === 0)
            return;
        const conflict = overrides[0];
        const key = toDateKey(new Date(conflict.date));
        if (conflict.type === OVERRIDE_BLOCKED) {
            throw new errors_1.BusinessLogicError(`Selected window includes blocked date ${key}`);
        }
        throw new errors_1.BusinessLogicError(`Selected window includes maintenance date ${key}`);
    }
};

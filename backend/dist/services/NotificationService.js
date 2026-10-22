"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const db_1 = __importDefault(require("../config/db"));
const FirebaseService_1 = require("./FirebaseService");
const SmsService_1 = require("./SmsService");
const EmailService_1 = require("./EmailService");
const socketServer_1 = require("../realtime/socketServer");
const roles_1 = require("../utils/roles");
const INDIVIDUAL_VENDOR_NOTIFICATION_TYPES = new Set([
    'INDIVIDUAL_VENDOR_PRODUCT_ADDED',
    'INDIVIDUAL_VENDOR_CONTRACT_UPDATED',
    'INDIVIDUAL_VENDOR_PRODUCT_STATUS_CHANGED',
    'INDIVIDUAL_VENDOR_EARNING',
    'INDIVIDUAL_VENDOR_SUPPORT'
]);
const ADMIN_AS_VENDOR_NOTIFICATION_TYPES = new Set([
    'ADMIN_VENDOR_ORDER',
    'ADMIN_VENDOR_INVENTORY',
    'ADMIN_VENDOR_FINANCE',
    'ADMIN_VENDOR_PRODUCT',
    'ADMIN_VENDOR_SUPPORT',
    'ADMIN_VENDOR_SYSTEM'
]);
const NOTIFICATION_LOG_COMPATIBLE_TYPES = new Set([
    'OTP',
    'TRIAL_BOOKED',
    'TRIAL_APPROVED',
    'TRIAL_REMINDER',
    'FINAL_REMINDER',
    'TRIAL_CANCELLED',
    'BOOKING_CANCELLED',
    'VENDOR_UNAVAILABLE',
    'RESCHEDULED',
    'ORDER_PLACED_VENDOR',
    'ORDER_ACCEPTED_CUSTOMER',
    'ORDER_REJECTED_CUSTOMER',
    'REVIEW_SUBMITTED',
    'REVIEW_INVALID_PRODUCT',
    'ADMIN_VENDOR_ORDER',
    'ADMIN_VENDOR_INVENTORY',
    'ADMIN_VENDOR_FINANCE',
    'ADMIN_VENDOR_PRODUCT',
    'ADMIN_VENDOR_SUPPORT',
    'ADMIN_VENDOR_SYSTEM'
]);
const getNotificationLogQueryableTypes = (allowedTypes) => {
    if (!allowedTypes)
        return undefined;
    return Array.from(allowedTypes).filter((type) => NOTIFICATION_LOG_COMPATIBLE_TYPES.has(type));
};
const isCriticalType = (type) => type === 'TRIAL_APPROVED' ||
    type === 'FINAL_REMINDER' ||
    type === 'TRIAL_CANCELLED' ||
    type === 'BOOKING_CANCELLED' ||
    type === 'VENDOR_UNAVAILABLE' ||
    type === 'ORDER_PLACED_VENDOR' ||
    type === 'ORDER_ACCEPTED_CUSTOMER' ||
    type === 'ORDER_REJECTED_CUSTOMER';
const isOtpType = (type) => type === 'OTP';
const shouldSendSmsForType = (type) => isOtpType(type) || isCriticalType(type);
const now = () => new Date();
const toBigInt = (id) => (typeof id === 'bigint' ? id : BigInt(id));
const normalizeUserKey = (value) => String(value).trim();
const normalizeTypeKey = (value) => String(value || '').trim().toUpperCase();
const hasAllowedType = (type, allowedTypes) => !allowedTypes || allowedTypes.has(normalizeTypeKey(type));
const formatNotificationLabel = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part, index) => index === 0
    ? `${part.charAt(0).toUpperCase()}${part.slice(1)}`
    : part)
    .join(' ');
const buildRealtimeRefs = (data) => {
    const normalized = Object.fromEntries(Object.entries(data || {}).map(([key, value]) => [key, String(value || '').trim()]));
    return Object.fromEntries(Object.entries(normalized).filter(([, value]) => value));
};
const getRealtimeDomainsForNotification = (type) => {
    switch (type) {
        case 'TRIAL_BOOKED':
        case 'TRIAL_APPROVED':
        case 'TRIAL_REMINDER':
        case 'FINAL_REMINDER':
        case 'TRIAL_CANCELLED':
            return ['trials', 'dashboard'];
        case 'ORDER_PLACED_VENDOR':
        case 'ORDER_ACCEPTED_CUSTOMER':
        case 'ORDER_REJECTED_CUSTOMER':
            return ['orders', 'dashboard'];
        case 'ADMIN_VENDOR_ORDER':
            return ['orders', 'operations', 'dashboard'];
        case 'ADMIN_VENDOR_PRODUCT':
        case 'INDIVIDUAL_VENDOR_PRODUCT_ADDED':
        case 'INDIVIDUAL_VENDOR_PRODUCT_STATUS_CHANGED':
            return ['products', 'dashboard'];
        case 'ADMIN_VENDOR_FINANCE':
        case 'INDIVIDUAL_VENDOR_EARNING':
            return ['finance', 'dashboard'];
        case 'ADMIN_VENDOR_SUPPORT':
        case 'INDIVIDUAL_VENDOR_SUPPORT':
            return ['support', 'dashboard'];
        case 'ADMIN_VENDOR_INVENTORY':
        case 'ADMIN_VENDOR_SYSTEM':
            return ['products', 'operations', 'dashboard'];
        case 'BOOKING_CANCELLED':
        case 'VENDOR_UNAVAILABLE':
        case 'RESCHEDULED':
            return ['orders', 'trials', 'dashboard'];
        case 'REVIEW_SUBMITTED':
        case 'REVIEW_INVALID_PRODUCT':
            return ['orders'];
        default:
            return [];
    }
};
const isIndividualVendorRole = (value) => normalizeTypeKey(value) === 'INDIVIDUAL_VENDOR';
const normalizeNotificationDataRecord = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        String(entryValue)
    ]));
};
const NOTIFICATION_DEDUPE_WINDOW_MS = 2 * 60 * 1000;
const NOTIFICATION_DEDUPE_FETCH_CAP = 250;
const NOTIFICATION_FINGERPRINT_IGNORED_DATA_KEYS = new Set([
    'source',
    'notificationId',
    'createdAt',
    'readAt',
    'timestamp',
    'updatedAt'
]);
const normalizeNotificationText = (value) => String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
const serializeNotificationDataForFingerprint = (value, options) => {
    const normalized = normalizeNotificationDataRecord(value);
    const orderedEntries = Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b));
    const filteredEntries = orderedEntries.filter(([key, entryValue]) => {
        if (!String(entryValue || '').trim())
            return false;
        if (options?.includeIgnoredKeys)
            return true;
        return !NOTIFICATION_FINGERPRINT_IGNORED_DATA_KEYS.has(key);
    });
    return JSON.stringify(filteredEntries);
};
const buildNotificationFingerprint = (payload, options) => {
    const parts = [
        normalizeNotificationText(payload.title),
        normalizeNotificationText(payload.message),
        serializeNotificationDataForFingerprint(payload.data, {
            includeIgnoredKeys: options?.includeIgnoredKeys
        })
    ];
    if (options?.includeType !== false) {
        parts.unshift(normalizeTypeKey(payload.type));
    }
    return parts.join('|');
};
const getNotificationCreatedAtMs = (value) => {
    const ts = new Date(value ? String(value) : now().toISOString()).getTime();
    return Number.isFinite(ts) ? ts : 0;
};
const dedupeRecentNotificationRows = (rows) => {
    const latestByFingerprint = new Map();
    const deduped = [];
    for (const row of rows) {
        const fingerprint = buildNotificationFingerprint(row, {
            includeType: false
        });
        const createdAtMs = getNotificationCreatedAtMs(row?.createdAt);
        const latestSeen = latestByFingerprint.get(fingerprint);
        if (latestSeen !== undefined &&
            Math.abs(latestSeen - createdAtMs) <= NOTIFICATION_DEDUPE_WINDOW_MS) {
            continue;
        }
        latestByFingerprint.set(fingerprint, createdAtMs);
        deduped.push(row);
    }
    return deduped;
};
const getInAppNotificationModel = () => db_1.default.inAppNotification;
const buildLegacyLogNotificationId = (rowId) => `legacy-log-${String(rowId || '')}`;
const buildBootstrapNotificationId = (targetUserId, sourceId) => `bootstrap-${normalizeUserKey(targetUserId)}-${String(sourceId || '')}`;
const mapInAppNotificationRow = (row) => ({
    id: String(row?.id || ''),
    userId: normalizeUserKey(row?.userId || ''),
    type: String(row?.type || 'ORDER_ACCEPTED_CUSTOMER'),
    title: String(row?.title || 'Notification'),
    message: String(row?.message || ''),
    data: normalizeNotificationDataRecord(row?.data),
    createdAt: row?.createdAt
        ? new Date(row.createdAt).toISOString()
        : now().toISOString(),
    readAt: row?.readAt ? new Date(row.readAt).toISOString() : null
});
const buildInAppWhere = (userIdBig, allowedTypes) => {
    const where = { userId: userIdBig };
    if (allowedTypes && allowedTypes.size > 0) {
        where.type = { in: Array.from(allowedTypes) };
    }
    return where;
};
const countUnreadInAppNotifications = async (userId, allowedTypes) => {
    const model = getInAppNotificationModel();
    if (!model?.findMany)
        return 0;
    const where = {
        ...buildInAppWhere(toBigInt(normalizeUserKey(userId)), allowedTypes),
        readAt: null
    };
    const rows = await model.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: NOTIFICATION_DEDUPE_FETCH_CAP
    });
    return dedupeRecentNotificationRows(rows || []).length;
};
const appendInAppNotification = async (payload) => {
    const model = getInAppNotificationModel();
    if (!model?.create || !model?.findMany) {
        throw new Error('InAppNotification table not available. Run prisma migrate + prisma generate.');
    }
    const key = normalizeUserKey(payload.userId);
    const incomingStrictFingerprint = buildNotificationFingerprint(payload, {
        includeIgnoredKeys: true
    });
    const incomingDisplayFingerprint = buildNotificationFingerprint(payload, {
        includeType: false
    });
    const dedupeCutoff = new Date(Date.now() - NOTIFICATION_DEDUPE_WINDOW_MS);
    const recentCandidates = await model.findMany({
        where: {
            userId: toBigInt(key),
            createdAt: {
                gt: dedupeCutoff
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
    });
    const existingDuplicate = (recentCandidates || []).find((row) => {
        const strictFingerprint = buildNotificationFingerprint(row, {
            includeIgnoredKeys: true
        });
        const displayFingerprint = buildNotificationFingerprint(row, {
            includeType: false
        });
        if (strictFingerprint !== incomingStrictFingerprint &&
            displayFingerprint !== incomingDisplayFingerprint) {
            return false;
        }
        return (Math.abs(getNotificationCreatedAtMs(row?.createdAt) - Date.now()) <= NOTIFICATION_DEDUPE_WINDOW_MS);
    });
    if (existingDuplicate) {
        return mapInAppNotificationRow(existingDuplicate);
    }
    const created = await model.create({
        data: {
            userId: toBigInt(key),
            type: payload.type,
            title: payload.title,
            message: payload.message,
            data: payload.data || {}
        }
    });
    const notification = mapInAppNotificationRow(created);
    const unreadCount = await countUnreadInAppNotifications(key);
    (0, socketServer_1.emitNotificationUpdated)(key, {
        unreadCount,
        notification: {
            ...notification,
            read: false
        }
    });
    return notification;
};
const listInAppNotifications = async (userId, page, limit, allowedTypes) => {
    const model = getInAppNotificationModel();
    if (!model?.findMany || !model?.count) {
        return {
            notifications: [],
            pagination: { page, limit, total: 0, pages: 0 },
            unreadCount: 0
        };
    }
    const key = normalizeUserKey(userId);
    const where = buildInAppWhere(toBigInt(key), allowedTypes);
    const scanLimit = Math.min(Math.max(page * limit * 3, limit * 3), NOTIFICATION_DEDUPE_FETCH_CAP);
    const [rawTotal, unreadCount, rows] = await Promise.all([
        model.count({ where }),
        countUnreadInAppNotifications(key, allowedTypes),
        model.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: scanLimit
        })
    ]);
    const dedupedRows = dedupeRecentNotificationRows(rows || []);
    const pageStart = (page - 1) * limit;
    const pageRows = dedupedRows.slice(pageStart, pageStart + limit);
    const visibleTotal = Math.max(Number(rawTotal || 0) - Math.max(0, (rows || []).length - dedupedRows.length), dedupedRows.length);
    return {
        notifications: pageRows.map((row) => ({
            ...mapInAppNotificationRow(row),
            read: row?.readAt !== null
        })),
        pagination: {
            page,
            limit,
            total: visibleTotal,
            pages: visibleTotal > 0 ? Math.ceil(visibleTotal / limit) : 0
        },
        unreadCount
    };
};
const markInAppNotificationsRead = async (userId, options, allowedTypes) => {
    const model = getInAppNotificationModel();
    if (!model?.updateMany) {
        return { updated: 0, unreadCount: 0 };
    }
    const key = normalizeUserKey(userId);
    const ids = Array.isArray(options?.ids)
        ? options.ids.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
    const markAll = options?.markAll === true || ids.length === 0;
    const where = {
        ...buildInAppWhere(toBigInt(key), allowedTypes),
        readAt: null
    };
    if (!markAll) {
        where.id = { in: ids };
    }
    const result = await model.updateMany({
        where,
        data: {
            readAt: now()
        }
    });
    const updated = Number(result?.count || 0);
    const unreadCount = await countUnreadInAppNotifications(key, allowedTypes);
    if (updated > 0) {
        (0, socketServer_1.emitNotificationUpdated)(key, { unreadCount });
    }
    return { updated, unreadCount };
};
const resolveVendorNotificationTarget = async (vendorIdentifier) => {
    let vendorIdBig;
    try {
        vendorIdBig = BigInt(vendorIdentifier);
    }
    catch {
        return null;
    }
    const vendor = await db_1.default.vendorProfile.findFirst({
        where: {
            OR: [{ id: vendorIdBig }, { userId: vendorIdBig }]
        },
        select: {
            userId: true,
            user: {
                select: {
                    role: true
                }
            }
        }
    });
    if (!vendor?.userId)
        return null;
    return {
        userId: vendor.userId.toString(),
        role: String(vendor.user?.role || '')
    };
};
const safeLog = async (params) => {
    const model = db_1.default.notificationLog;
    if (!model?.create) {
        console.log('NotificationLog skipped (prisma generate/migration pending)', {
            ...params,
            userId: params.userId.toString()
        });
        return;
    }
    if (!NOTIFICATION_LOG_COMPATIBLE_TYPES.has(params.type)) {
        return;
    }
    try {
        await model.create({
            data: {
                userId: params.userId,
                type: params.type,
                channel: params.channel,
                status: params.status,
                title: params.title ?? null,
                message: params.message,
                provider: params.provider ?? null,
                error: params.error ?? null,
                metadata: params.metadata ?? undefined,
                sentAt: params.sentAt ?? null
            }
        });
    }
    catch (error) {
        console.error('NotificationLog write failed; continuing without dashboard log.', {
            error,
            type: params.type,
            channel: params.channel,
            userId: params.userId.toString()
        });
    }
};
const fetchActiveFcmTokens = async (userId) => {
    const model = db_1.default.userDevice;
    if (!model?.findMany)
        return [];
    try {
        const rows = await model.findMany({
            where: { userId, isActive: true },
            select: { fcmToken: true }
        });
        return (rows || []).map((row) => String(row.fcmToken)).filter(Boolean);
    }
    catch (error) {
        console.error('UserDevice read failed; treating as no FCM tokens.', {
            error,
            userId: userId.toString()
        });
        return [];
    }
};
const deactivateBadTokens = async (tokens) => {
    if (tokens.length === 0)
        return;
    const model = db_1.default.userDevice;
    if (!model?.updateMany)
        return;
    try {
        await model.updateMany({
            where: { fcmToken: { in: tokens } },
            data: { isActive: false, lastUsedAt: now() }
        });
    }
    catch (error) {
        console.error('UserDevice token deactivation failed; continuing.', { error });
    }
};
const resolveVendorUserId = async (vendorIdentifier) => {
    const target = await resolveVendorNotificationTarget(vendorIdentifier);
    return target?.userId || null;
};
const resolveOrderItemNotificationContext = async (orderItemIdentifier) => {
    const normalizedOrderItemId = String(orderItemIdentifier || '').trim();
    if (!normalizedOrderItemId)
        return null;
    let orderItemIdBig;
    try {
        orderItemIdBig = BigInt(normalizedOrderItemId);
    }
    catch {
        return null;
    }
    const orderItem = await db_1.default.orderItem.findUnique({
        where: { id: orderItemIdBig },
        select: {
            id: true,
            orderId: true,
            order: {
                select: {
                    orderNo: true
                }
            },
            product: {
                select: {
                    name: true
                }
            }
        }
    }).catch(() => null);
    if (!orderItem)
        return null;
    const orderNo = String(orderItem.order?.orderNo || `ORD-${orderItem.orderId.toString()}`).trim();
    const productName = String(orderItem.product?.name || 'Product').trim() || 'Product';
    return {
        orderItemId: orderItem.id.toString(),
        orderNo,
        productName,
        itemLabel: `${orderNo} - ${productName}`
    };
};
const notifyAdminAsVendorUsers = async (payload) => {
    const admins = await db_1.default.user.findMany({
        where: {
            role: { in: roles_1.ADMIN_AS_VENDOR_ROLES },
            status: 'ACTIVE'
        },
        select: { id: true }
    });
    if (!admins.length)
        return;
    await Promise.all(admins.map((admin) => exports.NotificationService.sendNotification({
        userId: admin.id.toString(),
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data
    })));
};
const readNotificationLogRowsForBackfill = async (userIdBig, allowedTypes) => {
    const model = db_1.default.notificationLog;
    if (!model?.findMany)
        return [];
    const baseWhere = { userId: userIdBig };
    const queryableTypes = getNotificationLogQueryableTypes(allowedTypes);
    if (allowedTypes && (!queryableTypes || queryableTypes.length === 0)) {
        return [];
    }
    if (queryableTypes && queryableTypes.length > 0) {
        baseWhere.type = { in: queryableTypes };
    }
    try {
        const inAppRows = await model.findMany({
            where: {
                ...baseWhere,
                provider: 'IN_APP'
            },
            orderBy: { createdAt: 'desc' },
            take: 500
        });
        if (Array.isArray(inAppRows) && inAppRows.length > 0) {
            return inAppRows;
        }
        return model.findMany({
            where: baseWhere,
            orderBy: { createdAt: 'desc' },
            take: 500
        });
    }
    catch (error) {
        console.error('NotificationLog read for backfill failed.', {
            error,
            userId: userIdBig.toString()
        });
        return [];
    }
};
const logInAppNotificationReplica = async (params) => {
    await safeLog({
        userId: params.userId,
        type: params.type,
        channel: 'FCM',
        status: 'SENT',
        title: params.title,
        message: params.message,
        provider: 'IN_APP',
        metadata: {
            inApp: true,
            data: params.data || {}
        },
        sentAt: now()
    });
};
const mapNotificationLogRowToInAppCreateData = (row, userId) => {
    const metadata = row?.metadata && typeof row.metadata === 'object' && row.metadata !== null
        ? row.metadata
        : {};
    return {
        id: buildLegacyLogNotificationId(row?.id),
        userId: toBigInt(userId),
        type: String(row?.type || 'ORDER_ACCEPTED_CUSTOMER'),
        title: String(row?.title || row?.type || 'Notification'),
        message: String(row?.message || ''),
        data: normalizeNotificationDataRecord(metadata.data),
        createdAt: row?.createdAt ? new Date(row.createdAt) : now(),
        readAt: null
    };
};
const backfillFromLegacyNotificationLog = async (userId, allowedTypes) => {
    const normalizedUserId = normalizeUserKey(userId);
    const inAppModel = getInAppNotificationModel();
    const logModel = db_1.default.notificationLog;
    if (!inAppModel?.count || !inAppModel?.createMany || !logModel?.findMany) {
        return false;
    }
    const userIdBig = toBigInt(normalizedUserId);
    const existingCount = await inAppModel.count({
        where: buildInAppWhere(userIdBig, allowedTypes)
    });
    if (Number(existingCount || 0) > 0) {
        return false;
    }
    const rows = await readNotificationLogRowsForBackfill(userIdBig, allowedTypes);
    if (!Array.isArray(rows) || rows.length === 0)
        return false;
    const data = rows
        .filter((entry) => hasAllowedType(entry?.type, allowedTypes))
        .map((row) => mapNotificationLogRowToInAppCreateData(row, normalizedUserId));
    if (data.length === 0)
        return false;
    await inAppModel.createMany({
        data,
        skipDuplicates: true
    });
    return true;
};
const cloneNotificationsToUser = async (targetUserId, sourceRows) => {
    const inAppModel = getInAppNotificationModel();
    if (!inAppModel?.count || !inAppModel?.createMany) {
        return false;
    }
    const normalizedTargetUserId = normalizeUserKey(targetUserId);
    if (sourceRows.length === 0) {
        return false;
    }
    const existingCount = await inAppModel.count({
        where: {
            userId: toBigInt(normalizedTargetUserId),
            type: { in: sourceRows.map((row) => String(row.type)) }
        }
    });
    if (Number(existingCount || 0) > 0) {
        return false;
    }
    const data = sourceRows.map((row) => ({
        id: buildBootstrapNotificationId(normalizedTargetUserId, row.id),
        userId: toBigInt(normalizedTargetUserId),
        type: String(row.type),
        title: row.title,
        message: row.message,
        data: row.data || {},
        createdAt: row.createdAt ? new Date(row.createdAt) : now(),
        readAt: null
    }));
    await inAppModel.createMany({
        data,
        skipDuplicates: true
    });
    return true;
};
const bootstrapAdminAsVendorNotificationsFromPeers = async (userId) => {
    const normalizedUserId = normalizeUserKey(userId);
    const admins = await db_1.default.user.findMany({
        where: {
            role: { in: roles_1.ADMIN_AS_VENDOR_ROLES },
            status: 'ACTIVE'
        },
        select: { id: true }
    });
    const peerIds = admins
        .map((row) => normalizeUserKey(row.id))
        .filter((id) => id !== normalizedUserId);
    if (peerIds.length === 0)
        return false;
    const inAppModel = getInAppNotificationModel();
    if (inAppModel?.findMany) {
        const peerRows = await inAppModel.findMany({
            where: {
                userId: { in: peerIds.map((id) => toBigInt(id)) },
                type: { in: Array.from(ADMIN_AS_VENDOR_NOTIFICATION_TYPES) }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        if (Array.isArray(peerRows) && peerRows.length > 0) {
            return cloneNotificationsToUser(normalizedUserId, peerRows.map(mapInAppNotificationRow));
        }
    }
    const model = db_1.default.notificationLog;
    if (!model?.findMany)
        return false;
    try {
        const notificationTypes = Array.from(ADMIN_AS_VENDOR_NOTIFICATION_TYPES);
        const rows = await model.findMany({
            where: {
                userId: { in: peerIds.map((id) => toBigInt(id)) },
                type: { in: notificationTypes },
                provider: 'IN_APP'
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        if (!Array.isArray(rows) || rows.length === 0) {
            return false;
        }
        const mapped = rows.map((row) => ({
            id: buildLegacyLogNotificationId(row?.id),
            userId: normalizedUserId,
            type: String(row?.type || 'ADMIN_VENDOR_SYSTEM'),
            title: String(row?.title || row?.type || 'Notification'),
            message: String(row?.message || ''),
            data: row?.metadata && typeof row.metadata === 'object' && row.metadata !== null
                ? Object.fromEntries(Object.entries(row.metadata.data || {}).map(([entryKey, entryValue]) => [entryKey, String(entryValue)]))
                : {},
            createdAt: row?.createdAt
                ? new Date(row.createdAt).toISOString()
                : now().toISOString(),
            readAt: null
        }));
        return cloneNotificationsToUser(normalizedUserId, mapped);
    }
    catch (error) {
        console.error('Admin-as-vendor notification bootstrap failed.', {
            error,
            userId: normalizedUserId
        });
        return false;
    }
};
exports.NotificationService = {
    async registerFcmToken(userId, token, platform) {
        const trimmed = String(token || '').trim();
        if (!trimmed) {
            return { success: false, error: 'Token is required' };
        }
        const model = db_1.default.userDevice;
        if (!model?.upsert) {
            return {
                success: false,
                error: 'UserDevice table not available. Run prisma migrate + prisma generate.'
            };
        }
        const userIdBig = toBigInt(userId);
        await model.upsert({
            where: { fcmToken: trimmed },
            update: { userId: userIdBig, platform: platform || null, isActive: true, lastUsedAt: now() },
            create: { userId: userIdBig, fcmToken: trimmed, platform: platform || null, isActive: true, lastUsedAt: now() }
        });
        return { success: true };
    },
    async unregisterFcmToken(userId, token) {
        const trimmed = String(token || '').trim();
        if (!trimmed) {
            return { success: false, error: 'Token is required' };
        }
        const model = db_1.default.userDevice;
        if (!model?.updateMany) {
            return {
                success: false,
                error: 'UserDevice table not available. Run prisma migrate + prisma generate.'
            };
        }
        const userIdBig = toBigInt(userId);
        await model.updateMany({
            where: { userId: userIdBig, fcmToken: trimmed },
            data: { isActive: false, lastUsedAt: now() }
        });
        return { success: true };
    },
    async listMyNotifications(userId, query) {
        const pageRaw = Number(query?.page ?? 1);
        const limitRaw = Number(query?.limit ?? 20);
        const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : 20;
        const normalizedUserId = normalizeUserKey(userId);
        await backfillFromLegacyNotificationLog(normalizedUserId);
        return listInAppNotifications(normalizedUserId, page, limit);
    },
    async listIndividualVendorNotifications(userId, query) {
        const pageRaw = Number(query?.page ?? 1);
        const limitRaw = Number(query?.limit ?? 20);
        const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : 20;
        const normalizedUserId = normalizeUserKey(userId);
        await backfillFromLegacyNotificationLog(normalizedUserId, INDIVIDUAL_VENDOR_NOTIFICATION_TYPES);
        return listInAppNotifications(normalizedUserId, page, limit, INDIVIDUAL_VENDOR_NOTIFICATION_TYPES);
    },
    async listAdminAsVendorNotifications(userId, query) {
        const pageRaw = Number(query?.page ?? 1);
        const limitRaw = Number(query?.limit ?? 20);
        const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : 20;
        const normalizedUserId = normalizeUserKey(userId);
        await backfillFromLegacyNotificationLog(normalizedUserId, ADMIN_AS_VENDOR_NOTIFICATION_TYPES);
        const inApp = await listInAppNotifications(normalizedUserId, page, limit, ADMIN_AS_VENDOR_NOTIFICATION_TYPES);
        if (inApp.pagination.total > 0) {
            return inApp;
        }
        const bootstrapped = await bootstrapAdminAsVendorNotificationsFromPeers(normalizedUserId);
        if (bootstrapped) {
            return listInAppNotifications(normalizedUserId, page, limit, ADMIN_AS_VENDOR_NOTIFICATION_TYPES);
        }
        return {
            notifications: [],
            pagination: { page, limit, total: 0, pages: 0 },
            unreadCount: 0
        };
    },
    async markMyNotificationsRead(userId, payload) {
        const normalizedUserId = normalizeUserKey(userId);
        await backfillFromLegacyNotificationLog(normalizedUserId);
        return markInAppNotificationsRead(normalizedUserId, payload);
    },
    async markIndividualVendorNotificationsRead(userId, payload) {
        const normalizedUserId = normalizeUserKey(userId);
        await backfillFromLegacyNotificationLog(normalizedUserId, INDIVIDUAL_VENDOR_NOTIFICATION_TYPES);
        return markInAppNotificationsRead(normalizedUserId, payload, INDIVIDUAL_VENDOR_NOTIFICATION_TYPES);
    },
    async markAdminAsVendorNotificationsRead(userId, payload) {
        const normalizedUserId = normalizeUserKey(userId);
        await backfillFromLegacyNotificationLog(normalizedUserId, ADMIN_AS_VENDOR_NOTIFICATION_TYPES);
        await bootstrapAdminAsVendorNotificationsFromPeers(normalizedUserId);
        return markInAppNotificationsRead(normalizedUserId, payload, ADMIN_AS_VENDOR_NOTIFICATION_TYPES);
    },
    async sendNotification(params) {
        const userIdBig = toBigInt(params.userId);
        const user = await db_1.default.user.findUnique({
            where: { id: userIdBig },
            select: { id: true, phone: true, email: true, name: true }
        });
        if (!user) {
            return { success: false, error: 'User not found' };
        }
        await appendInAppNotification({
            userId: user.id.toString(),
            type: params.type,
            title: params.title,
            message: params.message,
            data: params.data
        }).catch((error) => {
            console.error('In-app notification write failed; continuing.', {
                error,
                userId: user.id.toString(),
                type: params.type
            });
        });
        await logInAppNotificationReplica({
            userId: userIdBig,
            type: params.type,
            title: params.title,
            message: params.message,
            data: params.data
        }).catch((error) => {
            console.error('In-app notification log mirror failed; continuing.', {
                error,
                userId: user.id.toString(),
                type: params.type
            });
        });
        const realtimeDomains = getRealtimeDomainsForNotification(params.type);
        if (realtimeDomains.length > 0) {
            (0, socketServer_1.emitDataUpdatedToUser)(user.id.toString(), {
                domains: realtimeDomains,
                refs: buildRealtimeRefs(params.data),
                reason: params.type
            });
        }
        // Some vendor records store phone in VendorProfile instead of User.phone.
        const vendorPhoneFallback = !user.phone
            ? await db_1.default.vendorProfile
                .findUnique({ where: { userId: userIdBig }, select: { phone: true } })
                .catch(() => null)
            : null;
        const resolvedPhone = String(user.phone || vendorPhoneFallback?.phone || '').trim() || null;
        const fcmTokens = await fetchActiveFcmTokens(userIdBig);
        const wantSms = shouldSendSmsForType(params.type);
        const canTryFcm = !isOtpType(params.type) && fcmTokens.length > 0;
        let fcmOk = false;
        let fcmError = null;
        if (canTryFcm) {
            const result = await FirebaseService_1.FirebaseService.sendMultipleNotifications(fcmTokens, params.title, params.message, params.data || {});
            if (result?.success && result?.result) {
                const multicast = result.result;
                fcmOk = Boolean(multicast.ok || multicast.successCount > 0);
                const badTokens = (multicast.failures || [])
                    .filter((f) => String(f.code || '').includes('registration-token-not-registered') ||
                    String(f.code || '').includes('invalid-registration-token'))
                    .map((f) => f.token);
                await deactivateBadTokens(badTokens);
                await safeLog({
                    userId: userIdBig,
                    type: params.type,
                    channel: 'FCM',
                    status: fcmOk ? 'SENT' : 'FAILED',
                    title: params.title,
                    message: params.message,
                    provider: 'FCM',
                    error: fcmOk ? null : 'FCM multicast had failures',
                    metadata: multicast,
                    sentAt: fcmOk ? now() : null
                });
            }
            else {
                fcmError = result?.error || 'FCM failed';
                await safeLog({
                    userId: userIdBig,
                    type: params.type,
                    channel: 'FCM',
                    status: 'FAILED',
                    title: params.title,
                    message: params.message,
                    provider: 'FCM',
                    error: String(fcmError),
                    sentAt: null
                });
            }
        }
        const shouldFallbackToSms = (!canTryFcm || !fcmOk) && !isOtpType(params.type) && params.type !== 'TRIAL_REMINDER';
        const shouldSendSms = (wantSms || shouldFallbackToSms) && Boolean(resolvedPhone);
        let smsOk = false;
        if ((wantSms || shouldFallbackToSms) && !resolvedPhone) {
            await safeLog({
                userId: userIdBig,
                type: params.type,
                channel: 'SMS',
                status: 'FAILED',
                title: params.title,
                message: params.message,
                provider: null,
                error: 'User has no phone number',
                sentAt: null
            });
        }
        if (shouldSendSms) {
            smsOk = await SmsService_1.SmsService.sendSms(resolvedPhone, params.message, { forceProvider: 'MSG91_THEN_TWILIO' });
            await safeLog({
                userId: userIdBig,
                type: params.type,
                channel: 'SMS',
                status: smsOk ? 'SENT' : 'FAILED',
                title: params.title,
                message: params.message,
                provider: smsOk ? 'MSG91/TWILIO' : null,
                error: smsOk ? null : 'SMS provider failed',
                sentAt: smsOk ? now() : null
            });
        }
        if (String(process.env.EMAIL_ENABLED || '').toLowerCase() === 'true' && user.email) {
            const emailResult = await EmailService_1.EmailService.sendEmail({
                to: user.email,
                subject: params.title,
                text: params.message
            });
            const emailOk = Boolean(emailResult?.success);
            await safeLog({
                userId: userIdBig,
                type: params.type,
                channel: 'EMAIL',
                status: emailOk ? 'SENT' : 'FAILED',
                title: params.title,
                message: params.message,
                provider: 'EMAIL',
                error: emailOk ? null : String(emailResult?.error || 'Email failed'),
                sentAt: emailOk ? now() : null
            });
        }
        return {
            success: Boolean((canTryFcm ? fcmOk : true) || smsOk),
            channels: {
                fcm: canTryFcm ? fcmOk : null,
                sms: shouldSendSms ? smsOk : null,
                fcmError: fcmError ? String(fcmError) : null
            }
        };
    },
    async notifyIndividualVendorProductAdded(userId, product) {
        const productId = String(product?.id || '').trim();
        const productName = String(product?.name || 'Product').trim() || 'Product';
        const statusLabel = formatNotificationLabel(product?.status || 'PENDING_APPROVAL');
        await exports.NotificationService.sendNotification({
            userId,
            type: 'INDIVIDUAL_VENDOR_PRODUCT_ADDED',
            title: 'Product added successfully',
            message: `${productName} has been added successfully. Current status: ${statusLabel}.`,
            data: {
                ...(productId ? { productId } : {}),
                status: String(product?.status || 'PENDING_APPROVAL')
            }
        });
    },
    async notifyIndividualVendorContractUpdated(userId, payload) {
        const contractVersion = String(payload?.contractVersion || '').trim();
        const revenueSharePercent = Number(payload?.revenueSharePercent);
        const hasRevenueShare = Number.isFinite(revenueSharePercent) && revenueSharePercent >= 0;
        const message = contractVersion
            ? `Your contract version has been updated to ${contractVersion}.`
            : hasRevenueShare
                ? `Your agreement terms were updated. Revenue share is now ${revenueSharePercent}%.`
                : 'Your agreement terms have been updated.';
        await exports.NotificationService.sendNotification({
            userId,
            type: 'INDIVIDUAL_VENDOR_CONTRACT_UPDATED',
            title: 'Contract terms updated',
            message,
            data: {
                ...(contractVersion ? { contractVersion } : {}),
                ...(hasRevenueShare
                    ? { revenueSharePercent: String(revenueSharePercent) }
                    : {})
            }
        });
    },
    async notifyIndividualVendorProductStatusChanged(userId, payload) {
        const productId = String(payload?.productId || '').trim();
        const productName = String(payload?.productName || 'Product').trim() || 'Product';
        const status = String(payload?.status || '').trim() || 'UPDATED';
        const statusLabel = formatNotificationLabel(status);
        await exports.NotificationService.sendNotification({
            userId,
            type: 'INDIVIDUAL_VENDOR_PRODUCT_STATUS_CHANGED',
            title: 'Product status changed',
            message: `${productName} status changed to ${statusLabel}.`,
            data: {
                ...(productId ? { productId } : {}),
                status
            }
        });
    },
    async notifyIndividualVendorEarning(userId, amount) {
        await exports.NotificationService.sendNotification({
            userId,
            type: 'INDIVIDUAL_VENDOR_EARNING',
            title: 'Earning update',
            message: `Payout settlement of Rs ${amount} has been recorded for your account.`,
            data: { amount: String(amount) }
        });
    },
    async notifyIndividualVendorSupport(userId, payload) {
        await exports.NotificationService.sendNotification({
            userId,
            type: 'INDIVIDUAL_VENDOR_SUPPORT',
            title: payload.title,
            message: payload.message,
            data: {
                ...(payload.ticketId ? { ticketId: payload.ticketId } : {}),
                ...(payload.complaintNo ? { complaintNo: payload.complaintNo } : {}),
                ...(payload.status ? { status: payload.status } : {})
            }
        });
    },
    async notifyAdminAsVendorProductUpdate(payload) {
        await notifyAdminAsVendorUsers({
            type: 'ADMIN_VENDOR_PRODUCT',
            title: payload.title,
            message: payload.message,
            data: {
                ...(payload.productId ? { productId: payload.productId } : {}),
                ...(payload.status ? { status: payload.status } : {}),
                ...(payload.vendorId ? { vendorId: payload.vendorId } : {})
            }
        });
    },
    async notifyAdminAsVendorOrderUpdate(payload) {
        await notifyAdminAsVendorUsers({
            type: 'ADMIN_VENDOR_ORDER',
            title: payload.title,
            message: payload.message,
            data: {
                ...(payload.orderId ? { orderId: payload.orderId } : {}),
                ...(payload.orderItemId ? { orderItemId: payload.orderItemId } : {}),
                ...(payload.productId ? { productId: payload.productId } : {}),
                ...(payload.trialRequestId ? { trialRequestId: payload.trialRequestId } : {}),
                ...(payload.status ? { status: payload.status } : {})
            }
        });
    },
    async notifyAdminAsVendorFinanceUpdate(payload) {
        await notifyAdminAsVendorUsers({
            type: 'ADMIN_VENDOR_FINANCE',
            title: payload.title,
            message: payload.message,
            data: {
                ...(payload.orderId ? { orderId: payload.orderId } : {}),
                ...(payload.orderItemId ? { orderItemId: payload.orderItemId } : {}),
                ...(payload.amount !== undefined ? { amount: String(payload.amount) } : {})
            }
        });
    },
    async notifyAdminAsVendorSupportUpdate(payload) {
        await notifyAdminAsVendorUsers({
            type: 'ADMIN_VENDOR_SUPPORT',
            title: payload.title,
            message: payload.message,
            data: {
                ...(payload.ticketId ? { ticketId: payload.ticketId } : {}),
                ...(payload.complaintNo ? { complaintNo: payload.complaintNo } : {}),
                ...(payload.status ? { status: payload.status } : {})
            }
        });
    },
    // Backward-compatible helpers (existing code calls these)
    async notifyVendorNewOrder(vendorId, orderId) {
        const vendor = await db_1.default.vendorProfile.findUnique({
            where: { id: BigInt(vendorId) },
            include: { user: true }
        });
        if (!vendor)
            return;
        await exports.NotificationService.sendNotification({
            userId: vendor.userId.toString(),
            type: 'ORDER_PLACED_VENDOR',
            title: 'New order received',
            message: `New order received! Order ID: ${orderId}. Please accept within 24 hours.`,
            data: { orderId }
        });
        if (isIndividualVendorRole(vendor.user?.role)) {
            await exports.NotificationService.notifyAdminAsVendorOrderUpdate({
                title: 'New rental order',
                message: `A new rental order ${orderId} was placed for ${vendor.shopName || vendor.ownerName || 'an individual vendor'} inventory.`,
                orderId
            }).catch(() => null);
        }
    },
    async notifyCustomerOrderAccepted(customerId, orderItemId) {
        await exports.NotificationService.sendNotification({
            userId: customerId,
            type: 'ORDER_ACCEPTED_CUSTOMER',
            title: 'Order accepted',
            message: `Great! Your order has been accepted by the vendor. Order Item: ${orderItemId}`,
            data: { orderItemId }
        });
    },
    async notifyCustomerOrderRejected(customerId, orderItemId) {
        await exports.NotificationService.sendNotification({
            userId: customerId,
            type: 'ORDER_REJECTED_CUSTOMER',
            title: 'Order rejected',
            message: `Your order has been rejected. Refund request is now pending admin processing. Order Item: ${orderItemId}`,
            data: { orderItemId }
        });
    },
    async notifyVendorReturnInitiated(vendorId, orderItemId) {
        const vendorTarget = await resolveVendorNotificationTarget(vendorId);
        const vendorUserId = vendorTarget?.userId || null;
        if (!vendorUserId)
            return;
        await exports.NotificationService.sendNotification({
            userId: vendorUserId,
            type: 'ORDER_PLACED_VENDOR',
            title: 'Return initiated',
            message: `A customer initiated return for order item ${orderItemId}. Please inspect on return.`,
            data: { orderItemId }
        });
        if (isIndividualVendorRole(vendorTarget?.role)) {
            await exports.NotificationService.notifyAdminAsVendorOrderUpdate({
                title: 'Return initiated',
                message: `A return was initiated for order item ${orderItemId} on individual-vendor inventory.`,
                orderItemId,
                status: 'RETURN_REQUESTED'
            }).catch(() => null);
        }
    },
    async notifyAdminReturnReview(orderItemId) {
        const admins = await db_1.default.user.findMany({
            where: { role: { in: roles_1.ADMIN_PORTAL_ROLES }, status: 'ACTIVE' },
            select: { id: true }
        });
        if (!admins.length)
            return;
        await Promise.all(admins.map((admin) => exports.NotificationService.sendNotification({
            userId: admin.id.toString(),
            type: 'ORDER_PLACED_VENDOR',
            title: 'Return review pending',
            message: `Return inspection is submitted for order item ${orderItemId}. Please review refund decision.`,
            data: { orderItemId }
        })));
    },
    async notifyCustomerRefundDecision(customerId, orderItemId, refundAmount) {
        const context = await resolveOrderItemNotificationContext(orderItemId);
        const itemLabel = context?.itemLabel || `order item ${orderItemId}`;
        await exports.NotificationService.sendNotification({
            userId: customerId,
            type: 'ORDER_ACCEPTED_CUSTOMER',
            title: 'Security deposit reviewed',
            message: `Refund decision completed for ${itemLabel}. Refund amount: Rs ${refundAmount} will be credited within 5-10 working days.`,
            data: {
                orderItemId: context?.orderItemId || orderItemId,
                ...(context?.orderNo ? { orderNo: context.orderNo } : {}),
                ...(context?.productName ? { productName: context.productName } : {}),
                refundAmount: String(refundAmount)
            }
        });
    },
    async notifyCustomerTrialCompleted(customerId, trialRequestId, productName, productId) {
        await exports.NotificationService.sendNotification({
            userId: customerId,
            type: 'TRIAL_APPROVED',
            title: 'Trial completed',
            message: `Your trial for ${productName} has been completed successfully.`,
            data: {
                trialRequestId,
                ...(productId ? { productId } : {})
            }
        });
    },
    async notifyCustomerTrialStarted(customerId, trialRequestId, productName, productId) {
        await exports.NotificationService.sendNotification({
            userId: customerId,
            type: 'TRIAL_APPROVED',
            title: 'Trial started',
            message: `Your trial for ${productName} has started. The vendor will mark it completed after the item is returned.`,
            data: {
                trialRequestId,
                ...(productId ? { productId } : {})
            }
        });
    },
    async notifyCustomerOrderPlaced(customerId, orderId) {
        await exports.NotificationService.sendNotification({
            userId: customerId,
            type: 'ORDER_ACCEPTED_CUSTOMER',
            title: 'Order booked',
            message: `Your order ${orderId} has been booked successfully. The vendor will update pickup and return steps here.`,
            data: { orderId }
        });
    },
    async notifyCustomerOrderStatusUpdate(customerId, orderItemId, status) {
        const context = await resolveOrderItemNotificationContext(orderItemId);
        const itemLabel = context?.itemLabel || `order item ${orderItemId}`;
        await exports.NotificationService.sendNotification({
            userId: customerId,
            type: 'ORDER_ACCEPTED_CUSTOMER',
            title: 'Order status updated',
            message: `${itemLabel} status changed to ${status.replace(/_/g, ' ')}.`,
            data: {
                orderItemId: context?.orderItemId || orderItemId,
                ...(context?.orderNo ? { orderNo: context.orderNo } : {}),
                ...(context?.productName ? { productName: context.productName } : {}),
                status
            }
        });
    },
    async notifyVendorReturnCompleted(vendorId, orderItemId) {
        const vendorTarget = await resolveVendorNotificationTarget(vendorId);
        const vendorUserId = vendorTarget?.userId || null;
        if (!vendorUserId)
            return;
        await exports.NotificationService.sendNotification({
            userId: vendorUserId,
            type: 'ORDER_PLACED_VENDOR',
            title: 'Return completed',
            message: `Return workflow is completed for order item ${orderItemId}.`,
            data: { orderItemId }
        });
        if (isIndividualVendorRole(vendorTarget?.role)) {
            await exports.NotificationService.notifyAdminAsVendorOrderUpdate({
                title: 'Return completed',
                message: `Return workflow was completed for order item ${orderItemId} on individual-vendor inventory.`,
                orderItemId,
                status: 'COMPLETED'
            }).catch(() => null);
        }
    },
    async notifyVendorSettlement(vendorId, amount) {
        const vendorTarget = await resolveVendorNotificationTarget(vendorId);
        if (!vendorTarget?.userId)
            return;
        if (isIndividualVendorRole(vendorTarget.role)) {
            await exports.NotificationService.notifyIndividualVendorEarning(vendorTarget.userId, amount);
            await exports.NotificationService.notifyAdminAsVendorFinanceUpdate({
                title: 'Vendor payout recorded',
                message: `Payout settlement of Rs ${amount} was recorded for an individual vendor account.`,
                amount
            }).catch(() => null);
            return;
        }
        await exports.NotificationService.sendNotification({
            userId: vendorTarget.userId,
            type: 'ORDER_PLACED_VENDOR',
            title: 'Settlement completed',
            message: `Payout settlement of Rs ${amount} has been recorded for your account.`,
            data: { amount: String(amount) }
        });
    }
};

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplaintService = void 0;
const db_1 = __importDefault(require("../config/db"));
const S3Service_1 = require("./S3Service");
const NotificationService_1 = require("./NotificationService");
const socketServer_1 = require("../realtime/socketServer");
const errors_1 = require("../utils/errors");
const vendorScope_1 = require("../utils/vendorScope");
const STATUS_LABELS = {
    PENDING: 'Pending',
    IN_PROGRESS: 'In Progress',
    RESOLVED: 'Resolved',
    REJECTED: 'Rejected'
};
const PRIORITY_LABELS = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High'
};
const complaintInclude = {
    raisedByUser: {
        select: {
            id: true,
            name: true,
            email: true,
            phone: true
        }
    },
    vendor: {
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true
                }
            }
        }
    },
    order: {
        select: {
            id: true,
            orderNo: true,
            createdAt: true
        }
    },
    orderItem: {
        include: {
            product: {
                select: {
                    id: true,
                    name: true
                }
            },
            variant: {
                select: {
                    id: true,
                    size: true,
                    sku: true
                }
            },
            vendorProfile: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            }
        }
    },
    messages: {
        orderBy: {
            createdAt: 'asc'
        }
    }
};
const fileToDataUrl = (file) => `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
const normalizeText = (value) => String(value || '').trim();
const normalizeOptionalText = (value) => {
    const normalized = normalizeText(value);
    return normalized.length > 0 ? normalized : null;
};
const tryParseBigInt = (value) => {
    const normalized = normalizeText(value);
    if (!normalized)
        return null;
    try {
        return BigInt(normalized);
    }
    catch {
        return null;
    }
};
const parseBigInt = (value, field) => {
    const parsed = tryParseBigInt(value);
    if (parsed === null) {
        throw new errors_1.ValidationError(`Invalid ${field}`);
    }
    return parsed;
};
const toBigIntList = (values) => Array.from(values)
    .map(value => tryParseBigInt(value))
    .filter((value) => value !== null);
const buildTemporaryComplaintNo = () => `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const buildComplaintNo = (id) => `CMP-${String(id).padStart(6, '0')}`;
const normalizePriorityCode = (value) => {
    const normalized = normalizeText(value).toUpperCase();
    if (normalized === 'LOW')
        return 'LOW';
    if (normalized === 'HIGH' || normalized === 'URGENT')
        return 'HIGH';
    return 'MEDIUM';
};
const normalizeStatusCode = (value) => {
    const normalized = normalizeText(value).toUpperCase();
    if (normalized === 'PENDING')
        return 'PENDING';
    if (normalized === 'IN_PROGRESS')
        return 'IN_PROGRESS';
    if (normalized === 'RESOLVED')
        return 'RESOLVED';
    if (normalized === 'REJECTED')
        return 'REJECTED';
    throw new errors_1.ValidationError('Invalid complaint status');
};
const normalizeFeedbackCode = (value) => {
    const normalized = normalizeText(value).toUpperCase();
    if (normalized === 'HELPFUL')
        return 'HELPFUL';
    if (normalized === 'NOT_HELPFUL')
        return 'NOT_HELPFUL';
    return null;
};
const normalizeRaisedByRole = (value) => {
    const normalized = normalizeText(value).toUpperCase();
    if (normalized === 'ADMIN_AS_VENDOR')
        return 'ADMIN_AS_VENDOR';
    if (normalized === 'INDIVIDUAL_VENDOR' || normalized === 'VENDOR') {
        return 'INDIVIDUAL_VENDOR';
    }
    return 'CUSTOMER';
};
const toMessageSenderRole = (value) => {
    const normalized = normalizeText(value).toUpperCase();
    if (normalized === 'ADMIN_AS_VENDOR')
        return 'ADMIN_AS_VENDOR';
    if (normalized === 'INDIVIDUAL_VENDOR' || normalized === 'VENDOR') {
        return 'INDIVIDUAL_VENDOR';
    }
    if (normalized === 'ADMIN')
        return 'ADMIN';
    return 'CUSTOMER';
};
const getRoleLabel = (role) => {
    if (role === 'ADMIN_AS_VENDOR')
        return 'Admin as Vendor';
    if (role === 'INDIVIDUAL_VENDOR')
        return 'Individual Vendor';
    if (role === 'ADMIN')
        return 'Admin User';
    return 'Customer';
};
const derivePriority = (category, subCategory) => {
    const token = `${category} ${subCategory || ''}`.toLowerCase();
    if (token.includes('payment') ||
        token.includes('refund') ||
        token.includes('deposit') ||
        token.includes('vendor') ||
        token.includes('damaged') ||
        token.includes('wrong item') ||
        token.includes('quality')) {
        return 'HIGH';
    }
    if (token.includes('order') ||
        token.includes('return') ||
        token.includes('pickup') ||
        token.includes('technical') ||
        token.includes('delivery') ||
        token.includes('late') ||
        token.includes('logistics')) {
        return 'MEDIUM';
    }
    return 'LOW';
};
const buildComplaintTitle = (data) => {
    const issue = normalizeOptionalText(data.subCategory) || normalizeText(data.category) || 'Support';
    const subject = normalizeOptionalText(data.productName) ||
        normalizeOptionalText(data.orderNo) ||
        'Ticket';
    return `${issue} - ${subject}`;
};
const uploadComplaintImages = async (files = []) => {
    if (!files.length)
        return [];
    try {
        return await S3Service_1.S3Service.uploadMultipleImages(files, 'complaints');
    }
    catch {
        return files.map(fileToDataUrl);
    }
};
const toAccessibleUrls = async (attachments = []) => Promise.all(attachments
    .filter(Boolean)
    .map(async (url) => {
    if (String(url).startsWith('data:'))
        return url;
    try {
        return await S3Service_1.S3Service.getAccessibleImageUrl(url);
    }
    catch {
        return url;
    }
}));
const buildComplaintLookupWhere = (complaintIdOrNo) => {
    const normalized = normalizeText(complaintIdOrNo);
    const orClauses = [
        { complaintNo: normalized }
    ];
    const parsedId = tryParseBigInt(normalized);
    if (parsedId !== null) {
        orClauses.unshift({ id: parsedId });
    }
    return { OR: orClauses };
};
const findComplaintRecord = async (complaintIdOrNo, extraWhere) => {
    const normalized = normalizeText(complaintIdOrNo);
    if (!normalized)
        return null;
    const where = extraWhere
        ? {
            AND: [buildComplaintLookupWhere(normalized), extraWhere]
        }
        : buildComplaintLookupWhere(normalized);
    return db_1.default.complaintTicket.findFirst({
        where,
        include: complaintInclude
    });
};
const findComplaintRecordOrThrow = async (complaintIdOrNo, extraWhere, notFoundMessage = 'Complaint not found') => {
    const complaint = await findComplaintRecord(complaintIdOrNo, extraWhere);
    if (!complaint) {
        throw new errors_1.ValidationError(notFoundMessage);
    }
    return complaint;
};
const findTargetOrderItem = async (customerId, orderId, orderItemId) => {
    const customerIdBig = parseBigInt(customerId, 'customerId');
    if (orderItemId) {
        const orderItemIdBig = parseBigInt(orderItemId, 'orderItemId');
        const orderItem = await db_1.default.orderItem.findFirst({
            where: {
                id: orderItemIdBig,
                order: { customerId: customerIdBig }
            },
            include: {
                order: true,
                product: true,
                variant: true,
                vendorProfile: {
                    include: {
                        user: true
                    }
                }
            }
        });
        if (!orderItem) {
            throw new errors_1.ValidationError('Order item not found for this customer');
        }
        return orderItem;
    }
    if (!orderId) {
        throw new errors_1.ValidationError('orderId or orderItemId is required');
    }
    const orderIdBig = parseBigInt(orderId, 'orderId');
    const order = await db_1.default.order.findFirst({
        where: {
            id: orderIdBig,
            customerId: customerIdBig
        },
        include: {
            items: {
                include: {
                    order: true,
                    product: true,
                    variant: true,
                    vendorProfile: {
                        include: {
                            user: true
                        }
                    }
                },
                orderBy: { id: 'asc' }
            }
        }
    });
    if (!order) {
        throw new errors_1.ValidationError('Order not found for this customer');
    }
    const firstItem = order.items?.[0];
    if (!firstItem) {
        throw new errors_1.ValidationError('Selected order has no items');
    }
    return firstItem;
};
const findVendorProfileByUserId = async (userId) => {
    const normalizedUserId = normalizeText(userId);
    if (!normalizedUserId)
        return null;
    return db_1.default.vendorProfile.findUnique({
        where: {
            userId: parseBigInt(normalizedUserId, 'userId')
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true
                }
            }
        }
    });
};
const getScopedVendorIdSet = async (roleFilter) => {
    const scopedVendors = await db_1.default.vendorProfile.findMany({
        where: (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter),
        select: {
            id: true
        }
    });
    return new Set(scopedVendors.map(vendor => String(vendor.id)));
};
const isAdminAsVendorTicketAccessible = (record, adminId, scopedVendorIds) => {
    const raisedByRole = normalizeRaisedByRole(record.raisedByRole);
    if (raisedByRole === 'ADMIN_AS_VENDOR') {
        return String(record.raisedByUserId) === adminId;
    }
    return Boolean(record.vendorId && scopedVendorIds.has(String(record.vendorId)));
};
const decorateMessage = async (message) => ({
    id: String(message.id),
    senderUserId: message.senderUserId != null ? String(message.senderUserId) : '',
    senderRole: toMessageSenderRole(message.senderRole),
    senderName: normalizeText(message.senderName) ||
        getRoleLabel(toMessageSenderRole(message.senderRole)),
    message: normalizeText(message.message),
    attachments: await toAccessibleUrls(message.attachments || []),
    isInternal: Boolean(message.isInternal),
    createdAt: message.createdAt instanceof Date
        ? message.createdAt.toISOString()
        : String(message.createdAt),
    readBy: []
});
const enrichComplaintRecord = async (record) => {
    const raisedByRole = normalizeRaisedByRole(record.raisedByRole);
    const raisedByName = normalizeText(record.raisedByUser?.name) || getRoleLabel(raisedByRole);
    const vendorName = record.vendor?.shopName ||
        record.vendor?.ownerName ||
        record.vendor?.user?.name ||
        record.orderItem?.vendorProfile?.shopName ||
        record.orderItem?.vendorProfile?.ownerName ||
        record.orderItem?.vendorProfile?.user?.name ||
        (raisedByRole === 'INDIVIDUAL_VENDOR' ? raisedByName : null) ||
        'N/A';
    const attachments = await toAccessibleUrls(record.attachments || []);
    const fallbackMessages = [
        {
            id: `${record.id}-initial`,
            senderUserId: record.raisedByUserId,
            senderRole: raisedByRole,
            senderName: raisedByName,
            message: record.description,
            attachments: record.attachments || [],
            isInternal: false,
            createdAt: record.createdAt
        },
        ...(record.adminResponse
            ? [
                {
                    id: `${record.id}-admin-response`,
                    senderUserId: null,
                    senderRole: 'ADMIN',
                    senderName: 'Admin User',
                    message: record.adminResponse,
                    attachments: [],
                    isInternal: false,
                    createdAt: record.adminRespondedAt || record.updatedAt || record.createdAt
                }
            ]
            : [])
    ];
    const rawMessages = Array.isArray(record.messages) && record.messages.length > 0
        ? record.messages.map(message => ({
            id: message.id,
            senderUserId: message.senderUserId,
            senderRole: message.senderRole,
            senderName: message.senderName,
            message: message.message,
            attachments: message.attachments || [],
            isInternal: message.isInternal,
            createdAt: message.createdAt
        }))
        : fallbackMessages;
    const messages = await Promise.all(rawMessages.map(decorateMessage));
    const productName = record.orderItem?.product?.name || null;
    const productCode = record.orderItem?.variant?.sku ||
        (record.orderItem?.product?.id ? String(record.orderItem.product.id) : null);
    const orderDisplay = record.order?.orderNo ||
        normalizeOptionalText(record.orderReference) ||
        (record.orderId ? `#${String(record.orderId)}` : '-');
    return {
        id: String(record.id),
        complaintNo: record.complaintNo,
        title: record.title,
        type: record.type,
        category: record.category,
        subCategory: record.subCategory,
        description: record.description,
        priority: PRIORITY_LABELS[normalizePriorityCode(record.priority)],
        severity: PRIORITY_LABELS[normalizePriorityCode(record.priority)],
        priorityCode: normalizePriorityCode(record.priority),
        status: STATUS_LABELS[normalizeStatusCode(record.status)],
        statusCode: normalizeStatusCode(record.status),
        attachments,
        evidence: attachments,
        customer: raisedByName,
        customerId: String(record.raisedByUserId),
        vendor: vendorName,
        orderId: orderDisplay,
        orderDbId: record.orderId ? String(record.orderId) : null,
        orderItemId: record.orderItemId ? String(record.orderItemId) : null,
        productName: productName || '-',
        productCode: productCode || '-',
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        date: record.createdAt.toISOString().slice(0, 10),
        adminResponse: record.adminResponse,
        resolution: record.resolution,
        resolutionNotes: record.resolutionNotes,
        resolvedAt: record.resolvedAt ? record.resolvedAt.toISOString() : null,
        adminRespondedAt: record.adminRespondedAt ? record.adminRespondedAt.toISOString() : null,
        feedback: normalizeFeedbackCode(record.feedback),
        liked: normalizeFeedbackCode(record.feedback) === 'HELPFUL'
            ? true
            : normalizeFeedbackCode(record.feedback) === 'NOT_HELPFUL'
                ? false
                : null,
        raisedByRole,
        raisedByUserId: String(record.raisedByUserId),
        role: raisedByRole,
        roleLabel: getRoleLabel(raisedByRole),
        messages,
        raisedBy: record.raisedByUser
            ? {
                ...record.raisedByUser,
                id: String(record.raisedByUser.id),
                role: raisedByRole
            }
            : {
                id: String(record.raisedByUserId),
                name: raisedByName,
                role: raisedByRole
            },
        against: {
            id: record.vendorId ? String(record.vendorId) : null,
            name: vendorName
        },
        vendorProfileId: record.vendorId ? String(record.vendorId) : null,
        order: record.order
            ? {
                id: String(record.order.id),
                orderNo: record.order.orderNo,
                createdAt: record.order.createdAt,
                items: productName
                    ? [
                        {
                            product: {
                                name: productName,
                                vendor: {
                                    shopName: vendorName
                                }
                            }
                        }
                    ]
                    : []
            }
            : null
    };
};
const maybeNotifyIndividualVendorTicketOwner = async (record, payload) => {
    if (normalizeRaisedByRole(record.raisedByRole) !== 'INDIVIDUAL_VENDOR')
        return;
    await NotificationService_1.NotificationService.notifyIndividualVendorSupport(String(record.raisedByUserId), {
        title: payload.title,
        message: payload.message,
        ticketId: String(record.id),
        complaintNo: record.complaintNo,
        status: payload.status
    }).catch(() => null);
};
const buildSupportRealtimeRefs = (record) => Object.fromEntries([
    ['ticketId', String(record.id || '').trim()],
    ['complaintNo', String(record.complaintNo || '').trim()],
    ['orderId', record.orderId ? String(record.orderId).trim() : ''],
    ['orderItemId', record.orderItemId ? String(record.orderItemId).trim() : ''],
    ['vendorId', record.vendorId ? String(record.vendorId).trim() : ''],
    ['raisedByRole', normalizeRaisedByRole(record.raisedByRole)]
].filter(([, value]) => value));
const emitSupportRealtimeForComplaint = (record, reason) => {
    const refs = buildSupportRealtimeRefs(record);
    const domains = ['support', 'dashboard'];
    const payload = {
        domains,
        refs,
        reason
    };
    const raisedByUserId = record.raisedByUserId
        ? String(record.raisedByUserId).trim()
        : '';
    const raisedByRole = normalizeRaisedByRole(record.raisedByRole);
    if (raisedByUserId) {
        (0, socketServer_1.emitDataUpdatedToUser)(raisedByUserId, payload);
    }
    if (raisedByRole === 'INDIVIDUAL_VENDOR') {
        (0, socketServer_1.emitDataUpdatedToRole)('ADMIN_AS_VENDOR', payload);
        return;
    }
    (0, socketServer_1.emitDataUpdatedToRole)('ADMIN', payload);
};
exports.ComplaintService = {
    async createComplaint(data) {
        const customerId = normalizeText(data.customerId);
        const category = normalizeText(data.category);
        const subCategory = normalizeOptionalText(data.subCategory);
        const description = normalizeText(data.description);
        if (!customerId)
            throw new errors_1.ValidationError('customerId is required');
        if (!category)
            throw new errors_1.ValidationError('category is required');
        if (!description)
            throw new errors_1.ValidationError('description is required');
        const targetOrderItem = await findTargetOrderItem(customerId, normalizeOptionalText(data.orderId) || undefined, normalizeOptionalText(data.orderItemId) || undefined);
        const attachments = await uploadComplaintImages(data.imageFiles || []);
        const orderNo = targetOrderItem.order?.orderNo || null;
        const productName = targetOrderItem.product?.name || null;
        const type = [category, subCategory].filter(Boolean).join(' - ');
        const complaint = await db_1.default.$transaction(async (tx) => {
            const created = await tx.complaintTicket.create({
                data: {
                    complaintNo: buildTemporaryComplaintNo(),
                    raisedByUserId: parseBigInt(customerId, 'customerId'),
                    raisedByRole: 'CUSTOMER',
                    vendorId: targetOrderItem.vendorId,
                    orderId: targetOrderItem.orderId,
                    orderItemId: targetOrderItem.id,
                    orderReference: targetOrderItem.order?.orderNo || null,
                    category,
                    subCategory,
                    type: type || category,
                    title: buildComplaintTitle({ category, subCategory, productName, orderNo }),
                    description,
                    attachments,
                    status: 'PENDING',
                    priority: derivePriority(category, subCategory),
                    messages: {
                        create: {
                            senderUserId: parseBigInt(customerId, 'customerId'),
                            senderRole: 'CUSTOMER',
                            senderName: 'Customer',
                            message: description,
                            attachments,
                            isInternal: false
                        }
                    }
                },
                include: complaintInclude
            });
            return tx.complaintTicket.update({
                where: { id: created.id },
                data: { complaintNo: buildComplaintNo(created.id) },
                include: complaintInclude
            });
        });
        emitSupportRealtimeForComplaint(complaint, 'COMPLAINT_CREATED');
        return enrichComplaintRecord(complaint);
    },
    async getCustomerComplaints(customerId) {
        const normalizedCustomerId = normalizeText(customerId);
        const complaints = await db_1.default.complaintTicket.findMany({
            where: {
                raisedByUserId: parseBigInt(normalizedCustomerId, 'customerId'),
                raisedByRole: 'CUSTOMER'
            },
            include: complaintInclude,
            orderBy: { createdAt: 'desc' }
        });
        return Promise.all(complaints.map(enrichComplaintRecord));
    },
    async getCustomerComplaintDetail(customerId, complaintId) {
        const complaint = await findComplaintRecordOrThrow(complaintId, {
            raisedByUserId: parseBigInt(customerId, 'customerId'),
            raisedByRole: 'CUSTOMER'
        }, 'Complaint not found');
        return enrichComplaintRecord(complaint);
    },
    async setCustomerFeedback(customerId, complaintId, helpful) {
        const existing = await findComplaintRecordOrThrow(complaintId, {
            raisedByUserId: parseBigInt(customerId, 'customerId'),
            raisedByRole: 'CUSTOMER'
        }, 'Complaint not found');
        const updated = await db_1.default.complaintTicket.update({
            where: { id: existing.id },
            data: {
                feedback: helpful ? 'HELPFUL' : 'NOT_HELPFUL'
            },
            include: complaintInclude
        });
        emitSupportRealtimeForComplaint(updated, 'COMPLAINT_FEEDBACK_UPDATED');
        return enrichComplaintRecord(updated);
    },
    async getComplaints(status) {
        const normalizedStatus = normalizeText(status).toUpperCase();
        const complaints = await db_1.default.complaintTicket.findMany({
            where: normalizedStatus.length > 0
                ? { status: normalizeStatusCode(normalizedStatus) }
                : undefined,
            include: complaintInclude,
            orderBy: { createdAt: 'desc' }
        });
        return Promise.all(complaints.map(enrichComplaintRecord));
    },
    async getComplaintDetail(complaintId) {
        const complaint = await findComplaintRecordOrThrow(complaintId, undefined, 'Complaint not found');
        return enrichComplaintRecord(complaint);
    },
    async resolveComplaint(complaintId, status, adminResponse, notes) {
        const nextStatus = normalizeStatusCode(status);
        const normalizedResponse = normalizeText(adminResponse);
        const normalizedNotes = normalizeOptionalText(notes);
        if (!normalizedResponse) {
            throw new errors_1.ValidationError('adminResponse is required');
        }
        const existing = await findComplaintRecordOrThrow(complaintId, undefined, 'Complaint not found');
        const now = new Date();
        const isClosed = nextStatus === 'RESOLVED' || nextStatus === 'REJECTED';
        const updated = await db_1.default.complaintTicket.update({
            where: { id: existing.id },
            data: {
                status: nextStatus,
                adminResponse: normalizedResponse,
                adminRespondedAt: now,
                resolution: isClosed ? nextStatus : null,
                resolutionNotes: normalizedNotes,
                resolvedAt: isClosed ? now : null,
                messages: {
                    create: {
                        senderRole: 'ADMIN',
                        senderName: 'Admin User',
                        message: normalizedResponse,
                        attachments: [],
                        isInternal: false
                    }
                }
            },
            include: complaintInclude
        });
        emitSupportRealtimeForComplaint(updated, 'COMPLAINT_RESOLVED');
        return enrichComplaintRecord(updated);
    },
    async createIndividualVendorTicket(data) {
        const userId = normalizeText(data.userId);
        const category = normalizeText(data.category);
        const subCategory = normalizeOptionalText(data.subCategory);
        const description = normalizeText(data.description);
        const subject = normalizeOptionalText(data.subject);
        const priority = normalizePriorityCode(data.priority);
        const orderReference = normalizeOptionalText(data.orderId);
        if (!userId)
            throw new errors_1.ValidationError('userId is required');
        if (!category)
            throw new errors_1.ValidationError('category is required');
        if (!description)
            throw new errors_1.ValidationError('description is required');
        const [attachments, vendorProfile] = await Promise.all([
            uploadComplaintImages(data.imageFiles || []),
            findVendorProfileByUserId(userId)
        ]);
        const type = [category, subCategory].filter(Boolean).join(' - ');
        const vendorName = vendorProfile?.shopName ||
            vendorProfile?.ownerName ||
            vendorProfile?.user?.name ||
            'Individual Vendor';
        const complaint = await db_1.default.$transaction(async (tx) => {
            const created = await tx.complaintTicket.create({
                data: {
                    complaintNo: buildTemporaryComplaintNo(),
                    raisedByUserId: parseBigInt(userId, 'userId'),
                    raisedByRole: 'INDIVIDUAL_VENDOR',
                    vendorId: vendorProfile?.id || null,
                    orderReference,
                    category,
                    subCategory,
                    type: type || category,
                    title: subject || buildComplaintTitle({ category, subCategory, orderNo: orderReference }),
                    description,
                    attachments,
                    status: 'PENDING',
                    priority,
                    messages: {
                        create: {
                            senderUserId: parseBigInt(userId, 'userId'),
                            senderRole: 'INDIVIDUAL_VENDOR',
                            senderName: vendorName,
                            message: description,
                            attachments,
                            isInternal: false
                        }
                    }
                },
                include: complaintInclude
            });
            return tx.complaintTicket.update({
                where: { id: created.id },
                data: { complaintNo: buildComplaintNo(created.id) },
                include: complaintInclude
            });
        });
        await NotificationService_1.NotificationService.notifyIndividualVendorSupport(userId, {
            title: 'Support ticket submitted',
            message: `Your support ticket ${complaint.complaintNo} has been submitted successfully.`,
            ticketId: String(complaint.id),
            complaintNo: complaint.complaintNo,
            status: complaint.status
        }).catch(() => null);
        await NotificationService_1.NotificationService.notifyAdminAsVendorSupportUpdate({
            title: 'New support ticket',
            message: `Support ticket ${complaint.complaintNo} was submitted by an individual vendor.`,
            ticketId: String(complaint.id),
            complaintNo: complaint.complaintNo,
            status: complaint.status
        }).catch(() => null);
        return enrichComplaintRecord(complaint);
    },
    async createAdminAsVendorTicket(data) {
        const adminId = normalizeText(data.adminId);
        const category = normalizeText(data.category);
        const subCategory = normalizeOptionalText(data.subCategory);
        const description = normalizeText(data.description);
        const subject = normalizeOptionalText(data.subject);
        const priority = normalizePriorityCode(data.priority);
        const orderReference = normalizeOptionalText(data.orderId);
        if (!adminId)
            throw new errors_1.ValidationError('adminId is required');
        if (!category)
            throw new errors_1.ValidationError('category is required');
        if (!description)
            throw new errors_1.ValidationError('description is required');
        const attachments = await uploadComplaintImages(data.imageFiles || []);
        const type = [category, subCategory].filter(Boolean).join(' - ');
        const complaint = await db_1.default.$transaction(async (tx) => {
            const created = await tx.complaintTicket.create({
                data: {
                    complaintNo: buildTemporaryComplaintNo(),
                    raisedByUserId: parseBigInt(adminId, 'adminId'),
                    raisedByRole: 'ADMIN_AS_VENDOR',
                    orderReference,
                    category,
                    subCategory,
                    type: type || category,
                    title: subject || buildComplaintTitle({ category, subCategory, orderNo: orderReference }),
                    description,
                    attachments,
                    status: 'PENDING',
                    priority,
                    messages: {
                        create: {
                            senderUserId: parseBigInt(adminId, 'adminId'),
                            senderRole: 'ADMIN_AS_VENDOR',
                            senderName: 'Admin as Vendor',
                            message: description,
                            attachments,
                            isInternal: false
                        }
                    }
                },
                include: complaintInclude
            });
            return tx.complaintTicket.update({
                where: { id: created.id },
                data: { complaintNo: buildComplaintNo(created.id) },
                include: complaintInclude
            });
        });
        emitSupportRealtimeForComplaint(complaint, 'SUPPORT_TICKET_CREATED');
        return enrichComplaintRecord(complaint);
    },
    async getAdminAsVendorTickets(adminId, roleFilter) {
        const normalizedAdminId = normalizeText(adminId);
        const scopedVendorIds = await getScopedVendorIdSet(roleFilter);
        const vendorIds = toBigIntList(scopedVendorIds);
        const complaints = await db_1.default.complaintTicket.findMany({
            where: {
                OR: [
                    {
                        raisedByRole: 'ADMIN_AS_VENDOR',
                        raisedByUserId: parseBigInt(normalizedAdminId, 'adminId')
                    },
                    ...(vendorIds.length > 0
                        ? [
                            {
                                vendorId: {
                                    in: vendorIds
                                }
                            }
                        ]
                        : [])
                ]
            },
            include: complaintInclude,
            orderBy: { createdAt: 'desc' }
        });
        const scoped = complaints.filter(record => isAdminAsVendorTicketAccessible(record, normalizedAdminId, scopedVendorIds));
        return Promise.all(scoped.map(enrichComplaintRecord));
    },
    async getAdminAsVendorTicketDetail(adminId, ticketId, roleFilter) {
        const normalizedAdminId = normalizeText(adminId);
        const scopedVendorIds = await getScopedVendorIdSet(roleFilter);
        const complaint = await findComplaintRecordOrThrow(ticketId, undefined, 'Ticket not found');
        if (!isAdminAsVendorTicketAccessible(complaint, normalizedAdminId, scopedVendorIds)) {
            throw new errors_1.ValidationError('Ticket not found');
        }
        return enrichComplaintRecord(complaint);
    },
    async getIndividualVendorTickets(userId) {
        const complaints = await db_1.default.complaintTicket.findMany({
            where: {
                raisedByRole: 'INDIVIDUAL_VENDOR',
                raisedByUserId: parseBigInt(userId, 'userId')
            },
            include: complaintInclude,
            orderBy: { createdAt: 'desc' }
        });
        return Promise.all(complaints.map(enrichComplaintRecord));
    },
    async getIndividualVendorTicketDetail(userId, ticketId) {
        const complaint = await findComplaintRecordOrThrow(ticketId, {
            raisedByRole: 'INDIVIDUAL_VENDOR',
            raisedByUserId: parseBigInt(userId, 'userId')
        }, 'Ticket not found');
        return enrichComplaintRecord(complaint);
    },
    async resolveSupportTicket(ticketId, status, adminResponse, notes, sender, roleFilter) {
        const nextStatus = normalizeStatusCode(status);
        const normalizedResponse = normalizeText(adminResponse);
        const normalizedNotes = normalizeOptionalText(notes);
        const senderRole = toMessageSenderRole(sender?.role || '');
        if (!normalizedResponse) {
            throw new errors_1.ValidationError('adminResponse is required');
        }
        if (!['ADMIN', 'ADMIN_AS_VENDOR'].includes(senderRole)) {
            throw new errors_1.ValidationError('Only support team members can update tickets');
        }
        const existing = await findComplaintRecordOrThrow(ticketId, undefined, 'Ticket not found');
        if (senderRole === 'ADMIN_AS_VENDOR') {
            const scopedVendorIds = await getScopedVendorIdSet(roleFilter);
            const senderUserId = normalizeText(sender?.userId || '');
            if (!isAdminAsVendorTicketAccessible(existing, senderUserId, scopedVendorIds)) {
                throw new errors_1.ValidationError('Ticket not found');
            }
        }
        const now = new Date();
        const isClosed = nextStatus === 'RESOLVED' || nextStatus === 'REJECTED';
        const senderName = normalizeText(sender?.name || '') || getRoleLabel(senderRole);
        const senderUserIdBig = tryParseBigInt(normalizeText(sender?.userId || ''));
        const updated = await db_1.default.complaintTicket.update({
            where: { id: existing.id },
            data: {
                status: nextStatus,
                adminResponse: normalizedResponse,
                adminRespondedAt: now,
                resolution: isClosed ? nextStatus : null,
                resolutionNotes: normalizedNotes,
                resolvedAt: isClosed ? now : null,
                messages: {
                    create: {
                        senderUserId: senderUserIdBig,
                        senderRole,
                        senderName,
                        message: normalizedResponse,
                        attachments: [],
                        isInternal: false
                    }
                }
            },
            include: complaintInclude
        });
        await maybeNotifyIndividualVendorTicketOwner(updated, {
            title: 'Support ticket updated',
            message: `Your support ticket ${updated.complaintNo} is now ${STATUS_LABELS[nextStatus]}.`,
            status: nextStatus
        });
        emitSupportRealtimeForComplaint(updated, 'SUPPORT_TICKET_STATUS_UPDATED');
        return enrichComplaintRecord(updated);
    },
    async addMessageToTicket(ticketId, message, isInternal, imageFiles, sender, roleFilter) {
        const normalizedMessage = normalizeText(message);
        if (!normalizedMessage)
            throw new errors_1.ValidationError('message is required');
        const existing = await findComplaintRecordOrThrow(ticketId, undefined, 'Ticket not found');
        const senderRole = toMessageSenderRole(sender?.role || '');
        const senderUserId = normalizeText(sender?.userId || '');
        if (senderRole === 'ADMIN_AS_VENDOR') {
            const scopedVendorIds = await getScopedVendorIdSet(roleFilter);
            if (!isAdminAsVendorTicketAccessible(existing, senderUserId, scopedVendorIds)) {
                throw new errors_1.ValidationError('Ticket not found');
            }
        }
        const attachments = await uploadComplaintImages(imageFiles || []);
        const senderName = normalizeText(sender?.name || '') || getRoleLabel(senderRole);
        const senderUserIdBig = tryParseBigInt(senderUserId);
        const updated = await db_1.default.complaintTicket.update({
            where: { id: existing.id },
            data: {
                ...(attachments.length > 0
                    ? {
                        attachments: {
                            push: attachments
                        }
                    }
                    : {}),
                ...((senderRole === 'ADMIN' || senderRole === 'ADMIN_AS_VENDOR') && !isInternal
                    ? {
                        adminResponse: normalizedMessage,
                        adminRespondedAt: new Date()
                    }
                    : {}),
                messages: {
                    create: {
                        senderUserId: senderUserIdBig,
                        senderRole,
                        senderName,
                        message: normalizedMessage,
                        attachments,
                        isInternal
                    }
                }
            },
            include: complaintInclude
        });
        if (!isInternal &&
            normalizeRaisedByRole(updated.raisedByRole) === 'INDIVIDUAL_VENDOR' &&
            (senderRole === 'ADMIN' || senderRole === 'ADMIN_AS_VENDOR')) {
            await maybeNotifyIndividualVendorTicketOwner(updated, {
                title: 'New support response',
                message: `You have a new response on support ticket ${updated.complaintNo}.`,
                status: updated.status
            });
        }
        if (!isInternal &&
            normalizeRaisedByRole(updated.raisedByRole) === 'INDIVIDUAL_VENDOR' &&
            senderRole === 'INDIVIDUAL_VENDOR') {
            await NotificationService_1.NotificationService.notifyAdminAsVendorSupportUpdate({
                title: 'Support ticket updated',
                message: `New vendor reply received on support ticket ${updated.complaintNo}.`,
                ticketId: String(updated.id),
                complaintNo: updated.complaintNo,
                status: updated.status
            }).catch(() => null);
        }
        emitSupportRealtimeForComplaint(updated, 'SUPPORT_TICKET_MESSAGE_ADDED');
        return enrichComplaintRecord(updated);
    }
};

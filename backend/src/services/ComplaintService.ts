import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { S3Service } from './S3Service';
import { NotificationService } from './NotificationService';
import {
  emitDataUpdatedToRole,
  emitDataUpdatedToUser
} from '../realtime/socketServer';
import { ValidationError } from '../utils/errors';
import { getVendorProfileUserWhere } from '../utils/vendorScope';

type ComplaintStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH';
type ComplaintFeedback = 'HELPFUL' | 'NOT_HELPFUL' | null;
type ComplaintRaisedByRole = 'CUSTOMER' | 'ADMIN_AS_VENDOR' | 'INDIVIDUAL_VENDOR';
type ComplaintMessageSenderRole =
  | 'CUSTOMER'
  | 'ADMIN'
  | 'ADMIN_AS_VENDOR'
  | 'INDIVIDUAL_VENDOR';

type UploadedImageFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
  [key: string]: any;
};

type CreateComplaintInput = {
  customerId: string;
  orderId?: string;
  orderItemId?: string;
  category: string;
  subCategory?: string;
  description: string;
  imageFiles?: UploadedImageFile[];
};

type TicketSenderContext = {
  userId: string;
  role: string;
  name?: string;
};

type ConversationMessageLike = {
  id: string | bigint;
  senderUserId?: string | bigint | null;
  senderRole: string;
  senderName: string;
  message: string;
  attachments: string[];
  isInternal: boolean;
  createdAt: Date | string;
};

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected'
};

const PRIORITY_LABELS: Record<ComplaintPriority, string> = {
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
      createdAt: 'asc' as const
    }
  }
} satisfies Prisma.ComplaintTicketInclude;

type ComplaintRecord = Prisma.ComplaintTicketGetPayload<{
  include: typeof complaintInclude;
}>;

type OrderItemRecord = Prisma.OrderItemGetPayload<{
  include: {
    order: true;
    product: true;
    variant: true;
    vendorProfile: {
      include: {
        user: true;
      };
    };
  };
}>;

const fileToDataUrl = (file: UploadedImageFile) =>
  `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

const normalizeText = (value: unknown) => String(value || '').trim();

const normalizeOptionalText = (value: unknown) => {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
};

const tryParseBigInt = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
};

const parseBigInt = (value: string, field: string) => {
  const parsed = tryParseBigInt(value);
  if (parsed === null) {
    throw new ValidationError(`Invalid ${field}`);
  }
  return parsed;
};

const toBigIntList = (values: Iterable<string>) =>
  Array.from(values)
    .map(value => tryParseBigInt(value))
    .filter((value): value is bigint => value !== null);

const buildTemporaryComplaintNo = () =>
  `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const buildComplaintNo = (id: string | bigint) =>
  `CMP-${String(id).padStart(6, '0')}`;

const normalizePriorityCode = (value: unknown): ComplaintPriority => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'LOW') return 'LOW';
  if (normalized === 'HIGH' || normalized === 'URGENT') return 'HIGH';
  return 'MEDIUM';
};

const normalizeStatusCode = (value: unknown): ComplaintStatus => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'PENDING') return 'PENDING';
  if (normalized === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (normalized === 'RESOLVED') return 'RESOLVED';
  if (normalized === 'REJECTED') return 'REJECTED';
  throw new ValidationError('Invalid complaint status');
};

const normalizeFeedbackCode = (value: unknown): ComplaintFeedback => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'HELPFUL') return 'HELPFUL';
  if (normalized === 'NOT_HELPFUL') return 'NOT_HELPFUL';
  return null;
};

const normalizeRaisedByRole = (value: unknown): ComplaintRaisedByRole => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'ADMIN_AS_VENDOR') return 'ADMIN_AS_VENDOR';
  if (normalized === 'INDIVIDUAL_VENDOR' || normalized === 'VENDOR') {
    return 'INDIVIDUAL_VENDOR';
  }
  return 'CUSTOMER';
};

const toMessageSenderRole = (value: string): ComplaintMessageSenderRole => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'ADMIN_AS_VENDOR') return 'ADMIN_AS_VENDOR';
  if (normalized === 'INDIVIDUAL_VENDOR' || normalized === 'VENDOR') {
    return 'INDIVIDUAL_VENDOR';
  }
  if (normalized === 'ADMIN') return 'ADMIN';
  return 'CUSTOMER';
};

const getRoleLabel = (role: ComplaintRaisedByRole | ComplaintMessageSenderRole) => {
  if (role === 'ADMIN_AS_VENDOR') return 'Admin as Vendor';
  if (role === 'INDIVIDUAL_VENDOR') return 'Individual Vendor';
  if (role === 'ADMIN') return 'Admin User';
  return 'Customer';
};

const derivePriority = (category: string, subCategory?: string | null): ComplaintPriority => {
  const token = `${category} ${subCategory || ''}`.toLowerCase();
  if (
    token.includes('payment') ||
    token.includes('refund') ||
    token.includes('deposit') ||
    token.includes('vendor') ||
    token.includes('damaged') ||
    token.includes('wrong item') ||
    token.includes('quality')
  ) {
    return 'HIGH';
  }

  if (
    token.includes('order') ||
    token.includes('return') ||
    token.includes('pickup') ||
    token.includes('technical') ||
    token.includes('delivery') ||
    token.includes('late') ||
    token.includes('logistics')
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
};

const buildComplaintTitle = (data: {
  category: string;
  subCategory?: string | null;
  productName?: string | null;
  orderNo?: string | null;
}) => {
  const issue = normalizeOptionalText(data.subCategory) || normalizeText(data.category) || 'Support';
  const subject =
    normalizeOptionalText(data.productName) ||
    normalizeOptionalText(data.orderNo) ||
    'Ticket';
  return `${issue} - ${subject}`;
};

const uploadComplaintImages = async (files: UploadedImageFile[] = []) => {
  if (!files.length) return [] as string[];

  try {
    return await S3Service.uploadMultipleImages(files, 'complaints');
  } catch {
    return files.map(fileToDataUrl);
  }
};

const toAccessibleUrls = async (attachments: string[] = []) =>
  Promise.all(
    attachments
      .filter(Boolean)
      .map(async url => {
        if (String(url).startsWith('data:')) return url;
        try {
          return await S3Service.getAccessibleImageUrl(url);
        } catch {
          return url;
        }
      })
  );

const buildComplaintLookupWhere = (
  complaintIdOrNo: string
): Prisma.ComplaintTicketWhereInput => {
  const normalized = normalizeText(complaintIdOrNo);
  const orClauses: Prisma.ComplaintTicketWhereInput[] = [
    { complaintNo: normalized }
  ];
  const parsedId = tryParseBigInt(normalized);
  if (parsedId !== null) {
    orClauses.unshift({ id: parsedId });
  }

  return { OR: orClauses };
};

const findComplaintRecord = async (
  complaintIdOrNo: string,
  extraWhere?: Prisma.ComplaintTicketWhereInput
) => {
  const normalized = normalizeText(complaintIdOrNo);
  if (!normalized) return null;

  const where: Prisma.ComplaintTicketWhereInput = extraWhere
    ? {
        AND: [buildComplaintLookupWhere(normalized), extraWhere]
      }
    : buildComplaintLookupWhere(normalized);

  return prisma.complaintTicket.findFirst({
    where,
    include: complaintInclude
  });
};

const findComplaintRecordOrThrow = async (
  complaintIdOrNo: string,
  extraWhere?: Prisma.ComplaintTicketWhereInput,
  notFoundMessage = 'Complaint not found'
) => {
  const complaint = await findComplaintRecord(complaintIdOrNo, extraWhere);
  if (!complaint) {
    throw new ValidationError(notFoundMessage);
  }
  return complaint;
};

const findTargetOrderItem = async (
  customerId: string,
  orderId?: string,
  orderItemId?: string
): Promise<OrderItemRecord> => {
  const customerIdBig = parseBigInt(customerId, 'customerId');

  if (orderItemId) {
    const orderItemIdBig = parseBigInt(orderItemId, 'orderItemId');
    const orderItem = await prisma.orderItem.findFirst({
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
      throw new ValidationError('Order item not found for this customer');
    }

    return orderItem;
  }

  if (!orderId) {
    throw new ValidationError('orderId or orderItemId is required');
  }

  const orderIdBig = parseBigInt(orderId, 'orderId');
  const order = await prisma.order.findFirst({
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
    throw new ValidationError('Order not found for this customer');
  }

  const firstItem = order.items?.[0];
  if (!firstItem) {
    throw new ValidationError('Selected order has no items');
  }

  return firstItem;
};

const findVendorProfileByUserId = async (userId: string) => {
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) return null;

  return prisma.vendorProfile.findUnique({
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

const getScopedVendorIdSet = async (roleFilter?: Record<string, any>) => {
  const scopedVendors = await prisma.vendorProfile.findMany({
    where: getVendorProfileUserWhere(roleFilter),
    select: {
      id: true
    }
  });

  return new Set(scopedVendors.map(vendor => String(vendor.id)));
};

const isAdminAsVendorTicketAccessible = (
  record: ComplaintRecord,
  adminId: string,
  scopedVendorIds: Set<string>
) => {
  const raisedByRole = normalizeRaisedByRole(record.raisedByRole);

  if (raisedByRole === 'ADMIN_AS_VENDOR') {
    return String(record.raisedByUserId) === adminId;
  }

  return Boolean(record.vendorId && scopedVendorIds.has(String(record.vendorId)));
};

const decorateMessage = async (message: ConversationMessageLike) => ({
  id: String(message.id),
  senderUserId: message.senderUserId != null ? String(message.senderUserId) : '',
  senderRole: toMessageSenderRole(message.senderRole),
  senderName:
    normalizeText(message.senderName) ||
    getRoleLabel(toMessageSenderRole(message.senderRole)),
  message: normalizeText(message.message),
  attachments: await toAccessibleUrls(message.attachments || []),
  isInternal: Boolean(message.isInternal),
  createdAt:
    message.createdAt instanceof Date
      ? message.createdAt.toISOString()
      : String(message.createdAt),
  readBy: [] as string[]
});

const enrichComplaintRecord = async (record: ComplaintRecord) => {
  const raisedByRole = normalizeRaisedByRole(record.raisedByRole);
  const raisedByName =
    normalizeText(record.raisedByUser?.name) || getRoleLabel(raisedByRole);

  const vendorName =
    record.vendor?.shopName ||
    record.vendor?.ownerName ||
    record.vendor?.user?.name ||
    record.orderItem?.vendorProfile?.shopName ||
    record.orderItem?.vendorProfile?.ownerName ||
    record.orderItem?.vendorProfile?.user?.name ||
    (raisedByRole === 'INDIVIDUAL_VENDOR' ? raisedByName : null) ||
    'N/A';

  const attachments = await toAccessibleUrls(record.attachments || []);
  const fallbackMessages: ConversationMessageLike[] = [
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

  const rawMessages =
    Array.isArray(record.messages) && record.messages.length > 0
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
  const productCode =
    record.orderItem?.variant?.sku ||
    (record.orderItem?.product?.id ? String(record.orderItem.product.id) : null);
  const orderDisplay =
    record.order?.orderNo ||
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
    liked:
      normalizeFeedbackCode(record.feedback) === 'HELPFUL'
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

const maybeNotifyIndividualVendorTicketOwner = async (
  record: ComplaintRecord,
  payload: {
    title: string;
    message: string;
    status?: string;
  }
) => {
  if (normalizeRaisedByRole(record.raisedByRole) !== 'INDIVIDUAL_VENDOR') return;

  await NotificationService.notifyIndividualVendorSupport(String(record.raisedByUserId), {
    title: payload.title,
    message: payload.message,
    ticketId: String(record.id),
    complaintNo: record.complaintNo,
    status: payload.status
  }).catch(() => null);
};

const buildSupportRealtimeRefs = (record: ComplaintRecord) =>
  Object.fromEntries(
    [
      ['ticketId', String(record.id || '').trim()],
      ['complaintNo', String(record.complaintNo || '').trim()],
      ['orderId', record.orderId ? String(record.orderId).trim() : ''],
      ['orderItemId', record.orderItemId ? String(record.orderItemId).trim() : ''],
      ['vendorId', record.vendorId ? String(record.vendorId).trim() : ''],
      ['raisedByRole', normalizeRaisedByRole(record.raisedByRole)]
    ].filter(([, value]) => value)
  );

const emitSupportRealtimeForComplaint = (
  record: ComplaintRecord,
  reason: string
) => {
  const refs = buildSupportRealtimeRefs(record);
  const domains: Array<'support' | 'dashboard'> = ['support', 'dashboard'];
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
    emitDataUpdatedToUser(raisedByUserId, payload);
  }

  if (raisedByRole === 'INDIVIDUAL_VENDOR') {
    emitDataUpdatedToRole('ADMIN_AS_VENDOR', payload);
    return;
  }

  emitDataUpdatedToRole('ADMIN', payload);
};

export const ComplaintService = {
  async createComplaint(data: CreateComplaintInput) {
    const customerId = normalizeText(data.customerId);
    const category = normalizeText(data.category);
    const subCategory = normalizeOptionalText(data.subCategory);
    const description = normalizeText(data.description);

    if (!customerId) throw new ValidationError('customerId is required');
    if (!category) throw new ValidationError('category is required');
    if (!description) throw new ValidationError('description is required');

    const targetOrderItem = await findTargetOrderItem(
      customerId,
      normalizeOptionalText(data.orderId) || undefined,
      normalizeOptionalText(data.orderItemId) || undefined
    );
    const attachments = await uploadComplaintImages(data.imageFiles || []);
    const orderNo = targetOrderItem.order?.orderNo || null;
    const productName = targetOrderItem.product?.name || null;
    const type = [category, subCategory].filter(Boolean).join(' - ');

    const complaint = await prisma.$transaction(async tx => {
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

  async getCustomerComplaints(customerId: string) {
    const normalizedCustomerId = normalizeText(customerId);
    const complaints = await prisma.complaintTicket.findMany({
      where: {
        raisedByUserId: parseBigInt(normalizedCustomerId, 'customerId'),
        raisedByRole: 'CUSTOMER'
      },
      include: complaintInclude,
      orderBy: { createdAt: 'desc' }
    });

    return Promise.all(complaints.map(enrichComplaintRecord));
  },

  async getCustomerComplaintDetail(customerId: string, complaintId: string) {
    const complaint = await findComplaintRecordOrThrow(
      complaintId,
      {
        raisedByUserId: parseBigInt(customerId, 'customerId'),
        raisedByRole: 'CUSTOMER'
      },
      'Complaint not found'
    );

    return enrichComplaintRecord(complaint);
  },

  async setCustomerFeedback(customerId: string, complaintId: string, helpful: boolean) {
    const existing = await findComplaintRecordOrThrow(
      complaintId,
      {
        raisedByUserId: parseBigInt(customerId, 'customerId'),
        raisedByRole: 'CUSTOMER'
      },
      'Complaint not found'
    );

    const updated = await prisma.complaintTicket.update({
      where: { id: existing.id },
      data: {
        feedback: helpful ? 'HELPFUL' : 'NOT_HELPFUL'
      },
      include: complaintInclude
    });

    emitSupportRealtimeForComplaint(updated, 'COMPLAINT_FEEDBACK_UPDATED');

    return enrichComplaintRecord(updated);
  },

  async getComplaints(status?: string) {
    const normalizedStatus = normalizeText(status).toUpperCase();
    const complaints = await prisma.complaintTicket.findMany({
      where:
        normalizedStatus.length > 0
          ? { status: normalizeStatusCode(normalizedStatus) }
          : undefined,
      include: complaintInclude,
      orderBy: { createdAt: 'desc' }
    });

    return Promise.all(complaints.map(enrichComplaintRecord));
  },

  async getComplaintDetail(complaintId: string) {
    const complaint = await findComplaintRecordOrThrow(
      complaintId,
      undefined,
      'Complaint not found'
    );
    return enrichComplaintRecord(complaint);
  },

  async resolveComplaint(
    complaintId: string,
    status: string,
    adminResponse: string,
    notes?: string
  ) {
    const nextStatus = normalizeStatusCode(status);
    const normalizedResponse = normalizeText(adminResponse);
    const normalizedNotes = normalizeOptionalText(notes);

    if (!normalizedResponse) {
      throw new ValidationError('adminResponse is required');
    }

    const existing = await findComplaintRecordOrThrow(
      complaintId,
      undefined,
      'Complaint not found'
    );
    const now = new Date();
    const isClosed = nextStatus === 'RESOLVED' || nextStatus === 'REJECTED';

    const updated = await prisma.complaintTicket.update({
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

  async createIndividualVendorTicket(data: {
    userId: string;
    orderId?: string;
    subject?: string;
    category: string;
    subCategory?: string;
    description: string;
    priority?: string;
    imageFiles?: UploadedImageFile[];
  }) {
    const userId = normalizeText(data.userId);
    const category = normalizeText(data.category);
    const subCategory = normalizeOptionalText(data.subCategory);
    const description = normalizeText(data.description);
    const subject = normalizeOptionalText(data.subject);
    const priority = normalizePriorityCode(data.priority);
    const orderReference = normalizeOptionalText(data.orderId);

    if (!userId) throw new ValidationError('userId is required');
    if (!category) throw new ValidationError('category is required');
    if (!description) throw new ValidationError('description is required');

    const [attachments, vendorProfile] = await Promise.all([
      uploadComplaintImages(data.imageFiles || []),
      findVendorProfileByUserId(userId)
    ]);
    const type = [category, subCategory].filter(Boolean).join(' - ');
    const vendorName =
      vendorProfile?.shopName ||
      vendorProfile?.ownerName ||
      vendorProfile?.user?.name ||
      'Individual Vendor';

    const complaint = await prisma.$transaction(async tx => {
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
          title:
            subject || buildComplaintTitle({ category, subCategory, orderNo: orderReference }),
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

    await NotificationService.notifyIndividualVendorSupport(userId, {
      title: 'Support ticket submitted',
      message: `Your support ticket ${complaint.complaintNo} has been submitted successfully.`,
      ticketId: String(complaint.id),
      complaintNo: complaint.complaintNo,
      status: complaint.status
    }).catch(() => null);

    await NotificationService.notifyAdminAsVendorSupportUpdate({
      title: 'New support ticket',
      message: `Support ticket ${complaint.complaintNo} was submitted by an individual vendor.`,
      ticketId: String(complaint.id),
      complaintNo: complaint.complaintNo,
      status: complaint.status
    }).catch(() => null);

    return enrichComplaintRecord(complaint);
  },

  async createAdminAsVendorTicket(data: {
    adminId: string;
    orderId?: string;
    subject?: string;
    category: string;
    subCategory?: string;
    description: string;
    priority?: string;
    imageFiles?: UploadedImageFile[];
  }) {
    const adminId = normalizeText(data.adminId);
    const category = normalizeText(data.category);
    const subCategory = normalizeOptionalText(data.subCategory);
    const description = normalizeText(data.description);
    const subject = normalizeOptionalText(data.subject);
    const priority = normalizePriorityCode(data.priority);
    const orderReference = normalizeOptionalText(data.orderId);

    if (!adminId) throw new ValidationError('adminId is required');
    if (!category) throw new ValidationError('category is required');
    if (!description) throw new ValidationError('description is required');

    const attachments = await uploadComplaintImages(data.imageFiles || []);
    const type = [category, subCategory].filter(Boolean).join(' - ');

    const complaint = await prisma.$transaction(async tx => {
      const created = await tx.complaintTicket.create({
        data: {
          complaintNo: buildTemporaryComplaintNo(),
          raisedByUserId: parseBigInt(adminId, 'adminId'),
          raisedByRole: 'ADMIN_AS_VENDOR',
          orderReference,
          category,
          subCategory,
          type: type || category,
          title:
            subject || buildComplaintTitle({ category, subCategory, orderNo: orderReference }),
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

  async getAdminAsVendorTickets(adminId: string, roleFilter?: Record<string, any>) {
    const normalizedAdminId = normalizeText(adminId);
    const scopedVendorIds = await getScopedVendorIdSet(roleFilter);
    const vendorIds = toBigIntList(scopedVendorIds);

    const complaints = await prisma.complaintTicket.findMany({
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

    const scoped = complaints.filter(record =>
      isAdminAsVendorTicketAccessible(record, normalizedAdminId, scopedVendorIds)
    );

    return Promise.all(scoped.map(enrichComplaintRecord));
  },

  async getAdminAsVendorTicketDetail(
    adminId: string,
    ticketId: string,
    roleFilter?: Record<string, any>
  ) {
    const normalizedAdminId = normalizeText(adminId);
    const scopedVendorIds = await getScopedVendorIdSet(roleFilter);
    const complaint = await findComplaintRecordOrThrow(ticketId, undefined, 'Ticket not found');

    if (!isAdminAsVendorTicketAccessible(complaint, normalizedAdminId, scopedVendorIds)) {
      throw new ValidationError('Ticket not found');
    }

    return enrichComplaintRecord(complaint);
  },

  async getIndividualVendorTickets(userId: string) {
    const complaints = await prisma.complaintTicket.findMany({
      where: {
        raisedByRole: 'INDIVIDUAL_VENDOR',
        raisedByUserId: parseBigInt(userId, 'userId')
      },
      include: complaintInclude,
      orderBy: { createdAt: 'desc' }
    });

    return Promise.all(complaints.map(enrichComplaintRecord));
  },

  async getIndividualVendorTicketDetail(userId: string, ticketId: string) {
    const complaint = await findComplaintRecordOrThrow(
      ticketId,
      {
        raisedByRole: 'INDIVIDUAL_VENDOR',
        raisedByUserId: parseBigInt(userId, 'userId')
      },
      'Ticket not found'
    );

    return enrichComplaintRecord(complaint);
  },

  async resolveSupportTicket(
    ticketId: string,
    status: string,
    adminResponse: string,
    notes?: string,
    sender?: TicketSenderContext,
    roleFilter?: Record<string, any>
  ) {
    const nextStatus = normalizeStatusCode(status);
    const normalizedResponse = normalizeText(adminResponse);
    const normalizedNotes = normalizeOptionalText(notes);
    const senderRole = toMessageSenderRole(sender?.role || '');

    if (!normalizedResponse) {
      throw new ValidationError('adminResponse is required');
    }

    if (!['ADMIN', 'ADMIN_AS_VENDOR'].includes(senderRole)) {
      throw new ValidationError('Only support team members can update tickets');
    }

    const existing = await findComplaintRecordOrThrow(ticketId, undefined, 'Ticket not found');

    if (senderRole === 'ADMIN_AS_VENDOR') {
      const scopedVendorIds = await getScopedVendorIdSet(roleFilter);
      const senderUserId = normalizeText(sender?.userId || '');
      if (!isAdminAsVendorTicketAccessible(existing, senderUserId, scopedVendorIds)) {
        throw new ValidationError('Ticket not found');
      }
    }

    const now = new Date();
    const isClosed = nextStatus === 'RESOLVED' || nextStatus === 'REJECTED';
    const senderName = normalizeText(sender?.name || '') || getRoleLabel(senderRole);
    const senderUserIdBig = tryParseBigInt(normalizeText(sender?.userId || ''));

    const updated = await prisma.complaintTicket.update({
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

  async addMessageToTicket(
    ticketId: string,
    message: string,
    isInternal: boolean,
    imageFiles?: UploadedImageFile[],
    sender?: TicketSenderContext,
    roleFilter?: Record<string, any>
  ) {
    const normalizedMessage = normalizeText(message);
    if (!normalizedMessage) throw new ValidationError('message is required');

    const existing = await findComplaintRecordOrThrow(ticketId, undefined, 'Ticket not found');
    const senderRole = toMessageSenderRole(sender?.role || '');
    const senderUserId = normalizeText(sender?.userId || '');

    if (senderRole === 'ADMIN_AS_VENDOR') {
      const scopedVendorIds = await getScopedVendorIdSet(roleFilter);
      if (!isAdminAsVendorTicketAccessible(existing, senderUserId, scopedVendorIds)) {
        throw new ValidationError('Ticket not found');
      }
    }

    const attachments = await uploadComplaintImages(imageFiles || []);
    const senderName = normalizeText(sender?.name || '') || getRoleLabel(senderRole);
    const senderUserIdBig = tryParseBigInt(senderUserId);

    const updated = await prisma.complaintTicket.update({
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

    if (
      !isInternal &&
      normalizeRaisedByRole(updated.raisedByRole) === 'INDIVIDUAL_VENDOR' &&
      (senderRole === 'ADMIN' || senderRole === 'ADMIN_AS_VENDOR')
    ) {
      await maybeNotifyIndividualVendorTicketOwner(updated, {
        title: 'New support response',
        message: `You have a new response on support ticket ${updated.complaintNo}.`,
        status: updated.status
      });
    }

    if (
      !isInternal &&
      normalizeRaisedByRole(updated.raisedByRole) === 'INDIVIDUAL_VENDOR' &&
      senderRole === 'INDIVIDUAL_VENDOR'
    ) {
      await NotificationService.notifyAdminAsVendorSupportUpdate({
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

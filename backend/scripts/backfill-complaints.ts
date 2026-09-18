import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import prisma from '../src/config/db';

type LegacyComplaintStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
type LegacyComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH';
type LegacyComplaintFeedback = 'HELPFUL' | 'NOT_HELPFUL' | null;
type LegacyRaisedByRole = 'CUSTOMER' | 'ADMIN_AS_VENDOR' | 'INDIVIDUAL_VENDOR';

type LegacyComplaintMessageRecord = {
  id?: string;
  senderUserId?: string;
  senderRole?: 'CUSTOMER' | 'ADMIN' | 'ADMIN_AS_VENDOR' | 'INDIVIDUAL_VENDOR';
  senderName?: string;
  message?: string;
  attachments?: string[];
  isInternal?: boolean;
  createdAt?: string;
};

type LegacyComplaintStoreRecord = {
  id?: string;
  complaintNo?: string;
  customerId?: string;
  vendorId?: string | null;
  orderId?: string | null;
  orderItemId?: string | null;
  category?: string;
  subCategory?: string | null;
  type?: string;
  title?: string;
  description?: string;
  attachments?: string[];
  status?: LegacyComplaintStatus;
  priority?: LegacyComplaintPriority;
  adminResponse?: string | null;
  adminRespondedAt?: string | null;
  resolution?: string | null;
  resolutionNotes?: string | null;
  feedback?: LegacyComplaintFeedback;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string | null;
  raisedByRole?: LegacyRaisedByRole | null;
  raisedByUserId?: string | null;
  messages?: LegacyComplaintMessageRecord[];
};

const complaintStorePath = path.resolve(process.cwd(), 'data', 'complaints.json');

const normalizeText = (value: unknown) => String(value || '').trim();

const normalizeOptionalText = (value: unknown) => {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
};

const tryParseBigInt = (value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
};

const toDate = (value: unknown, fallback: Date) => {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return fallback;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const normalizeRaisedByRole = (value: unknown): LegacyRaisedByRole => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'ADMIN_AS_VENDOR') return 'ADMIN_AS_VENDOR';
  if (normalized === 'INDIVIDUAL_VENDOR' || normalized === 'VENDOR') {
    return 'INDIVIDUAL_VENDOR';
  }
  return 'CUSTOMER';
};

const normalizeSenderRole = (value: unknown) => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'ADMIN') return 'ADMIN';
  if (normalized === 'ADMIN_AS_VENDOR') return 'ADMIN_AS_VENDOR';
  if (normalized === 'INDIVIDUAL_VENDOR' || normalized === 'VENDOR') {
    return 'INDIVIDUAL_VENDOR';
  }
  return 'CUSTOMER';
};

const normalizeStatus = (value: unknown): LegacyComplaintStatus => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (normalized === 'RESOLVED') return 'RESOLVED';
  if (normalized === 'REJECTED') return 'REJECTED';
  return 'PENDING';
};

const normalizePriority = (value: unknown): LegacyComplaintPriority => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'LOW') return 'LOW';
  if (normalized === 'HIGH') return 'HIGH';
  return 'MEDIUM';
};

const normalizeFeedback = (value: unknown): LegacyComplaintFeedback => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'HELPFUL') return 'HELPFUL';
  if (normalized === 'NOT_HELPFUL') return 'NOT_HELPFUL';
  return null;
};

const readLegacyComplaints = async (): Promise<LegacyComplaintStoreRecord[]> => {
  try {
    const raw = await fs.readFile(complaintStorePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LegacyComplaintStoreRecord[]) : [];
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
};

const exists = async <T>(
  query: Promise<T | null | undefined>
) => Boolean(await query);

async function main() {
  const records = await readLegacyComplaints();
  if (records.length === 0) {
    console.log('No legacy complaints found. Nothing to backfill.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const [index, record] of records.entries()) {
    const complaintNo = normalizeOptionalText(record.complaintNo);
    if (!complaintNo) {
      skipped += 1;
      console.warn(`Skipping legacy complaint at index ${index}: missing complaintNo`);
      continue;
    }

    const existing = await prisma.complaintTicket.findUnique({
      where: { complaintNo },
      select: { id: true }
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const raisedByUserId =
      tryParseBigInt(record.raisedByUserId) ?? tryParseBigInt(record.customerId);
    if (!raisedByUserId) {
      skipped += 1;
      console.warn(`Skipping ${complaintNo}: missing raisedBy user id`);
      continue;
    }

    const hasRaisedByUser = await exists(
      prisma.user.findUnique({
        where: { id: raisedByUserId },
        select: { id: true }
      })
    );
    if (!hasRaisedByUser) {
      skipped += 1;
      console.warn(`Skipping ${complaintNo}: raisedBy user ${raisedByUserId} not found`);
      continue;
    }

    const vendorIdCandidate = tryParseBigInt(record.vendorId);
    const vendorId =
      vendorIdCandidate &&
      (await exists(
        prisma.vendorProfile.findUnique({
          where: { id: vendorIdCandidate },
          select: { id: true }
        })
      ))
        ? vendorIdCandidate
        : null;

    const orderIdCandidate = tryParseBigInt(record.orderId);
    const orderId =
      orderIdCandidate &&
      (await exists(
        prisma.order.findUnique({
          where: { id: orderIdCandidate },
          select: { id: true }
        })
      ))
        ? orderIdCandidate
        : null;

    const orderItemIdCandidate = tryParseBigInt(record.orderItemId);
    const orderItemId =
      orderItemIdCandidate &&
      (await exists(
        prisma.orderItem.findUnique({
          where: { id: orderItemIdCandidate },
          select: { id: true }
        })
      ))
        ? orderItemIdCandidate
        : null;

    const orderReference =
      orderId === null ? normalizeOptionalText(record.orderId) : null;

    const createdAt = toDate(record.createdAt, new Date());
    const updatedAt = toDate(record.updatedAt, createdAt);
    const adminRespondedAt = normalizeOptionalText(record.adminRespondedAt)
      ? toDate(record.adminRespondedAt, updatedAt)
      : null;
    const resolvedAt = normalizeOptionalText(record.resolvedAt)
      ? toDate(record.resolvedAt, updatedAt)
      : null;

    const raisedByRole = normalizeRaisedByRole(record.raisedByRole);
    const senderNameFallback =
      raisedByRole === 'ADMIN_AS_VENDOR'
        ? 'Admin as Vendor'
        : raisedByRole === 'INDIVIDUAL_VENDOR'
        ? 'Individual Vendor'
        : 'Customer';

    const baseMessages =
      Array.isArray(record.messages) && record.messages.length > 0
        ? record.messages
        : [
            {
              senderUserId: String(raisedByUserId),
              senderRole: raisedByRole,
              senderName: senderNameFallback,
              message: normalizeText(record.description),
              attachments: Array.isArray(record.attachments) ? record.attachments : [],
              isInternal: false,
              createdAt: createdAt.toISOString()
            },
            ...(normalizeOptionalText(record.adminResponse)
              ? [
                  {
                    senderRole: 'ADMIN' as const,
                    senderName: 'Admin User',
                    message: normalizeText(record.adminResponse),
                    attachments: [],
                    isInternal: false,
                    createdAt: (adminRespondedAt || updatedAt).toISOString()
                  }
                ]
              : [])
          ];

    const messageCreates = [];
    for (const [messageIndex, message] of baseMessages.entries()) {
      const senderUserIdCandidate = tryParseBigInt(message.senderUserId);
      const senderUserId =
        senderUserIdCandidate &&
        (await exists(
          prisma.user.findUnique({
            where: { id: senderUserIdCandidate },
            select: { id: true }
          })
        ))
          ? senderUserIdCandidate
          : null;

      messageCreates.push({
        senderUserId,
        senderRole: normalizeSenderRole(message.senderRole),
        senderName:
          normalizeText(message.senderName) ||
          (normalizeSenderRole(message.senderRole) === 'ADMIN'
            ? 'Admin User'
            : senderNameFallback),
        message:
          normalizeText(message.message) ||
          (messageIndex === 0 ? normalizeText(record.description) : 'Legacy update'),
        attachments: Array.isArray(message.attachments)
          ? message.attachments.filter(Boolean)
          : [],
        isInternal: Boolean(message.isInternal),
        createdAt: toDate(message.createdAt, createdAt)
      });
    }

    await prisma.complaintTicket.create({
      data: {
        complaintNo,
        raisedByUserId,
        raisedByRole,
        vendorId,
        orderId,
        orderItemId,
        orderReference,
        category: normalizeText(record.category) || 'Support',
        subCategory: normalizeOptionalText(record.subCategory),
        type: normalizeText(record.type) || normalizeText(record.category) || 'Support',
        title: normalizeText(record.title) || complaintNo,
        description: normalizeText(record.description) || 'Legacy support ticket',
        attachments: Array.isArray(record.attachments) ? record.attachments.filter(Boolean) : [],
        status: normalizeStatus(record.status),
        priority: normalizePriority(record.priority),
        adminResponse: normalizeOptionalText(record.adminResponse),
        adminRespondedAt,
        resolution: normalizeOptionalText(record.resolution),
        resolutionNotes: normalizeOptionalText(record.resolutionNotes),
        feedback: normalizeFeedback(record.feedback),
        createdAt,
        updatedAt,
        resolvedAt,
        messages: {
          create: messageCreates
        }
      }
    });

    created += 1;
  }

  console.log(`Complaint backfill complete. Created: ${created}. Skipped: ${skipped}.`);
}

main()
  .catch(error => {
    console.error('Complaint backfill failed.', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

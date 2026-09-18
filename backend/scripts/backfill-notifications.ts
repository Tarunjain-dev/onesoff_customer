import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import prisma from '../src/config/db';

type LegacyInAppNotification = {
  id?: string;
  userId?: string;
  type?: string;
  title?: string;
  message?: string;
  data?: Record<string, unknown>;
  createdAt?: string;
  readAt?: string | null;
};

type LegacyInAppStore = Record<string, LegacyInAppNotification[]>;

const storePath = path.resolve(process.cwd(), 'data', 'in-app-notifications.json');

const normalizeText = (value: unknown) => String(value || '').trim();

const tryParseBigInt = (value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
};

const normalizeNotificationData = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      String(entryValue)
    ])
  );
};

const toDate = (value: unknown, fallback: Date) => {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const readLegacyStore = async (): Promise<LegacyInAppStore> => {
  try {
    const raw = await fs.readFile(storePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LegacyInAppStore) : {};
  } catch (error: any) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
};

async function main() {
  const store = await readLegacyStore();
  const entries = Object.entries(store);

  if (entries.length === 0) {
    console.log('No legacy in-app notifications found. Nothing to backfill.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const [userKey, rows] of entries) {
    const userId = tryParseBigInt(userKey);
    if (!userId) {
      skipped += Array.isArray(rows) ? rows.length : 0;
      console.warn(`Skipping notifications for invalid user key: ${userKey}`);
      continue;
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    if (!userExists) {
      skipped += Array.isArray(rows) ? rows.length : 0;
      console.warn(`Skipping notifications for missing user: ${userKey}`);
      continue;
    }

    const data = (Array.isArray(rows) ? rows : [])
      .map((row, index) => {
        const title = normalizeText(row?.title);
        const message = normalizeText(row?.message);
        if (!title || !message) return null;

        const id = normalizeText(row?.id) || `legacy-${userKey}-${index}`;
        const createdAt = toDate(row?.createdAt, new Date());
        const readAtRaw = normalizeText(row?.readAt);
        const readAt = readAtRaw ? toDate(readAtRaw, createdAt) : null;

        return {
          id,
          userId,
          type: normalizeText(row?.type) || 'ORDER_ACCEPTED_CUSTOMER',
          title,
          message,
          data: normalizeNotificationData(row?.data),
          createdAt,
          readAt
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (data.length === 0) {
      skipped += Array.isArray(rows) ? rows.length : 0;
      continue;
    }

    const result = await (prisma as any).inAppNotification.createMany({
      data,
      skipDuplicates: true
    });

    created += Number(result?.count || 0);
    skipped += data.length - Number(result?.count || 0);
  }

  console.log(`In-app notification backfill completed. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((error) => {
    console.error('In-app notification backfill failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

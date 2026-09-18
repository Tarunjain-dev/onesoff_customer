import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import prisma from '../src/config/db';
import { VendorProfileService } from '../src/services/VendorProfileService';

type LegacyRecord = Record<string, Record<string, unknown>>;

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

const readLegacyStore = async (fileName: string): Promise<LegacyRecord> => {
  const filePath = path.resolve(process.cwd(), 'data', fileName);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LegacyRecord) : {};
  } catch (error: any) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
};

const isMeaningfulRecord = (value: Record<string, unknown> | undefined) =>
  Boolean(value) &&
  Object.values(value as Record<string, unknown>).some(entry => {
    if (entry === null || entry === undefined) return false;
    if (Array.isArray(entry)) return entry.length > 0;
    if (typeof entry === 'object') return Object.keys(entry as Record<string, unknown>).length > 0;
    return String(entry).trim().length > 0;
  });

async function main() {
  const [onboarding, bank, extras, fallbackProfile] = await Promise.all([
    readLegacyStore('vendor-onboarding-details.json'),
    readLegacyStore('vendor-bank-details.json'),
    readLegacyStore('vendor-profile-extras.json'),
    readLegacyStore('vendor-profile-fallback.json')
  ]);

  const userIds = Array.from(
    new Set([
      ...Object.keys(onboarding),
      ...Object.keys(bank),
      ...Object.keys(extras),
      ...Object.keys(fallbackProfile)
    ])
  );

  if (userIds.length === 0) {
    console.log('No legacy vendor profile data found. Nothing to backfill.');
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const userKey of userIds) {
    const userId = tryParseBigInt(userKey);
    if (!userId) {
      skipped += 1;
      console.warn(`Skipping invalid vendor user key: ${userKey}`);
      continue;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user) {
      skipped += 1;
      console.warn(`Skipping vendor profile backfill for missing user: ${userKey}`);
      continue;
    }

    const payload = {
      ...(fallbackProfile[userKey] || {}),
      ...(onboarding[userKey] || {}),
      ...(bank[userKey] || {}),
      ...(extras[userKey] || {})
    };

    if (!isMeaningfulRecord(payload)) {
      skipped += 1;
      continue;
    }

    try {
      await VendorProfileService.updateProfile(String(userId), payload);
      updated += 1;
    } catch (error) {
      skipped += 1;
      console.warn(
        `Skipping vendor profile backfill for user ${userKey}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  console.log(`Vendor profile data backfill completed. Updated: ${updated}, Skipped: ${skipped}`);
}

main()
  .catch(error => {
    console.error('Vendor profile data backfill failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

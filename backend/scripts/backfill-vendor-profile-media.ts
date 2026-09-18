import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import prisma from '../src/config/db';

type LegacyVendorProfileMediaRecord = {
  profileImageUrl?: string | null;
};

type LegacyVendorProfileMediaStore = Record<string, LegacyVendorProfileMediaRecord>;

const storePath = path.resolve(process.cwd(), 'data', 'vendor-profile-media.json');

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

const readLegacyStore = async (): Promise<LegacyVendorProfileMediaStore> => {
  try {
    const raw = await fs.readFile(storePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as LegacyVendorProfileMediaStore)
      : {};
  } catch (error: any) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
};

async function main() {
  const store = await readLegacyStore();
  const entries = Object.entries(store);

  if (entries.length === 0) {
    console.log('No legacy vendor profile media found. Nothing to backfill.');
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const [userKey, record] of entries) {
    const userId = tryParseBigInt(userKey);
    const profileImageUrl = normalizeText(record?.profileImageUrl);

    if (!userId || !profileImageUrl) {
      skipped += 1;
      continue;
    }

    const result = await prisma.vendorProfile.updateMany({
      where: {
        userId,
        OR: [{ profileImageUrl: null }, { profileImageUrl: '' }]
      },
      data: { profileImageUrl }
    });

    if (Number(result.count || 0) > 0) {
      updated += Number(result.count || 0);
    } else {
      skipped += 1;
    }
  }

  console.log(
    `Vendor profile media backfill completed. Updated: ${updated}, Skipped: ${skipped}`
  );
}

main()
  .catch((error) => {
    console.error('Vendor profile media backfill failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

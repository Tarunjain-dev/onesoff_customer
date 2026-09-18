import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import prisma from '../src/config/db';
import {
  readProductApprovalFlowMetadata,
  type ProductApprovalFlowMetadata,
  withProductApprovalFlowMetadata
} from '../src/services/ProductService';

type ProductApprovalStage =
  | 'PENDING_APPROVAL'
  | 'APPROVED_1'
  | 'PENDING_VENDOR_AGREEMENT'
  | 'LIVE'
  | 'REJECTED';

type VendorApprovalDecision = 'AGREE' | 'REJECT';
type ProductWithdrawalStatus = 'REQUESTED' | 'APPROVED';

type LegacyProductApprovalFlowRecord = {
  productId?: string;
  currentStage?: string;
  submittedAt?: string;
  approved1At?: string | null;
  approved2At?: string | null;
  finalRentalPrice?: number | string | null;
  currentProductValue?: number | string | null;
  withdrawalStatus?: string | null;
  withdrawalRequestedAt?: string | null;
  withdrawalApprovedAt?: string | null;
  vendorDecision?: string | null;
  vendorDecisionAt?: string | null;
  listedAt?: string | null;
  rejectedAt?: string | null;
  statusOverride?: string | null;
};

type LegacyApprovalStore = Record<string, LegacyProductApprovalFlowRecord>;

const storePath = path.resolve(process.cwd(), 'data', 'product-approval-flows.json');

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

const normalizeStage = (value: unknown): ProductApprovalStage => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'APPROVED_1') return 'APPROVED_1';
  if (normalized === 'PENDING_VENDOR_AGREEMENT') return 'PENDING_VENDOR_AGREEMENT';
  if (normalized === 'LIVE') return 'LIVE';
  if (normalized === 'REJECTED') return 'REJECTED';
  return 'PENDING_APPROVAL';
};

const normalizeVendorDecision = (value: unknown): VendorApprovalDecision | null => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'AGREE') return 'AGREE';
  if (normalized === 'REJECT') return 'REJECT';
  return null;
};

const normalizeWithdrawalStatus = (value: unknown): ProductWithdrawalStatus | null => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'REQUESTED') return 'REQUESTED';
  if (normalized === 'APPROVED') return 'APPROVED';
  return null;
};

const normalizeStatusOverride = (value: unknown): 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK' | null => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'ACTIVE') return 'ACTIVE';
  if (normalized === 'INACTIVE') return 'INACTIVE';
  if (normalized === 'OUT_OF_STOCK') return 'OUT_OF_STOCK';
  return null;
};

const normalizeNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeIsoString = (value: unknown, fallback: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};

const mapStageToProductStatus = (stage: ProductApprovalStage) => {
  if (stage === 'LIVE') return 'ACTIVE';
  if (stage === 'REJECTED') return 'REJECTED';
  if (stage === 'APPROVED_1') return 'APPROVED_1';
  if (stage === 'PENDING_VENDOR_AGREEMENT') return 'PENDING_VENDOR_AGREEMENT';
  return 'INACTIVE';
};

const computeSecurityDeposit = (rentalPrice: number) =>
  Number(((Number(rentalPrice) * 80) / 100).toFixed(2));

const readLegacyStore = async (): Promise<LegacyApprovalStore> => {
  try {
    const raw = await fs.readFile(storePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LegacyApprovalStore) : {};
  } catch (error: any) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
};

async function main() {
  const store = await readLegacyStore();
  const entries = Object.entries(store);

  if (entries.length === 0) {
    console.log('No legacy product approval flows found. Nothing to backfill.');
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const [productKey, record] of entries) {
    const productId = tryParseBigInt(record.productId ?? productKey);
    if (!productId) {
      skipped += 1;
      console.warn(`Skipping invalid product approval flow key: ${productKey}`);
      continue;
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        rentalPrice: true,
        productDetailsFull: true,
        fullDescription: true
      }
    });

    if (!product) {
      skipped += 1;
      console.warn(`Skipping missing product for approval flow backfill: ${productKey}`);
      continue;
    }

    if (readProductApprovalFlowMetadata(product.productDetailsFull)) {
      skipped += 1;
      continue;
    }

    const submittedAt = normalizeIsoString(record.submittedAt, product.createdAt.toISOString());
    const flow: ProductApprovalFlowMetadata = {
      currentStage: normalizeStage(record.currentStage),
      submittedAt,
      approved1At: record.approved1At ? normalizeIsoString(record.approved1At, submittedAt) : null,
      approved2At: record.approved2At ? normalizeIsoString(record.approved2At, submittedAt) : null,
      finalRentalPrice: normalizeNumber(record.finalRentalPrice),
      currentProductValue: normalizeNumber(record.currentProductValue),
      withdrawalStatus: normalizeWithdrawalStatus(record.withdrawalStatus),
      withdrawalRequestedAt: record.withdrawalRequestedAt
        ? normalizeIsoString(record.withdrawalRequestedAt, submittedAt)
        : null,
      withdrawalApprovedAt: record.withdrawalApprovedAt
        ? normalizeIsoString(record.withdrawalApprovedAt, submittedAt)
        : null,
      vendorDecision: normalizeVendorDecision(record.vendorDecision),
      vendorDecisionAt: record.vendorDecisionAt
        ? normalizeIsoString(record.vendorDecisionAt, submittedAt)
        : null,
      listedAt: record.listedAt ? normalizeIsoString(record.listedAt, submittedAt) : null,
      rejectedAt: record.rejectedAt ? normalizeIsoString(record.rejectedAt, submittedAt) : null,
      statusOverride: normalizeStatusOverride(record.statusOverride)
    };

    const nextStatus = flow.statusOverride || mapStageToProductStatus(normalizeStage(flow.currentStage));
    const nextProductDetailsFull = withProductApprovalFlowMetadata(
      product.productDetailsFull,
      flow,
      String(
        product.fullDescription ||
          (product.productDetailsFull as any)?.aboutItem ||
          ''
      )
    );

    const finalRentalPrice = Number(flow.finalRentalPrice || 0);
    await prisma.product.update({
      where: { id: productId },
      data: {
        status: nextStatus,
        productDetailsFull: nextProductDetailsFull as any,
        ...(flow.currentStage === 'LIVE' && finalRentalPrice > 0
          ? {
              rentalPrice: finalRentalPrice,
              securityDeposit: computeSecurityDeposit(finalRentalPrice)
            }
          : {})
      } as any
    });

    updated += 1;
  }

  console.log(`Product approval flow backfill completed. Updated: ${updated}, Skipped: ${skipped}`);
}

main()
  .catch(error => {
    console.error('Product approval flow backfill failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

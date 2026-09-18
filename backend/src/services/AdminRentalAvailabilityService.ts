import prisma from '../config/db';
import { ProductService } from './ProductService';
import { RentalAvailabilityService } from './RentalAvailabilityService';
import { getVendorProfileUserWhere } from '../utils/vendorScope';
import { ValidationError } from '../utils/errors';

type ScopedVendorProductsInput = {
  vendorId: string;
  page?: number;
  limit?: number;
};

type ScopedCalendarInput = {
  vendorId: string;
  productId: string;
  month?: string;
  variantId?: string;
};

type ScopedUpsertDateInput = {
  vendorId: string;
  productId: string;
  variantId?: string;
  date: string;
  mode: 'BLOCKED' | 'MAINTENANCE' | 'AVAILABLE';
  note?: string;
};

type ScopedClearMonthInput = {
  vendorId: string;
  productId: string;
  variantId?: string;
  month: string;
};

const resolveScopedVendorProfileId = async (
  vendorIdentifier: string,
  roleFilter?: Record<string, any>
) => {
  const normalizedVendorId = String(vendorIdentifier || '').trim();
  if (!normalizedVendorId) {
    throw new ValidationError('vendorId is required');
  }

  let vendorIdBig: bigint;
  try {
    vendorIdBig = BigInt(normalizedVendorId);
  } catch {
    throw new ValidationError('Invalid vendorId');
  }

  const vendorProfile = await prisma.vendorProfile.findFirst({
    where: {
      OR: [{ id: vendorIdBig }, { userId: vendorIdBig }],
      ...getVendorProfileUserWhere(roleFilter)
    },
    select: { id: true }
  });

  if (!vendorProfile) {
    throw new ValidationError('Vendor not found');
  }

  return vendorProfile.id.toString();
};

export const AdminRentalAvailabilityService = {
  async getScopedVendorProducts(
    input: ScopedVendorProductsInput,
    roleFilter?: Record<string, any>
  ) {
    const vendorProfileId = await resolveScopedVendorProfileId(input.vendorId, roleFilter);

    return ProductService.getProducts(
      {
        vendorId: vendorProfileId,
        page: input.page ?? 1,
        limit: input.limit ?? 200,
        status: 'ALL'
      },
      { requesterRole: 'ADMIN' }
    );
  },

  async getScopedCalendar(input: ScopedCalendarInput, roleFilter?: Record<string, any>) {
    const vendorProfileId = await resolveScopedVendorProfileId(input.vendorId, roleFilter);

    return RentalAvailabilityService.getCalendar(vendorProfileId, {
      productId: input.productId,
      month: input.month,
      variantId: input.variantId
    });
  },

  async upsertScopedDate(input: ScopedUpsertDateInput, roleFilter?: Record<string, any>) {
    const vendorProfileId = await resolveScopedVendorProfileId(input.vendorId, roleFilter);

    return RentalAvailabilityService.upsertDate(vendorProfileId, {
      productId: input.productId,
      variantId: input.variantId,
      date: input.date,
      mode: input.mode,
      note: input.note
    });
  },

  async clearScopedMonth(input: ScopedClearMonthInput, roleFilter?: Record<string, any>) {
    const vendorProfileId = await resolveScopedVendorProfileId(input.vendorId, roleFilter);

    return RentalAvailabilityService.clearMonth(vendorProfileId, {
      productId: input.productId,
      variantId: input.variantId,
      month: input.month
    });
  }
};

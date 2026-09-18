import { ValidationError } from '../utils/errors';
import prisma from '../config/db';

type CreateCouponInput = {
  code?: string;
  type?: 'FLAT' | 'PERCENT';
  value?: number;
  discountType?: 'FLAT' | 'PERCENT';
  discountValue?: number;
  validityDays?: number | string;
  isActive?: boolean;
};

const normalizeCouponCode = (code: unknown) => String(code || '').trim().toUpperCase();

const toPositiveMoney = (value: unknown, fieldName: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldName} must be greater than 0`);
  }
  return parsed;
};

const toPositiveInteger = (value: unknown, fieldName: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldName} must be a positive whole number`);
  }
  return parsed;
};

const resolveValidityDays = (value: unknown, fallback = 30) =>
  value === undefined || value === null || String(value).trim() === ''
    ? fallback
    : toPositiveInteger(value, 'validityDays');

const getCouponValidityEndsAt = (registeredAt: Date, validityDays: number) =>
  new Date(registeredAt.getTime() + validityDays * 24 * 60 * 60 * 1000);

const getCustomerRegistrationDate = async (customerId: bigint) => {
  const customer = await prisma.user.findUnique({
    where: { id: customerId },
    select: { createdAt: true }
  });

  if (!customer) throw new ValidationError('Customer not found');
  return customer.createdAt;
};

export const CouponService = {
  async createCoupon(_adminId: string, couponData: CreateCouponInput) {
    const code = normalizeCouponCode(couponData.code);
    if (!code) throw new ValidationError('Coupon code is required');

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new ValidationError('Coupon code already exists');

    const resolvedType = (couponData.discountType ?? couponData.type ?? 'FLAT').toUpperCase();
    const resolvedValue = Number(couponData.discountValue ?? couponData.value ?? 0);

    if (!['FLAT', 'PERCENT'].includes(resolvedType)) {
      throw new ValidationError('discountType must be FLAT or PERCENT');
    }

    if (!Number.isFinite(resolvedValue) || resolvedValue <= 0) {
      throw new ValidationError('discountValue must be a positive number');
    }

    if (resolvedType === 'PERCENT' && resolvedValue > 100) {
      throw new ValidationError('discountValue cannot exceed 100 for percentage coupons');
    }

    const validityDays = resolveValidityDays(couponData.validityDays);

    return prisma.coupon.create({
      data: {
        code,
        discountType: resolvedType as 'FLAT' | 'PERCENT',
        discountValue: resolvedValue,
        validityDays,
        isActive: couponData.isActive ?? true
      }
    });
  },

  async validateCoupon(code: string, customerId: string, orderValue: number, _vendorId?: string) {
    const normalizedCode = normalizeCouponCode(code);
    if (!normalizedCode) throw new ValidationError('Coupon code is required');

    const couponBaseAmount = toPositiveMoney(orderValue, 'Order value');
    const customerIdBig = BigInt(customerId);

    const coupon = await prisma.coupon.findFirst({
      where: {
        code: normalizedCode,
        isActive: true
      }
    });

    if (!coupon) throw new ValidationError('Invalid coupon');

    const [userUsage, registeredAt] = await Promise.all([
      prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          userId: customerIdBig
        }
      }),
      getCustomerRegistrationDate(customerIdBig)
    ]);

    const validUntil = getCouponValidityEndsAt(registeredAt, Number(coupon.validityDays || 30));
    if (validUntil.getTime() < Date.now()) {
      throw new ValidationError('This coupon has expired for your account');
    }

    if (userUsage > 0) {
      throw new ValidationError('You have already used this coupon');
    }

    const rawDiscount =
      coupon.discountType === 'FLAT'
        ? Number(coupon.discountValue)
        : (couponBaseAmount * Number(coupon.discountValue)) / 100;
    const discount = Math.min(Math.max(0, rawDiscount), couponBaseAmount);

    return {
      coupon,
      discount,
      finalOrderValue: Math.max(0, couponBaseAmount - discount),
      validUntil
    };
  },

  async applyCoupon(couponId: string, customerId: string, orderId: string, _discount: number) {
    const couponIdBig = BigInt(couponId);
    const customerIdBig = BigInt(customerId);
    const orderIdBig = BigInt(orderId);

    const existing = await prisma.couponUsage.findFirst({
      where: {
        couponId: couponIdBig,
        userId: customerIdBig,
        orderId: orderIdBig
      }
    });

    if (existing) return existing;

    const existingForUser = await prisma.couponUsage.findFirst({
      where: {
        couponId: couponIdBig,
        userId: customerIdBig
      }
    });

    if (existingForUser) {
      throw new ValidationError('You have already used this coupon');
    }

    return prisma.couponUsage.create({
      data: {
        couponId: couponIdBig,
        userId: customerIdBig,
        orderId: orderIdBig
      }
    });
  },

  async getFirstOrderOffer(customerId: string) {
    const customerIdBig = BigInt(customerId);
    const coupon = await prisma.coupon.findFirst({
      where: { isActive: true },
      include: { _count: { select: { usage: true } } },
      orderBy: { createdAt: 'desc' }
    });

    if (!coupon) {
      return {
        coupon: null,
        isEligible: false,
        reason: 'No welcome coupon is active right now'
      };
    }

    const [userUsage, registeredAt] = await Promise.all([
      prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          userId: customerIdBig
        }
      }),
      getCustomerRegistrationDate(customerIdBig)
    ]);

    const validUntil = getCouponValidityEndsAt(registeredAt, Number(coupon.validityDays || 30));
    const isExpired = validUntil.getTime() < Date.now();
    const hasUsedCoupon = userUsage > 0;
    const isEligible = !hasUsedCoupon && !isExpired;

    return {
      coupon: isEligible ? coupon : null,
      isEligible,
      validUntil: isEligible ? validUntil : null,
      reason: isEligible
        ? null
        : isExpired
          ? 'This coupon has expired for your account'
          : 'You have already used this coupon'
    };
  },

  async getCoupons(filters: { isActive?: boolean; page?: number | string; limit?: number | string }) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);
    const skip = (page - 1) * limit;
    const where: { isActive?: boolean } = {};

    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const coupons = await prisma.coupon.findMany({
      where,
      skip,
      take: limit,
      include: { _count: { select: { usage: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.coupon.count({ where });
    return { coupons, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },

  async updateCoupon(couponId: string, couponData: CreateCouponInput) {
    const id = BigInt(couponId);
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new ValidationError('Coupon not found');

    const nextCode = couponData.code === undefined
      ? existing.code
      : normalizeCouponCode(couponData.code);
    if (!nextCode) throw new ValidationError('Coupon code is required');

    if (nextCode !== existing.code) {
      const duplicate = await prisma.coupon.findUnique({ where: { code: nextCode } });
      if (duplicate && duplicate.id !== existing.id) {
        throw new ValidationError('Coupon code already exists');
      }
    }

    const resolvedType = String(
      couponData.discountType ?? couponData.type ?? existing.discountType
    ).toUpperCase();
    const resolvedValue = Number(
      couponData.discountValue ?? couponData.value ?? existing.discountValue
    );

    if (!['FLAT', 'PERCENT'].includes(resolvedType)) {
      throw new ValidationError('discountType must be FLAT or PERCENT');
    }

    if (!Number.isFinite(resolvedValue) || resolvedValue <= 0) {
      throw new ValidationError('discountValue must be a positive number');
    }

    if (resolvedType === 'PERCENT' && resolvedValue > 100) {
      throw new ValidationError('discountValue cannot exceed 100 for percentage coupons');
    }

    const validityDays = resolveValidityDays(couponData.validityDays, Number(existing.validityDays || 30));

    return prisma.coupon.update({
      where: { id },
      data: {
        code: nextCode,
        discountType: resolvedType as 'FLAT' | 'PERCENT',
        discountValue: resolvedValue,
        validityDays,
        ...(couponData.isActive === undefined ? {} : { isActive: Boolean(couponData.isActive) })
      }
    });
  },

  async toggleCoupon(couponId: string, isActive: boolean) {
    return prisma.coupon.update({
      where: { id: BigInt(couponId) },
      data: { isActive }
    });
  },

  async deleteCoupon(couponId: string) {
    const id = BigInt(couponId);
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new ValidationError('Coupon not found');

    await prisma.$transaction(async (tx) => {
      await tx.couponUsage.deleteMany({ where: { couponId: id } });
      await tx.order.updateMany({ where: { couponId: id }, data: { couponId: null } });
      await tx.coupon.delete({ where: { id } });
    });

    return { id: couponId };
  }
};

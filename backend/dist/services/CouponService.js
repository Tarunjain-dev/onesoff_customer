"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponService = void 0;
const errors_1 = require("../utils/errors");
const db_1 = __importDefault(require("../config/db"));
const normalizeCouponCode = (code) => String(code || '').trim().toUpperCase();
const toPositiveMoney = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new errors_1.ValidationError(`${fieldName} must be greater than 0`);
    }
    return parsed;
};
const toPositiveInteger = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new errors_1.ValidationError(`${fieldName} must be a positive whole number`);
    }
    return parsed;
};
const resolveValidityDays = (value, fallback = 30) => value === undefined || value === null || String(value).trim() === ''
    ? fallback
    : toPositiveInteger(value, 'validityDays');
const getCouponValidityEndsAt = (registeredAt, validityDays) => new Date(registeredAt.getTime() + validityDays * 24 * 60 * 60 * 1000);
const getCustomerRegistrationDate = async (customerId) => {
    const customer = await db_1.default.user.findUnique({
        where: { id: customerId },
        select: { createdAt: true }
    });
    if (!customer)
        throw new errors_1.ValidationError('Customer not found');
    return customer.createdAt;
};
exports.CouponService = {
    async createCoupon(_adminId, couponData) {
        const code = normalizeCouponCode(couponData.code);
        if (!code)
            throw new errors_1.ValidationError('Coupon code is required');
        const existing = await db_1.default.coupon.findUnique({ where: { code } });
        if (existing)
            throw new errors_1.ValidationError('Coupon code already exists');
        const resolvedType = (couponData.discountType ?? couponData.type ?? 'FLAT').toUpperCase();
        const resolvedValue = Number(couponData.discountValue ?? couponData.value ?? 0);
        if (!['FLAT', 'PERCENT'].includes(resolvedType)) {
            throw new errors_1.ValidationError('discountType must be FLAT or PERCENT');
        }
        if (!Number.isFinite(resolvedValue) || resolvedValue <= 0) {
            throw new errors_1.ValidationError('discountValue must be a positive number');
        }
        if (resolvedType === 'PERCENT' && resolvedValue > 100) {
            throw new errors_1.ValidationError('discountValue cannot exceed 100 for percentage coupons');
        }
        const validityDays = resolveValidityDays(couponData.validityDays);
        return db_1.default.coupon.create({
            data: {
                code,
                discountType: resolvedType,
                discountValue: resolvedValue,
                validityDays,
                isActive: couponData.isActive ?? true
            }
        });
    },
    async validateCoupon(code, customerId, orderValue, _vendorId) {
        const normalizedCode = normalizeCouponCode(code);
        if (!normalizedCode)
            throw new errors_1.ValidationError('Coupon code is required');
        const couponBaseAmount = toPositiveMoney(orderValue, 'Order value');
        const customerIdBig = BigInt(customerId);
        const coupon = await db_1.default.coupon.findFirst({
            where: {
                code: normalizedCode,
                isActive: true
            }
        });
        if (!coupon)
            throw new errors_1.ValidationError('Invalid coupon');
        const [userUsage, registeredAt] = await Promise.all([
            db_1.default.couponUsage.count({
                where: {
                    couponId: coupon.id,
                    userId: customerIdBig
                }
            }),
            getCustomerRegistrationDate(customerIdBig)
        ]);
        const validUntil = getCouponValidityEndsAt(registeredAt, Number(coupon.validityDays || 30));
        if (validUntil.getTime() < Date.now()) {
            throw new errors_1.ValidationError('This coupon has expired for your account');
        }
        if (userUsage > 0) {
            throw new errors_1.ValidationError('You have already used this coupon');
        }
        const rawDiscount = coupon.discountType === 'FLAT'
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
    async applyCoupon(couponId, customerId, orderId, _discount) {
        const couponIdBig = BigInt(couponId);
        const customerIdBig = BigInt(customerId);
        const orderIdBig = BigInt(orderId);
        const existing = await db_1.default.couponUsage.findFirst({
            where: {
                couponId: couponIdBig,
                userId: customerIdBig,
                orderId: orderIdBig
            }
        });
        if (existing)
            return existing;
        const existingForUser = await db_1.default.couponUsage.findFirst({
            where: {
                couponId: couponIdBig,
                userId: customerIdBig
            }
        });
        if (existingForUser) {
            throw new errors_1.ValidationError('You have already used this coupon');
        }
        return db_1.default.couponUsage.create({
            data: {
                couponId: couponIdBig,
                userId: customerIdBig,
                orderId: orderIdBig
            }
        });
    },
    async getFirstOrderOffer(customerId) {
        const customerIdBig = BigInt(customerId);
        const coupon = await db_1.default.coupon.findFirst({
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
            db_1.default.couponUsage.count({
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
    async getCoupons(filters) {
        const page = Number(filters.page ?? 1);
        const limit = Number(filters.limit ?? 20);
        const skip = (page - 1) * limit;
        const where = {};
        if (filters.isActive !== undefined)
            where.isActive = filters.isActive;
        const coupons = await db_1.default.coupon.findMany({
            where,
            skip,
            take: limit,
            include: { _count: { select: { usage: true } } },
            orderBy: { createdAt: 'desc' }
        });
        const total = await db_1.default.coupon.count({ where });
        return { coupons, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    },
    async updateCoupon(couponId, couponData) {
        const id = BigInt(couponId);
        const existing = await db_1.default.coupon.findUnique({ where: { id } });
        if (!existing)
            throw new errors_1.ValidationError('Coupon not found');
        const nextCode = couponData.code === undefined
            ? existing.code
            : normalizeCouponCode(couponData.code);
        if (!nextCode)
            throw new errors_1.ValidationError('Coupon code is required');
        if (nextCode !== existing.code) {
            const duplicate = await db_1.default.coupon.findUnique({ where: { code: nextCode } });
            if (duplicate && duplicate.id !== existing.id) {
                throw new errors_1.ValidationError('Coupon code already exists');
            }
        }
        const resolvedType = String(couponData.discountType ?? couponData.type ?? existing.discountType).toUpperCase();
        const resolvedValue = Number(couponData.discountValue ?? couponData.value ?? existing.discountValue);
        if (!['FLAT', 'PERCENT'].includes(resolvedType)) {
            throw new errors_1.ValidationError('discountType must be FLAT or PERCENT');
        }
        if (!Number.isFinite(resolvedValue) || resolvedValue <= 0) {
            throw new errors_1.ValidationError('discountValue must be a positive number');
        }
        if (resolvedType === 'PERCENT' && resolvedValue > 100) {
            throw new errors_1.ValidationError('discountValue cannot exceed 100 for percentage coupons');
        }
        const validityDays = resolveValidityDays(couponData.validityDays, Number(existing.validityDays || 30));
        return db_1.default.coupon.update({
            where: { id },
            data: {
                code: nextCode,
                discountType: resolvedType,
                discountValue: resolvedValue,
                validityDays,
                ...(couponData.isActive === undefined ? {} : { isActive: Boolean(couponData.isActive) })
            }
        });
    },
    async toggleCoupon(couponId, isActive) {
        return db_1.default.coupon.update({
            where: { id: BigInt(couponId) },
            data: { isActive }
        });
    },
    async deleteCoupon(couponId) {
        const id = BigInt(couponId);
        const existing = await db_1.default.coupon.findUnique({ where: { id } });
        if (!existing)
            throw new errors_1.ValidationError('Coupon not found');
        await db_1.default.$transaction(async (tx) => {
            await tx.couponUsage.deleteMany({ where: { couponId: id } });
            await tx.order.updateMany({ where: { couponId: id }, data: { couponId: null } });
            await tx.coupon.delete({ where: { id } });
        });
        return { id: couponId };
    }
};

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRentalAvailabilityService = void 0;
const db_1 = __importDefault(require("../config/db"));
const ProductService_1 = require("./ProductService");
const RentalAvailabilityService_1 = require("./RentalAvailabilityService");
const vendorScope_1 = require("../utils/vendorScope");
const errors_1 = require("../utils/errors");
const resolveScopedVendorProfileId = async (vendorIdentifier, roleFilter) => {
    const normalizedVendorId = String(vendorIdentifier || '').trim();
    if (!normalizedVendorId) {
        throw new errors_1.ValidationError('vendorId is required');
    }
    let vendorIdBig;
    try {
        vendorIdBig = BigInt(normalizedVendorId);
    }
    catch {
        throw new errors_1.ValidationError('Invalid vendorId');
    }
    const vendorProfile = await db_1.default.vendorProfile.findFirst({
        where: {
            OR: [{ id: vendorIdBig }, { userId: vendorIdBig }],
            ...(0, vendorScope_1.getVendorProfileUserWhere)(roleFilter)
        },
        select: { id: true }
    });
    if (!vendorProfile) {
        throw new errors_1.ValidationError('Vendor not found');
    }
    return vendorProfile.id.toString();
};
exports.AdminRentalAvailabilityService = {
    async getScopedVendorProducts(input, roleFilter) {
        const vendorProfileId = await resolveScopedVendorProfileId(input.vendorId, roleFilter);
        return ProductService_1.ProductService.getProducts({
            vendorId: vendorProfileId,
            page: input.page ?? 1,
            limit: input.limit ?? 200,
            status: 'ALL'
        }, { requesterRole: 'ADMIN' });
    },
    async getScopedCalendar(input, roleFilter) {
        const vendorProfileId = await resolveScopedVendorProfileId(input.vendorId, roleFilter);
        return RentalAvailabilityService_1.RentalAvailabilityService.getCalendar(vendorProfileId, {
            productId: input.productId,
            month: input.month,
            variantId: input.variantId
        });
    },
    async upsertScopedDate(input, roleFilter) {
        const vendorProfileId = await resolveScopedVendorProfileId(input.vendorId, roleFilter);
        return RentalAvailabilityService_1.RentalAvailabilityService.upsertDate(vendorProfileId, {
            productId: input.productId,
            variantId: input.variantId,
            date: input.date,
            mode: input.mode,
            note: input.note
        });
    },
    async clearScopedMonth(input, roleFilter) {
        const vendorProfileId = await resolveScopedVendorProfileId(input.vendorId, roleFilter);
        return RentalAvailabilityService_1.RentalAvailabilityService.clearMonth(vendorProfileId, {
            productId: input.productId,
            variantId: input.variantId,
            month: input.month
        });
    }
};

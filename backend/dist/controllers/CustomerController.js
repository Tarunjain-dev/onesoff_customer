"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const CustomerService_1 = require("../services/CustomerService");
const normalizeOptionalText = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};
const isAlphabeticText = (value) => /^[A-Za-z\s]+$/.test(value);
const isPincodeText = (value) => /^\d{1,6}$/.test(value);
exports.CustomerController = {
    async getProfile(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            const profile = await CustomerService_1.CustomerService.getProfile(userId);
            return ApiResponse_1.ApiResponse.success(res, profile);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async updateProfile(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            const payload = {
                name: normalizeOptionalText(req.body?.name),
                phone: normalizeOptionalText(req.body?.phone),
                email: normalizeOptionalText(req.body?.email),
                aadharNumber: normalizeOptionalText(req.body?.aadharNumber),
                addressLine1: normalizeOptionalText(req.body?.addressLine1),
                landmark: normalizeOptionalText(req.body?.landmark),
                pincode: normalizeOptionalText(req.body?.pincode),
                city: normalizeOptionalText(req.body?.city),
                state: normalizeOptionalText(req.body?.state),
                additionalInfo: normalizeOptionalText(req.body?.additionalInfo)
            };
            const hasAtLeastOneField = Object.values(payload).some(Boolean);
            if (!hasAtLeastOneField) {
                return ApiResponse_1.ApiResponse.error(res, 'At least one field is required to update profile', 400);
            }
            if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
                return ApiResponse_1.ApiResponse.error(res, 'email must be a valid email address', 400);
            }
            if (payload.aadharNumber && !/^\d{12}$/.test(payload.aadharNumber)) {
                return ApiResponse_1.ApiResponse.error(res, 'aadharNumber must be exactly 12 digits', 400);
            }
            if (payload.pincode && !isPincodeText(payload.pincode)) {
                return ApiResponse_1.ApiResponse.error(res, 'pincode must contain only digits', 400);
            }
            if (payload.city && !isAlphabeticText(payload.city)) {
                return ApiResponse_1.ApiResponse.error(res, 'city must contain only alphabetic characters', 400);
            }
            if (payload.state && !isAlphabeticText(payload.state)) {
                return ApiResponse_1.ApiResponse.error(res, 'state must contain only alphabetic characters', 400);
            }
            const profile = await CustomerService_1.CustomerService.updateProfile(userId, payload);
            return ApiResponse_1.ApiResponse.success(res, profile, 'Profile updated successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getWishlist(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            const wishlist = await CustomerService_1.CustomerService.getWishlist(userId);
            return ApiResponse_1.ApiResponse.success(res, wishlist);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async addToWishlist(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            const rawProductId = req.body?.productId;
            const productId = parseInt(rawProductId);
            if (!Number.isFinite(productId)) {
                throw new Error('Valid productId is required');
            }
            const wishlist = await CustomerService_1.CustomerService.addToWishlist(userId, productId);
            return ApiResponse_1.ApiResponse.success(res, wishlist, 'Added to wishlist');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async removeFromWishlist(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            const rawProductId = Array.isArray(req.params.productId)
                ? req.params.productId[0]
                : req.params.productId;
            const productId = parseInt(String(rawProductId || ''));
            if (!Number.isFinite(productId)) {
                throw new Error('Valid productId is required');
            }
            await CustomerService_1.CustomerService.removeFromWishlist(userId, productId);
            return ApiResponse_1.ApiResponse.success(res, null, 'Removed from wishlist');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getRefundDetails(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            const refundDetails = await CustomerService_1.CustomerService.getRefundDetails(userId);
            return ApiResponse_1.ApiResponse.success(res, refundDetails);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getBankDetails(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            const bankDetails = await CustomerService_1.CustomerService.getBankDetails(userId);
            return ApiResponse_1.ApiResponse.success(res, bankDetails);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async upsertBankDetails(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            const saved = await CustomerService_1.CustomerService.upsertBankDetails(userId, req.body || {});
            return ApiResponse_1.ApiResponse.success(res, saved, 'Customer bank details saved');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

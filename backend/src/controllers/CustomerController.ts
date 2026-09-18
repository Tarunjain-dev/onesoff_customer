import { Response } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/ApiResponse';
import { CustomerService } from '../services/CustomerService';

const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isAlphabeticText = (value: string) => /^[A-Za-z\s]+$/.test(value);
const isPincodeText = (value: string) => /^\d{1,6}$/.test(value);

export const CustomerController = {
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);
      const profile = await CustomerService.getProfile(userId);
      return ApiResponse.success(res, profile);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);
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
        return ApiResponse.error(res, 'At least one field is required to update profile', 400);
      }

      if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        return ApiResponse.error(res, 'email must be a valid email address', 400);
      }

      if (payload.aadharNumber && !/^\d{12}$/.test(payload.aadharNumber)) {
        return ApiResponse.error(res, 'aadharNumber must be exactly 12 digits', 400);
      }

      if (payload.pincode && !isPincodeText(payload.pincode)) {
        return ApiResponse.error(res, 'pincode must contain only digits', 400);
      }

      if (payload.city && !isAlphabeticText(payload.city)) {
        return ApiResponse.error(res, 'city must contain only alphabetic characters', 400);
      }

      if (payload.state && !isAlphabeticText(payload.state)) {
        return ApiResponse.error(res, 'state must contain only alphabetic characters', 400);
      }

      const profile = await CustomerService.updateProfile(userId, payload);
      return ApiResponse.success(res, profile, 'Profile updated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getWishlist(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);
      const wishlist = await CustomerService.getWishlist(userId);
      return ApiResponse.success(res, wishlist);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async addToWishlist(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);
      const rawProductId = req.body?.productId;
      const productId = parseInt(rawProductId);
      if (!Number.isFinite(productId)) {
        throw new Error('Valid productId is required');
      }
      const wishlist = await CustomerService.addToWishlist(userId, productId);
      return ApiResponse.success(res, wishlist, 'Added to wishlist');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async removeFromWishlist(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);
      const rawProductId = Array.isArray(req.params.productId)
        ? req.params.productId[0]
        : req.params.productId;
      const productId = parseInt(String(rawProductId || ''));
      if (!Number.isFinite(productId)) {
        throw new Error('Valid productId is required');
      }
      await CustomerService.removeFromWishlist(userId, productId);
      return ApiResponse.success(res, null, 'Removed from wishlist');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getRefundDetails(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);
      const refundDetails = await CustomerService.getRefundDetails(userId);
      return ApiResponse.success(res, refundDetails);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getBankDetails(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);
      const bankDetails = await CustomerService.getBankDetails(userId);
      return ApiResponse.success(res, bankDetails);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async upsertBankDetails(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized', 401);
      const saved = await CustomerService.upsertBankDetails(userId, req.body || {});
      return ApiResponse.success(res, saved, 'Customer bank details saved');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};
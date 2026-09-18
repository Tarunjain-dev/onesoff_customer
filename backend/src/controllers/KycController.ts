import { Response } from 'express';
import { KycService } from '../services/KycService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';

export const KycController = {
  async uploadKyc(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        return ApiResponse.error(res, 'Vendor context missing', 400);
      }
      const kycData = req.body;
      const result = await KycService.uploadVendorKyc(vendorId, kycData);
      return ApiResponse.success(res, result, 'KYC documents uploaded successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async reviewKyc(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.adminId || req.user?.userId;
      const { vendorId, status, notes } = req.body;
      if (!adminId) {
        return ApiResponse.error(res, 'Admin context missing', 400);
      }
      const result = await KycService.reviewKyc(adminId, vendorId, status, notes);
      return ApiResponse.success(res, result, `KYC ${status.toLowerCase()}`);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getPendingKyc(req: AuthRequest, res: Response) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const result = await KycService.getPendingKyc({
        page: Number(page), limit: Number(limit)
      });
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getKycStatus(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        return ApiResponse.error(res, 'Vendor context missing', 400);
      }
      const result = await KycService.getVendorKycStatus(vendorId);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getVendorKycByAdmin(req: AuthRequest, res: Response) {
    try {
      const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
      if (!vendorId) {
        return ApiResponse.error(res, 'vendorId is required', 400);
      }
      const result = await KycService.getVendorKycForAdmin(vendorId, req.vendorFilter);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

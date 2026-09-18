import { Request, Response } from 'express';
import { AdminVendorService } from '../services/AdminVendorService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';

export const AdminVendorController = {
  async getVendors(req: AuthRequest, res: Response) {
    try {
      const { status, city, badge, dateFrom } = req.query;

      const roleFilter = req.vendorFilter || {};

      const vendors = await AdminVendorService.getVendorList({
        status: status as any,
        city: city as string,
        badge: badge as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        roleFilter
      });
      return ApiResponse.success(res, vendors);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getVendorDetail(req: AuthRequest, res: Response) {
    try {
      const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
      if (!vendorId) {
        return ApiResponse.error(res, 'vendorId is required', 400);
      }
      const vendor = await AdminVendorService.getVendorDetail(vendorId, req.vendorFilter);
      return ApiResponse.success(res, vendor);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const { status } = req.body;
      const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
      if (!vendorId) {
        return ApiResponse.error(res, 'vendorId is required', 400);
      }
      const vendor = await AdminVendorService.updateVendorStatus(vendorId, status, req.vendorFilter);
      return ApiResponse.success(res, vendor);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async requestDocumentResubmission(req: AuthRequest, res: Response) {
    try {
      const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
      if (!vendorId) {
        return ApiResponse.error(res, 'vendorId is required', 400);
      }

      const notes = Array.isArray(req.body?.notes) ? req.body.notes : [];
      const adminName = req.body?.adminName || req.user?.userId || null;

      const result = await AdminVendorService.requestDocumentResubmission(
        vendorId,
        notes,
        adminName,
        req.vendorFilter
      );
      return ApiResponse.success(res, result, 'Document resubmission requested');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async updateCommission(req: AuthRequest, res: Response) {
    try {
      const commission = Number(req.body?.commission);
      if (!Number.isFinite(commission)) {
        return ApiResponse.error(res, 'Valid commission is required', 400);
      }
      if (commission < 0 || commission > 100) {
        return ApiResponse.error(res, 'Commission must be between 0 and 100', 400);
      }
      const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
      if (!vendorId) {
        return ApiResponse.error(res, 'vendorId is required', 400);
      }
      const profile = await AdminVendorService.updateCommission(vendorId, commission, req.vendorFilter);
      return ApiResponse.success(res, profile);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async deleteVendor(req: AuthRequest, res: Response) {
    try {
      const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
      if (!vendorId) {
        return ApiResponse.error(res, 'vendorId is required', 400);
      }
      await AdminVendorService.deleteVendor(vendorId, req.vendorFilter);
      return ApiResponse.success(res, null, 'Vendor deleted successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

import { Response } from 'express';
import { ReturnService } from '../services/ReturnService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';

export const ReturnController = {
  async initiateReturn(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId;
      if (!customerId) throw new Error('Customer ID required');
      const { orderItemId, returnReason } = req.body;
      const result = await ReturnService.initiateReturn(customerId, orderItemId, returnReason);
      return ApiResponse.success(res, result, 'Return initiated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async vendorInspection(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');
      const { returnId, inspectionData } = req.body;
      const result = await ReturnService.submitVendorInspection(vendorId, returnId, inspectionData);
      return ApiResponse.success(res, result, 'Inspection submitted for admin review');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async adminRefundDecision(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.adminId || req.user?.userId;
      if (!adminId) throw new Error('Admin ID required');
      const { returnId, refundDecision } = req.body;
      const result = await ReturnService.processAdminRefundDecision(adminId, returnId, refundDecision);
      return ApiResponse.success(res, result, 'Refund decision processed');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getVendorReturns(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');
      const { status, page = 1, limit = 10 } = req.query;
      const returns = await ReturnService.getVendorReturns(vendorId, {
        status: status as string, page: Number(page), limit: Number(limit)
      });
      return ApiResponse.success(res, returns);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getAdminReturns(req: AuthRequest, res: Response) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const returns = await ReturnService.getAdminReturns({
        status: status as string, page: Number(page), limit: Number(limit)
      });
      return ApiResponse.success(res, returns);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getAdminReturnStats(_req: AuthRequest, res: Response) {
    try {
      const stats = await ReturnService.getAdminReturnStats();
      return ApiResponse.success(res, stats);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getCustomerReturns(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId;
      if (!customerId) throw new Error('Customer ID required');
      const { page = 1, limit = 10 } = req.query;
      const returns = await ReturnService.getCustomerReturns(customerId, {
        page: Number(page), limit: Number(limit)
      });
      return ApiResponse.success(res, returns);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async raiseDamageClaim(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }

      const result = await ReturnService.raiseDamageClaim(vendorId, req.body);
      return ApiResponse.success(res, result, 'Damage claim raised');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getVendorDamageClaims(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }

      const { status, page = 1, limit = 10 } = req.query;
      const claims = await ReturnService.getVendorDamageClaims(vendorId, {
        status: status as string,
        page: Number(page),
        limit: Number(limit)
      });
      return ApiResponse.success(res, claims);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getAdminDamageClaims(req: AuthRequest, res: Response) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const claims = await ReturnService.getAdminDamageClaims({
        status: status as string,
        page: Number(page),
        limit: Number(limit)
      }, undefined, {
        completedAdminAsVendorOnly: true
      });
      return ApiResponse.success(res, claims);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async reviewDamageClaim(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.adminId || req.user?.userId;
      if (!adminId) {
        throw new Error('Admin ID required');
      }

      const claimId = Array.isArray(req.params.claimId) ? req.params.claimId[0] : req.params.claimId;
      if (!claimId) {
        throw new Error('claimId is required');
      }

      const result = await ReturnService.reviewDamageClaim(adminId, claimId, req.body);
      return ApiResponse.success(res, result, 'Damage claim reviewed');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

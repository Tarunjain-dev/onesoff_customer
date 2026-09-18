import { Request, Response } from 'express';
import { AdminSettlementService } from '../services/AdminSettlementService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';

export const AdminSettlementController = {
  async getOwnerPayoutSummaries(req: AuthRequest, res: Response) {
    try {
      const rows = await AdminSettlementService.getOwnerPayoutSummaries(req.vendorFilter);
      return ApiResponse.success(res, rows);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getOwnerPayoutDetail(req: AuthRequest, res: Response) {
    try {
      const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
      if (!vendorId) {
        throw new Error('vendorId is required');
      }
      const detail = await AdminSettlementService.getOwnerPayoutDetail(
        vendorId,
        req.vendorFilter
      );
      return ApiResponse.success(res, detail);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getSettlements(req: Request, res: Response) {
    try {
      const settlements = await AdminSettlementService.getSettlementList();
      return ApiResponse.success(res, settlements);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async markPaid(req: AuthRequest, res: Response) {
    try {
      const { from, to, transferMode, transferReference, notes, paidAt } = req.body;
      const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
      if (!vendorId) {
        throw new Error('vendorId is required');
      }
      const adminId = String(req.user?.adminId || req.user?.userId || '').trim() || undefined;
      const result = await AdminSettlementService.markSettlementPaid(
        vendorId,
        {
          period: from && to ? { from: new Date(from), to: new Date(to) } : undefined,
          transferMode,
          transferReference,
          notes,
          paidAt: paidAt ? new Date(paidAt) : undefined,
          paidByAdminId: adminId
        }
      );
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async reject(req: AuthRequest, res: Response) {
    try {
      const { reason, notes } = req.body;
      const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
      if (!vendorId) {
        throw new Error('vendorId is required');
      }
      const adminId = String(req.user?.adminId || req.user?.userId || '').trim() || undefined;
      const result = await AdminSettlementService.rejectSettlement(
        vendorId,
        {
          reason,
          notes,
          rejectedByAdminId: adminId
        }
      );
      return ApiResponse.success(res, result, 'Settlement rejected');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

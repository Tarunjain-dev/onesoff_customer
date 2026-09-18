import { Response } from 'express';
import { AdminRefundService } from '../services/AdminRefundService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';

export const AdminRefundController = {
  async getRefundRequests(req: AuthRequest, res: Response) {
    try {
      const requests = await AdminRefundService.getRefundRequests(req.vendorFilter);
      return ApiResponse.success(res, requests);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async processRefund(req: AuthRequest, res: Response) {
    try {
      const { decision, refundAmount, manualTransfer } = req.body;
      const adminId = req.user?.adminId || req.user?.userId;
      const returnId = Array.isArray(req.params.returnId)
        ? req.params.returnId[0]
        : req.params.returnId;
      if (!returnId) {
        throw new Error('returnId is required');
      }
      const result = await AdminRefundService.processRefund(
        returnId,
        decision,
        refundAmount,
        manualTransfer,
        adminId,
        req.vendorFilter
      );
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async remindRefund(req: AuthRequest, res: Response) {
    try {
      const requesterId = req.user?.userId;
      const returnId = Array.isArray(req.params.returnId)
        ? req.params.returnId[0]
        : req.params.returnId;
      if (!returnId) {
        throw new Error('returnId is required');
      }

      const result = await AdminRefundService.remindAdmin(
        returnId,
        requesterId,
        req.vendorFilter
      );
      return ApiResponse.success(res, result, 'Refund reminder sent');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

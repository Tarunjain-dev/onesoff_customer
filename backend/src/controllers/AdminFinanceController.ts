import { Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';
import { AdminFinanceService } from '../services/AdminFinanceService';

export const AdminFinanceController = {
  async getOverview(req: AuthRequest, res: Response) {
    try {
      const overview = await AdminFinanceService.getOverview(req.vendorFilter);
      return ApiResponse.success(res, overview);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch finance overview');
    }
  },

  async getTransactionHistory(req: AuthRequest, res: Response) {
    try {
      const rows = await AdminFinanceService.getTransactionHistory(req.vendorFilter);
      return ApiResponse.success(res, rows);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch transaction history');
    }
  }
};

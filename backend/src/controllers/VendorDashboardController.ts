import { Response } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/ApiResponse';
import { VendorDashboardService } from '../services/VendorDashboardService';

export const VendorDashboardController = {
  async getSummary(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }

      const summary = await VendorDashboardService.getDashboardSummary(vendorId);
      return ApiResponse.success(res, summary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch dashboard summary';
      return ApiResponse.error(res, message);
    }
  }
};


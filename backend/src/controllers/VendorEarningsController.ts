import { Response } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/ApiResponse';
import { VendorEarningService } from '../services/VendorEarningService';

export const VendorEarningsController = {
  async getSummary(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }

      const summary = await VendorEarningService.getVendorEarningsSummary(vendorId);
      return ApiResponse.success(res, summary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch earnings summary';
      return ApiResponse.error(res, message);
    }
  }
};


import { Response } from 'express';
import { AdminDashboardService } from '../services/AdminDashboardService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';

export const AdminDashboardController = {
  async getDashboard(req: AuthRequest, res: Response) {
    try {
      const range = typeof req.query.range === 'string' ? req.query.range : undefined;
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;

      const data = await AdminDashboardService.getDashboardStats(req.vendorFilter, {
        range,
        from,
        to
      });
      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

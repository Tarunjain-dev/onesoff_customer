import { Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';
import { AdminReportService } from '../services/AdminReportService';

export const AdminReportController = {
  async getOverview(req: AuthRequest, res: Response) {
    try {
      const { dateRange, customStart, customEnd } = req.query;
      const overview = await AdminReportService.getOverview(
        {
          dateRange: dateRange ? String(dateRange) : undefined,
          customStart: customStart ? String(customStart) : undefined,
          customEnd: customEnd ? String(customEnd) : undefined
        },
        req.vendorFilter
      );

      return ApiResponse.success(res, overview);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch reports overview');
    }
  }
};

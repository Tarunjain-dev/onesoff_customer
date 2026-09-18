import { Request, Response } from 'express';
import { CommissionService } from '../services/CommissionService';
import { ApiResponse } from '../utils/ApiResponse';

export const AdminCommissionSettingsController = {
  async getSettings(_req: Request, res: Response) {
    try {
      const settings = await CommissionService.getCommissionSettings();
      return ApiResponse.success(res, settings);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch commission settings');
    }
  },

  async updateSettings(req: Request, res: Response) {
    try {
      const settings = await CommissionService.updateCommissionSettings({
        defaultCommission: req.body?.defaultCommission,
        individualVendorDefaultCommission: req.body?.individualVendorDefaultCommission,
        goldVendorCommission: req.body?.goldVendorCommission,
        silverVendorCommission: req.body?.silverVendorCommission,
        platinumVendorCommission: req.body?.platinumVendorCommission,
        categoryCommission: req.body?.categoryCommission
      });

      return ApiResponse.success(res, settings, 'Commission settings updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to update commission settings');
    }
  }
};

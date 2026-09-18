import { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { GeneralSettingsService } from '../services/GeneralSettingsService';

export const AdminGeneralSettingsController = {
  async getSettings(_req: Request, res: Response) {
    try {
      const settings = await GeneralSettingsService.getGeneralSettings();
      return ApiResponse.success(res, settings);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch general settings');
    }
  },

  async createSettings(req: Request, res: Response) {
    try {
      const settings = await GeneralSettingsService.createGeneralSettings(req.body || {});
      return ApiResponse.success(res, settings, 'General settings created', 201);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to create general settings');
    }
  },

  async updateSettings(req: Request, res: Response) {
    try {
      const settings = await GeneralSettingsService.updateGeneralSettings(req.body || {});
      return ApiResponse.success(res, settings, 'General settings updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to update general settings');
    }
  },

  async deleteSettings(req: Request, res: Response) {
    try {
      const rawField = req.query?.field;
      const field =
        typeof rawField === 'string'
          ? rawField
          : Array.isArray(rawField) && typeof rawField[0] === 'string'
            ? rawField[0]
            : undefined;

      const settings = await GeneralSettingsService.deleteGeneralSettings(field);
      return ApiResponse.success(
        res,
        settings,
        field ? `General settings field ${field} reset` : 'General settings reset'
      );
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to delete general settings');
    }
  }
};

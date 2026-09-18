import { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { GeneralSettingsService } from '../services/GeneralSettingsService';

export const GeneralSettingsController = {
  async getPublicSettings(_req: Request, res: Response) {
    try {
      const settings = await GeneralSettingsService.getGeneralSettings();
      return ApiResponse.success(res, settings);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch general settings');
    }
  }
};

import { Response } from 'express';
import { VendorProfileService } from '../services/VendorProfileService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';

export const VendorProfileController = {
  async createProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }
      const profile = await VendorProfileService.createProfile(userId, req.body);
      return ApiResponse.success(res, profile, 'Vendor profile created');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }
      const profile = await VendorProfileService.getProfile(userId);
      return ApiResponse.success(res, profile);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getApplicationStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }
      const status = await VendorProfileService.getApplicationStatus(userId);
      return ApiResponse.success(res, status);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }
      const profile = await VendorProfileService.updateProfile(userId, req.body);
      return ApiResponse.success(res, profile, 'Profile updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async resubmitDocuments(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }
      const files = Array.isArray(req.files) ? req.files : [];
      const filesByDocumentKey = files.reduce((acc, file) => {
        acc[String(file.fieldname)] = file;
        return acc;
      }, {} as Record<string, Express.Multer.File>);

      const status = await VendorProfileService.resubmitDocuments(userId, filesByDocumentKey as any);
      return ApiResponse.success(res, status, 'Documents resubmitted successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

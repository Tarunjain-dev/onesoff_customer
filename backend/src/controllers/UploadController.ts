import { Response } from 'express';
import { S3Service } from '../services/S3Service';
import { VendorProfileMediaService } from '../services/VendorProfileMediaService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';
import logger from '../utils/logger';

export const UploadController = {
  async uploadVendorProfileImage(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 'No file uploaded', 400);
      }

      if (!req.user?.userId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      const imageUrl = await VendorProfileMediaService.uploadProfileImage(
        req.user.userId,
        req.file
      );

      return ApiResponse.success(
        res,
        { imageUrl },
        'Profile image uploaded successfully'
      );
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to upload profile image', 500);
    }
  },

  async uploadProductImages(req: AuthRequest, res: Response) {
    try {
      if (!req.files || !Array.isArray(req.files)) {
        return ApiResponse.error(res, 'No files uploaded', 400);
      }

      if (req.files.length === 0) {
        return ApiResponse.error(res, 'No files uploaded', 400);
      }

      const imageUrls = await S3Service.uploadMultipleImages(req.files, 'products');
      return ApiResponse.success(res, { imageUrls }, 'Images uploaded successfully');
    } catch (error: any) {
      logger.error(
        {
          error: error?.message || String(error),
          fileCount: Array.isArray(req.files) ? req.files.length : 0
        },
        'Product image upload failed'
      );
      return ApiResponse.error(res, error.message, 500);
    }
  },

  async uploadBadgeImage(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 'No file uploaded', 400);
      }

      const imageUrl = await S3Service.uploadImage(req.file, 'badges');
      return ApiResponse.success(res, { imageUrl }, 'Badge image uploaded successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to upload badge image', 500);
    }
  },

  async uploadKycDocument(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 'No file uploaded');
      }

      const imageUrl = await S3Service.uploadImage(req.file, 'kyc');
      return ApiResponse.success(res, { imageUrl }, 'Document uploaded successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async deleteImage(req: AuthRequest, res: Response) {
    try {
      const { imageUrl } = req.body;
      await S3Service.deleteImage(imageUrl);
      return ApiResponse.success(res, null, 'Image deleted successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

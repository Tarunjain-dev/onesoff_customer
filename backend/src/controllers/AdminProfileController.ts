import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth';
import { AdminProfileService } from '../services/AdminProfileService';
import { ApiResponse } from '../utils/ApiResponse';

const updateProfileSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
    phone: z
      .union([z.string().regex(/^\+?\d{10,15}$/), z.literal(''), z.null()])
      .optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update profile'
  });

export const AdminProfileController = {
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        return ApiResponse.unauthorized(res, 'Unauthorized');
      }

      const profile = await AdminProfileService.getProfile(adminUserId);
      return ApiResponse.success(res, profile);
    } catch (error: any) {
      const statusCode = error?.message === 'Admin not found' ? 404 : 400;
      return ApiResponse.error(res, error?.message || 'Failed to fetch admin profile', statusCode);
    }
  },

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        return ApiResponse.unauthorized(res, 'Unauthorized');
      }

      const payload = updateProfileSchema.parse(req.body);
      const profile = await AdminProfileService.updateProfile(adminUserId, payload);
      return ApiResponse.success(res, profile, 'Profile updated');
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return ApiResponse.error(res, error.issues[0]?.message || 'Invalid profile payload', 400);
      }

      const statusCode = error?.message === 'Admin not found' ? 404 : 400;
      return ApiResponse.error(res, error?.message || 'Failed to update admin profile', statusCode);
    }
  }
};


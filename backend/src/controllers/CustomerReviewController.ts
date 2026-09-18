import { Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';
import { CustomerReviewService } from '../services/CustomerReviewService';

export const CustomerReviewController = {
  async getMyReview(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) return ApiResponse.error(res, 'Unauthorized');
      const result = await CustomerReviewService.getMyReview(customerId, req.query);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async updateMyReview(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) return ApiResponse.error(res, 'Unauthorized');
      const reviewId = Array.isArray(req.params.reviewId) ? req.params.reviewId[0] : req.params.reviewId;
      const result = await CustomerReviewService.updateMyReview(customerId, reviewId, req.body);
      return ApiResponse.success(res, result, 'Review updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};


import { Request, Response } from 'express';
import { ReviewModerationService } from '../services/ReviewModerationService';
import { ApiResponse } from '../utils/ApiResponse';

export const ReviewModerationController = {
  async getReviews(req: Request, res: Response) {
    try {
      const rawStatus = req.query.status;
      const firstStatus = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
      const status =
        typeof firstStatus === 'string'
          ? firstStatus
          : undefined;
      const reviews = await ReviewModerationService.getReviews(status);
      return ApiResponse.success(res, reviews);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async moderateReview(req: Request, res: Response) {
    try {
      const { action, reason } = req.body;
      const reviewId = Array.isArray(req.params.reviewId) ? req.params.reviewId[0] : req.params.reviewId;
      if (!reviewId) {
        throw new Error('reviewId is required');
      }
      const result = await ReviewModerationService.moderateReview(reviewId, action, reason);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async deleteReview(req: Request, res: Response) {
    try {
      const reviewId = Array.isArray(req.params.reviewId) ? req.params.reviewId[0] : req.params.reviewId;
      if (!reviewId) {
        throw new Error('reviewId is required');
      }
      const result = await ReviewModerationService.deleteReview(reviewId);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

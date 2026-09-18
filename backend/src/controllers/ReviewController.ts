import { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { ReviewService } from '../services/ReviewService';

export const ReviewController = {
  async getVendorReviews(req: Request, res: Response) {
    try {
      const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
      const result = await ReviewService.getVendorApprovedReviews(vendorId, req.query);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getProductReviews(req: Request, res: Response) {
    try {
      const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
      const result = await ReviewService.getProductApprovedReviews(productId, req.query);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

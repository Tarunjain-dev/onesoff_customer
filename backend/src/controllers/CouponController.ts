import { Response } from 'express';
import { CouponService } from '../services/CouponService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';

export const CouponController = {
  async createCoupon(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.userId;
      if (!adminId) throw new Error('Admin ID required');
      const coupon = await CouponService.createCoupon(adminId, req.body);
      return ApiResponse.success(res, coupon, 'Coupon created');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async validateCoupon(req: AuthRequest, res: Response) {
    try {
      const { code, orderValue, vendorId } = req.body;
      const customerId = req.user?.userId;
      if (!customerId) throw new Error('Customer ID required');
      const result = await CouponService.validateCoupon(code, customerId, orderValue, vendorId);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getFirstOrderOffer(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.userId;
      if (!customerId) throw new Error('Customer ID required');
      const result = await CouponService.getFirstOrderOffer(customerId);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getCoupons(req: AuthRequest, res: Response) {
    try {
      const coupons = await CouponService.getCoupons(req.query);
      return ApiResponse.success(res, coupons);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async updateCoupon(req: AuthRequest, res: Response) {
    try {
      const couponId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const coupon = await CouponService.updateCoupon(couponId, req.body || {});
      return ApiResponse.success(res, coupon, 'Coupon updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async toggleCoupon(req: AuthRequest, res: Response) {
    try {
      const { isActive } = req.body;
      const couponId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const coupon = await CouponService.toggleCoupon(couponId, isActive);
      return ApiResponse.success(res, coupon, 'Coupon updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async deleteCoupon(req: AuthRequest, res: Response) {
    try {
      const couponId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await CouponService.deleteCoupon(couponId);
      return ApiResponse.success(res, result, 'Coupon deleted');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

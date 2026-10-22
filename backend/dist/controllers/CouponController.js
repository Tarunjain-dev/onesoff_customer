"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponController = void 0;
const CouponService_1 = require("../services/CouponService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.CouponController = {
    async createCoupon(req, res) {
        try {
            const adminId = req.user?.userId;
            if (!adminId)
                throw new Error('Admin ID required');
            const coupon = await CouponService_1.CouponService.createCoupon(adminId, req.body);
            return ApiResponse_1.ApiResponse.success(res, coupon, 'Coupon created');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async validateCoupon(req, res) {
        try {
            const { code, orderValue, vendorId } = req.body;
            const customerId = req.user?.userId;
            if (!customerId)
                throw new Error('Customer ID required');
            const result = await CouponService_1.CouponService.validateCoupon(code, customerId, orderValue, vendorId);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getFirstOrderOffer(req, res) {
        try {
            const customerId = req.user?.userId;
            if (!customerId)
                throw new Error('Customer ID required');
            const result = await CouponService_1.CouponService.getFirstOrderOffer(customerId);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getCoupons(req, res) {
        try {
            const coupons = await CouponService_1.CouponService.getCoupons(req.query);
            return ApiResponse_1.ApiResponse.success(res, coupons);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async updateCoupon(req, res) {
        try {
            const couponId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const coupon = await CouponService_1.CouponService.updateCoupon(couponId, req.body || {});
            return ApiResponse_1.ApiResponse.success(res, coupon, 'Coupon updated');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async toggleCoupon(req, res) {
        try {
            const { isActive } = req.body;
            const couponId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const coupon = await CouponService_1.CouponService.toggleCoupon(couponId, isActive);
            return ApiResponse_1.ApiResponse.success(res, coupon, 'Coupon updated');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async deleteCoupon(req, res) {
        try {
            const couponId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await CouponService_1.CouponService.deleteCoupon(couponId);
            return ApiResponse_1.ApiResponse.success(res, result, 'Coupon deleted');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

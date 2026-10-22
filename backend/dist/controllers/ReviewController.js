"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const ReviewService_1 = require("../services/ReviewService");
exports.ReviewController = {
    async getVendorReviews(req, res) {
        try {
            const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
            const result = await ReviewService_1.ReviewService.getVendorApprovedReviews(vendorId, req.query);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getProductReviews(req, res) {
        try {
            const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
            const result = await ReviewService_1.ReviewService.getProductApprovedReviews(productId, req.query);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

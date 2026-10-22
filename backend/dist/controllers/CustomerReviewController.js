"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerReviewController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const CustomerReviewService_1 = require("../services/CustomerReviewService");
exports.CustomerReviewController = {
    async getMyReview(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized');
            const result = await CustomerReviewService_1.CustomerReviewService.getMyReview(customerId, req.query);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async updateMyReview(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized');
            const reviewId = Array.isArray(req.params.reviewId) ? req.params.reviewId[0] : req.params.reviewId;
            const result = await CustomerReviewService_1.CustomerReviewService.updateMyReview(customerId, reviewId, req.body);
            return ApiResponse_1.ApiResponse.success(res, result, 'Review updated');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

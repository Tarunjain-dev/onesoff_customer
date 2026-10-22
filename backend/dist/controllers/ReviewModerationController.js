"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewModerationController = void 0;
const ReviewModerationService_1 = require("../services/ReviewModerationService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.ReviewModerationController = {
    async getReviews(req, res) {
        try {
            const rawStatus = req.query.status;
            const firstStatus = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
            const status = typeof firstStatus === 'string'
                ? firstStatus
                : undefined;
            const reviews = await ReviewModerationService_1.ReviewModerationService.getReviews(status);
            return ApiResponse_1.ApiResponse.success(res, reviews);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async moderateReview(req, res) {
        try {
            const { action, reason } = req.body;
            const reviewId = Array.isArray(req.params.reviewId) ? req.params.reviewId[0] : req.params.reviewId;
            if (!reviewId) {
                throw new Error('reviewId is required');
            }
            const result = await ReviewModerationService_1.ReviewModerationService.moderateReview(reviewId, action, reason);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async deleteReview(req, res) {
        try {
            const reviewId = Array.isArray(req.params.reviewId) ? req.params.reviewId[0] : req.params.reviewId;
            if (!reviewId) {
                throw new Error('reviewId is required');
            }
            const result = await ReviewModerationService_1.ReviewModerationService.deleteReview(reviewId);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

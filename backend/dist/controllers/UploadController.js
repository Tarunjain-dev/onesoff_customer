"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const S3Service_1 = require("../services/S3Service");
const VendorProfileMediaService_1 = require("../services/VendorProfileMediaService");
const ApiResponse_1 = require("../utils/ApiResponse");
const logger_1 = __importDefault(require("../utils/logger"));
exports.UploadController = {
    async uploadVendorProfileImage(req, res) {
        try {
            if (!req.file) {
                return ApiResponse_1.ApiResponse.error(res, 'No file uploaded', 400);
            }
            if (!req.user?.userId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const imageUrl = await VendorProfileMediaService_1.VendorProfileMediaService.uploadProfileImage(req.user.userId, req.file);
            return ApiResponse_1.ApiResponse.success(res, { imageUrl }, 'Profile image uploaded successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to upload profile image', 500);
        }
    },
    async uploadProductImages(req, res) {
        try {
            if (!req.files || !Array.isArray(req.files)) {
                return ApiResponse_1.ApiResponse.error(res, 'No files uploaded', 400);
            }
            if (req.files.length === 0) {
                return ApiResponse_1.ApiResponse.error(res, 'No files uploaded', 400);
            }
            const imageUrls = await S3Service_1.S3Service.uploadMultipleImages(req.files, 'products');
            return ApiResponse_1.ApiResponse.success(res, { imageUrls }, 'Images uploaded successfully');
        }
        catch (error) {
            logger_1.default.error({
                error: error?.message || String(error),
                fileCount: Array.isArray(req.files) ? req.files.length : 0
            }, 'Product image upload failed');
            return ApiResponse_1.ApiResponse.error(res, error.message, 500);
        }
    },
    async uploadBadgeImage(req, res) {
        try {
            if (!req.file) {
                return ApiResponse_1.ApiResponse.error(res, 'No file uploaded', 400);
            }
            const imageUrl = await S3Service_1.S3Service.uploadImage(req.file, 'badges');
            return ApiResponse_1.ApiResponse.success(res, { imageUrl }, 'Badge image uploaded successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to upload badge image', 500);
        }
    },
    async uploadKycDocument(req, res) {
        try {
            if (!req.file) {
                return ApiResponse_1.ApiResponse.error(res, 'No file uploaded');
            }
            const imageUrl = await S3Service_1.S3Service.uploadImage(req.file, 'kyc');
            return ApiResponse_1.ApiResponse.success(res, { imageUrl }, 'Document uploaded successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async deleteImage(req, res) {
        try {
            const { imageUrl } = req.body;
            await S3Service_1.S3Service.deleteImage(imageUrl);
            return ApiResponse_1.ApiResponse.success(res, null, 'Image deleted successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

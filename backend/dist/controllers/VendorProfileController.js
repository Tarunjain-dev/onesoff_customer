"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorProfileController = void 0;
const VendorProfileService_1 = require("../services/VendorProfileService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.VendorProfileController = {
    async createProfile(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const profile = await VendorProfileService_1.VendorProfileService.createProfile(userId, req.body);
            return ApiResponse_1.ApiResponse.success(res, profile, 'Vendor profile created');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getProfile(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const profile = await VendorProfileService_1.VendorProfileService.getProfile(userId);
            return ApiResponse_1.ApiResponse.success(res, profile);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getApplicationStatus(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const status = await VendorProfileService_1.VendorProfileService.getApplicationStatus(userId);
            return ApiResponse_1.ApiResponse.success(res, status);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async updateProfile(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const profile = await VendorProfileService_1.VendorProfileService.updateProfile(userId, req.body);
            return ApiResponse_1.ApiResponse.success(res, profile, 'Profile updated');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async resubmitDocuments(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const files = Array.isArray(req.files) ? req.files : [];
            const filesByDocumentKey = files.reduce((acc, file) => {
                acc[String(file.fieldname)] = file;
                return acc;
            }, {});
            const status = await VendorProfileService_1.VendorProfileService.resubmitDocuments(userId, filesByDocumentKey);
            return ApiResponse_1.ApiResponse.success(res, status, 'Documents resubmitted successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

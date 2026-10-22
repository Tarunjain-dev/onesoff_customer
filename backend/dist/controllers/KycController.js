"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycController = void 0;
const KycService_1 = require("../services/KycService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.KycController = {
    async uploadKyc(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                return ApiResponse_1.ApiResponse.error(res, 'Vendor context missing', 400);
            }
            const kycData = req.body;
            const result = await KycService_1.KycService.uploadVendorKyc(vendorId, kycData);
            return ApiResponse_1.ApiResponse.success(res, result, 'KYC documents uploaded successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async reviewKyc(req, res) {
        try {
            const adminId = req.user?.adminId || req.user?.userId;
            const { vendorId, status, notes } = req.body;
            if (!adminId) {
                return ApiResponse_1.ApiResponse.error(res, 'Admin context missing', 400);
            }
            const result = await KycService_1.KycService.reviewKyc(adminId, vendorId, status, notes);
            return ApiResponse_1.ApiResponse.success(res, result, `KYC ${status.toLowerCase()}`);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getPendingKyc(req, res) {
        try {
            const { page = 1, limit = 10 } = req.query;
            const result = await KycService_1.KycService.getPendingKyc({
                page: Number(page), limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getKycStatus(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                return ApiResponse_1.ApiResponse.error(res, 'Vendor context missing', 400);
            }
            const result = await KycService_1.KycService.getVendorKycStatus(vendorId);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getVendorKycByAdmin(req, res) {
        try {
            const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
            if (!vendorId) {
                return ApiResponse_1.ApiResponse.error(res, 'vendorId is required', 400);
            }
            const result = await KycService_1.KycService.getVendorKycForAdmin(vendorId, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

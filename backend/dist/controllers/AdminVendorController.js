"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminVendorController = void 0;
const AdminVendorService_1 = require("../services/AdminVendorService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.AdminVendorController = {
    async getVendors(req, res) {
        try {
            const { status, city, badge, dateFrom } = req.query;
            const roleFilter = req.vendorFilter || {};
            const vendors = await AdminVendorService_1.AdminVendorService.getVendorList({
                status: status,
                city: city,
                badge: badge,
                dateFrom: dateFrom ? new Date(dateFrom) : undefined,
                roleFilter
            });
            return ApiResponse_1.ApiResponse.success(res, vendors);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getVendorDetail(req, res) {
        try {
            const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
            if (!vendorId) {
                return ApiResponse_1.ApiResponse.error(res, 'vendorId is required', 400);
            }
            const vendor = await AdminVendorService_1.AdminVendorService.getVendorDetail(vendorId, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, vendor);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async updateStatus(req, res) {
        try {
            const { status } = req.body;
            const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
            if (!vendorId) {
                return ApiResponse_1.ApiResponse.error(res, 'vendorId is required', 400);
            }
            const vendor = await AdminVendorService_1.AdminVendorService.updateVendorStatus(vendorId, status, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, vendor);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async requestDocumentResubmission(req, res) {
        try {
            const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
            if (!vendorId) {
                return ApiResponse_1.ApiResponse.error(res, 'vendorId is required', 400);
            }
            const notes = Array.isArray(req.body?.notes) ? req.body.notes : [];
            const adminName = req.body?.adminName || req.user?.userId || null;
            const result = await AdminVendorService_1.AdminVendorService.requestDocumentResubmission(vendorId, notes, adminName, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, result, 'Document resubmission requested');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async updateCommission(req, res) {
        try {
            const commission = Number(req.body?.commission);
            if (!Number.isFinite(commission)) {
                return ApiResponse_1.ApiResponse.error(res, 'Valid commission is required', 400);
            }
            if (commission < 0 || commission > 100) {
                return ApiResponse_1.ApiResponse.error(res, 'Commission must be between 0 and 100', 400);
            }
            const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
            if (!vendorId) {
                return ApiResponse_1.ApiResponse.error(res, 'vendorId is required', 400);
            }
            const profile = await AdminVendorService_1.AdminVendorService.updateCommission(vendorId, commission, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, profile);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async deleteVendor(req, res) {
        try {
            const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
            if (!vendorId) {
                return ApiResponse_1.ApiResponse.error(res, 'vendorId is required', 400);
            }
            await AdminVendorService_1.AdminVendorService.deleteVendor(vendorId, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, null, 'Vendor deleted successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

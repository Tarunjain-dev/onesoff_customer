"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReturnController = void 0;
const ReturnService_1 = require("../services/ReturnService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.ReturnController = {
    async initiateReturn(req, res) {
        try {
            const customerId = req.user?.customerId;
            if (!customerId)
                throw new Error('Customer ID required');
            const { orderItemId, returnReason } = req.body;
            const result = await ReturnService_1.ReturnService.initiateReturn(customerId, orderItemId, returnReason);
            return ApiResponse_1.ApiResponse.success(res, result, 'Return initiated successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async vendorInspection(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const { returnId, inspectionData } = req.body;
            const result = await ReturnService_1.ReturnService.submitVendorInspection(vendorId, returnId, inspectionData);
            return ApiResponse_1.ApiResponse.success(res, result, 'Inspection submitted for admin review');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async adminRefundDecision(req, res) {
        try {
            const adminId = req.user?.adminId || req.user?.userId;
            if (!adminId)
                throw new Error('Admin ID required');
            const { returnId, refundDecision } = req.body;
            const result = await ReturnService_1.ReturnService.processAdminRefundDecision(adminId, returnId, refundDecision);
            return ApiResponse_1.ApiResponse.success(res, result, 'Refund decision processed');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getVendorReturns(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const { status, page = 1, limit = 10 } = req.query;
            const returns = await ReturnService_1.ReturnService.getVendorReturns(vendorId, {
                status: status, page: Number(page), limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, returns);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getAdminReturns(req, res) {
        try {
            const { status, page = 1, limit = 10 } = req.query;
            const returns = await ReturnService_1.ReturnService.getAdminReturns({
                status: status, page: Number(page), limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, returns);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getAdminReturnStats(_req, res) {
        try {
            const stats = await ReturnService_1.ReturnService.getAdminReturnStats();
            return ApiResponse_1.ApiResponse.success(res, stats);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getCustomerReturns(req, res) {
        try {
            const customerId = req.user?.customerId;
            if (!customerId)
                throw new Error('Customer ID required');
            const { page = 1, limit = 10 } = req.query;
            const returns = await ReturnService_1.ReturnService.getCustomerReturns(customerId, {
                page: Number(page), limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, returns);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async raiseDamageClaim(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const result = await ReturnService_1.ReturnService.raiseDamageClaim(vendorId, req.body);
            return ApiResponse_1.ApiResponse.success(res, result, 'Damage claim raised');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getVendorDamageClaims(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const { status, page = 1, limit = 10 } = req.query;
            const claims = await ReturnService_1.ReturnService.getVendorDamageClaims(vendorId, {
                status: status,
                page: Number(page),
                limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, claims);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getAdminDamageClaims(req, res) {
        try {
            const { status, page = 1, limit = 10 } = req.query;
            const claims = await ReturnService_1.ReturnService.getAdminDamageClaims({
                status: status,
                page: Number(page),
                limit: Number(limit)
            }, undefined, {
                completedAdminAsVendorOnly: true
            });
            return ApiResponse_1.ApiResponse.success(res, claims);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async reviewDamageClaim(req, res) {
        try {
            const adminId = req.user?.adminId || req.user?.userId;
            if (!adminId) {
                throw new Error('Admin ID required');
            }
            const claimId = Array.isArray(req.params.claimId) ? req.params.claimId[0] : req.params.claimId;
            if (!claimId) {
                throw new Error('claimId is required');
            }
            const result = await ReturnService_1.ReturnService.reviewDamageClaim(adminId, claimId, req.body);
            return ApiResponse_1.ApiResponse.success(res, result, 'Damage claim reviewed');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

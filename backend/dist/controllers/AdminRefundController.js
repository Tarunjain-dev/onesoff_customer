"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRefundController = void 0;
const AdminRefundService_1 = require("../services/AdminRefundService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.AdminRefundController = {
    async getRefundRequests(req, res) {
        try {
            const requests = await AdminRefundService_1.AdminRefundService.getRefundRequests(req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, requests);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async processRefund(req, res) {
        try {
            const { decision, refundAmount, manualTransfer } = req.body;
            const adminId = req.user?.adminId || req.user?.userId;
            const returnId = Array.isArray(req.params.returnId)
                ? req.params.returnId[0]
                : req.params.returnId;
            if (!returnId) {
                throw new Error('returnId is required');
            }
            const result = await AdminRefundService_1.AdminRefundService.processRefund(returnId, decision, refundAmount, manualTransfer, adminId, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async remindRefund(req, res) {
        try {
            const requesterId = req.user?.userId;
            const returnId = Array.isArray(req.params.returnId)
                ? req.params.returnId[0]
                : req.params.returnId;
            if (!returnId) {
                throw new Error('returnId is required');
            }
            const result = await AdminRefundService_1.AdminRefundService.remindAdmin(returnId, requesterId, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, result, 'Refund reminder sent');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

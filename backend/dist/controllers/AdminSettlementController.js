"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSettlementController = void 0;
const AdminSettlementService_1 = require("../services/AdminSettlementService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.AdminSettlementController = {
    async getOwnerPayoutSummaries(req, res) {
        try {
            const rows = await AdminSettlementService_1.AdminSettlementService.getOwnerPayoutSummaries(req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, rows);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getOwnerPayoutDetail(req, res) {
        try {
            const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
            if (!vendorId) {
                throw new Error('vendorId is required');
            }
            const detail = await AdminSettlementService_1.AdminSettlementService.getOwnerPayoutDetail(vendorId, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, detail);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getSettlements(req, res) {
        try {
            const settlements = await AdminSettlementService_1.AdminSettlementService.getSettlementList();
            return ApiResponse_1.ApiResponse.success(res, settlements);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async markPaid(req, res) {
        try {
            const { from, to, transferMode, transferReference, notes, paidAt } = req.body;
            const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
            if (!vendorId) {
                throw new Error('vendorId is required');
            }
            const adminId = String(req.user?.adminId || req.user?.userId || '').trim() || undefined;
            const result = await AdminSettlementService_1.AdminSettlementService.markSettlementPaid(vendorId, {
                period: from && to ? { from: new Date(from), to: new Date(to) } : undefined,
                transferMode,
                transferReference,
                notes,
                paidAt: paidAt ? new Date(paidAt) : undefined,
                paidByAdminId: adminId
            });
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async reject(req, res) {
        try {
            const { reason, notes } = req.body;
            const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
            if (!vendorId) {
                throw new Error('vendorId is required');
            }
            const adminId = String(req.user?.adminId || req.user?.userId || '').trim() || undefined;
            const result = await AdminSettlementService_1.AdminSettlementService.rejectSettlement(vendorId, {
                reason,
                notes,
                rejectedByAdminId: adminId
            });
            return ApiResponse_1.ApiResponse.success(res, result, 'Settlement rejected');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

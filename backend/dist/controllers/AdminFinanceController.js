"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminFinanceController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const AdminFinanceService_1 = require("../services/AdminFinanceService");
exports.AdminFinanceController = {
    async getOverview(req, res) {
        try {
            const overview = await AdminFinanceService_1.AdminFinanceService.getOverview(req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, overview);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch finance overview');
        }
    },
    async getTransactionHistory(req, res) {
        try {
            const rows = await AdminFinanceService_1.AdminFinanceService.getTransactionHistory(req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, rows);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch transaction history');
        }
    }
};

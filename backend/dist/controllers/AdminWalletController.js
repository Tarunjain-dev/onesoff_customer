"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminWalletController = void 0;
const AdminWalletService_1 = require("../services/AdminWalletService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.AdminWalletController = {
    async getWalletOverview(req, res) {
        try {
            const overview = await AdminWalletService_1.AdminWalletService.getWalletOverview();
            return ApiResponse_1.ApiResponse.success(res, overview);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getTransactions(req, res) {
        try {
            const { limit } = req.query;
            const transactions = await AdminWalletService_1.AdminWalletService.getTransactions(limit ? parseInt(limit) : 50);
            return ApiResponse_1.ApiResponse.success(res, transactions);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

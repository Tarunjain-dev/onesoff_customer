"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorController = void 0;
const VendorEarningService_1 = require("../services/VendorEarningService");
const VendorAccountService_1 = require("../services/VendorAccountService");
const BadgeService_1 = require("../services/BadgeService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.VendorController = {
    async getCustomers(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const { page = 1, limit = 20 } = req.query;
            const customers = await VendorEarningService_1.VendorEarningService.getVendorCustomers(vendorId, {
                page: Number(page),
                limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, customers);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getBalance(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const balance = await VendorEarningService_1.VendorEarningService.getVendorBalance(vendorId);
            return ApiResponse_1.ApiResponse.success(res, balance);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getTransactions(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const { page = 1, limit = 10 } = req.query;
            const transactions = await VendorEarningService_1.VendorEarningService.getVendorTransactions(vendorId, {
                page: Number(page), limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, transactions);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getSettlements(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const { page = 1, limit = 10 } = req.query;
            const settlements = await VendorEarningService_1.VendorEarningService.getVendorSettlements(vendorId, {
                page: Number(page), limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, settlements);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async createSettlement(req, res) {
        try {
            const adminId = req.user?.adminId || req.user?.userId;
            if (!adminId) {
                throw new Error('Admin ID required');
            }
            const { vendorId } = req.body;
            const settlement = await VendorEarningService_1.VendorEarningService.createSettlement(adminId, vendorId);
            return ApiResponse_1.ApiResponse.success(res, settlement, 'Settlement created');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async approveSettlement(req, res) {
        try {
            const adminId = req.user?.adminId || req.user?.userId;
            if (!adminId) {
                throw new Error('Admin ID required');
            }
            const { settlementId } = req.body;
            const settlement = await VendorEarningService_1.VendorEarningService.approveSettlement(adminId, settlementId);
            return ApiResponse_1.ApiResponse.success(res, settlement, 'Settlement marked as paid');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getPendingSettlements(req, res) {
        try {
            const { page = 1, limit = 10 } = req.query;
            const settlements = await VendorEarningService_1.VendorEarningService.getPendingSettlements({
                page: Number(page), limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, settlements);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async deactivateAccount(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const result = await VendorAccountService_1.VendorAccountService.deactivateAccount(vendorId);
            return ApiResponse_1.ApiResponse.success(res, result, 'Vendor account deactivated');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async deleteAccount(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const result = await VendorAccountService_1.VendorAccountService.deleteAccount(vendorId);
            return ApiResponse_1.ApiResponse.success(res, result, 'Vendor account deleted');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getBadgeRules(_req, res) {
        try {
            const rules = await BadgeService_1.BadgeService.getBadgeRules();
            return ApiResponse_1.ApiResponse.success(res, rules);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getMyBadge(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                throw new Error('Vendor user ID required');
            }
            const badge = await BadgeService_1.BadgeService.getVendorCurrentBadgeByUserId(userId);
            return ApiResponse_1.ApiResponse.success(res, badge);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

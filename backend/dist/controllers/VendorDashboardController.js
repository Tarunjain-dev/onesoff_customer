"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorDashboardController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const VendorDashboardService_1 = require("../services/VendorDashboardService");
exports.VendorDashboardController = {
    async getSummary(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const summary = await VendorDashboardService_1.VendorDashboardService.getDashboardSummary(vendorId);
            return ApiResponse_1.ApiResponse.success(res, summary);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch dashboard summary';
            return ApiResponse_1.ApiResponse.error(res, message);
        }
    }
};

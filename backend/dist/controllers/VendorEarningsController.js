"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorEarningsController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const VendorEarningService_1 = require("../services/VendorEarningService");
exports.VendorEarningsController = {
    async getSummary(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const summary = await VendorEarningService_1.VendorEarningService.getVendorEarningsSummary(vendorId);
            return ApiResponse_1.ApiResponse.success(res, summary);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch earnings summary';
            return ApiResponse_1.ApiResponse.error(res, message);
        }
    }
};

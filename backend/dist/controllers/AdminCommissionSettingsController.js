"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminCommissionSettingsController = void 0;
const CommissionService_1 = require("../services/CommissionService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.AdminCommissionSettingsController = {
    async getSettings(_req, res) {
        try {
            const settings = await CommissionService_1.CommissionService.getCommissionSettings();
            return ApiResponse_1.ApiResponse.success(res, settings);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch commission settings');
        }
    },
    async updateSettings(req, res) {
        try {
            const settings = await CommissionService_1.CommissionService.updateCommissionSettings({
                defaultCommission: req.body?.defaultCommission,
                individualVendorDefaultCommission: req.body?.individualVendorDefaultCommission,
                goldVendorCommission: req.body?.goldVendorCommission,
                silverVendorCommission: req.body?.silverVendorCommission,
                platinumVendorCommission: req.body?.platinumVendorCommission,
                categoryCommission: req.body?.categoryCommission
            });
            return ApiResponse_1.ApiResponse.success(res, settings, 'Commission settings updated');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to update commission settings');
        }
    }
};

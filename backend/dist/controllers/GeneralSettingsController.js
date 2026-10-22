"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneralSettingsController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const GeneralSettingsService_1 = require("../services/GeneralSettingsService");
exports.GeneralSettingsController = {
    async getPublicSettings(_req, res) {
        try {
            const settings = await GeneralSettingsService_1.GeneralSettingsService.getGeneralSettings();
            return ApiResponse_1.ApiResponse.success(res, settings);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch general settings');
        }
    }
};

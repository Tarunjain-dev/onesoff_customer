"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminGeneralSettingsController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const GeneralSettingsService_1 = require("../services/GeneralSettingsService");
exports.AdminGeneralSettingsController = {
    async getSettings(_req, res) {
        try {
            const settings = await GeneralSettingsService_1.GeneralSettingsService.getGeneralSettings();
            return ApiResponse_1.ApiResponse.success(res, settings);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch general settings');
        }
    },
    async createSettings(req, res) {
        try {
            const settings = await GeneralSettingsService_1.GeneralSettingsService.createGeneralSettings(req.body || {});
            return ApiResponse_1.ApiResponse.success(res, settings, 'General settings created', 201);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to create general settings');
        }
    },
    async updateSettings(req, res) {
        try {
            const settings = await GeneralSettingsService_1.GeneralSettingsService.updateGeneralSettings(req.body || {});
            return ApiResponse_1.ApiResponse.success(res, settings, 'General settings updated');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to update general settings');
        }
    },
    async deleteSettings(req, res) {
        try {
            const rawField = req.query?.field;
            const field = typeof rawField === 'string'
                ? rawField
                : Array.isArray(rawField) && typeof rawField[0] === 'string'
                    ? rawField[0]
                    : undefined;
            const settings = await GeneralSettingsService_1.GeneralSettingsService.deleteGeneralSettings(field);
            return ApiResponse_1.ApiResponse.success(res, settings, field ? `General settings field ${field} reset` : 'General settings reset');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to delete general settings');
        }
    }
};

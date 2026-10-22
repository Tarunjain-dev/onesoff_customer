"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminDashboardController = void 0;
const AdminDashboardService_1 = require("../services/AdminDashboardService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.AdminDashboardController = {
    async getDashboard(req, res) {
        try {
            const range = typeof req.query.range === 'string' ? req.query.range : undefined;
            const from = typeof req.query.from === 'string' ? req.query.from : undefined;
            const to = typeof req.query.to === 'string' ? req.query.to : undefined;
            const data = await AdminDashboardService_1.AdminDashboardService.getDashboardStats(req.vendorFilter, {
                range,
                from,
                to
            });
            return ApiResponse_1.ApiResponse.success(res, data);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

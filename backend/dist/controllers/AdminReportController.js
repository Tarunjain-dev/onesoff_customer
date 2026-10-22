"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminReportController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const AdminReportService_1 = require("../services/AdminReportService");
exports.AdminReportController = {
    async getOverview(req, res) {
        try {
            const { dateRange, customStart, customEnd } = req.query;
            const overview = await AdminReportService_1.AdminReportService.getOverview({
                dateRange: dateRange ? String(dateRange) : undefined,
                customStart: customStart ? String(customStart) : undefined,
                customEnd: customEnd ? String(customEnd) : undefined
            }, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, overview);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch reports overview');
        }
    }
};

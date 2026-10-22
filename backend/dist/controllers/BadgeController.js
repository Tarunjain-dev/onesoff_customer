"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadgeController = void 0;
const BadgeService_1 = require("../services/BadgeService");
const ApiResponse_1 = require("../utils/ApiResponse");
exports.BadgeController = {
    async getBadgeRules(req, res) {
        try {
            const rules = await BadgeService_1.BadgeService.getBadgeRules();
            return ApiResponse_1.ApiResponse.success(res, rules);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async createBadgeRule(req, res) {
        try {
            const rule = await BadgeService_1.BadgeService.createBadgeRule(req.body);
            return ApiResponse_1.ApiResponse.success(res, rule);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async updateBadgeRule(req, res) {
        try {
            const badgeId = String(req.params.badgeId || '');
            const rule = await BadgeService_1.BadgeService.updateBadgeRule(badgeId, req.body || {});
            return ApiResponse_1.ApiResponse.success(res, rule);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async deleteBadgeRule(req, res) {
        try {
            const badgeId = String(req.params.badgeId || '');
            const result = await BadgeService_1.BadgeService.deleteBadgeRule(badgeId);
            return ApiResponse_1.ApiResponse.success(res, result, 'Badge rule deleted successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getVendorBadgeHistory(req, res) {
        try {
            const { vendorId } = req.query;
            const history = await BadgeService_1.BadgeService.getVendorBadgeHistory(vendorId);
            return ApiResponse_1.ApiResponse.success(res, history);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async assignBadge(req, res) {
        try {
            const { vendorId, badgeId } = req.body;
            const result = await BadgeService_1.BadgeService.assignBadge(vendorId, badgeId);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async unassignBadge(req, res) {
        try {
            const vendorId = String(req.params.vendorId || req.body?.vendorId || '');
            const result = await BadgeService_1.BadgeService.unassignBadge(vendorId);
            return ApiResponse_1.ApiResponse.success(res, result, 'Badge unassigned successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async processAllVendorBadges(req, res) {
        try {
            const results = await BadgeService_1.BadgeService.processAllVendorBadges();
            return ApiResponse_1.ApiResponse.success(res, results, `Processed ${results.length} vendor badges`);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async autoAssignVendorBadge(req, res) {
        try {
            const vendorId = String(req.params.vendorId || '');
            const result = await BadgeService_1.BadgeService.autoAssignVendorBadge(vendorId);
            return ApiResponse_1.ApiResponse.success(res, result, 'Badge auto-assigned successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

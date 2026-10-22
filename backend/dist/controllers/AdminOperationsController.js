"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminOperationsController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const AdminOperationsService_1 = require("../services/AdminOperationsService");
exports.AdminOperationsController = {
    async getQualityChecks(req, res) {
        try {
            const data = await AdminOperationsService_1.AdminOperationsService.getQualityCheckQueue(req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, data);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async inspectQualityCheck(req, res) {
        try {
            const adminId = req.user?.adminId || req.user?.userId;
            const orderItemId = Array.isArray(req.params.orderItemId) ? req.params.orderItemId[0] : req.params.orderItemId;
            if (!adminId) {
                throw new Error('Admin ID required');
            }
            if (!orderItemId) {
                throw new Error('orderItemId is required');
            }
            const result = await AdminOperationsService_1.AdminOperationsService.inspectReturnedOrder(adminId, orderItemId, req.body, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, result, 'Inspection submitted successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getDamageClaims(req, res) {
        try {
            const data = await AdminOperationsService_1.AdminOperationsService.getDamageClaims(req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, data);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async reviewDamageClaim(req, res) {
        try {
            const adminId = req.user?.adminId || req.user?.userId;
            const claimId = Array.isArray(req.params.claimId) ? req.params.claimId[0] : req.params.claimId;
            if (!adminId) {
                throw new Error('Admin ID required');
            }
            if (!claimId) {
                throw new Error('claimId is required');
            }
            const result = await AdminOperationsService_1.AdminOperationsService.reviewDamageClaim(adminId, claimId, req.body, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, result, 'Damage claim reviewed successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getMaintenanceTasks(req, res) {
        try {
            const data = await AdminOperationsService_1.AdminOperationsService.getMaintenanceTasks(req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, data);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async updateMaintenanceTaskStatus(req, res) {
        try {
            const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
            if (!taskId) {
                throw new Error('taskId is required');
            }
            const result = await AdminOperationsService_1.AdminOperationsService.updateMaintenanceTaskStatus(taskId, req.body?.status, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, result, 'Maintenance task updated successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getRepairTasks(req, res) {
        try {
            const data = await AdminOperationsService_1.AdminOperationsService.getRepairTasks(req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, data);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async updateRepairTask(req, res) {
        try {
            const repairId = Array.isArray(req.params.repairId) ? req.params.repairId[0] : req.params.repairId;
            if (!repairId) {
                throw new Error('repairId is required');
            }
            const result = await AdminOperationsService_1.AdminOperationsService.updateRepairTask(repairId, req.body, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, result, 'Repair task updated successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async updateIssueTask(req, res) {
        try {
            const adminId = req.user?.adminId || req.user?.userId;
            const orderItemId = Array.isArray(req.params.orderItemId) ? req.params.orderItemId[0] : req.params.orderItemId;
            if (!adminId) {
                throw new Error('Admin ID required');
            }
            if (!orderItemId) {
                throw new Error('orderItemId is required');
            }
            const result = await AdminOperationsService_1.AdminOperationsService.updateIssueTask(adminId, orderItemId, req.body, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, result, 'Issue updated successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

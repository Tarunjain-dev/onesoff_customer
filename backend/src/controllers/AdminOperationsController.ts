import { Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';
import { AdminOperationsService } from '../services/AdminOperationsService';

export const AdminOperationsController = {
  async getQualityChecks(req: AuthRequest, res: Response) {
    try {
      const data = await AdminOperationsService.getQualityCheckQueue(req.vendorFilter);
      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async inspectQualityCheck(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.adminId || req.user?.userId;
      const orderItemId = Array.isArray(req.params.orderItemId) ? req.params.orderItemId[0] : req.params.orderItemId;
      if (!adminId) {
        throw new Error('Admin ID required');
      }
      if (!orderItemId) {
        throw new Error('orderItemId is required');
      }

      const result = await AdminOperationsService.inspectReturnedOrder(
        adminId,
        orderItemId,
        req.body,
        req.vendorFilter
      );

      return ApiResponse.success(res, result, 'Inspection submitted successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getDamageClaims(req: AuthRequest, res: Response) {
    try {
      const data = await AdminOperationsService.getDamageClaims(req.vendorFilter);
      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async reviewDamageClaim(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.adminId || req.user?.userId;
      const claimId = Array.isArray(req.params.claimId) ? req.params.claimId[0] : req.params.claimId;
      if (!adminId) {
        throw new Error('Admin ID required');
      }
      if (!claimId) {
        throw new Error('claimId is required');
      }

      const result = await AdminOperationsService.reviewDamageClaim(
        adminId,
        claimId,
        req.body,
        req.vendorFilter
      );

      return ApiResponse.success(res, result, 'Damage claim reviewed successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getMaintenanceTasks(req: AuthRequest, res: Response) {
    try {
      const data = await AdminOperationsService.getMaintenanceTasks(req.vendorFilter);
      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async updateMaintenanceTaskStatus(req: AuthRequest, res: Response) {
    try {
      const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
      if (!taskId) {
        throw new Error('taskId is required');
      }

      const result = await AdminOperationsService.updateMaintenanceTaskStatus(
        taskId,
        req.body?.status,
        req.vendorFilter
      );

      return ApiResponse.success(res, result, 'Maintenance task updated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getRepairTasks(req: AuthRequest, res: Response) {
    try {
      const data = await AdminOperationsService.getRepairTasks(req.vendorFilter);
      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async updateRepairTask(req: AuthRequest, res: Response) {
    try {
      const repairId = Array.isArray(req.params.repairId) ? req.params.repairId[0] : req.params.repairId;
      if (!repairId) {
        throw new Error('repairId is required');
      }

      const result = await AdminOperationsService.updateRepairTask(
        repairId,
        req.body,
        req.vendorFilter
      );

      return ApiResponse.success(res, result, 'Repair task updated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async updateIssueTask(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.adminId || req.user?.userId;
      const orderItemId = Array.isArray(req.params.orderItemId) ? req.params.orderItemId[0] : req.params.orderItemId;
      if (!adminId) {
        throw new Error('Admin ID required');
      }
      if (!orderItemId) {
        throw new Error('orderItemId is required');
      }

      const result = await AdminOperationsService.updateIssueTask(
        adminId,
        orderItemId,
        req.body,
        req.vendorFilter
      );

      return ApiResponse.success(res, result, 'Issue updated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

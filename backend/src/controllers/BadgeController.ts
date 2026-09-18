import { Request, Response } from 'express';
import { BadgeService } from '../services/BadgeService';
import { ApiResponse } from '../utils/ApiResponse';

export const BadgeController = {
  async getBadgeRules(req: Request, res: Response) {
    try {
      const rules = await BadgeService.getBadgeRules();
      return ApiResponse.success(res, rules);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async createBadgeRule(req: Request, res: Response) {
    try {
      const rule = await BadgeService.createBadgeRule(req.body);
      return ApiResponse.success(res, rule);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async updateBadgeRule(req: Request, res: Response) {
    try {
      const badgeId = String(req.params.badgeId || '');
      const rule = await BadgeService.updateBadgeRule(badgeId, req.body || {});
      return ApiResponse.success(res, rule);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async deleteBadgeRule(req: Request, res: Response) {
    try {
      const badgeId = String(req.params.badgeId || '');
      const result = await BadgeService.deleteBadgeRule(badgeId);
      return ApiResponse.success(res, result, 'Badge rule deleted successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getVendorBadgeHistory(req: Request, res: Response) {
    try {
      const { vendorId } = req.query;
      const history = await BadgeService.getVendorBadgeHistory(vendorId as string);
      return ApiResponse.success(res, history);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async assignBadge(req: Request, res: Response) {
    try {
      const { vendorId, badgeId } = req.body;
      const result = await BadgeService.assignBadge(vendorId, badgeId);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async unassignBadge(req: Request, res: Response) {
    try {
      const vendorId = String(req.params.vendorId || req.body?.vendorId || '');
      const result = await BadgeService.unassignBadge(vendorId);
      return ApiResponse.success(res, result, 'Badge unassigned successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async processAllVendorBadges(req: Request, res: Response) {
    try {
      const results = await BadgeService.processAllVendorBadges();
      return ApiResponse.success(res, results, `Processed ${results.length} vendor badges`);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async autoAssignVendorBadge(req: Request, res: Response) {
    try {
      const vendorId = String(req.params.vendorId || '');
      const result = await BadgeService.autoAssignVendorBadge(vendorId);
      return ApiResponse.success(res, result, 'Badge auto-assigned successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

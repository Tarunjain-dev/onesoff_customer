import { Response } from 'express';
import { VendorEarningService } from '../services/VendorEarningService';
import { VendorAccountService } from '../services/VendorAccountService';
import { BadgeService } from '../services/BadgeService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';

export const VendorController = {
  async getCustomers(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }

      const { page = 1, limit = 20 } = req.query;
      const customers = await VendorEarningService.getVendorCustomers(vendorId, {
        page: Number(page),
        limit: Number(limit)
      });

      return ApiResponse.success(res, customers);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getBalance(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }
      const balance = await VendorEarningService.getVendorBalance(vendorId);
      return ApiResponse.success(res, balance);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getTransactions(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }
      const { page = 1, limit = 10 } = req.query;
      const transactions = await VendorEarningService.getVendorTransactions(vendorId, {
        page: Number(page), limit: Number(limit)
      });
      return ApiResponse.success(res, transactions);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getSettlements(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }
      const { page = 1, limit = 10 } = req.query;
      const settlements = await VendorEarningService.getVendorSettlements(vendorId, {
        page: Number(page), limit: Number(limit)
      });
      return ApiResponse.success(res, settlements);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async createSettlement(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.adminId || req.user?.userId;
      if (!adminId) {
        throw new Error('Admin ID required');
      }
      const { vendorId } = req.body;
      const settlement = await VendorEarningService.createSettlement(adminId, vendorId);
      return ApiResponse.success(res, settlement, 'Settlement created');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async approveSettlement(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.adminId || req.user?.userId;
      if (!adminId) {
        throw new Error('Admin ID required');
      }
      const { settlementId } = req.body;
      const settlement = await VendorEarningService.approveSettlement(adminId, settlementId);
      return ApiResponse.success(res, settlement, 'Settlement marked as paid');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getPendingSettlements(req: AuthRequest, res: Response) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const settlements = await VendorEarningService.getPendingSettlements({
        page: Number(page), limit: Number(limit)
      });
      return ApiResponse.success(res, settlements);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async deactivateAccount(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }

      const result = await VendorAccountService.deactivateAccount(vendorId);
      return ApiResponse.success(res, result, 'Vendor account deactivated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async deleteAccount(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }

      const result = await VendorAccountService.deleteAccount(vendorId);
      return ApiResponse.success(res, result, 'Vendor account deleted');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getBadgeRules(_req: AuthRequest, res: Response) {
    try {
      const rules = await BadgeService.getBadgeRules();
      return ApiResponse.success(res, rules);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getMyBadge(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new Error('Vendor user ID required');
      }

      const badge = await BadgeService.getVendorCurrentBadgeByUserId(userId);
      return ApiResponse.success(res, badge);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

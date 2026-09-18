import { Request, Response } from 'express';
import { AdminWalletService } from '../services/AdminWalletService';
import { ApiResponse } from '../utils/ApiResponse';

export const AdminWalletController = {
  async getWalletOverview(req: Request, res: Response) {
    try {
      const overview = await AdminWalletService.getWalletOverview();
      return ApiResponse.success(res, overview);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getTransactions(req: Request, res: Response) {
    try {
      const { limit } = req.query;
      const transactions = await AdminWalletService.getTransactions(limit ? parseInt(limit as string) : 50);
      return ApiResponse.success(res, transactions);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

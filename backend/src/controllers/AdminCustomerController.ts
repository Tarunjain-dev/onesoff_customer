import { Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';
import { AdminCustomerService } from '../services/AdminCustomerService';

export const AdminCustomerController = {
  async getCustomers(req: AuthRequest, res: Response) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const customers = await AdminCustomerService.getScopedCustomers(
        {
          page: Number(page),
          limit: Number(limit)
        },
        req.vendorFilter
      );

      return ApiResponse.success(res, customers);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch customers');
    }
  }
};

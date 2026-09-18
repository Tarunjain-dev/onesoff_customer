import { Response } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/ApiResponse';
import { RentalAvailabilityService } from '../services/RentalAvailabilityService';
import { AdminRentalAvailabilityService } from '../services/AdminRentalAvailabilityService';

export const RentalAvailabilityController = {
  async getProducts(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }

      const { page = 1, limit = 20, search = '' } = req.query;
      const data = await RentalAvailabilityService.getVendorProducts(vendorId, {
        page: Number(page),
        limit: Number(limit),
        search: String(search || '')
      });

      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getCalendar(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }

      const { productId, month, variantId } = req.query;
      const data = await RentalAvailabilityService.getCalendar(vendorId, {
        productId: String(productId || ''),
        month: month ? String(month) : undefined,
        variantId: variantId ? String(variantId) : undefined
      });

      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async upsertDate(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }

      const { productId, variantId, date, mode, note } = req.body;
      const data = await RentalAvailabilityService.upsertDate(vendorId, {
        productId: String(productId || ''),
        variantId: variantId ? String(variantId) : undefined,
        date: String(date || ''),
        mode: String(mode || '').toUpperCase() as 'BLOCKED' | 'MAINTENANCE' | 'AVAILABLE',
        note: note ? String(note) : undefined
      });

      return ApiResponse.success(res, data, 'Availability updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async upsertRange(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }

      const { productId, variantId, startDate, endDate, mode, note } = req.body;
      const data = await RentalAvailabilityService.upsertRange(vendorId, {
        productId: String(productId || ''),
        variantId: variantId ? String(variantId) : undefined,
        startDate: String(startDate || ''),
        endDate: String(endDate || ''),
        mode: String(mode || '').toUpperCase() as 'BLOCKED' | 'MAINTENANCE' | 'AVAILABLE',
        note: note ? String(note) : undefined
      });

      return ApiResponse.success(res, data, 'Availability range updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async clearMonth(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new Error('Vendor ID required');
      }

      const { productId, variantId, month } = req.body;
      const data = await RentalAvailabilityService.clearMonth(vendorId, {
        productId: String(productId || ''),
        variantId: variantId ? String(variantId) : undefined,
        month: String(month || '')
      });

      return ApiResponse.success(res, data, 'Month overrides cleared');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getCalendarByAdmin(req: AuthRequest, res: Response) {
    try {
      const { vendorId, productId, month, variantId } = req.query;
      const data = await AdminRentalAvailabilityService.getScopedCalendar(
        {
          vendorId: String(vendorId || ''),
          productId: String(productId || ''),
          month: month ? String(month) : undefined,
          variantId: variantId ? String(variantId) : undefined
        },
        req.vendorFilter
      );

      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getProductsByAdmin(req: AuthRequest, res: Response) {
    try {
      const { vendorId, page = 1, limit = 200 } = req.query;
      const data = await AdminRentalAvailabilityService.getScopedVendorProducts(
        {
          vendorId: String(vendorId || ''),
          page: Number(page),
          limit: Number(limit)
        },
        req.vendorFilter
      );

      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async upsertDateByAdmin(req: AuthRequest, res: Response) {
    try {
      const { vendorId, productId, variantId, date, mode, note } = req.body;
      const data = await AdminRentalAvailabilityService.upsertScopedDate(
        {
          vendorId: String(vendorId || ''),
          productId: String(productId || ''),
          variantId: variantId ? String(variantId) : undefined,
          date: String(date || ''),
          mode: String(mode || '').toUpperCase() as 'BLOCKED' | 'MAINTENANCE' | 'AVAILABLE',
          note: note ? String(note) : undefined
        },
        req.vendorFilter
      );

      return ApiResponse.success(res, data, 'Availability updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async clearMonthByAdmin(req: AuthRequest, res: Response) {
    try {
      const { vendorId, productId, variantId, month } = req.body;
      const data = await AdminRentalAvailabilityService.clearScopedMonth(
        {
          vendorId: String(vendorId || ''),
          productId: String(productId || ''),
          variantId: variantId ? String(variantId) : undefined,
          month: String(month || '')
        },
        req.vendorFilter
      );

      return ApiResponse.success(res, data, 'Month overrides cleared');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};


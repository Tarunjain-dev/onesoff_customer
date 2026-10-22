import { Response } from 'express';
import { OrderService } from '../services/OrderService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';
import { ValidationError } from '../utils/errors';

export const OrderController = {
  async createOrder(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) {
        throw new ValidationError('Customer ID is required');
      }
      const orderData = req.body;
      const order = await OrderService.createUnpaidOrder(String(customerId), orderData);
      return ApiResponse.success(
        res,
        {
          order,
          paymentStatus: 'UNPAID'
        },
        'Order created. Complete payment via /payments/razorpay/init and /payments/razorpay/verify.'
      );
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async vendorResponse(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new ValidationError('Vendor ID is required');
      }
      const { orderItemId, action } = req.body;
      const result = await OrderService.handleVendorResponse(String(vendorId), orderItemId, action);
      return ApiResponse.success(res, result, `Order ${action.toLowerCase()}ed successfully`);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getVendorOrders(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new ValidationError('Vendor ID is required');
      }
      const { status, page = 1, limit = 10 } = req.query;
      const orders = await OrderService.getVendorOrders(String(vendorId), {
        status: status as string,
        page: Number(page),
        limit: Number(limit)
      });
      return ApiResponse.success(res, orders);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getCustomerOrders(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) {
        throw new ValidationError('Customer ID is required');
      }
      const { page = 1, limit = 10 } = req.query;
      const orders = await OrderService.getCustomerOrders(String(customerId), {
        page: Number(page),
        limit: Number(limit)
      });
      return ApiResponse.success(res, orders);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async cancelCustomerOrder(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) throw new ValidationError('Customer ID is required');
      const orderId = String(req.params.orderId || '').trim();
      if (!/^\d+$/.test(orderId)) throw new ValidationError('Valid orderId is required');
      const result = await OrderService.cancelCustomerOrder(
        String(customerId),
        orderId,
        'Cancelled by customer'
      );
      return ApiResponse.success(res, result, 'Order cancelled. Refund is pending processing.');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async updateOrderStatus(req: AuthRequest, res: Response) {
    try {
      const { orderItemId, status } = req.body;
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) {
        throw new ValidationError('Vendor ID is required');
      }
      const result = await OrderService.updateOrderStatus(String(vendorId), orderItemId, status);
      return ApiResponse.success(res, result, 'Order status updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async submitReview(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) {
        throw new ValidationError('Customer ID is required');
      }
      const result = await OrderService.submitCustomerReview(String(customerId), req.body);
      return ApiResponse.success(res, result, 'Review submitted successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

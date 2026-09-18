import { Response } from 'express';
import { OrderItemStatus } from '@prisma/client';
import { AdminOrderService } from '../services/AdminOrderService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';

const VALID_ORDER_STATUSES = new Set<string>(Object.values(OrderItemStatus));

const toValidOrderStatus = (value: unknown): OrderItemStatus | undefined => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized || !VALID_ORDER_STATUSES.has(normalized)) return undefined;
  return normalized as OrderItemStatus;
};

export const AdminOrderController = {
  async getOrders(req: AuthRequest, res: Response) {
    try {
      const { dateFrom, dateTo, vendorId, status, paymentStatus } = req.query;
      const orders = await AdminOrderService.getOrderList({
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        vendorId: vendorId as string,
        status: toValidOrderStatus(status),
        paymentStatus: paymentStatus as string,
        roleFilter: req.vendorFilter
      });
      return ApiResponse.success(res, orders);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getOrderDetail(req: AuthRequest, res: Response) {
    try {
      const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
      if (!orderId) {
        return ApiResponse.error(res, 'orderId is required', 400);
      }
      const order = await AdminOrderService.getOrderDetail(orderId, req.vendorFilter);
      return ApiResponse.success(res, order);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async cancelOrder(req: AuthRequest, res: Response) {
    try {
      const { reason } = req.body;
      const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
      if (!orderId) {
        return ApiResponse.error(res, 'orderId is required', 400);
      }
      const result = await AdminOrderService.cancelOrder(orderId, reason, req.vendorFilter);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async overrideStatus(req: AuthRequest, res: Response) {
    try {
      const { status } = req.body;
      const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
      if (!orderId) {
        return ApiResponse.error(res, 'orderId is required', 400);
      }
      const order = await AdminOrderService.overrideStatus(orderId, status, req.vendorFilter);
      return ApiResponse.success(res, order);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminOrderController = void 0;
const client_1 = require("@prisma/client");
const AdminOrderService_1 = require("../services/AdminOrderService");
const ApiResponse_1 = require("../utils/ApiResponse");
const VALID_ORDER_STATUSES = new Set(Object.values(client_1.OrderItemStatus));
const toValidOrderStatus = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized || !VALID_ORDER_STATUSES.has(normalized))
        return undefined;
    return normalized;
};
exports.AdminOrderController = {
    async getOrders(req, res) {
        try {
            const { dateFrom, dateTo, vendorId, status, paymentStatus } = req.query;
            const orders = await AdminOrderService_1.AdminOrderService.getOrderList({
                dateFrom: dateFrom ? new Date(dateFrom) : undefined,
                dateTo: dateTo ? new Date(dateTo) : undefined,
                vendorId: vendorId,
                status: toValidOrderStatus(status),
                paymentStatus: paymentStatus,
                roleFilter: req.vendorFilter
            });
            return ApiResponse_1.ApiResponse.success(res, orders);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getOrderDetail(req, res) {
        try {
            const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
            if (!orderId) {
                return ApiResponse_1.ApiResponse.error(res, 'orderId is required', 400);
            }
            const order = await AdminOrderService_1.AdminOrderService.getOrderDetail(orderId, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, order);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async cancelOrder(req, res) {
        try {
            const { reason } = req.body;
            const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
            if (!orderId) {
                return ApiResponse_1.ApiResponse.error(res, 'orderId is required', 400);
            }
            const result = await AdminOrderService_1.AdminOrderService.cancelOrder(orderId, reason, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async overrideStatus(req, res) {
        try {
            const { status } = req.body;
            const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
            if (!orderId) {
                return ApiResponse_1.ApiResponse.error(res, 'orderId is required', 400);
            }
            const order = await AdminOrderService_1.AdminOrderService.overrideStatus(orderId, status, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, order);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

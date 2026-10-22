"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const OrderService_1 = require("../services/OrderService");
const ApiResponse_1 = require("../utils/ApiResponse");
const errors_1 = require("../utils/errors");
exports.OrderController = {
    async createOrder(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId) {
                throw new errors_1.ValidationError('Customer ID is required');
            }
            const orderData = req.body;
            const order = await OrderService_1.OrderService.createUnpaidOrder(String(customerId), orderData);
            return ApiResponse_1.ApiResponse.success(res, {
                order,
                paymentStatus: 'UNPAID'
            }, 'Order created. Complete payment via /payments/razorpay/init and /payments/razorpay/verify.');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async vendorResponse(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new errors_1.ValidationError('Vendor ID is required');
            }
            const { orderItemId, action } = req.body;
            const result = await OrderService_1.OrderService.handleVendorResponse(String(vendorId), orderItemId, action);
            return ApiResponse_1.ApiResponse.success(res, result, `Order ${action.toLowerCase()}ed successfully`);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getVendorOrders(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new errors_1.ValidationError('Vendor ID is required');
            }
            const { status, page = 1, limit = 10 } = req.query;
            const orders = await OrderService_1.OrderService.getVendorOrders(String(vendorId), {
                status: status,
                page: Number(page),
                limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, orders);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getCustomerOrders(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId) {
                throw new errors_1.ValidationError('Customer ID is required');
            }
            const { page = 1, limit = 10 } = req.query;
            const orders = await OrderService_1.OrderService.getCustomerOrders(String(customerId), {
                page: Number(page),
                limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, orders);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async cancelCustomerOrder(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId)
                throw new errors_1.ValidationError('Customer ID is required');
            const orderId = String(req.params.orderId || '').trim();
            if (!/^\d+$/.test(orderId))
                throw new errors_1.ValidationError('Valid orderId is required');
            const result = await OrderService_1.OrderService.cancelCustomerOrder(String(customerId), orderId, 'Cancelled by customer');
            return ApiResponse_1.ApiResponse.success(res, result, 'Order cancelled. Refund is pending processing.');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async updateOrderStatus(req, res) {
        try {
            const { orderItemId, status } = req.body;
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new errors_1.ValidationError('Vendor ID is required');
            }
            const result = await OrderService_1.OrderService.updateOrderStatus(String(vendorId), orderItemId, status);
            return ApiResponse_1.ApiResponse.success(res, result, 'Order status updated');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async submitReview(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId) {
                throw new errors_1.ValidationError('Customer ID is required');
            }
            const result = await OrderService_1.OrderService.submitCustomerReview(String(customerId), req.body);
            return ApiResponse_1.ApiResponse.success(res, result, 'Review submitted successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

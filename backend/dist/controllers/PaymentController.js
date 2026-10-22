"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const errors_1 = require("../utils/errors");
const OrderService_1 = require("../services/OrderService");
const RazorpayService_1 = require("../services/RazorpayService");
const PaymentService_1 = require("../services/PaymentService");
exports.PaymentController = {
    async initRazorpay(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId)
                throw new errors_1.ValidationError('Customer ID is required');
            if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
                throw new errors_1.BusinessLogicError('Razorpay is not configured');
            }
            const order = await OrderService_1.OrderService.createUnpaidOrder(String(customerId), req.body);
            try {
                const amount = Number(order?.finalPayable || 0);
                const pricingBreakdown = order?.pricingBreakdown || null;
                const deliveryAddress = req.body?.deliveryAddress || null;
                const razorpayOrder = await RazorpayService_1.RazorpayService.createOrder(amount, String(order?.orderNo || order.id));
                const payment = await PaymentService_1.PaymentService.initializePayment({
                    customerId: String(customerId),
                    orderId: String(order?.id),
                    provider: 'RAZORPAY',
                    providerOrderId: String(razorpayOrder?.id || ''),
                    currency: String(razorpayOrder?.currency || 'INR'),
                    amount: Number(razorpayOrder?.amount || 0) / 100,
                    paymentMeta: {
                        razorpayOrderId: razorpayOrder?.id,
                        receipt: razorpayOrder?.receipt,
                        pricingBreakdown,
                        deliveryAddress
                    }
                });
                return ApiResponse_1.ApiResponse.success(res, {
                    order,
                    payment,
                    razorpay: {
                        keyId: process.env.RAZORPAY_KEY_ID,
                        orderId: razorpayOrder?.id,
                        amount: razorpayOrder?.amount,
                        currency: razorpayOrder?.currency || 'INR'
                    },
                    pricingBreakdown
                }, 'Razorpay order created');
            }
            catch (razorpayError) {
                await OrderService_1.OrderService.rollbackUnpaidOrder(String(order?.id));
                const message = razorpayError?.error?.description ||
                    razorpayError?.response?.data?.error?.description ||
                    razorpayError?.response?.data?.message ||
                    razorpayError?.message ||
                    'Razorpay order creation failed';
                const normalized = String(message);
                if (normalized.toLowerCase().includes('authentication failed')) {
                    throw new errors_1.BusinessLogicError('Razorpay authentication failed. Please verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test vs live) and restart the backend.');
                }
                throw new errors_1.BusinessLogicError(normalized);
            }
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async verifyRazorpay(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId)
                throw new errors_1.ValidationError('Customer ID is required');
            const { internalOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
            if (!internalOrderId)
                throw new errors_1.ValidationError('internalOrderId is required');
            if (!razorpayOrderId)
                throw new errors_1.ValidationError('razorpayOrderId is required');
            if (!razorpayPaymentId)
                throw new errors_1.ValidationError('razorpayPaymentId is required');
            if (!razorpaySignature)
                throw new errors_1.ValidationError('razorpaySignature is required');
            const ok = RazorpayService_1.RazorpayService.verifyPaymentSignature(String(razorpayOrderId), String(razorpayPaymentId), String(razorpaySignature));
            if (!ok)
                throw new errors_1.ValidationError('Invalid payment signature');
            const order = await OrderService_1.OrderService.confirmOrderPayment(String(customerId), String(internalOrderId), {
                provider: 'RAZORPAY',
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature
            });
            return ApiResponse_1.ApiResponse.success(res, order, 'Payment verified');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async cancelRazorpay(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId)
                throw new errors_1.ValidationError('Customer ID is required');
            const { internalOrderId } = req.body || {};
            if (!internalOrderId)
                throw new errors_1.ValidationError('internalOrderId is required');
            const result = await OrderService_1.OrderService.rollbackUnpaidOrder(String(internalOrderId), String(customerId));
            return ApiResponse_1.ApiResponse.success(res, result, 'Pending order cancelled and dates released');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async razorpayWebhook(req, res) {
        try {
            const signature = req.headers['x-razorpay-signature'];
            if (!signature || Array.isArray(signature)) {
                throw new errors_1.ValidationError('Missing Razorpay webhook signature');
            }
            const rawBody = Buffer.isBuffer(req.body)
                ? req.body
                : Buffer.from(JSON.stringify(req.body || {}), 'utf8');
            const validSignature = RazorpayService_1.RazorpayService.verifyWebhookSignature(rawBody, signature);
            if (!validSignature) {
                throw new errors_1.ValidationError('Invalid Razorpay webhook signature');
            }
            const payload = Buffer.isBuffer(req.body)
                ? JSON.parse(rawBody.toString('utf8') || '{}')
                : req.body;
            const result = await PaymentService_1.PaymentService.handleRazorpayWebhook(payload);
            return ApiResponse_1.ApiResponse.success(res, result, 'Webhook processed');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async handlePaymentFailure(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId)
                throw new errors_1.ValidationError('Customer ID is required');
            const { orderId } = req.body || {};
            if (!orderId)
                throw new errors_1.ValidationError('orderId is required');
            const result = await PaymentService_1.PaymentService.handlePaymentFailure(String(customerId), String(orderId));
            return ApiResponse_1.ApiResponse.success(res, result, 'Payment cancelled and order rolled back');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

import { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';
import { ValidationError, BusinessLogicError } from '../utils/errors';
import { OrderService } from '../services/OrderService';
import { RazorpayService } from '../services/RazorpayService';
import { PaymentService } from '../services/PaymentService';

export const PaymentController = {
  async initRazorpay(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) throw new ValidationError('Customer ID is required');

      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new BusinessLogicError('Razorpay is not configured');
      }

      const order = await OrderService.createUnpaidOrder(String(customerId), req.body);
      try {
        const amount = Number((order as any)?.finalPayable || 0);
        const pricingBreakdown = (order as any)?.pricingBreakdown || null;
        const deliveryAddress = req.body?.deliveryAddress || null;
        const razorpayOrder = await RazorpayService.createOrder(amount, String((order as any)?.orderNo || order.id));
        const payment = await PaymentService.initializePayment({
          customerId: String(customerId),
          orderId: String((order as any)?.id),
          provider: 'RAZORPAY',
          providerOrderId: String((razorpayOrder as any)?.id || ''),
          currency: String((razorpayOrder as any)?.currency || 'INR'),
          amount: Number((razorpayOrder as any)?.amount || 0) / 100,
          paymentMeta: {
            razorpayOrderId: (razorpayOrder as any)?.id,
            receipt: (razorpayOrder as any)?.receipt,
            pricingBreakdown,
            deliveryAddress
          }
        });

        return ApiResponse.success(
          res,
          {
            order,
            payment,
            razorpay: {
              keyId: process.env.RAZORPAY_KEY_ID,
              orderId: (razorpayOrder as any)?.id,
              amount: (razorpayOrder as any)?.amount,
              currency: (razorpayOrder as any)?.currency || 'INR'
            },
            pricingBreakdown
          },
          'Razorpay order created'
        );
      } catch (razorpayError: any) {
        await OrderService.rollbackUnpaidOrder(String((order as any)?.id));
        const message =
          razorpayError?.error?.description ||
          razorpayError?.response?.data?.error?.description ||
          razorpayError?.response?.data?.message ||
          razorpayError?.message ||
          'Razorpay order creation failed';

        const normalized = String(message);
        if (normalized.toLowerCase().includes('authentication failed')) {
          throw new BusinessLogicError(
            'Razorpay authentication failed. Please verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test vs live) and restart the backend.'
          );
        }

        throw new BusinessLogicError(normalized);
      }
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async verifyRazorpay(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) throw new ValidationError('Customer ID is required');

      const { internalOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};

      if (!internalOrderId) throw new ValidationError('internalOrderId is required');
      if (!razorpayOrderId) throw new ValidationError('razorpayOrderId is required');
      if (!razorpayPaymentId) throw new ValidationError('razorpayPaymentId is required');
      if (!razorpaySignature) throw new ValidationError('razorpaySignature is required');

      const ok = RazorpayService.verifyPaymentSignature(
        String(razorpayOrderId),
        String(razorpayPaymentId),
        String(razorpaySignature)
      );

      if (!ok) throw new ValidationError('Invalid payment signature');

      const order = await OrderService.confirmOrderPayment(String(customerId), String(internalOrderId), {
        provider: 'RAZORPAY',
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      });

      return ApiResponse.success(res, order, 'Payment verified');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async cancelRazorpay(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) throw new ValidationError('Customer ID is required');

      const { internalOrderId } = req.body || {};
      if (!internalOrderId) throw new ValidationError('internalOrderId is required');

      const result = await OrderService.rollbackUnpaidOrder(
        String(internalOrderId),
        String(customerId)
      );

      return ApiResponse.success(res, result, 'Pending order cancelled and dates released');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async razorpayWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      if (!signature || Array.isArray(signature)) {
        throw new ValidationError('Missing Razorpay webhook signature');
      }

      const rawBody =
        Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(JSON.stringify(req.body || {}), 'utf8');

      const validSignature = RazorpayService.verifyWebhookSignature(rawBody, signature);
      if (!validSignature) {
        throw new ValidationError('Invalid Razorpay webhook signature');
      }

      const payload = Buffer.isBuffer(req.body)
        ? JSON.parse(rawBody.toString('utf8') || '{}')
        : req.body;

      const result = await PaymentService.handleRazorpayWebhook(payload);
      return ApiResponse.success(res, result, 'Webhook processed');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async handlePaymentFailure(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) throw new ValidationError('Customer ID is required');

      const { orderId } = req.body || {};
      if (!orderId) throw new ValidationError('orderId is required');

      const result = await PaymentService.handlePaymentFailure(String(customerId), String(orderId));
      return ApiResponse.success(res, result, 'Payment cancelled and order rolled back');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

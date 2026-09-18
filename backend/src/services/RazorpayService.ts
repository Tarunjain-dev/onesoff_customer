import Razorpay from 'razorpay';
import crypto from 'crypto';
import { BusinessLogicError } from '../utils/errors';

let razorpayClient: Razorpay | null = null;

const getRazorpay = (): Razorpay => {
  if (razorpayClient) return razorpayClient;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new BusinessLogicError('Razorpay is not configured');
  }

  razorpayClient = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });

  return razorpayClient;
};

export const RazorpayService = {
  async createOrder(amount: number, orderId: string) {
    const razorpay = getRazorpay();
    const rupees = Number(amount);
    const amountPaise = Math.round(rupees * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw new BusinessLogicError('Invalid amount for Razorpay order');
    }
    const options = {
      amount: amountPaise, // paise (integer)
      currency: 'INR',
      receipt: orderId,
      notes: {
        orderId
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);
    return razorpayOrder;
  },

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const text = `${orderId}|${paymentId}`;
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest('hex');

    return generated_signature === signature;
  },

  async capturePayment(paymentId: string, amount: number) {
    const razorpay = getRazorpay();
    const rupees = Number(amount);
    const amountPaise = Math.round(rupees * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw new BusinessLogicError('Invalid amount for Razorpay capture');
    }
    const payment = await razorpay.payments.capture(paymentId, amountPaise, 'INR');
    return payment;
  },

  async processRefund(paymentId: string, amount: number, notes?: Record<string, string>) {
    const razorpay = getRazorpay();
    const rupees = Number(amount);
    const amountPaise = Math.round(rupees * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw new BusinessLogicError('Invalid amount for Razorpay refund');
    }
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amountPaise,
      speed: 'normal',
      notes
    });

    return refund;
  },

  async createPayout(vendorId: string, amount: number, accountNumber: string, ifsc: string) {
    const razorpay = getRazorpay();
    // Razorpay X payout
    const payout = await razorpay.payouts.create({
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER!,
      amount: amount * 100,
      currency: 'INR',
      mode: 'IMPS',
      purpose: 'vendor_settlement',
      fund_account: {
        account_type: 'bank_account',
        bank_account: {
          name: 'Vendor',
          ifsc,
          account_number: accountNumber
        }
      },
      queue_if_low_balance: true,
      reference_id: `PAYOUT_${vendorId}_${Date.now()}`
    });

    return payout;
  },

  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BusinessLogicError('Razorpay webhook secret is not configured');
    }

    const rawString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawString)
      .digest('hex');

    return expectedSignature === signature;
  },

  async handleWebhook(payload: any, signature: string): Promise<boolean> {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return expectedSignature === signature;
  }
};

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RazorpayService = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const errors_1 = require("../utils/errors");
let razorpayClient = null;
const getRazorpay = () => {
    if (razorpayClient)
        return razorpayClient;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        throw new errors_1.BusinessLogicError('Razorpay is not configured');
    }
    razorpayClient = new razorpay_1.default({
        key_id: keyId,
        key_secret: keySecret
    });
    return razorpayClient;
};
exports.RazorpayService = {
    async createOrder(amount, orderId) {
        const razorpay = getRazorpay();
        const rupees = Number(amount);
        const amountPaise = Math.round(rupees * 100);
        if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
            throw new errors_1.BusinessLogicError('Invalid amount for Razorpay order');
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
    verifyPaymentSignature(orderId, paymentId, signature) {
        const text = `${orderId}|${paymentId}`;
        const generated_signature = crypto_1.default
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(text)
            .digest('hex');
        return generated_signature === signature;
    },
    async capturePayment(paymentId, amount) {
        const razorpay = getRazorpay();
        const rupees = Number(amount);
        const amountPaise = Math.round(rupees * 100);
        if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
            throw new errors_1.BusinessLogicError('Invalid amount for Razorpay capture');
        }
        const payment = await razorpay.payments.capture(paymentId, amountPaise, 'INR');
        return payment;
    },
    async processRefund(paymentId, amount, notes) {
        const razorpay = getRazorpay();
        const rupees = Number(amount);
        const amountPaise = Math.round(rupees * 100);
        if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
            throw new errors_1.BusinessLogicError('Invalid amount for Razorpay refund');
        }
        const refund = await razorpay.payments.refund(paymentId, {
            amount: amountPaise,
            speed: 'normal',
            notes
        });
        return refund;
    },
    async createPayout(vendorId, amount, accountNumber, ifsc) {
        const razorpay = getRazorpay();
        // Razorpay X payout
        const payout = await razorpay.payouts.create({
            account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
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
    verifyWebhookSignature(rawBody, signature) {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            throw new errors_1.BusinessLogicError('Razorpay webhook secret is not configured');
        }
        const rawString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
        const expectedSignature = crypto_1.default
            .createHmac('sha256', webhookSecret)
            .update(rawString)
            .digest('hex');
        return expectedSignature === signature;
    },
    async handleWebhook(payload, signature) {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const expectedSignature = crypto_1.default
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(payload))
            .digest('hex');
        return expectedSignature === signature;
    }
};

declare module 'razorpay' {
  export default class Razorpay {
    constructor(options: { key_id: string; key_secret: string });
    orders: {
      create(options: any): Promise<any>;
    };
    payments: {
      capture(paymentId: string, amount: number, currency: string): Promise<any>;
      refund(paymentId: string, options: any): Promise<any>;
    };
    payouts: {
      create(options: any): Promise<any>;
    };
  }
}

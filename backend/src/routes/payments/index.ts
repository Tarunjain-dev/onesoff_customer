import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { PaymentController } from '../../controllers/PaymentController';

const router = Router();

router.post('/razorpay/webhook', PaymentController.razorpayWebhook);
router.post('/razorpay/init', authenticate, authorize(['CUSTOMER']), PaymentController.initRazorpay);
router.post('/razorpay/verify', authenticate, authorize(['CUSTOMER']), PaymentController.verifyRazorpay);
router.post('/razorpay/cancel', authenticate, authorize(['CUSTOMER']), PaymentController.cancelRazorpay);
router.post('/payment-failure', authenticate, authorize(['CUSTOMER']), PaymentController.handlePaymentFailure);

export default router;

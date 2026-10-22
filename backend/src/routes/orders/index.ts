import { Router } from 'express';
import { OrderController } from '../../controllers/OrderController';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

// Customer routes
router.post('/create', authenticate, authorize(['CUSTOMER']), OrderController.createOrder);
router.get('/customer', authenticate, authorize(['CUSTOMER']), OrderController.getCustomerOrders);
router.post('/customer/:orderId/cancel', authenticate, authorize(['CUSTOMER']), OrderController.cancelCustomerOrder);
router.post('/review', authenticate, authorize(['CUSTOMER']), OrderController.submitReview);

// Vendor routes
router.get('/vendor', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), OrderController.getVendorOrders);
router.put('/vendor/status', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), OrderController.updateOrderStatus);

export default router;

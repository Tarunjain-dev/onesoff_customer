import { Router } from 'express';
import { CouponController } from '../../controllers/CouponController';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

// Admin routes
router.post('/', authenticate, authorize(['ADMIN']), CouponController.createCoupon);
router.get('/', authenticate, authorize(['ADMIN']), CouponController.getCoupons);
router.patch('/:id', authenticate, authorize(['ADMIN']), CouponController.updateCoupon);
router.patch('/:id/toggle', authenticate, authorize(['ADMIN']), CouponController.toggleCoupon);
router.delete('/:id', authenticate, authorize(['ADMIN']), CouponController.deleteCoupon);

// Customer routes
router.get('/first-order-offer', authenticate, authorize(['CUSTOMER']), CouponController.getFirstOrderOffer);
router.post('/validate', authenticate, authorize(['CUSTOMER']), CouponController.validateCoupon);

export default router;

import { Router } from 'express';
import { ReviewController } from '../../controllers/ReviewController';

const router = Router();

router.get('/vendors/:vendorId', ReviewController.getVendorReviews);
router.get('/products/:productId', ReviewController.getProductReviews);

export default router;

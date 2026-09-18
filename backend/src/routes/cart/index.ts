import { Router } from 'express';
import { CartController } from '../../controllers/CartController';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

// Allow both customer and vendor accounts to use the cart routes (useful during testing and for hybrid users)
router.get('/', authenticate, authorize(['CUSTOMER', 'VENDOR']), CartController.getCart);
router.post('/add', authenticate, authorize(['CUSTOMER', 'VENDOR']), CartController.addToCart);
router.delete('/remove/:itemId', authenticate, authorize(['CUSTOMER', 'VENDOR']), CartController.removeFromCart);
router.delete('/clear', authenticate, authorize(['CUSTOMER', 'VENDOR']), CartController.clearCart);

export default router;

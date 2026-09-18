import { Router } from 'express';
import { ProductController } from '../../controllers/ProductController';
import { authenticate, authorize } from '../../middlewares/auth';
import { upload } from '../../config/multer';

const router = Router();

router.post('/', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), upload.array('images'), ProductController.createProduct);
router.get('/', ProductController.getProducts);
router.get('/:id', ProductController.getProduct);
router.get('/:id/rental-availability/calendar', ProductController.getRentalAvailabilityCalendar);
router.post('/:id/approval-response', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), ProductController.respondToApprovalFlow);
router.post('/:id/withdrawal-request', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), ProductController.requestWithdrawal);
router.patch('/:id', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), upload.array('images'), ProductController.updateProduct);
router.delete('/:id', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), ProductController.deleteProduct);
router.post('/:id/variants', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), ProductController.addVariant);
router.patch('/:id/variants/:variantId', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), ProductController.updateVariant);
router.delete('/:id/variants/:variantId', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), ProductController.deleteVariant);

export default router;

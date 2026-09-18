import { Router } from 'express';
import { KycController } from '../../controllers/KycController';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

router.post('/upload', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), KycController.uploadKyc);
router.get('/status', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), KycController.getKycStatus);
router.post('/review', authenticate, authorize(['ADMIN']), KycController.reviewKyc);
router.get('/pending', authenticate, authorize(['ADMIN']), KycController.getPendingKyc);

export default router;

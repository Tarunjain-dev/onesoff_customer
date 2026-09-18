import { Router } from 'express';
import { VendorProfileController } from '../../controllers/VendorProfileController';
import { authenticate, authorize } from '../../middlewares/auth';
import { onboardingUpload } from '../../config/multer';

const router = Router();

router.post('/', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), VendorProfileController.createProfile);
router.get('/', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), VendorProfileController.getProfile);
router.get('/application-status', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), VendorProfileController.getApplicationStatus);
router.post(
  '/resubmit-documents',
  authenticate,
  authorize(['VENDOR', 'INDIVIDUAL_VENDOR']),
  onboardingUpload.any(),
  VendorProfileController.resubmitDocuments
);
router.patch('/', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), VendorProfileController.updateProfile);

export default router;

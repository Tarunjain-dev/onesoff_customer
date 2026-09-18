import { Router } from 'express';
import { UploadController } from '../../controllers/UploadController';
import { authenticate, authorize } from '../../middlewares/auth';
import { upload } from '../../config/multer';

const router = Router();

router.post('/vendor-profile', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), upload.single('image'), UploadController.uploadVendorProfileImage);
router.post('/badges', authenticate, authorize(['ADMIN']), upload.single('image'), UploadController.uploadBadgeImage);
router.post('/products', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), upload.array('images', 5), UploadController.uploadProductImages);
router.post('/kyc', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), upload.single('document'), UploadController.uploadKycDocument);
router.delete('/image', authenticate, UploadController.deleteImage);

export default router;

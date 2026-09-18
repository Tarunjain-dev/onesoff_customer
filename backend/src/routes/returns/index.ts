import { Router } from 'express';
import { ReturnController } from '../../controllers/ReturnController';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

// Customer routes
router.post('/initiate', authenticate, authorize(['CUSTOMER']), ReturnController.initiateReturn);
router.get('/customer', authenticate, authorize(['CUSTOMER']), ReturnController.getCustomerReturns);

// Vendor routes
router.post('/vendor/inspection', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), ReturnController.vendorInspection);
router.get('/vendor', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), ReturnController.getVendorReturns);
router.post('/vendor/damage-claim', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), ReturnController.raiseDamageClaim);
router.get('/vendor/damage-claims', authenticate, authorize(['VENDOR', 'INDIVIDUAL_VENDOR']), ReturnController.getVendorDamageClaims);

// Admin routes (MOST CRITICAL)
router.get('/admin/decision', authenticate, authorize(['ADMIN']), ReturnController.getAdminReturnStats);
router.post('/admin/decision', authenticate, authorize(['ADMIN']), ReturnController.adminRefundDecision);
router.get('/admin', authenticate, authorize(['ADMIN']), ReturnController.getAdminReturns);
router.get('/admin/damage-claims', authenticate, authorize(['ADMIN']), ReturnController.getAdminDamageClaims);
router.post('/admin/damage-claims/:claimId/review', authenticate, authorize(['ADMIN']), ReturnController.reviewDamageClaim);

export default router;

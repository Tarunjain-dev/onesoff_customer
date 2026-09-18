import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { TrialRequestController } from '../../controllers/TrialRequestController';

const router = Router();

// Customer routes
router.post('/request', authenticate, authorize(['CUSTOMER']), TrialRequestController.createRequest);
router.get('/customer', authenticate, authorize(['CUSTOMER']), TrialRequestController.getCustomerRequests);
router.get('/customer/:trialRequestId', authenticate, authorize(['CUSTOMER']), TrialRequestController.getCustomerRequestById);

// Vendor routes
router.get('/vendor', authenticate, authorize(['VENDOR']), TrialRequestController.getVendorRequests);
router.post('/vendor/response', authenticate, authorize(['VENDOR']), TrialRequestController.vendorRespond);
router.post('/vendor/start', authenticate, authorize(['VENDOR']), TrialRequestController.vendorStart);
router.post('/vendor/complete', authenticate, authorize(['VENDOR']), TrialRequestController.vendorFinalize);
router.post('/vendor/no-show', authenticate, authorize(['VENDOR']), TrialRequestController.vendorMarkNoShow);

export default router;

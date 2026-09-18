import { Router } from 'express';
import { CustomerController } from '../../controllers/CustomerController';
import { CustomerReviewController } from '../../controllers/CustomerReviewController';
import { ComplaintController } from '../../controllers/ComplaintController';
import { authenticate, authorize } from '../../middlewares/auth';
import { upload } from '../../config/multer';
import {submitContact} from '../../controllers/ContactController';

const router = Router();

router.get('/profile', authenticate, authorize(['CUSTOMER']), CustomerController.getProfile);
router.patch('/profile', authenticate, authorize(['CUSTOMER']), CustomerController.updateProfile);
router.get('/bank-details', authenticate, authorize(['CUSTOMER']), CustomerController.getBankDetails);
router.patch('/bank-details', authenticate, authorize(['CUSTOMER']), CustomerController.upsertBankDetails);
router.get('/wishlist', authenticate, authorize(['CUSTOMER']), CustomerController.getWishlist);
router.post('/wishlist', authenticate, authorize(['CUSTOMER']), CustomerController.addToWishlist);
router.delete('/wishlist/:productId', authenticate, authorize(['CUSTOMER']), CustomerController.removeFromWishlist);
router.get('/refund-details', authenticate, authorize(['CUSTOMER']), CustomerController.getRefundDetails);
router.get('/complaints', authenticate, authorize(['CUSTOMER']), ComplaintController.getCustomerComplaints);
router.get('/complaints/:complaintId', authenticate, authorize(['CUSTOMER']), ComplaintController.getCustomerComplaintDetail);
router.post(
  '/complaints',
  authenticate,
  authorize(['CUSTOMER']),
  upload.array('images', 5),
  ComplaintController.createCustomerComplaint
);
router.patch(
  '/complaints/:complaintId/feedback',
  authenticate,
  authorize(['CUSTOMER']),
  ComplaintController.setCustomerComplaintFeedback
);

// Reviews (Customer)
router.get('/reviews', authenticate, authorize(['CUSTOMER']), CustomerReviewController.getMyReview);
router.patch('/reviews/:reviewId', authenticate, authorize(['CUSTOMER']), CustomerReviewController.updateMyReview);

// contact route
router.post('/contact', submitContact);


export default router;
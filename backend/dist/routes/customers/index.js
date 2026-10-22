"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CustomerController_1 = require("../../controllers/CustomerController");
const CustomerReviewController_1 = require("../../controllers/CustomerReviewController");
const ComplaintController_1 = require("../../controllers/ComplaintController");
const auth_1 = require("../../middlewares/auth");
const multer_1 = require("../../config/multer");
const ContactController_1 = require("../../controllers/ContactController");
const router = (0, express_1.Router)();
router.get('/profile', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), CustomerController_1.CustomerController.getProfile);
router.patch('/profile', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), CustomerController_1.CustomerController.updateProfile);
router.get('/bank-details', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), CustomerController_1.CustomerController.getBankDetails);
router.patch('/bank-details', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), CustomerController_1.CustomerController.upsertBankDetails);
router.get('/wishlist', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), CustomerController_1.CustomerController.getWishlist);
router.post('/wishlist', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), CustomerController_1.CustomerController.addToWishlist);
router.delete('/wishlist/:productId', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), CustomerController_1.CustomerController.removeFromWishlist);
router.get('/refund-details', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), CustomerController_1.CustomerController.getRefundDetails);
router.get('/complaints', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), ComplaintController_1.ComplaintController.getCustomerComplaints);
router.get('/complaints/:complaintId', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), ComplaintController_1.ComplaintController.getCustomerComplaintDetail);
router.post('/complaints', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), multer_1.upload.array('images', 5), ComplaintController_1.ComplaintController.createCustomerComplaint);
router.patch('/complaints/:complaintId/feedback', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), ComplaintController_1.ComplaintController.setCustomerComplaintFeedback);
// Reviews (Customer)
router.get('/reviews', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), CustomerReviewController_1.CustomerReviewController.getMyReview);
router.patch('/reviews/:reviewId', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), CustomerReviewController_1.CustomerReviewController.updateMyReview);
// contact route
router.post('/contact', ContactController_1.submitContact);
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ReturnController_1 = require("../../controllers/ReturnController");
const auth_1 = require("../../middlewares/auth");
const router = (0, express_1.Router)();
// Customer routes
router.post('/initiate', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), ReturnController_1.ReturnController.initiateReturn);
router.get('/customer', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), ReturnController_1.ReturnController.getCustomerReturns);
// Vendor routes
router.post('/vendor/inspection', auth_1.authenticate, (0, auth_1.authorize)(['VENDOR', 'INDIVIDUAL_VENDOR']), ReturnController_1.ReturnController.vendorInspection);
router.get('/vendor', auth_1.authenticate, (0, auth_1.authorize)(['VENDOR', 'INDIVIDUAL_VENDOR']), ReturnController_1.ReturnController.getVendorReturns);
router.post('/vendor/damage-claim', auth_1.authenticate, (0, auth_1.authorize)(['VENDOR', 'INDIVIDUAL_VENDOR']), ReturnController_1.ReturnController.raiseDamageClaim);
router.get('/vendor/damage-claims', auth_1.authenticate, (0, auth_1.authorize)(['VENDOR', 'INDIVIDUAL_VENDOR']), ReturnController_1.ReturnController.getVendorDamageClaims);
// Admin routes (MOST CRITICAL)
router.get('/admin/decision', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), ReturnController_1.ReturnController.getAdminReturnStats);
router.post('/admin/decision', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), ReturnController_1.ReturnController.adminRefundDecision);
router.get('/admin', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), ReturnController_1.ReturnController.getAdminReturns);
router.get('/admin/damage-claims', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), ReturnController_1.ReturnController.getAdminDamageClaims);
router.post('/admin/damage-claims/:claimId/review', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), ReturnController_1.ReturnController.reviewDamageClaim);
exports.default = router;

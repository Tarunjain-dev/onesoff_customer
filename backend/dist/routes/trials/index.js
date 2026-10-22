"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const TrialRequestController_1 = require("../../controllers/TrialRequestController");
const router = (0, express_1.Router)();
// Customer routes
router.post('/request', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), TrialRequestController_1.TrialRequestController.createRequest);
router.get('/customer', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), TrialRequestController_1.TrialRequestController.getCustomerRequests);
router.get('/customer/:trialRequestId', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), TrialRequestController_1.TrialRequestController.getCustomerRequestById);
// Vendor routes
router.get('/vendor', auth_1.authenticate, (0, auth_1.authorize)(['VENDOR']), TrialRequestController_1.TrialRequestController.getVendorRequests);
router.post('/vendor/response', auth_1.authenticate, (0, auth_1.authorize)(['VENDOR']), TrialRequestController_1.TrialRequestController.vendorRespond);
router.post('/vendor/start', auth_1.authenticate, (0, auth_1.authorize)(['VENDOR']), TrialRequestController_1.TrialRequestController.vendorStart);
router.post('/vendor/complete', auth_1.authenticate, (0, auth_1.authorize)(['VENDOR']), TrialRequestController_1.TrialRequestController.vendorFinalize);
router.post('/vendor/no-show', auth_1.authenticate, (0, auth_1.authorize)(['VENDOR']), TrialRequestController_1.TrialRequestController.vendorMarkNoShow);
exports.default = router;

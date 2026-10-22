"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const OrderController_1 = require("../../controllers/OrderController");
const auth_1 = require("../../middlewares/auth");
const router = (0, express_1.Router)();
// Customer routes
router.post('/create', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), OrderController_1.OrderController.createOrder);
router.get('/customer', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), OrderController_1.OrderController.getCustomerOrders);
router.post('/customer/:orderId/cancel', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), OrderController_1.OrderController.cancelCustomerOrder);
router.post('/review', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), OrderController_1.OrderController.submitReview);
// Vendor routes
router.get('/vendor', auth_1.authenticate, (0, auth_1.authorize)(['VENDOR', 'INDIVIDUAL_VENDOR']), OrderController_1.OrderController.getVendorOrders);
router.put('/vendor/status', auth_1.authenticate, (0, auth_1.authorize)(['VENDOR', 'INDIVIDUAL_VENDOR']), OrderController_1.OrderController.updateOrderStatus);
exports.default = router;

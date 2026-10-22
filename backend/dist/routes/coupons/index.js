"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CouponController_1 = require("../../controllers/CouponController");
const auth_1 = require("../../middlewares/auth");
const router = (0, express_1.Router)();
// Admin routes
router.post('/', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), CouponController_1.CouponController.createCoupon);
router.get('/', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), CouponController_1.CouponController.getCoupons);
router.patch('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), CouponController_1.CouponController.updateCoupon);
router.patch('/:id/toggle', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), CouponController_1.CouponController.toggleCoupon);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), CouponController_1.CouponController.deleteCoupon);
// Customer routes
router.get('/first-order-offer', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), CouponController_1.CouponController.getFirstOrderOffer);
router.post('/validate', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER']), CouponController_1.CouponController.validateCoupon);
exports.default = router;

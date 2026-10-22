"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CartController_1 = require("../../controllers/CartController");
const auth_1 = require("../../middlewares/auth");
const router = (0, express_1.Router)();
// Allow both customer and vendor accounts to use the cart routes (useful during testing and for hybrid users)
router.get('/', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER', 'VENDOR']), CartController_1.CartController.getCart);
router.post('/add', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER', 'VENDOR']), CartController_1.CartController.addToCart);
router.delete('/remove/:itemId', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER', 'VENDOR']), CartController_1.CartController.removeFromCart);
router.delete('/clear', auth_1.authenticate, (0, auth_1.authorize)(['CUSTOMER', 'VENDOR']), CartController_1.CartController.clearCart);
exports.default = router;

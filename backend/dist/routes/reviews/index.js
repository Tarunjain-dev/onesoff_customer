"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ReviewController_1 = require("../../controllers/ReviewController");
const router = (0, express_1.Router)();
router.get('/vendors/:vendorId', ReviewController_1.ReviewController.getVendorReviews);
router.get('/products/:productId', ReviewController_1.ReviewController.getProductReviews);
exports.default = router;

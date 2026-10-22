"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthController_1 = require("@/controllers/AuthController");
const multer_1 = require("@/config/multer");
const rateLimiter_1 = require("@/middlewares/rateLimiter");
const auth_1 = require("@/middlewares/auth");
const router = (0, express_1.Router)();
const vendorRegistrationUploadFields = [
    { name: 'shopLogoFile', maxCount: 1 },
    { name: 'idProofFile', maxCount: 1 },
    { name: 'selfieFile', maxCount: 1 },
    { name: 'businessProofFile', maxCount: 1 },
    { name: 'storeInteriorPhoto', maxCount: 1 },
    { name: 'storeExteriorPhoto', maxCount: 1 },
    { name: 'outfitImage', maxCount: 1 }
];
//customer
router.post("/register", AuthController_1.AuthController.register);
router.post("/login", AuthController_1.AuthController.login);
router.post("/send-otp", rateLimiter_1.otpRateLimit, AuthController_1.AuthController.sendCustomerOtp);
router.post("/verify-otp", AuthController_1.AuthController.verifyCustomerOtp);
router.post("/admin/send-otp", rateLimiter_1.otpRateLimit, AuthController_1.AuthController.sendAdminOtp);
router.post("/admin/verify-otp", AuthController_1.AuthController.verifyAdminOtp);
router.get("/customer/profile", auth_1.authenticate, (0, auth_1.authorize)(["CUSTOMER"]), AuthController_1.AuthController.getCustomerProfile);
//vendor
router.post("/vendor/register", multer_1.onboardingUpload.fields(vendorRegistrationUploadFields), AuthController_1.AuthController.registerVendor);
router.post("/vendor/register/send-otp", rateLimiter_1.otpRateLimit, AuthController_1.AuthController.sendVendorRegistrationOtp);
router.post("/vendor/register/verify-otp", AuthController_1.AuthController.verifyVendorRegistrationOtp);
router.post("/vendor/send-otp", rateLimiter_1.otpRateLimit, AuthController_1.AuthController.sendVendorOtp);
router.post("/vendor/verify-otp", AuthController_1.AuthController.verifyVendorOtp);
router.post("/refresh", AuthController_1.AuthController.refresh);
router.post("/logout", AuthController_1.AuthController.logout);
exports.default = router;

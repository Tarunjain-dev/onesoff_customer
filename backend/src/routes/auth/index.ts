import { Router } from "express";
import { AuthController } from "@/controllers/AuthController";
import { onboardingUpload } from "@/config/multer";
import { otpRateLimit } from "@/middlewares/rateLimiter";
import { authenticate, authorize } from "@/middlewares/auth";


const router = Router();
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
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/send-otp", otpRateLimit, AuthController.sendCustomerOtp);
router.post("/verify-otp", AuthController.verifyCustomerOtp);
router.post("/admin/send-otp", otpRateLimit, AuthController.sendAdminOtp);
router.post("/admin/verify-otp", AuthController.verifyAdminOtp);
router.get("/customer/profile", authenticate, authorize(["CUSTOMER"]), AuthController.getCustomerProfile);


//vendor
router.post(
  "/vendor/register",
  onboardingUpload.fields(vendorRegistrationUploadFields),
  AuthController.registerVendor
);
router.post("/vendor/register/send-otp", otpRateLimit, AuthController.sendVendorRegistrationOtp);
router.post("/vendor/register/verify-otp", AuthController.verifyVendorRegistrationOtp);
router.post("/vendor/send-otp", otpRateLimit, AuthController.sendVendorOtp);
router.post("/vendor/verify-otp", AuthController.verifyVendorOtp);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);

export default router;

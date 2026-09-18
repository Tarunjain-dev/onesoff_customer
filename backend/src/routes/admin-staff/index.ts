import { Router } from "express";
import { AdminStaffController } from "@/controllers/AdminStaffController";
import { authenticate, authorize } from "@/middlewares/auth";

const router = Router();

router.post(
  "/register",
  authenticate,
  authorize(["ADMIN"]),
  AdminStaffController.registerAdminStaff
);

router.get(
  "/profile",
  authenticate,
  authorize(["ADMIN"]),
  (req, res) => {
    res.json({
      success: true,
      data: req.user
    });
  }
);

router.patch(
  "/:id/status",
  authenticate,
  authorize(["ADMIN"]),
  AdminStaffController.updateAdminStaffStatus
);

router.get(
  "/:id",
  authenticate,
  authorize(["ADMIN"]),
  AdminStaffController.getAdminStaffById
);

router.get(
  "/",
  authenticate,
  authorize(["ADMIN"]),
  AdminStaffController.getAllAdminStaff
);

export default router;

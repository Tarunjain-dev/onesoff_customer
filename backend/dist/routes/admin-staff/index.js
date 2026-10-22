"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AdminStaffController_1 = require("@/controllers/AdminStaffController");
const auth_1 = require("@/middlewares/auth");
const router = (0, express_1.Router)();
router.post("/register", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), AdminStaffController_1.AdminStaffController.registerAdminStaff);
router.get("/profile", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), (req, res) => {
    res.json({
        success: true,
        data: req.user
    });
});
router.patch("/:id/status", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), AdminStaffController_1.AdminStaffController.updateAdminStaffStatus);
router.get("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), AdminStaffController_1.AdminStaffController.getAdminStaffById);
router.get("/", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), AdminStaffController_1.AdminStaffController.getAllAdminStaff);
exports.default = router;

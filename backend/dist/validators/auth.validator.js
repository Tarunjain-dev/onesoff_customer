"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.otpSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
// Password strength validation
const passwordSchema = zod_1.z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number");
const phoneSchema = zod_1.z.string()
    .regex(/^[6-9]\d{9}$/, "Invalid Indian phone number");
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Name must be at least 2 characters"),
    email: zod_1.z.string().email().optional(),
    phone: phoneSchema.optional(),
    password: passwordSchema
}).refine(data => data.email || data.phone, {
    message: "Either email or phone is required"
});
exports.loginSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(1, "Email or phone is required"),
    password: zod_1.z.string().min(1, "Password is required")
});
exports.otpSchema = zod_1.z.object({
    phone: phoneSchema,
    otp: zod_1.z.string().length(6, "OTP must be 6 digits")
});

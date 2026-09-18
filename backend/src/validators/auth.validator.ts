import { z } from "zod";

// Password strength validation
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const phoneSchema = z.string()
  .regex(/^[6-9]\d{9}$/, "Invalid Indian phone number");

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email().optional(),
  phone: phoneSchema.optional(),
  password: passwordSchema
}).refine(data => data.email || data.phone, {
  message: "Either email or phone is required"
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required")
});

export const otpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, "OTP must be 6 digits")
});

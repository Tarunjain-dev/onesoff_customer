import { Request, Response } from "express";
import { z } from "zod";
import { AdminStaffService } from "@/services/AdminStaffService";
import { sanitizeClientErrorMessage } from "@/utils/clientErrorMessage";

const ADMIN_STAFF_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'] as const;

const registerAdminStaffSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .regex(/^[a-zA-Z\s]+$/, "Name must contain only letters and spaces"),
  email: z.union([z.string().email("Invalid email format"), z.literal('')]).optional(),
  phone: z
    .string()
    .regex(/^[+]?[0-9]{10,15}$/, "Phone must be 10-15 digits with optional + prefix"),
  status: z.enum(ADMIN_STAFF_STATUS_VALUES).optional()
});

export const AdminStaffController = {
  async registerAdminStaff(req: Request, res: Response) {
    try {
      const data = registerAdminStaffSchema.parse(req.body);
      const normalizedData = {
        ...data,
        email: data.email || undefined,
        status: data.status || 'ACTIVE'
      };
      const staff = await AdminStaffService.registerAdminStaff(normalizedData);
      res.status(201).json({
        success: true,
        message: "Admin staff registered successfully",
        data: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
          status: staff.status,
          onboardingStatus: staff.onboardingStatus,
          createdAt: staff.createdAt
        }
      });
    } catch (error) {
      const message = sanitizeClientErrorMessage(
        error,
        "Admin staff registration failed"
      );
      res.status(400).json({ success: false, error: message });
    }
  },

  async getAllAdminStaff(req: Request, res: Response) {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      if (offset < 0) {
        return res.status(400).json({ success: false, error: "Offset must be non-negative" });
      }

      const result = await AdminStaffService.getAllAdminStaff(limit, offset);
      res.json({
        success: true,
        message: "Admin staff retrieved successfully",
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      const message = sanitizeClientErrorMessage(
        error,
        "Failed to retrieve admin staff"
      );
      res.status(500).json({ success: false, error: message });
    }
  },

  async getAdminStaffById(req: Request, res: Response) {
    try {
      const staffIdParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!staffIdParam) {
        return res.status(400).json({ success: false, error: "Staff id is required" });
      }
      const staffId = BigInt(staffIdParam);
      const staff = await AdminStaffService.getAdminStaffById(staffId);
      res.json({
        success: true,
        message: "Admin staff details retrieved successfully",
        data: staff
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error || '');
      const message = sanitizeClientErrorMessage(
        error,
        "Failed to retrieve staff details"
      );
      const status = rawMessage.toLowerCase().includes("not found") ? 404 : 400;
      res.status(status).json({ success: false, error: message });
    }
  },

  async updateAdminStaffStatus(req: Request, res: Response) {
    try {
      const staffIdParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!staffIdParam) {
        return res.status(400).json({ success: false, error: "Staff id is required" });
      }

      if (!/^\d+$/.test(staffIdParam)) {
        return res.status(400).json({ success: false, error: "Invalid staff id" });
      }

      const { status } = req.body || {};

      if (!status || !ADMIN_STAFF_STATUS_VALUES.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Invalid status value. Must be one of: ACTIVE, INACTIVE, SUSPENDED, PENDING"
        });
      }

      const staff = await AdminStaffService.updateAdminStaffStatus(BigInt(staffIdParam), status);
      res.json({
        success: true,
        message: "Staff status updated successfully",
        data: staff
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error || '');
      const message = sanitizeClientErrorMessage(
        error,
        "Failed to update staff status"
      );
      const status = rawMessage.toLowerCase().includes("not found") ? 404 : 400;
      res.status(status).json({ success: false, error: message });
    }
  }
};

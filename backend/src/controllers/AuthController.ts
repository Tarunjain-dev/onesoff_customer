import { Request, Response } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { AuthService } from "@/services/AuthService";
import { S3Service } from "@/services/S3Service";
import { AuthRequest } from "@/types";
import { sanitizeClientErrorMessage } from "@/utils/clientErrorMessage";

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(1),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(6)
}).refine(data => data.email || data.phone, {
  message: "Either email or phone is required"
});

const registerVendorSchema = z.object({
  name: z.string().min(1),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(6),
  shopName: z.string().min(1),
  ownerName: z.string().min(1),
  businessName: z.string().optional(),
  businessType: z.string().optional(),
  gstNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  aadhaarFront: z.string().optional(),
  aadhaarBack: z.string().optional()
}).passthrough().refine(data => data.email || data.phone, {
  message: "Either email or phone is required"
});

const loginSchema = z.object({
  emailOrPhone: z.string().min(1),
  password: z.string().min(1),
  role: z.nativeEnum(UserRole)
});

const vendorOtpSchema = z.object({
  phone: z.string().min(10)
});
const adminOtpSendSchema = z.object({
  emailOrPhone: z.string().min(1)
});

const verifyOtpSchema = z.object({
  phone: z.string().min(10),
  otp: z.string().length(6)
});
const verifyAdminOtpSchema = z.object({
  emailOrPhone: z.string().min(1),
  otp: z.string().length(6)
});
const verifyCustomerOtpSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10),
  otp: z.string().length(6),
  aadhar: z.string().length(12).optional(),
  email: z.union([z.string().email(), z.literal('')]).optional()
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

const optionalRefreshSchema = z.object({
  refreshToken: z.string().min(1).optional()
});

const VENDOR_REGISTRATION_ARRAY_FIELDS = [
  'workingDays',
  'shopCategoriesAvailable',
  'shopTargetAudience',
  'shopSizeRanges'
] as const;

const VENDOR_ONBOARDING_FILE_FIELDS = {
  shopLogoFile: {
    fileNameKey: 'shopLogoFileName',
    urlKey: 'shopLogoUrl',
    isDocument: false
  },
  idProofFile: {
    fileNameKey: 'idProofFileName',
    urlKey: 'idProofUrl',
    isDocument: true
  },
  selfieFile: {
    fileNameKey: 'selfieFileName',
    urlKey: 'selfieUrl',
    isDocument: false
  },
  businessProofFile: {
    fileNameKey: 'businessProofFileName',
    urlKey: 'businessProofUrl',
    isDocument: true
  },
  storeInteriorPhoto: {
    fileNameKey: 'storeInteriorPhotoFileName',
    urlKey: 'storeInteriorPhotoUrl',
    isDocument: false
  },
  storeExteriorPhoto: {
    fileNameKey: 'storeExteriorPhotoFileName',
    urlKey: 'storeExteriorPhotoUrl',
    isDocument: false
  },
  outfitImage: {
    fileNameKey: 'outfitImageFileName',
    urlKey: 'outfitImageUrl',
    isDocument: false
  }
} as const;

const normalizeStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry || '').trim()).filter(Boolean);
      }
    } catch {
      // Fallback to CSV parsing below.
    }
  }

  return trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const normalizeVendorRegistrationBody = (body: Record<string, unknown>) => {
  const normalized: Record<string, unknown> = { ...body };

  for (const field of VENDOR_REGISTRATION_ARRAY_FIELDS) {
    if (field in normalized) {
      normalized[field] = normalizeStringArray(normalized[field]);
    }
  }

  return normalized;
};

const uploadVendorOnboardingFiles = async (files: Request['files']) => {
  if (!files || Array.isArray(files)) {
    return {};
  }

  const payload: Record<string, unknown> = {};

  for (const [field, config] of Object.entries(VENDOR_ONBOARDING_FILE_FIELDS)) {
    const fileList = files[field];
    const file = Array.isArray(fileList) ? fileList[0] : undefined;

    if (!file) continue;

    const fileUrl = config.isDocument
      ? await S3Service.uploadDocument(file, 'vendor-onboarding')
      : await S3Service.uploadImage(file, 'vendor-onboarding');

    payload[config.fileNameKey] = file.originalname;
    payload[config.urlKey] = fileUrl;
  }

  return payload;
};

const hasBlockedIndicator = (error: unknown) =>
  String(error instanceof Error ? error.message : error || '')
    .toLowerCase()
    .includes('blocked');

const getClientMessage = (error: unknown, fallback: string) =>
  sanitizeClientErrorMessage(error, fallback);

const getSessionContext = (req: Request) => ({
  deviceInfo: req.get('user-agent') || null,
  ipAddress: req.ip || null
});

export const AuthController = {
  async registerVendor(req: Request, res: Response) {
    try {
      const uploadedFiles = await uploadVendorOnboardingFiles(req.files);
      const normalizedPayload = normalizeVendorRegistrationBody({
        ...(req.body as Record<string, unknown>),
        ...uploadedFiles
      });
      const data = registerVendorSchema.parse(normalizedPayload);
      const normalizedData = {
        ...data,
        email: data.email || undefined
      };
      const vendor = await AuthService.registerVendor(normalizedData);
      res.status(201).json({ success: true, data: vendor });
    } catch (error) {
      const message = getClientMessage(error, "Vendor registration failed");
      res.status(400).json({ success: false, error: message });
    }
  },

  async register(req: Request, res: Response) {
    try {
      const data = registerSchema.parse(req.body);
      const normalizedData = {
        ...data,
        email: data.email || undefined
      };
      const user = await AuthService.registerCustomer(normalizedData);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      const message = getClientMessage(error, "Registration failed");
      res.status(400).json({ success: false, error: message });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await AuthService.login(data, getSessionContext(req));
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getClientMessage(error, "Login failed");
      const status = hasBlockedIndicator(error) ? 401 : 400;
      res.status(status).json({ success: false, error: message });
    }
  },

  async sendVendorOtp(req: Request, res: Response) {
    try {
      const { phone } = vendorOtpSchema.parse(req.body);
      const result = await AuthService.sendVendorOtp(phone);
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getClientMessage(error, "Failed to send OTP");
      const status = hasBlockedIndicator(error) ? 401 : 400;
      res.status(status).json({ success: false, error: message });
    }
  },

  async sendVendorRegistrationOtp(req: Request, res: Response) {
    try {
      const { phone } = vendorOtpSchema.parse(req.body);
      const result = await AuthService.sendVendorRegistrationOtp(phone);
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getClientMessage(error, "Failed to send OTP");
      const status = hasBlockedIndicator(error) ? 401 : 400;
      res.status(status).json({ success: false, error: message });
    }
  },

  async sendCustomerOtp(req: Request, res: Response) {
    try {
      const { phone } = vendorOtpSchema.parse(req.body);
      const result = await AuthService.sendCustomerOtp(phone);
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getClientMessage(error, "Failed to send OTP");
      const status = hasBlockedIndicator(error) ? 401 : 400;
      res.status(status).json({ success: false, error: message });
    }
  },

  async sendAdminOtp(req: Request, res: Response) {
    try {
      const { emailOrPhone } = adminOtpSendSchema.parse(req.body);
      const result = await AuthService.sendAdminOtp(emailOrPhone);
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getClientMessage(error, "Failed to send OTP");
      const status = hasBlockedIndicator(error) ? 401 : 400;
      res.status(status).json({ success: false, error: message });
    }
  },

  async verifyVendorOtp(req: Request, res: Response) {
    try {
      const { phone, otp } = verifyOtpSchema.parse(req.body);
      const result = await AuthService.verifyVendorOtp(phone, otp, getSessionContext(req));
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getClientMessage(error, "OTP verification failed");
      const status = hasBlockedIndicator(error) ? 401 : 400;
      res.status(status).json({ success: false, error: message });
    }
  },

  async verifyVendorRegistrationOtp(req: Request, res: Response) {
    try {
      const { phone, otp } = verifyOtpSchema.parse(req.body);
      const result = await AuthService.verifyVendorRegistrationOtp(phone, otp);
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getClientMessage(error, "OTP verification failed");
      const status = hasBlockedIndicator(error) ? 401 : 400;
      res.status(status).json({ success: false, error: message });
    }
  },

  async verifyCustomerOtp(req: Request, res: Response) {
    try {
      const { name, phone, otp, aadhar, email } = verifyCustomerOtpSchema.parse(req.body);
      const result = await AuthService.verifyCustomerOtp(
        phone,
        otp,
        aadhar,
        name,
        email && email.trim() ? email.trim() : undefined,
        getSessionContext(req)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getClientMessage(error, "OTP verification failed");
      const status = hasBlockedIndicator(error) ? 401 : 400;
      res.status(status).json({ success: false, error: message });
    }
  },

  async verifyAdminOtp(req: Request, res: Response) {
    try {
      const { emailOrPhone, otp } = verifyAdminOtpSchema.parse(req.body);
      const result = await AuthService.verifyAdminOtp(
        emailOrPhone,
        otp,
        getSessionContext(req)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getClientMessage(error, "OTP verification failed");
      const status = hasBlockedIndicator(error) ? 401 : 400;
      res.status(status).json({ success: false, error: message });
    }
  },

  async getCustomerProfile(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      const result = await AuthService.getCustomerProfile(customerId);
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getClientMessage(error, "Failed to fetch profile");
      res.status(400).json({ success: false, error: message });
    }
  },

  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const result = await AuthService.refreshToken(refreshToken, getSessionContext(req));
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getClientMessage(error, "Token refresh failed");
      res.status(401).json({ success: false, error: message });
    }
  },

  async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = optionalRefreshSchema.parse(req.body ?? {});
      const result = await AuthService.logout(
        refreshToken,
        req.headers.authorization
      );
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getClientMessage(error, "Logout failed");
      res.status(400).json({ success: false, error: message });
    }
  }
};

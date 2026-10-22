"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const AuthService_1 = require("@/services/AuthService");
const S3Service_1 = require("@/services/S3Service");
const clientErrorMessage_1 = require("@/utils/clientErrorMessage");
// Validation schemas
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    email: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal('')]).optional(),
    phone: zod_1.z.string().min(10).optional(),
    password: zod_1.z.string().min(6)
}).refine(data => data.email || data.phone, {
    message: "Either email or phone is required"
});
const registerVendorSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    email: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal('')]).optional(),
    phone: zod_1.z.string().min(10).optional(),
    password: zod_1.z.string().min(6),
    shopName: zod_1.z.string().min(1),
    ownerName: zod_1.z.string().min(1),
    businessName: zod_1.z.string().optional(),
    businessType: zod_1.z.string().optional(),
    gstNumber: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    pincode: zod_1.z.string().optional(),
    aadhaarNumber: zod_1.z.string().optional(),
    aadhaarFront: zod_1.z.string().optional(),
    aadhaarBack: zod_1.z.string().optional()
}).passthrough().refine(data => data.email || data.phone, {
    message: "Either email or phone is required"
});
const loginSchema = zod_1.z.object({
    emailOrPhone: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1),
    role: zod_1.z.nativeEnum(client_1.UserRole)
});
const vendorOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10)
});
const adminOtpSendSchema = zod_1.z.object({
    emailOrPhone: zod_1.z.string().min(1)
});
const verifyOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10),
    otp: zod_1.z.string().length(6)
});
const verifyAdminOtpSchema = zod_1.z.object({
    emailOrPhone: zod_1.z.string().min(1),
    otp: zod_1.z.string().length(6)
});
const verifyCustomerOtpSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    phone: zod_1.z.string().min(10),
    otp: zod_1.z.string().length(6),
    aadhar: zod_1.z.string().length(12).optional(),
    email: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal('')]).optional()
});
const refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1)
});
const optionalRefreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1).optional()
});
const VENDOR_REGISTRATION_ARRAY_FIELDS = [
    'workingDays',
    'shopCategoriesAvailable',
    'shopTargetAudience',
    'shopSizeRanges'
];
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
};
const normalizeStringArray = (value) => {
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
        }
        catch {
            // Fallback to CSV parsing below.
        }
    }
    return trimmed
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
};
const normalizeVendorRegistrationBody = (body) => {
    const normalized = { ...body };
    for (const field of VENDOR_REGISTRATION_ARRAY_FIELDS) {
        if (field in normalized) {
            normalized[field] = normalizeStringArray(normalized[field]);
        }
    }
    return normalized;
};
const uploadVendorOnboardingFiles = async (files) => {
    if (!files || Array.isArray(files)) {
        return {};
    }
    const payload = {};
    for (const [field, config] of Object.entries(VENDOR_ONBOARDING_FILE_FIELDS)) {
        const fileList = files[field];
        const file = Array.isArray(fileList) ? fileList[0] : undefined;
        if (!file)
            continue;
        const fileUrl = config.isDocument
            ? await S3Service_1.S3Service.uploadDocument(file, 'vendor-onboarding')
            : await S3Service_1.S3Service.uploadImage(file, 'vendor-onboarding');
        payload[config.fileNameKey] = file.originalname;
        payload[config.urlKey] = fileUrl;
    }
    return payload;
};
const hasBlockedIndicator = (error) => String(error instanceof Error ? error.message : error || '')
    .toLowerCase()
    .includes('blocked');
const getClientMessage = (error, fallback) => (0, clientErrorMessage_1.sanitizeClientErrorMessage)(error, fallback);
const getSessionContext = (req) => ({
    deviceInfo: req.get('user-agent') || null,
    ipAddress: req.ip || null
});
exports.AuthController = {
    async registerVendor(req, res) {
        try {
            const uploadedFiles = await uploadVendorOnboardingFiles(req.files);
            const normalizedPayload = normalizeVendorRegistrationBody({
                ...req.body,
                ...uploadedFiles
            });
            const data = registerVendorSchema.parse(normalizedPayload);
            const normalizedData = {
                ...data,
                email: data.email || undefined
            };
            const vendor = await AuthService_1.AuthService.registerVendor(normalizedData);
            res.status(201).json({ success: true, data: vendor });
        }
        catch (error) {
            const message = getClientMessage(error, "Vendor registration failed");
            res.status(400).json({ success: false, error: message });
        }
    },
    async register(req, res) {
        try {
            const data = registerSchema.parse(req.body);
            const normalizedData = {
                ...data,
                email: data.email || undefined
            };
            const user = await AuthService_1.AuthService.registerCustomer(normalizedData);
            res.status(201).json({ success: true, data: user });
        }
        catch (error) {
            const message = getClientMessage(error, "Registration failed");
            res.status(400).json({ success: false, error: message });
        }
    },
    async login(req, res) {
        try {
            const data = loginSchema.parse(req.body);
            const result = await AuthService_1.AuthService.login(data, getSessionContext(req));
            res.json({ success: true, data: result });
        }
        catch (error) {
            const message = getClientMessage(error, "Login failed");
            const status = hasBlockedIndicator(error) ? 401 : 400;
            res.status(status).json({ success: false, error: message });
        }
    },
    async sendVendorOtp(req, res) {
        try {
            const { phone } = vendorOtpSchema.parse(req.body);
            const result = await AuthService_1.AuthService.sendVendorOtp(phone);
            res.json({ success: true, data: result });
        }
        catch (error) {
            const message = getClientMessage(error, "Failed to send OTP");
            const status = hasBlockedIndicator(error) ? 401 : 400;
            res.status(status).json({ success: false, error: message });
        }
    },
    async sendVendorRegistrationOtp(req, res) {
        try {
            const { phone } = vendorOtpSchema.parse(req.body);
            const result = await AuthService_1.AuthService.sendVendorRegistrationOtp(phone);
            res.json({ success: true, data: result });
        }
        catch (error) {
            const message = getClientMessage(error, "Failed to send OTP");
            const status = hasBlockedIndicator(error) ? 401 : 400;
            res.status(status).json({ success: false, error: message });
        }
    },
    async sendCustomerOtp(req, res) {
        try {
            const { phone } = vendorOtpSchema.parse(req.body);
            const result = await AuthService_1.AuthService.sendCustomerOtp(phone);
            res.json({ success: true, data: result });
        }
        catch (error) {
            const message = getClientMessage(error, "Failed to send OTP");
            const status = hasBlockedIndicator(error) ? 401 : 400;
            res.status(status).json({ success: false, error: message });
        }
    },
    async sendAdminOtp(req, res) {
        try {
            const { emailOrPhone } = adminOtpSendSchema.parse(req.body);
            const result = await AuthService_1.AuthService.sendAdminOtp(emailOrPhone);
            res.json({ success: true, data: result });
        }
        catch (error) {
            const message = getClientMessage(error, "Failed to send OTP");
            const status = hasBlockedIndicator(error) ? 401 : 400;
            res.status(status).json({ success: false, error: message });
        }
    },
    async verifyVendorOtp(req, res) {
        try {
            const { phone, otp } = verifyOtpSchema.parse(req.body);
            const result = await AuthService_1.AuthService.verifyVendorOtp(phone, otp, getSessionContext(req));
            res.json({ success: true, data: result });
        }
        catch (error) {
            const message = getClientMessage(error, "OTP verification failed");
            const status = hasBlockedIndicator(error) ? 401 : 400;
            res.status(status).json({ success: false, error: message });
        }
    },
    async verifyVendorRegistrationOtp(req, res) {
        try {
            const { phone, otp } = verifyOtpSchema.parse(req.body);
            const result = await AuthService_1.AuthService.verifyVendorRegistrationOtp(phone, otp);
            res.json({ success: true, data: result });
        }
        catch (error) {
            const message = getClientMessage(error, "OTP verification failed");
            const status = hasBlockedIndicator(error) ? 401 : 400;
            res.status(status).json({ success: false, error: message });
        }
    },
    async verifyCustomerOtp(req, res) {
        try {
            const { name, phone, otp, aadhar, email } = verifyCustomerOtpSchema.parse(req.body);
            const result = await AuthService_1.AuthService.verifyCustomerOtp(phone, otp, aadhar, name, email && email.trim() ? email.trim() : undefined, getSessionContext(req));
            res.json({ success: true, data: result });
        }
        catch (error) {
            const message = getClientMessage(error, "OTP verification failed");
            const status = hasBlockedIndicator(error) ? 401 : 400;
            res.status(status).json({ success: false, error: message });
        }
    },
    async verifyAdminOtp(req, res) {
        try {
            const { emailOrPhone, otp } = verifyAdminOtpSchema.parse(req.body);
            const result = await AuthService_1.AuthService.verifyAdminOtp(emailOrPhone, otp, getSessionContext(req));
            res.json({ success: true, data: result });
        }
        catch (error) {
            const message = getClientMessage(error, "OTP verification failed");
            const status = hasBlockedIndicator(error) ? 401 : 400;
            res.status(status).json({ success: false, error: message });
        }
    },
    async getCustomerProfile(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId) {
                return res.status(401).json({ success: false, error: "Unauthorized" });
            }
            const result = await AuthService_1.AuthService.getCustomerProfile(customerId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            const message = getClientMessage(error, "Failed to fetch profile");
            res.status(400).json({ success: false, error: message });
        }
    },
    async refresh(req, res) {
        try {
            const { refreshToken } = refreshSchema.parse(req.body);
            const result = await AuthService_1.AuthService.refreshToken(refreshToken, getSessionContext(req));
            res.json({ success: true, data: result });
        }
        catch (error) {
            const message = getClientMessage(error, "Token refresh failed");
            res.status(401).json({ success: false, error: message });
        }
    },
    async logout(req, res) {
        try {
            const { refreshToken } = optionalRefreshSchema.parse(req.body ?? {});
            const result = await AuthService_1.AuthService.logout(refreshToken, req.headers.authorization);
            res.json({ success: true, data: result });
        }
        catch (error) {
            const message = getClientMessage(error, "Logout failed");
            res.status(400).json({ success: false, error: message });
        }
    }
};

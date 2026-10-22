"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const db_1 = __importDefault(require("@/config/db"));
const SmsService_1 = require("@/services/SmsService");
const KycService_1 = require("@/services/KycService");
const VendorProfileService_1 = require("./VendorProfileService");
const publicCodes_1 = require("@/utils/publicCodes");
const roles_1 = require("@/utils/roles");
const customerProfileStorage_1 = require("./customerProfileStorage");
const authSession_1 = require("@/utils/authSession");
const logger_1 = __importDefault(require("@/utils/logger"));
const OTP_TTL_MS = 10 * 60 * 1000;
const normalizePhone = (phone) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10)
        return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91'))
        return `+${digits}`;
    if (phone.startsWith('+'))
        return phone;
    return `+${digits}`;
};
const parseCsvEnv = (value) => String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
const normalizePhoneKey = (phone) => {
    const digits = String(phone || "").replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
};
const canUseTestOtp = (otp, ...phones) => {
    const enabled = String(process.env.TEST_OTP_ENABLED || "").toLowerCase() === "true";
    const configuredOtp = String(process.env.TEST_OTP_CODE || "").trim();
    if (!enabled || !configuredOtp || otp !== configuredOtp) {
        return false;
    }
    const allowedPhones = new Set(parseCsvEnv(process.env.TEST_OTP_ALLOWED_PHONES).map((phone) => normalizePhoneKey(phone)));
    return phones.some((phone) => {
        const normalized = normalizePhoneKey(phone);
        return Boolean(normalized) && allowedPhones.has(normalized);
    });
};
const buildPhoneCandidates = (identifier) => {
    const value = identifier.trim();
    const digits = value.replace(/\D/g, "");
    const candidates = new Set();
    if (value) {
        candidates.add(value);
    }
    if (digits) {
        candidates.add(digits);
        candidates.add(`+${digits}`);
    }
    if (digits.length >= 10) {
        const local = digits.slice(-10);
        candidates.add(local);
        candidates.add(`91${local}`);
        candidates.add(`+91${local}`);
    }
    return Array.from(candidates);
};
const findAdminByIdentifier = async (emailOrPhone) => {
    const identifier = emailOrPhone.trim();
    const phoneCandidates = buildPhoneCandidates(identifier);
    return db_1.default.user.findFirst({
        where: {
            role: { in: [client_1.UserRole.ADMIN, roles_1.ADMIN_AS_VENDOR_ROLE] },
            OR: [
                { email: identifier },
                ...Array.from(phoneCandidates).map((phone) => ({ phone }))
            ]
        }
    });
};
const findVendorByIdentifier = async (phone) => {
    const phoneCandidates = buildPhoneCandidates(phone);
    if (!phoneCandidates.length) {
        return null;
    }
    return db_1.default.user.findFirst({
        where: {
            role: { in: roles_1.VENDOR_ROLES },
            OR: phoneCandidates.map((candidatePhone) => ({ phone: candidatePhone }))
        }
    });
};
const findUserByPhoneIdentifier = async (phone) => {
    const phoneCandidates = buildPhoneCandidates(phone);
    if (!phoneCandidates.length) {
        return null;
    }
    return db_1.default.user.findFirst({
        where: {
            OR: phoneCandidates.map((candidatePhone) => ({ phone: candidatePhone }))
        }
    });
};
const storeOtpVerification = async (phone) => {
    const formattedPhone = normalizePhone(phone);
    const verificationId = await SmsService_1.SmsService.sendOtpViaMC(formattedPhone);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await db_1.default.otpVerification.upsert({
        where: { phone: formattedPhone },
        update: { otp: verificationId, expiresAt },
        create: { phone: formattedPhone, otp: verificationId, expiresAt }
    });
    return formattedPhone;
};
const verifyStoredOtp = async (phone, otp, ...phoneCandidates) => {
    const formattedPhone = normalizePhone(phone);
    const otpRecord = await db_1.default.otpVerification.findUnique({
        where: { phone: formattedPhone }
    });
    if (!otpRecord) {
        throw new Error("No OTP found for this phone number");
    }
    if (otpRecord.expiresAt < new Date()) {
        throw new Error("OTP has expired");
    }
    const isTestOtp = canUseTestOtp(otp, phone, formattedPhone, otpRecord.phone, ...phoneCandidates);
    const isValid = isTestOtp || (await SmsService_1.SmsService.verifyOtp(formattedPhone, otp, otpRecord.otp));
    if (!isValid) {
        throw new Error("Invalid OTP");
    }
    await db_1.default.otpVerification.delete({
        where: { phone: formattedPhone }
    });
    return formattedPhone;
};
const ensureUserPublicCode = async (user) => {
    const existing = String(user?.publicCode || '').trim();
    if (existing) {
        return { ...user, publicCode: existing };
    }
    const publicCode = (0, publicCodes_1.buildUserPublicCode)(user.role, user.id);
    await db_1.default.user.update({
        where: { id: user.id },
        data: { publicCode }
    });
    return {
        ...user,
        publicCode
    };
};
const ensureAdminPortalAccountIsActive = (user) => {
    if (user.status !== client_1.UserStatus.ACTIVE) {
        throw new Error("Your account is not active. Please contact administrator.");
    }
};
const issueSessionTokens = async (user, sessionContext) => {
    const { session, refreshToken } = await (0, authSession_1.createAuthSession)({
        userId: user.id.toString(),
        deviceInfo: sessionContext?.deviceInfo || null,
        ipAddress: sessionContext?.ipAddress || null
    });
    const payload = {
        userId: user.id.toString(),
        role: user.role,
        sessionId: session.id.toString()
    };
    const accessToken = (0, authSession_1.createAccessToken)(payload);
    return {
        accessToken,
        refreshToken
    };
};
exports.AuthService = {
    async registerVendor(data) {
        const normalizeOptional = (value) => {
            if (value === undefined)
                return undefined;
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : undefined;
        };
        const name = data.name.trim();
        const email = normalizeOptional(data.email);
        const phone = normalizeOptional(data.phone);
        const password = data.password;
        const shopName = data.shopName.trim();
        const ownerName = data.ownerName.trim();
        const businessName = normalizeOptional(data.businessName);
        const businessType = normalizeOptional(data.businessType);
        const gstNumber = normalizeOptional(data.gstNumber);
        const address = normalizeOptional(data.address);
        const city = normalizeOptional(data.city);
        const state = normalizeOptional(data.state);
        const pincode = normalizeOptional(data.pincode);
        const aadhaarNumber = normalizeOptional(data.aadhaarNumber);
        const aadhaarFront = normalizeOptional(data.aadhaarFront);
        const aadhaarBack = normalizeOptional(data.aadhaarBack);
        const vendorCategory = String(data.vendorCategory || '').trim().toLowerCase();
        const vendorRole = vendorCategory === 'individual_owner' ? roles_1.INDIVIDUAL_VENDOR_ROLE : client_1.UserRole.VENDOR;
        if (!email && !phone) {
            throw new Error("Email or phone is required");
        }
        const phoneCandidates = phone ? buildPhoneCandidates(phone) : [];
        const existingUser = await db_1.default.user.findFirst({
            where: {
                OR: [
                    ...(email ? [{ email }] : []),
                    ...phoneCandidates.map((candidatePhone) => ({ phone: candidatePhone }))
                ]
            }
        });
        if (existingUser) {
            throw new Error("User already exists");
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const normalizedPhone = phone ? normalizePhone(phone) : undefined;
        const createdUser = await db_1.default.user.create({
            data: {
                name,
                email,
                phone: normalizedPhone,
                role: vendorRole,
                passwordAuth: {
                    create: {
                        passwordHash,
                        lastChanged: new Date(),
                        failedAttempts: 0
                    }
                },
                vendorProfile: {
                    create: {
                        shopName,
                        ownerName,
                        businessName,
                        businessType,
                        gstNumber,
                        address,
                        city,
                        state,
                        pincode,
                        phone: normalizedPhone
                    }
                }
            },
            include: {
                vendorProfile: true
            }
        });
        const user = await ensureUserPublicCode(createdUser);
        if (aadhaarNumber && aadhaarFront && aadhaarBack && user.vendorProfile?.id) {
            await KycService_1.KycService.uploadVendorKyc(user.vendorProfile.id.toString(), {
                aadhaarNumber,
                aadhaarFront,
                aadhaarBack
            });
        }
        await VendorProfileService_1.VendorProfileService.updateProfile(user.id.toString(), {
            ...data,
            phone: normalizedPhone
        });
        return user;
    },
    async registerCustomer(data) {
        const normalizeOptional = (value) => {
            if (value === undefined)
                return undefined;
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : undefined;
        };
        const name = data.name.trim();
        const email = normalizeOptional(data.email);
        const phone = normalizeOptional(data.phone);
        const password = data.password;
        if (!email && !phone) {
            throw new Error("Email or phone is required");
        }
        const existingUser = await db_1.default.user.findFirst({
            where: {
                OR: [
                    ...(email ? [{ email }] : []),
                    ...(phone ? [{ phone }] : [])
                ]
            }
        });
        if (existingUser) {
            throw new Error("User already exists");
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const createdUser = await db_1.default.user.create({
            data: {
                name,
                email,
                phone,
                role: client_1.UserRole.CUSTOMER,
                passwordAuth: {
                    create: {
                        passwordHash,
                        lastChanged: new Date(),
                        failedAttempts: 0
                    }
                }
            }
        });
        return ensureUserPublicCode(createdUser);
    },
    async login(data, sessionContext) {
        const { emailOrPhone, password, role } = data;
        try {
            const user = await db_1.default.user.findFirst({
                where: {
                    OR: [
                        { email: emailOrPhone },
                        { phone: emailOrPhone }
                    ],
                    role
                },
                include: {
                    passwordAuth: true
                }
            });
            if (!user || !user.passwordAuth) {
                throw new Error("Invalid credentials");
            }
            if (role === client_1.UserRole.ADMIN || role === roles_1.ADMIN_AS_VENDOR_ROLE) {
                ensureAdminPortalAccountIsActive(user);
            }
            else if (user.status === client_1.UserStatus.BLOCKED) {
                throw new Error("Account is blocked");
            }
            if (user.passwordAuth.failedAttempts >= 5) {
                await db_1.default.user.update({
                    where: { id: user.id },
                    data: { status: client_1.UserStatus.BLOCKED }
                });
                throw new Error("Account blocked due to too many failed login attempts");
            }
            const isValidPassword = await bcrypt_1.default.compare(password, user.passwordAuth.passwordHash);
            if (!isValidPassword) {
                await db_1.default.userPasswordAuth.update({
                    where: { userId: user.id },
                    data: { failedAttempts: { increment: 1 } }
                });
                throw new Error("Invalid credentials");
            }
            await db_1.default.userPasswordAuth.update({
                where: { userId: user.id },
                data: { failedAttempts: 0 }
            });
            const hydratedUser = await ensureUserPublicCode(user);
            const { accessToken, refreshToken } = await issueSessionTokens(hydratedUser, sessionContext);
            return {
                user: {
                    id: hydratedUser.id,
                    name: hydratedUser.name,
                    email: hydratedUser.email,
                    phone: hydratedUser.phone,
                    publicCode: hydratedUser.publicCode,
                    role: hydratedUser.role
                },
                accessToken,
                refreshToken
            };
        }
        catch (error) {
            logger_1.default.warn({ error: error instanceof Error ? error.message : String(error) }, 'Login failed');
            throw error;
        }
    },
    async sendVendorOtp(phone) {
        const vendor = await findVendorByIdentifier(phone);
        if (!vendor) {
            throw new Error("Vendor not found with phone: " + phone);
        }
        if (vendor.status === client_1.UserStatus.BLOCKED) {
            throw new Error("Account is blocked");
        }
        if (!vendor.phone) {
            throw new Error("Vendor phone is not configured for OTP");
        }
        const formattedPhone = await storeOtpVerification(vendor.phone);
        return { success: true, message: `OTP sent to ${formattedPhone}` };
    },
    async sendVendorRegistrationOtp(phone) {
        const existingUser = await findUserByPhoneIdentifier(phone);
        if (existingUser) {
            throw new Error("Phone number already exists. Please login instead.");
        }
        const formattedPhone = await storeOtpVerification(phone);
        return { success: true, message: `OTP sent to ${formattedPhone}` };
    },
    async sendCustomerOtp(phone) {
        const formattedPhone = await storeOtpVerification(phone);
        return { success: true, message: `OTP sent to ${formattedPhone}` };
    },
    async sendAdminOtp(emailOrPhone) {
        const admin = await findAdminByIdentifier(emailOrPhone);
        if (!admin) {
            throw new Error("Admin not found");
        }
        ensureAdminPortalAccountIsActive(admin);
        if (!admin.phone) {
            throw new Error("Admin phone is not configured for OTP");
        }
        const formattedPhone = await storeOtpVerification(admin.phone);
        return { success: true, message: `OTP sent to ${formattedPhone}` };
    },
    async verifyVendorOtp(phone, otp, sessionContext) {
        const vendor = await findVendorByIdentifier(phone);
        if (!vendor) {
            throw new Error("Vendor not found");
        }
        if (vendor.status === client_1.UserStatus.BLOCKED) {
            throw new Error("Account is blocked");
        }
        await verifyStoredOtp(vendor.phone || phone, otp, phone, vendor.phone);
        const hydratedVendor = await ensureUserPublicCode(vendor);
        const { accessToken, refreshToken } = await issueSessionTokens(hydratedVendor, sessionContext);
        return {
            user: {
                id: hydratedVendor.id,
                name: hydratedVendor.name,
                phone: hydratedVendor.phone,
                publicCode: hydratedVendor.publicCode,
                role: hydratedVendor.role
            },
            accessToken,
            refreshToken
        };
    },
    async verifyVendorRegistrationOtp(phone, otp) {
        const existingUser = await findUserByPhoneIdentifier(phone);
        if (existingUser) {
            throw new Error("Phone number already exists. Please login instead.");
        }
        const formattedPhone = await verifyStoredOtp(phone, otp, phone);
        return {
            phone: formattedPhone,
            verified: true
        };
    },
    async verifyCustomerOtp(phone, otp, aadhar, name, email, sessionContext) {
        const formattedPhone = await verifyStoredOtp(phone, otp, phone);
        const existingUserWithPhone = await db_1.default.user.findFirst({
            where: { phone: formattedPhone }
        });
        if (existingUserWithPhone && existingUserWithPhone.role !== client_1.UserRole.CUSTOMER) {
            throw new Error(`This phone number is already registered as ${existingUserWithPhone.role}. Please login with that account.`);
        }
        let customer = existingUserWithPhone && existingUserWithPhone.role === client_1.UserRole.CUSTOMER
            ? existingUserWithPhone
            : null;
        if (customer && customer.status === client_1.UserStatus.BLOCKED) {
            throw new Error("Account is blocked");
        }
        if (!customer) {
            if (!aadhar || !/^\d{12}$/.test(aadhar)) {
                throw new Error("Aadhar is required for new user");
            }
            const normalizedName = String(name || '').trim();
            if (!normalizedName) {
                throw new Error("Name is required");
            }
            try {
                customer = await db_1.default.user.create({
                    data: {
                        name: normalizedName,
                        phone: formattedPhone,
                        role: client_1.UserRole.CUSTOMER
                    }
                });
            }
            catch (error) {
                if (error?.code === "P2002") {
                    throw new Error("Phone number already exists. Please login instead of registering.");
                }
                throw error;
            }
        }
        if (customer) {
            const profileData = {};
            if (aadhar && /^\d{12}$/.test(aadhar)) {
                profileData.aadharNumber = aadhar;
            }
            if (email && email.trim()) {
                profileData.email = email.trim();
            }
            if (Object.keys(profileData).length > 0) {
                await (0, customerProfileStorage_1.upsertCustomerProfileDetails)(customer.id, profileData);
            }
        }
        const hydratedCustomer = await ensureUserPublicCode(customer);
        const { accessToken, refreshToken } = await issueSessionTokens(hydratedCustomer, sessionContext);
        return {
            user: {
                id: hydratedCustomer.id,
                name: hydratedCustomer.name,
                phone: hydratedCustomer.phone,
                publicCode: hydratedCustomer.publicCode,
                role: hydratedCustomer.role
            },
            accessToken,
            refreshToken
        };
    },
    async getCustomerProfile(customerId) {
        const customerIdBigInt = BigInt(customerId);
        const user = await db_1.default.user.findUnique({
            where: { id: customerIdBigInt },
            select: {
                id: true,
                name: true,
                phone: true,
                publicCode: true,
                status: true,
                createdAt: true
            }
        });
        if (!user) {
            throw new Error("Customer not found");
        }
        const hydratedUser = await ensureUserPublicCode(user);
        const totalOrders = await db_1.default.order.count({
            where: { customerId: customerIdBigInt }
        });
        const customerProfile = await (0, customerProfileStorage_1.readCustomerProfileDetails)(customerIdBigInt);
        return {
            id: String(hydratedUser.id),
            publicCode: hydratedUser.publicCode,
            name: hydratedUser.name || "",
            phone: hydratedUser.phone || "",
            email: customerProfile?.email || "",
            aadharNumber: customerProfile?.aadharNumber || "",
            addressLine1: customerProfile?.addressLine1 || "",
            landmark: customerProfile?.landmark || "",
            pincode: customerProfile?.pincode || "",
            city: customerProfile?.city || "",
            state: customerProfile?.state || "",
            additionalInfo: customerProfile?.additionalInfo || "",
            memberSince: hydratedUser.createdAt,
            totalOrders,
            accountStatus: hydratedUser.status,
            preferences: {
                emailNotifications: true,
                smsUpdates: true
            }
        };
    },
    async verifyAdminOtp(emailOrPhone, otp, sessionContext) {
        const admin = await findAdminByIdentifier(emailOrPhone);
        if (!admin) {
            throw new Error("Admin not found");
        }
        ensureAdminPortalAccountIsActive(admin);
        if (!admin.phone) {
            throw new Error("Admin phone is not configured for OTP");
        }
        await verifyStoredOtp(admin.phone, otp, emailOrPhone, admin.phone);
        const hydratedAdmin = await ensureUserPublicCode(admin);
        const { accessToken, refreshToken } = await issueSessionTokens(hydratedAdmin, sessionContext);
        return {
            user: {
                id: hydratedAdmin.id,
                name: hydratedAdmin.name,
                email: hydratedAdmin.email,
                phone: hydratedAdmin.phone,
                publicCode: hydratedAdmin.publicCode,
                role: hydratedAdmin.role
            },
            accessToken,
            refreshToken
        };
    },
    async refreshToken(refreshToken, sessionContext) {
        const normalizedRefreshToken = String(refreshToken || '').trim();
        if (!normalizedRefreshToken) {
            throw new Error('Refresh token is required');
        }
        const session = await db_1.default.authSession.findFirst({
            where: {
                refreshToken: normalizedRefreshToken,
                expiresAt: {
                    gt: new Date()
                }
            },
            include: {
                user: true
            }
        });
        if (!session || session.user.status !== client_1.UserStatus.ACTIVE) {
            throw new Error('Session expired. Please login again.');
        }
        const hydratedUser = await ensureUserPublicCode(session.user);
        const rotated = await (0, authSession_1.rotateAuthSession)({
            sessionId: session.id.toString(),
            userId: hydratedUser.id.toString(),
            deviceInfo: sessionContext?.deviceInfo || session.deviceInfo || null,
            ipAddress: sessionContext?.ipAddress || session.ipAddress || null
        });
        const accessToken = (0, authSession_1.createAccessToken)({
            userId: hydratedUser.id.toString(),
            role: hydratedUser.role,
            sessionId: rotated.session.id.toString()
        });
        return {
            user: {
                id: hydratedUser.id,
                name: hydratedUser.name,
                email: hydratedUser.email,
                phone: hydratedUser.phone,
                publicCode: hydratedUser.publicCode,
                role: hydratedUser.role
            },
            accessToken,
            refreshToken: rotated.refreshToken
        };
    },
    async logout(refreshToken, accessToken) {
        const normalizedRefreshToken = String(refreshToken || '').trim();
        let revokedCount = 0;
        if (normalizedRefreshToken) {
            revokedCount = await (0, authSession_1.revokeAuthSessionByRefreshToken)(normalizedRefreshToken);
        }
        if (revokedCount === 0) {
            const token = (0, authSession_1.parseBearerToken)(accessToken);
            const payload = token ? await (0, authSession_1.verifySessionBackedAccessToken)(token) : null;
            if (payload?.sessionId) {
                revokedCount = await (0, authSession_1.revokeAuthSessionById)(payload.sessionId, payload.userId);
            }
        }
        return { success: true };
    }
};

import bcrypt from "bcrypt";
import { UserRole, UserStatus } from "@prisma/client";
import prisma from "@/config/db";
import { SmsService } from "@/services/SmsService";
import { KycService } from "@/services/KycService";
import { VendorProfileService } from './VendorProfileService';
import { buildUserPublicCode } from '@/utils/publicCodes';
import {
  ADMIN_ROLES,
  ADMIN_AS_VENDOR_ROLE,
  INDIVIDUAL_VENDOR_ROLE,
  VENDOR_ROLES
} from '@/utils/roles';
import {
  readCustomerProfileDetails,
  upsertCustomerProfileDetails
} from './customerProfileStorage';
import {
  createAccessToken,
  createAuthSession,
  parseBearerToken,
  revokeAuthSessionById,
  revokeAuthSessionByRefreshToken,
  rotateAuthSession,
  verifySessionBackedAccessToken
} from '@/utils/authSession';
import logger from '@/utils/logger';

interface RegisterCustomerData {
  name: string;
  email?: string;
  phone?: string;
  password: string;
}

interface RegisterVendorData {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  shopName: string;
  ownerName: string;
  businessName?: string;
  businessType?: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  aadhaarNumber?: string;
  aadhaarFront?: string;
  aadhaarBack?: string;
  [key: string]: unknown;
}

interface LoginData {
  emailOrPhone: string;
  password: string;
  role: UserRole;
}

interface TokenPayload {
  userId: string;
  role: UserRole;
  sessionId: string;
}

type SessionContext = {
  deviceInfo?: string | null;
  ipAddress?: string | null;
};

const OTP_TTL_MS = 10 * 60 * 1000;

const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
};

const parseCsvEnv = (value?: string) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const normalizePhoneKey = (phone?: string | null) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

const canUseTestOtp = (otp: string, ...phones: Array<string | null | undefined>) => {
  const enabled = String(process.env.TEST_OTP_ENABLED || "").toLowerCase() === "true";
  const configuredOtp = String(process.env.TEST_OTP_CODE || "").trim();

  if (!enabled || !configuredOtp || otp !== configuredOtp) {
    return false;
  }

  const allowedPhones = new Set(
    parseCsvEnv(process.env.TEST_OTP_ALLOWED_PHONES).map((phone) => normalizePhoneKey(phone))
  );

  return phones.some((phone) => {
    const normalized = normalizePhoneKey(phone);
    return Boolean(normalized) && allowedPhones.has(normalized);
  });
};

const buildPhoneCandidates = (identifier: string) => {
  const value = identifier.trim();
  const digits = value.replace(/\D/g, "");
  const candidates = new Set<string>();

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

const findAdminByIdentifier = async (emailOrPhone: string) => {
  const identifier = emailOrPhone.trim();
  const phoneCandidates = buildPhoneCandidates(identifier);

  return prisma.user.findFirst({
    where: {
      role: { in: [UserRole.ADMIN, ADMIN_AS_VENDOR_ROLE] },
      OR: [
        { email: identifier },
        ...Array.from(phoneCandidates).map((phone) => ({ phone }))
      ]
    }
  });
};

const findVendorByIdentifier = async (phone: string) => {
  const phoneCandidates = buildPhoneCandidates(phone);
  if (!phoneCandidates.length) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      role: { in: VENDOR_ROLES },
      OR: phoneCandidates.map((candidatePhone) => ({ phone: candidatePhone }))
    }
  });
};

const findUserByPhoneIdentifier = async (phone: string) => {
  const phoneCandidates = buildPhoneCandidates(phone);
  if (!phoneCandidates.length) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      OR: phoneCandidates.map((candidatePhone) => ({ phone: candidatePhone }))
    }
  });
};

const storeOtpVerification = async (phone: string) => {
  const formattedPhone = normalizePhone(phone);
  const verificationId = await SmsService.sendOtpViaMC(formattedPhone);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpVerification.upsert({
    where: { phone: formattedPhone },
    update: { otp: verificationId, expiresAt },
    create: { phone: formattedPhone, otp: verificationId, expiresAt }
  });

  return formattedPhone;
};

const verifyStoredOtp = async (
  phone: string,
  otp: string,
  ...phoneCandidates: Array<string | null | undefined>
) => {
  const formattedPhone = normalizePhone(phone);
  const otpRecord = await prisma.otpVerification.findUnique({
    where: { phone: formattedPhone }
  });

  if (!otpRecord) {
    throw new Error("No OTP found for this phone number");
  }

  if (otpRecord.expiresAt < new Date()) {
    throw new Error("OTP has expired");
  }

  const isTestOtp = canUseTestOtp(otp, phone, formattedPhone, otpRecord.phone, ...phoneCandidates);
  const isValid = isTestOtp || (await SmsService.verifyOtp(formattedPhone, otp, otpRecord.otp));

  if (!isValid) {
    throw new Error("Invalid OTP");
  }

  await prisma.otpVerification.delete({
    where: { phone: formattedPhone }
  });

  return formattedPhone;
};

const ensureUserPublicCode = async <
  T extends { id: bigint; role: UserRole; publicCode?: string | null }
>(
  user: T
): Promise<T & { publicCode: string }> => {
  const existing = String(user?.publicCode || '').trim();
  if (existing) {
    return { ...user, publicCode: existing };
  }

  const publicCode = buildUserPublicCode(user.role, user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { publicCode } as any
  });

  return {
    ...user,
    publicCode
  };
};

const ensureAdminPortalAccountIsActive = (user: { status: UserStatus }) => {
  if (user.status !== UserStatus.ACTIVE) {
    throw new Error("Your account is not active. Please contact administrator.");
  }
};

const issueSessionTokens = async (
  user: { id: bigint; role: UserRole },
  sessionContext?: SessionContext
) => {
  const { session, refreshToken } = await createAuthSession({
    userId: user.id.toString(),
    deviceInfo: sessionContext?.deviceInfo || null,
    ipAddress: sessionContext?.ipAddress || null
  });

  const payload: TokenPayload = {
    userId: user.id.toString(),
    role: user.role,
    sessionId: session.id.toString()
  };

  const accessToken = createAccessToken(payload);
  return {
    accessToken,
    refreshToken
  };
};

export const AuthService = {
  async registerVendor(data: RegisterVendorData) {
    const normalizeOptional = (value?: string) => {
      if (value === undefined) return undefined;
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
    const vendorRole =
      vendorCategory === 'individual_owner' ? INDIVIDUAL_VENDOR_ROLE : UserRole.VENDOR;

    if (!email && !phone) {
      throw new Error("Email or phone is required");
    }

    const phoneCandidates = phone ? buildPhoneCandidates(phone) : [];
    const existingUser = await prisma.user.findFirst({
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

    const passwordHash = await bcrypt.hash(password, 10);
    const normalizedPhone = phone ? normalizePhone(phone) : undefined;

    const createdUser = await prisma.user.create({
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
    const user = await ensureUserPublicCode(createdUser as any);

    if (aadhaarNumber && aadhaarFront && aadhaarBack && user.vendorProfile?.id) {
      await KycService.uploadVendorKyc(user.vendorProfile.id.toString(), {
        aadhaarNumber,
        aadhaarFront,
        aadhaarBack
      });
    }

    await VendorProfileService.updateProfile(user.id.toString(), {
      ...data,
      phone: normalizedPhone
    });

    return user;
  },

  async registerCustomer(data: RegisterCustomerData) {
    const normalizeOptional = (value?: string) => {
      if (value === undefined) return undefined;
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

    const existingUser = await prisma.user.findFirst({
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

    const passwordHash = await bcrypt.hash(password, 10);

    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        role: UserRole.CUSTOMER,
        passwordAuth: {
          create: {
            passwordHash,
            lastChanged: new Date(),
            failedAttempts: 0
          }
        }
      }
    });
    return ensureUserPublicCode(createdUser as any);
  },

  async login(data: LoginData, sessionContext?: SessionContext) {
    const { emailOrPhone, password, role } = data;

    try {
      const user = await prisma.user.findFirst({
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

      if (role === UserRole.ADMIN || role === ADMIN_AS_VENDOR_ROLE) {
        ensureAdminPortalAccountIsActive(user);
      } else if (user.status === UserStatus.BLOCKED) {
        throw new Error("Account is blocked");
      }

      if (user.passwordAuth.failedAttempts >= 5) {
        await prisma.user.update({
          where: { id: user.id },
          data: { status: UserStatus.BLOCKED }
        });
        throw new Error("Account blocked due to too many failed login attempts");
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordAuth.passwordHash);

      if (!isValidPassword) {
        await prisma.userPasswordAuth.update({
          where: { userId: user.id },
          data: { failedAttempts: { increment: 1 } }
        });
        throw new Error("Invalid credentials");
      }
      

      await prisma.userPasswordAuth.update({
        where: { userId: user.id },
        data: { failedAttempts: 0 }
      });

      const hydratedUser = await ensureUserPublicCode(user as any);

      const { accessToken, refreshToken } = await issueSessionTokens(
        hydratedUser,
        sessionContext
      );

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
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Login failed'
      );
      throw error;
    }
  },

  async sendVendorOtp(phone: string) {
    const vendor = await findVendorByIdentifier(phone);

    if (!vendor) {
      throw new Error("Vendor not found with phone: " + phone);
    }

    if (vendor.status === UserStatus.BLOCKED) {
      throw new Error("Account is blocked");
    }

    if (!vendor.phone) {
      throw new Error("Vendor phone is not configured for OTP");
    }

    const formattedPhone = await storeOtpVerification(vendor.phone);

    return { success: true, message: `OTP sent to ${formattedPhone}` };
  },

  async sendVendorRegistrationOtp(phone: string) {
    const existingUser = await findUserByPhoneIdentifier(phone);

    if (existingUser) {
      throw new Error("Phone number already exists. Please login instead.");
    }

    const formattedPhone = await storeOtpVerification(phone);

    return { success: true, message: `OTP sent to ${formattedPhone}` };
  },

  async sendCustomerOtp(phone: string) {
    const formattedPhone = await storeOtpVerification(phone);

    return { success: true, message: `OTP sent to ${formattedPhone}` };
  },

  async sendAdminOtp(emailOrPhone: string) {
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

  async verifyVendorOtp(phone: string, otp: string, sessionContext?: SessionContext) {
    const vendor = await findVendorByIdentifier(phone);

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    if (vendor.status === UserStatus.BLOCKED) {
      throw new Error("Account is blocked");
    }

    await verifyStoredOtp(vendor.phone || phone, otp, phone, vendor.phone);

    const hydratedVendor = await ensureUserPublicCode(vendor as any);

    const { accessToken, refreshToken } = await issueSessionTokens(
      hydratedVendor,
      sessionContext
    );

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

  async verifyVendorRegistrationOtp(phone: string, otp: string) {
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

  async verifyCustomerOtp(
    phone: string,
    otp: string,
    aadhar?: string,
    name?: string,
    email?: string,
    sessionContext?: SessionContext
  ) {
    const formattedPhone = await verifyStoredOtp(phone, otp, phone);

    const existingUserWithPhone = await prisma.user.findFirst({
      where: { phone: formattedPhone }
    });

    if (existingUserWithPhone && existingUserWithPhone.role !== UserRole.CUSTOMER) {
      throw new Error(
        `This phone number is already registered as ${existingUserWithPhone.role}. Please login with that account.`
      );
    }

    let customer =
      existingUserWithPhone && existingUserWithPhone.role === UserRole.CUSTOMER
        ? existingUserWithPhone
        : null;

    if (customer && customer.status === UserStatus.BLOCKED) {
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
        customer = await prisma.user.create({
          data: {
            name: normalizedName,
            phone: formattedPhone,
            role: UserRole.CUSTOMER
          }
        });
      } catch (error: any) {
        if (error?.code === "P2002") {
          throw new Error("Phone number already exists. Please login instead of registering.");
        }
        throw error;
      }
    }

    if (customer) {
      const profileData: any = {};
      if (aadhar && /^\d{12}$/.test(aadhar)) {
        profileData.aadharNumber = aadhar;
      }
      if (email && email.trim()) {
        profileData.email = email.trim();
      }
      if (Object.keys(profileData).length > 0) {
        await upsertCustomerProfileDetails(customer.id as bigint, profileData);
      }
    }
    const hydratedCustomer = await ensureUserPublicCode(customer as any);

    const { accessToken, refreshToken } = await issueSessionTokens(
      hydratedCustomer,
      sessionContext
    );

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

  async getCustomerProfile(customerId: string) {
    const customerIdBigInt = BigInt(customerId);
    const user = await prisma.user.findUnique({
      where: { id: customerIdBigInt },
      select: {
        id: true,
        name: true,
        phone: true,
        publicCode: true,
        status: true,
        createdAt: true
      } as any
    });

    if (!user) {
      throw new Error("Customer not found");
    }
    const hydratedUser = await ensureUserPublicCode(user as any);

    const totalOrders = await prisma.order.count({
      where: { customerId: customerIdBigInt }
    });

    const customerProfile = await readCustomerProfileDetails(customerIdBigInt);

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

  async verifyAdminOtp(
    emailOrPhone: string,
    otp: string,
    sessionContext?: SessionContext
  ) {
    const admin = await findAdminByIdentifier(emailOrPhone);

    if (!admin) {
      throw new Error("Admin not found");
    }

    ensureAdminPortalAccountIsActive(admin);

    if (!admin.phone) {
      throw new Error("Admin phone is not configured for OTP");
    }

    await verifyStoredOtp(admin.phone, otp, emailOrPhone, admin.phone);

    const hydratedAdmin = await ensureUserPublicCode(admin as any);

    const { accessToken, refreshToken } = await issueSessionTokens(
      hydratedAdmin,
      sessionContext
    );

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

  async refreshToken(refreshToken: string, sessionContext?: SessionContext) {
    const normalizedRefreshToken = String(refreshToken || '').trim();
    if (!normalizedRefreshToken) {
      throw new Error('Refresh token is required');
    }

    const session = await prisma.authSession.findFirst({
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

    if (!session || session.user.status !== UserStatus.ACTIVE) {
      throw new Error('Session expired. Please login again.');
    }

    const hydratedUser = await ensureUserPublicCode(session.user as any);
    const rotated = await rotateAuthSession({
      sessionId: session.id.toString(),
      userId: hydratedUser.id.toString(),
      deviceInfo: sessionContext?.deviceInfo || session.deviceInfo || null,
      ipAddress: sessionContext?.ipAddress || session.ipAddress || null
    });

    const accessToken = createAccessToken({
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

  async logout(refreshToken?: string, accessToken?: string) {
    const normalizedRefreshToken = String(refreshToken || '').trim();
    let revokedCount = 0;

    if (normalizedRefreshToken) {
      revokedCount = await revokeAuthSessionByRefreshToken(normalizedRefreshToken);
    }

    if (revokedCount === 0) {
      const token = parseBearerToken(accessToken);
      const payload = token ? await verifySessionBackedAccessToken(token) : null;
      if (payload?.sessionId) {
        revokedCount = await revokeAuthSessionById(payload.sessionId, payload.userId);
      }
    }

    return { success: true };
  }
};

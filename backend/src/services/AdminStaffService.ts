import { UserStatus } from "@prisma/client";
import prisma from "@/config/db";
import { ADMIN_AS_VENDOR_ROLE } from "@/utils/roles";
import { buildUserPublicCode } from '@/utils/publicCodes';

interface RegisterAdminStaffData {
  name: string;
  email?: string;
  phone: string;
  status?: UserStatus | string;
}

const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
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

const ADMIN_STAFF_SELECT = {
  id: true,
  publicCode: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  onboardingStatus: true,
  createdAt: true
} as const;

const VALID_ADMIN_STAFF_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'PENDING'
] as const;

type AdminStaffUiStatus = (typeof VALID_ADMIN_STAFF_STATUSES)[number];

const normalizeAdminStaffStatus = (status?: UserStatus | string) => {
  const normalized = String(status || 'ACTIVE').trim().toUpperCase();
  if (!VALID_ADMIN_STAFF_STATUSES.includes(normalized as AdminStaffUiStatus)) {
    throw new Error("Invalid status value. Must be one of: ACTIVE, INACTIVE, SUSPENDED, PENDING");
  }

  return normalized as AdminStaffUiStatus;
};

const resolveAdminStaffPersistenceStatus = (status: AdminStaffUiStatus) => {
  switch (status) {
    case 'ACTIVE':
      return {
        userStatus: UserStatus.ACTIVE,
        onboardingStatus: "APPROVED"
      };
    case 'SUSPENDED':
      return {
        userStatus: UserStatus.BLOCKED,
        onboardingStatus: "SUSPENDED"
      };
    case 'PENDING':
      return {
        userStatus: UserStatus.BLOCKED,
        onboardingStatus: "PENDING"
      };
    case 'INACTIVE':
    default:
      return {
        userStatus: UserStatus.BLOCKED,
        onboardingStatus: "APPROVED"
      };
  }
};

export const AdminStaffService = {
  async registerAdminStaff(data: RegisterAdminStaffData) {
    const normalizeOptional = (value?: string) => {
      if (value === undefined) return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const name = data.name.trim();
    const email = normalizeOptional(data.email);
    const phone = normalizeOptional(data.phone);

    if (!phone) {
      throw new Error("Phone is required");
    }

    const normalizedPhone = normalizePhone(phone);
    const requestedStatus = normalizeAdminStaffStatus(data.status);
    const persistenceStatus = resolveAdminStaffPersistenceStatus(requestedStatus);
    const phoneCandidates = Array.from(
      new Set<string>([...buildPhoneCandidates(phone), normalizedPhone])
    );

    const [existingEmailUser, existingPhoneUser] = await Promise.all([
      email
        ? prisma.user.findFirst({
            where: { email },
            select: { id: true } as any
          })
        : Promise.resolve(null),
      prisma.user.findFirst({
        where: {
          OR: phoneCandidates.map((candidatePhone) => ({ phone: candidatePhone }))
        },
        select: { id: true } as any
      })
    ]);

    if (existingEmailUser) {
      throw new Error("Email already exists");
    }

    if (existingPhoneUser) {
      throw new Error("Phone number already exists");
    }

    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        phone: normalizedPhone,
        role: ADMIN_AS_VENDOR_ROLE,
        status: persistenceStatus.userStatus,
        onboardingStatus: persistenceStatus.onboardingStatus as any
      }
    });
    const publicCode = buildUserPublicCode(ADMIN_AS_VENDOR_ROLE, createdUser.id);

    return prisma.user.update({
      where: { id: createdUser.id },
      data: { publicCode } as any,
      select: ADMIN_STAFF_SELECT as any
    }) as any;
  },

  async getAllAdminStaff(limit: number = 50, offset: number = 0) {
    const [staff, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: ADMIN_AS_VENDOR_ROLE
        },
        select: ADMIN_STAFF_SELECT as any,
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.user.count({
        where: {
          role: ADMIN_AS_VENDOR_ROLE
        }
      })
    ]);

    return {
      data: staff,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit)
      }
    };
  },

  async getAdminStaffById(staffId: bigint) {
    const staff: any = await prisma.user.findFirst({
      where: {
        id: staffId,
        role: ADMIN_AS_VENDOR_ROLE
      },
      select: ADMIN_STAFF_SELECT as any
    });

    if (!staff) {
      throw new Error("Staff member not found");
    }

    return staff;
  },

  async updateAdminStaffStatus(staffId: bigint, status: string) {
    const normalizedStatus = normalizeAdminStaffStatus(status);
    const persistenceStatus = resolveAdminStaffPersistenceStatus(normalizedStatus);

    const updated = await prisma.user.updateMany({
      where: {
        id: staffId,
        role: ADMIN_AS_VENDOR_ROLE
      },
      data: {
        status: persistenceStatus.userStatus,
        onboardingStatus: persistenceStatus.onboardingStatus as any
      }
    });

    if (updated.count === 0) {
      throw new Error("Staff member not found");
    }

    return {
      id: staffId.toString(),
      status: persistenceStatus.userStatus,
      onboardingStatus: persistenceStatus.onboardingStatus
    };
  }
};

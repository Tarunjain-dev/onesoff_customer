"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminStaffService = void 0;
const client_1 = require("@prisma/client");
const db_1 = __importDefault(require("@/config/db"));
const roles_1 = require("@/utils/roles");
const publicCodes_1 = require("@/utils/publicCodes");
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
};
const VALID_ADMIN_STAFF_STATUSES = [
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED',
    'PENDING'
];
const normalizeAdminStaffStatus = (status) => {
    const normalized = String(status || 'ACTIVE').trim().toUpperCase();
    if (!VALID_ADMIN_STAFF_STATUSES.includes(normalized)) {
        throw new Error("Invalid status value. Must be one of: ACTIVE, INACTIVE, SUSPENDED, PENDING");
    }
    return normalized;
};
const resolveAdminStaffPersistenceStatus = (status) => {
    switch (status) {
        case 'ACTIVE':
            return {
                userStatus: client_1.UserStatus.ACTIVE,
                onboardingStatus: "APPROVED"
            };
        case 'SUSPENDED':
            return {
                userStatus: client_1.UserStatus.BLOCKED,
                onboardingStatus: "SUSPENDED"
            };
        case 'PENDING':
            return {
                userStatus: client_1.UserStatus.BLOCKED,
                onboardingStatus: "PENDING"
            };
        case 'INACTIVE':
        default:
            return {
                userStatus: client_1.UserStatus.BLOCKED,
                onboardingStatus: "APPROVED"
            };
    }
};
exports.AdminStaffService = {
    async registerAdminStaff(data) {
        const normalizeOptional = (value) => {
            if (value === undefined)
                return undefined;
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
        const phoneCandidates = Array.from(new Set([...buildPhoneCandidates(phone), normalizedPhone]));
        const [existingEmailUser, existingPhoneUser] = await Promise.all([
            email
                ? db_1.default.user.findFirst({
                    where: { email },
                    select: { id: true }
                })
                : Promise.resolve(null),
            db_1.default.user.findFirst({
                where: {
                    OR: phoneCandidates.map((candidatePhone) => ({ phone: candidatePhone }))
                },
                select: { id: true }
            })
        ]);
        if (existingEmailUser) {
            throw new Error("Email already exists");
        }
        if (existingPhoneUser) {
            throw new Error("Phone number already exists");
        }
        const createdUser = await db_1.default.user.create({
            data: {
                name,
                email,
                phone: normalizedPhone,
                role: roles_1.ADMIN_AS_VENDOR_ROLE,
                status: persistenceStatus.userStatus,
                onboardingStatus: persistenceStatus.onboardingStatus
            }
        });
        const publicCode = (0, publicCodes_1.buildUserPublicCode)(roles_1.ADMIN_AS_VENDOR_ROLE, createdUser.id);
        return db_1.default.user.update({
            where: { id: createdUser.id },
            data: { publicCode },
            select: ADMIN_STAFF_SELECT
        });
    },
    async getAllAdminStaff(limit = 50, offset = 0) {
        const [staff, total] = await Promise.all([
            db_1.default.user.findMany({
                where: {
                    role: roles_1.ADMIN_AS_VENDOR_ROLE
                },
                select: ADMIN_STAFF_SELECT,
                orderBy: {
                    createdAt: 'desc'
                },
                take: limit,
                skip: offset
            }),
            db_1.default.user.count({
                where: {
                    role: roles_1.ADMIN_AS_VENDOR_ROLE
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
    async getAdminStaffById(staffId) {
        const staff = await db_1.default.user.findFirst({
            where: {
                id: staffId,
                role: roles_1.ADMIN_AS_VENDOR_ROLE
            },
            select: ADMIN_STAFF_SELECT
        });
        if (!staff) {
            throw new Error("Staff member not found");
        }
        return staff;
    },
    async updateAdminStaffStatus(staffId, status) {
        const normalizedStatus = normalizeAdminStaffStatus(status);
        const persistenceStatus = resolveAdminStaffPersistenceStatus(normalizedStatus);
        const updated = await db_1.default.user.updateMany({
            where: {
                id: staffId,
                role: roles_1.ADMIN_AS_VENDOR_ROLE
            },
            data: {
                status: persistenceStatus.userStatus,
                onboardingStatus: persistenceStatus.onboardingStatus
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

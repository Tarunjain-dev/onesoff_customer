"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminProfileService = void 0;
const client_1 = require("@prisma/client");
const db_1 = __importDefault(require("../config/db"));
const roles_1 = require("../utils/roles");
const adminProfileSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    status: true,
    onboardingStatus: true,
    createdAt: true
};
exports.AdminProfileService = {
    async getProfile(adminUserId) {
        const profile = await db_1.default.user.findFirst({
            where: { id: BigInt(adminUserId), role: { in: roles_1.ADMIN_PORTAL_ROLES } },
            select: adminProfileSelect
        });
        if (!profile) {
            throw new Error('Admin not found');
        }
        return profile;
    },
    async updateProfile(adminUserId, payload) {
        const admin = await db_1.default.user.findFirst({
            where: { id: BigInt(adminUserId), role: { in: roles_1.ADMIN_PORTAL_ROLES } },
            select: { id: true }
        });
        if (!admin) {
            throw new Error('Admin not found');
        }
        const data = {};
        if (payload.name !== undefined) {
            const name = payload.name.trim();
            if (!name) {
                throw new Error('Name cannot be empty');
            }
            data.name = name;
        }
        if (payload.email !== undefined) {
            data.email = payload.email && payload.email.trim() ? payload.email.trim() : null;
        }
        if (payload.phone !== undefined) {
            data.phone = payload.phone && payload.phone.trim() ? payload.phone.trim() : null;
        }
        if (Object.keys(data).length === 0) {
            throw new Error('At least one field is required to update profile');
        }
        try {
            return await db_1.default.user.update({
                where: { id: admin.id },
                data,
                select: adminProfileSelect
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new Error('Email or phone already exists');
            }
            throw error;
        }
    }
};

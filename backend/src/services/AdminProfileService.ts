import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { ADMIN_PORTAL_ROLES } from '../utils/roles';

type UpdateAdminProfileInput = {
  name?: string;
  email?: string | null;
  phone?: string | null;
};

const adminProfileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  onboardingStatus: true,
  createdAt: true
} as const;

export const AdminProfileService = {
  async getProfile(adminUserId: string) {
    const profile = await prisma.user.findFirst({
      where: { id: BigInt(adminUserId), role: { in: ADMIN_PORTAL_ROLES } },
      select: adminProfileSelect
    });

    if (!profile) {
      throw new Error('Admin not found');
    }

    return profile;
  },

  async updateProfile(adminUserId: string, payload: UpdateAdminProfileInput) {
    const admin = await prisma.user.findFirst({
      where: { id: BigInt(adminUserId), role: { in: ADMIN_PORTAL_ROLES } },
      select: { id: true }
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    const data: UpdateAdminProfileInput = {};

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
      return await prisma.user.update({
        where: { id: admin.id },
        data,
        select: adminProfileSelect
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error('Email or phone already exists');
      }
      throw error;
    }
  }
};

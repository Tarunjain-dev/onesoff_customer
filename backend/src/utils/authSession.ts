import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UserRole, UserStatus } from '@prisma/client';
import prisma from '@/config/db';

export type SessionBackedAccessPayload = {
  userId: string;
  role: UserRole;
  sessionId: string;
  customerId?: string;
  vendorId?: string;
  adminId?: string;
};

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const ACCESS_TOKEN_TTL = String(process.env.ACCESS_TOKEN_TTL || '15m').trim();
const ACCESS_TOKEN_EXPIRES_IN = ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'];
const REFRESH_TOKEN_TTL_DAYS = Math.max(
  1,
  Number.parseInt(String(process.env.REFRESH_TOKEN_TTL_DAYS || '7').trim(), 10) || 7
);

const requireBigInt = (value: string, fieldName: string) => {
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Invalid ${fieldName}`);
  }
};

const buildRefreshExpiry = () =>
  new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

export const generateRefreshToken = () => crypto.randomBytes(48).toString('hex');

export const createAccessToken = (payload: SessionBackedAccessPayload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });

export const createAuthSession = async (params: {
  userId: string;
  deviceInfo?: string | null;
  ipAddress?: string | null;
}) => {
  const refreshToken = generateRefreshToken();
  const session = await prisma.authSession.create({
    data: {
      userId: requireBigInt(params.userId, 'userId'),
      refreshToken,
      deviceInfo: params.deviceInfo || null,
      ipAddress: params.ipAddress || null,
      expiresAt: buildRefreshExpiry()
    }
  });

  return { session, refreshToken };
};

export const rotateAuthSession = async (params: {
  sessionId: string;
  userId: string;
  deviceInfo?: string | null;
  ipAddress?: string | null;
}) => {
  const refreshToken = generateRefreshToken();
  const existingSession = await prisma.authSession.findFirst({
    where: {
      id: requireBigInt(params.sessionId, 'sessionId'),
      userId: requireBigInt(params.userId, 'userId')
    },
    select: {
      id: true
    }
  });

  if (!existingSession) {
    throw new Error('Session expired. Please login again.');
  }

  const session = await prisma.authSession.update({
    where: {
      id: existingSession.id
    },
    data: {
      refreshToken,
      deviceInfo: params.deviceInfo || null,
      ipAddress: params.ipAddress || null,
      expiresAt: buildRefreshExpiry()
    }
  });

  return { session, refreshToken };
};

export const parseBearerToken = (authorizationHeader?: string | null) => {
  if (!authorizationHeader) return '';
  return authorizationHeader.replace(/^Bearer\s+/i, '').trim();
};

export const verifySessionBackedAccessToken = async (
  token: string
): Promise<SessionBackedAccessPayload | null> => {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    const userId = String(payload?.userId || '').trim();
    const role = String(payload?.role || '').trim().toUpperCase() as UserRole;
    const sessionId = String(payload?.sessionId || '').trim();

    if (!userId || !role || !sessionId) {
      return null;
    }

    const session = await prisma.authSession.findFirst({
      where: {
        id: requireBigInt(sessionId, 'sessionId'),
        userId: requireBigInt(userId, 'userId'),
        expiresAt: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        user: {
          select: {
            status: true
          }
        }
      }
    });

    if (!session || session.user?.status !== UserStatus.ACTIVE) {
      return null;
    }

    return {
      userId,
      role,
      sessionId,
      customerId: payload?.customerId ? String(payload.customerId).trim() : undefined,
      vendorId: payload?.vendorId ? String(payload.vendorId).trim() : undefined,
      adminId: payload?.adminId ? String(payload.adminId).trim() : undefined
    };
  } catch {
    return null;
  }
};

export const revokeAuthSessionByRefreshToken = async (refreshToken?: string | null) => {
  const normalized = String(refreshToken || '').trim();
  if (!normalized) return 0;
  const result = await prisma.authSession.deleteMany({
    where: { refreshToken: normalized }
  });
  return Number(result.count || 0);
};

export const revokeAuthSessionById = async (sessionId?: string | null, userId?: string | null) => {
  const normalizedSessionId = String(sessionId || '').trim();
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedSessionId) return 0;

  const where: Record<string, unknown> = {
    id: requireBigInt(normalizedSessionId, 'sessionId')
  };
  if (normalizedUserId) {
    where.userId = requireBigInt(normalizedUserId, 'userId');
  }

  const result = await prisma.authSession.deleteMany({
    where
  });
  return Number(result.count || 0);
};

export const getRefreshTokenTtlDays = () => REFRESH_TOKEN_TTL_DAYS;
export const getAccessTokenTtl = () => ACCESS_TOKEN_TTL;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessTokenTtl = exports.getRefreshTokenTtlDays = exports.revokeAuthSessionById = exports.revokeAuthSessionByRefreshToken = exports.verifySessionBackedAccessToken = exports.parseBearerToken = exports.rotateAuthSession = exports.createAuthSession = exports.createAccessToken = exports.generateRefreshToken = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const db_1 = __importDefault(require("@/config/db"));
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
const ACCESS_TOKEN_TTL = String(process.env.ACCESS_TOKEN_TTL || '15m').trim();
const ACCESS_TOKEN_EXPIRES_IN = ACCESS_TOKEN_TTL;
const REFRESH_TOKEN_TTL_DAYS = Math.max(1, Number.parseInt(String(process.env.REFRESH_TOKEN_TTL_DAYS || '7').trim(), 10) || 7);
const requireBigInt = (value, fieldName) => {
    try {
        return BigInt(value);
    }
    catch {
        throw new Error(`Invalid ${fieldName}`);
    }
};
const buildRefreshExpiry = () => new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
const generateRefreshToken = () => crypto_1.default.randomBytes(48).toString('hex');
exports.generateRefreshToken = generateRefreshToken;
const createAccessToken = (payload) => jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
exports.createAccessToken = createAccessToken;
const createAuthSession = async (params) => {
    const refreshToken = (0, exports.generateRefreshToken)();
    const session = await db_1.default.authSession.create({
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
exports.createAuthSession = createAuthSession;
const rotateAuthSession = async (params) => {
    const refreshToken = (0, exports.generateRefreshToken)();
    const existingSession = await db_1.default.authSession.findFirst({
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
    const session = await db_1.default.authSession.update({
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
exports.rotateAuthSession = rotateAuthSession;
const parseBearerToken = (authorizationHeader) => {
    if (!authorizationHeader)
        return '';
    return authorizationHeader.replace(/^Bearer\s+/i, '').trim();
};
exports.parseBearerToken = parseBearerToken;
const verifySessionBackedAccessToken = async (token) => {
    if (!token)
        return null;
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const userId = String(payload?.userId || '').trim();
        const role = String(payload?.role || '').trim().toUpperCase();
        const sessionId = String(payload?.sessionId || '').trim();
        if (!userId || !role || !sessionId) {
            return null;
        }
        const session = await db_1.default.authSession.findFirst({
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
        if (!session || session.user?.status !== client_1.UserStatus.ACTIVE) {
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
    }
    catch {
        return null;
    }
};
exports.verifySessionBackedAccessToken = verifySessionBackedAccessToken;
const revokeAuthSessionByRefreshToken = async (refreshToken) => {
    const normalized = String(refreshToken || '').trim();
    if (!normalized)
        return 0;
    const result = await db_1.default.authSession.deleteMany({
        where: { refreshToken: normalized }
    });
    return Number(result.count || 0);
};
exports.revokeAuthSessionByRefreshToken = revokeAuthSessionByRefreshToken;
const revokeAuthSessionById = async (sessionId, userId) => {
    const normalizedSessionId = String(sessionId || '').trim();
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedSessionId)
        return 0;
    const where = {
        id: requireBigInt(normalizedSessionId, 'sessionId')
    };
    if (normalizedUserId) {
        where.userId = requireBigInt(normalizedUserId, 'userId');
    }
    const result = await db_1.default.authSession.deleteMany({
        where
    });
    return Number(result.count || 0);
};
exports.revokeAuthSessionById = revokeAuthSessionById;
const getRefreshTokenTtlDays = () => REFRESH_TOKEN_TTL_DAYS;
exports.getRefreshTokenTtlDays = getRefreshTokenTtlDays;
const getAccessTokenTtl = () => ACCESS_TOKEN_TTL;
exports.getAccessTokenTtl = getAccessTokenTtl;

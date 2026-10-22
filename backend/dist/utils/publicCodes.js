"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTemporaryOrderNo = exports.buildOrderNo = exports.buildUserPublicCode = exports.getPublicCodePrefix = void 0;
const client_1 = require("@prisma/client");
const DEFAULT_SEQUENCE_WIDTH = 6;
const toBigIntValue = (value) => {
    return typeof value === 'bigint' ? value : BigInt(value);
};
const padSequence = (value, width = DEFAULT_SEQUENCE_WIDTH) => {
    return toBigIntValue(value).toString().padStart(width, '0');
};
const formatYearMonth = (value) => {
    const parsed = value ? new Date(value) : new Date();
    const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}${month}`;
};
const getPublicCodePrefix = (role) => {
    const normalized = String(role || '').trim().toUpperCase();
    if (normalized === client_1.UserRole.CUSTOMER)
        return 'CUS';
    if (normalized === client_1.UserRole.VENDOR)
        return 'VND';
    if (normalized === client_1.UserRole.INDIVIDUAL_VENDOR)
        return 'IND';
    if (normalized === client_1.UserRole.ADMIN)
        return 'ADM';
    if (normalized === client_1.UserRole.ADMIN_AS_VENDOR)
        return 'AAV';
    return 'USR';
};
exports.getPublicCodePrefix = getPublicCodePrefix;
const buildUserPublicCode = (role, userId) => {
    return `${(0, exports.getPublicCodePrefix)(role)}-${padSequence(userId)}`;
};
exports.buildUserPublicCode = buildUserPublicCode;
const buildOrderNo = (orderId, createdAt) => {
    return `ORD-${formatYearMonth(createdAt)}-${padSequence(orderId)}`;
};
exports.buildOrderNo = buildOrderNo;
const buildTemporaryOrderNo = () => {
    const randomToken = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `TMP-${Date.now()}-${randomToken}`;
};
exports.buildTemporaryOrderNo = buildTemporaryOrderNo;

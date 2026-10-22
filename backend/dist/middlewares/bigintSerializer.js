"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bigintSerializerMiddleware = void 0;
const convertBigIntToString = (obj) => {
    if (typeof obj === 'bigint') {
        return obj.toString();
    }
    if (obj instanceof Date) {
        return obj.toISOString();
    }
    // Prisma Decimal / decimal-like objects
    if (obj !== null &&
        typeof obj === 'object' &&
        typeof obj.toNumber === 'function' &&
        typeof obj.toString === 'function') {
        const numericValue = obj.toNumber();
        return Number.isFinite(numericValue) ? numericValue : obj.toString();
    }
    if (Array.isArray(obj)) {
        return obj.map(convertBigIntToString);
    }
    if (obj !== null && typeof obj === 'object') {
        const converted = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                converted[key] = convertBigIntToString(obj[key]);
            }
        }
        return converted;
    }
    return obj;
};
const bigintSerializerMiddleware = (req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
        const convertedBody = convertBigIntToString(body);
        return originalJson.call(this, convertedBody);
    };
    next();
};
exports.bigintSerializerMiddleware = bigintSerializerMiddleware;

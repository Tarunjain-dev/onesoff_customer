"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertCustomerProfileDetails = exports.readCustomerProfileDetails = void 0;
const db_1 = __importDefault(require("../config/db"));
const normalizeNullableString = (value) => {
    if (value === undefined || value === null)
        return null;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
};
const normalizeNullableDate = (value) => {
    if (value === undefined || value === null || value === '')
        return null;
    if (value instanceof Date)
        return value;
    const parsed = new Date(String(value));
    return Number.isFinite(parsed.getTime()) ? parsed : null;
};
const readCustomerProfileDetails = async (userId) => {
    return db_1.default.customerProfile.findUnique({
        where: { userId },
        select: {
            userId: true,
            email: true,
            gender: true,
            dob: true,
            aadharNumber: true,
            addressLine1: true,
            landmark: true,
            pincode: true,
            city: true,
            state: true,
            additionalInfo: true
        }
    });
};
exports.readCustomerProfileDetails = readCustomerProfileDetails;
const upsertCustomerProfileDetails = async (userId, data) => {
    const existing = await (0, exports.readCustomerProfileDetails)(userId);
    const next = {
        email: normalizeNullableString(data.email) ??
            existing?.email ??
            null,
        gender: normalizeNullableString(data.gender) ??
            existing?.gender ??
            null,
        dob: normalizeNullableDate(data.dob) ?? existing?.dob ?? null,
        aadharNumber: normalizeNullableString(data.aadharNumber) ??
            existing?.aadharNumber ??
            null,
        addressLine1: normalizeNullableString(data.addressLine1) ??
            existing?.addressLine1 ??
            null,
        landmark: normalizeNullableString(data.landmark) ??
            existing?.landmark ??
            null,
        pincode: normalizeNullableString(data.pincode) ??
            existing?.pincode ??
            null,
        city: normalizeNullableString(data.city) ??
            existing?.city ??
            null,
        state: normalizeNullableString(data.state) ??
            existing?.state ??
            null,
        additionalInfo: normalizeNullableString(data.additionalInfo) ??
            existing?.additionalInfo ??
            null
    };
    return db_1.default.customerProfile.upsert({
        where: { userId },
        create: {
            userId,
            ...next
        },
        update: next,
        select: {
            userId: true,
            email: true,
            gender: true,
            dob: true,
            aadharNumber: true,
            addressLine1: true,
            landmark: true,
            pincode: true,
            city: true,
            state: true,
            additionalInfo: true
        }
    });
};
exports.upsertCustomerProfileDetails = upsertCustomerProfileDetails;

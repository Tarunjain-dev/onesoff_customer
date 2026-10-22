"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionService = void 0;
const db_1 = __importDefault(require("../config/db"));
const PLATFORM_SETTINGS_ID = 'default';
const DEFAULT_COMMISSION_SETTINGS = {
    defaultCommission: 15,
    individualVendorDefaultCommission: 15,
    goldVendorCommission: 12,
    silverVendorCommission: 13,
    platinumVendorCommission: 10,
    categoryCommission: [
        { category: 'Saree', commission: '15' },
        { category: 'Lehenga', commission: '18' },
        { category: 'Sherwani', commission: '15' },
        { category: 'Accessories', commission: '20' }
    ]
};
const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const clampCommission = (value) => {
    const normalized = toNumber(value);
    if (!Number.isFinite(normalized))
        return 0;
    return Math.max(0, Math.min(100, normalized));
};
const resolveVendorRole = (vendor) => {
    const normalizedRole = String(vendor?.role ?? vendor?.user?.role ?? '')
        .trim()
        .toUpperCase();
    if (normalizedRole)
        return normalizedRole;
    const vendorCategory = String(vendor?.vendorCategory || '')
        .trim()
        .toLowerCase();
    if (vendorCategory === 'individual_owner') {
        return 'INDIVIDUAL_VENDOR';
    }
    return null;
};
const hasVendorRoleContext = (vendor) => Boolean(resolveVendorRole(vendor));
const normalizeCategoryCommission = (value) => {
    if (!Array.isArray(value)) {
        return DEFAULT_COMMISSION_SETTINGS.categoryCommission;
    }
    return value
        .map((row) => {
        const normalizedRow = row;
        return {
            category: String(normalizedRow?.category || '').trim(),
            commission: String(clampCommission(normalizedRow?.commission))
        };
    })
        .filter((row) => row.category);
};
const isMissingTableError = (error) => {
    const code = error?.code;
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return code === 'P2021' || message.includes('does not exist in the current database');
};
exports.CommissionService = {
    async getCommissionSettings() {
        try {
            const row = await db_1.default.platformSetting.upsert({
                where: { id: PLATFORM_SETTINGS_ID },
                update: {},
                create: {
                    id: PLATFORM_SETTINGS_ID,
                    ...DEFAULT_COMMISSION_SETTINGS
                }
            });
            return {
                defaultCommission: clampCommission(row.defaultCommission),
                individualVendorDefaultCommission: clampCommission(row.individualVendorDefaultCommission),
                goldVendorCommission: clampCommission(row.goldVendorCommission),
                silverVendorCommission: clampCommission(row.silverVendorCommission),
                platinumVendorCommission: clampCommission(row.platinumVendorCommission),
                categoryCommission: Array.isArray(row.categoryCommission)
                    ? row.categoryCommission
                    : DEFAULT_COMMISSION_SETTINGS.categoryCommission
            };
        }
        catch (error) {
            if (!isMissingTableError(error))
                throw error;
            return { ...DEFAULT_COMMISSION_SETTINGS };
        }
    },
    async updateCommissionSettings(payload) {
        const existing = await this.getCommissionSettings();
        const nextData = {
            defaultCommission: clampCommission(payload.defaultCommission ?? existing.defaultCommission),
            individualVendorDefaultCommission: clampCommission(payload.individualVendorDefaultCommission ??
                existing.individualVendorDefaultCommission),
            goldVendorCommission: clampCommission(payload.goldVendorCommission ?? existing.goldVendorCommission),
            silverVendorCommission: clampCommission(payload.silverVendorCommission ?? existing.silverVendorCommission),
            platinumVendorCommission: clampCommission(payload.platinumVendorCommission ?? existing.platinumVendorCommission),
            categoryCommission: normalizeCategoryCommission(payload.categoryCommission ?? existing.categoryCommission)
        };
        try {
            const row = await db_1.default.platformSetting.upsert({
                where: { id: PLATFORM_SETTINGS_ID },
                update: nextData,
                create: {
                    id: PLATFORM_SETTINGS_ID,
                    ...nextData
                }
            });
            return {
                defaultCommission: clampCommission(row.defaultCommission),
                individualVendorDefaultCommission: clampCommission(row.individualVendorDefaultCommission),
                goldVendorCommission: clampCommission(row.goldVendorCommission),
                silverVendorCommission: clampCommission(row.silverVendorCommission),
                platinumVendorCommission: clampCommission(row.platinumVendorCommission),
                categoryCommission: Array.isArray(row.categoryCommission)
                    ? row.categoryCommission
                    : nextData.categoryCommission
            };
        }
        catch (error) {
            if (!isMissingTableError(error))
                throw error;
            return nextData;
        }
    },
    resolveEffectiveCommissionRate(vendor, settings) {
        const overrideRaw = vendor?.commissionOverridePercentage;
        if (overrideRaw !== undefined && overrideRaw !== null) {
            return clampCommission(overrideRaw);
        }
        if (resolveVendorRole(vendor) === 'INDIVIDUAL_VENDOR') {
            return clampCommission(settings.individualVendorDefaultCommission ?? settings.defaultCommission);
        }
        return clampCommission(settings.defaultCommission);
    },
    async getEffectiveCommissionRateForVendorProfile(vendorProfileId, vendor) {
        const [settings, resolvedVendor] = await Promise.all([
            this.getCommissionSettings(),
            vendor && hasVendorRoleContext(vendor)
                ? Promise.resolve(vendor)
                : db_1.default.vendorProfile.findUnique({
                    where: { id: vendorProfileId },
                    select: {
                        commissionOverridePercentage: true,
                        commissionPercentage: true,
                        commissionRate: true,
                        user: {
                            select: {
                                role: true
                            }
                        }
                    }
                })
        ]);
        return this.resolveEffectiveCommissionRate(resolvedVendor, settings);
    }
};

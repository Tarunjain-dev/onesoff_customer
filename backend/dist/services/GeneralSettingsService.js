"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENERAL_SETTINGS_FIELDS = exports.DEFAULT_GENERAL_SETTINGS = exports.GeneralSettingsService = void 0;
const db_1 = __importDefault(require("../config/db"));
const PLATFORM_SETTINGS_ID = 'default';
const DEFAULT_GENERAL_SETTINGS = {
    location: ['mumbai'],
    address: '123 Business Park, Andheri East, Mumbai - 400093',
    contactNumber: '+91 9876543210',
    whatsappNumber: '+91 9876543210',
    customerCareEmail: 'care@onesoff.com',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.onesoff',
    appStoreUrl: 'https://apps.apple.com/app/onesoff/id123456789',
    facebookUrl: 'https://facebook.com/onesoff',
    instagramUrl: 'https://instagram.com/onesoff',
    twitterUrl: 'https://twitter.com/onesoff',
    linkedinUrl: 'https://linkedin.com/company/onesoff'
};
exports.DEFAULT_GENERAL_SETTINGS = DEFAULT_GENERAL_SETTINGS;
const GENERAL_SETTINGS_FIELDS = [
    'location',
    'address',
    'contactNumber',
    'whatsappNumber',
    'customerCareEmail',
    'playStoreUrl',
    'appStoreUrl',
    'facebookUrl',
    'instagramUrl',
    'twitterUrl',
    'linkedinUrl'
];
exports.GENERAL_SETTINGS_FIELDS = GENERAL_SETTINGS_FIELDS;
const isMissingTableError = (error) => {
    const code = error?.code;
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return code === 'P2021' || message.includes('does not exist in the current database');
};
const normalizeString = (value, fallback) => {
    if (typeof value !== 'string')
        return fallback;
    return value.trim();
};
const normalizeLocation = (value, fallback) => {
    if (!Array.isArray(value)) {
        return fallback;
    }
    const normalized = value
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    return normalized.length > 0 ? Array.from(new Set(normalized)) : fallback;
};
const normalizeSettings = (source, fallback) => ({
    location: normalizeLocation(source?.location, fallback.location),
    address: normalizeString(source?.address, fallback.address),
    contactNumber: normalizeString(source?.contactNumber, fallback.contactNumber),
    whatsappNumber: normalizeString(source?.whatsappNumber, fallback.whatsappNumber),
    customerCareEmail: normalizeString(source?.customerCareEmail, fallback.customerCareEmail),
    playStoreUrl: normalizeString(source?.playStoreUrl, fallback.playStoreUrl),
    appStoreUrl: normalizeString(source?.appStoreUrl, fallback.appStoreUrl),
    facebookUrl: normalizeString(source?.facebookUrl, fallback.facebookUrl),
    instagramUrl: normalizeString(source?.instagramUrl, fallback.instagramUrl),
    twitterUrl: normalizeString(source?.twitterUrl, fallback.twitterUrl),
    linkedinUrl: normalizeString(source?.linkedinUrl, fallback.linkedinUrl)
});
const upsertSettingsRow = async (data) => db_1.default.platformSetting.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    update: data,
    create: {
        id: PLATFORM_SETTINGS_ID,
        ...data
    }
});
exports.GeneralSettingsService = {
    async getGeneralSettings() {
        try {
            const row = await db_1.default.platformSetting.upsert({
                where: { id: PLATFORM_SETTINGS_ID },
                update: {},
                create: {
                    id: PLATFORM_SETTINGS_ID
                }
            });
            return normalizeSettings(row, DEFAULT_GENERAL_SETTINGS);
        }
        catch (error) {
            if (!isMissingTableError(error))
                throw error;
            return { ...DEFAULT_GENERAL_SETTINGS };
        }
    },
    async createGeneralSettings(payload) {
        const current = await this.getGeneralSettings();
        const nextData = normalizeSettings(payload, current);
        try {
            const row = await upsertSettingsRow(nextData);
            return normalizeSettings(row, nextData);
        }
        catch (error) {
            if (!isMissingTableError(error))
                throw error;
            return nextData;
        }
    },
    async updateGeneralSettings(payload) {
        const nextData = normalizeSettings(payload, DEFAULT_GENERAL_SETTINGS);
        try {
            const row = await upsertSettingsRow(nextData);
            return normalizeSettings(row, nextData);
        }
        catch (error) {
            if (!isMissingTableError(error))
                throw error;
            return nextData;
        }
    },
    async deleteGeneralSettings(field) {
        const normalizedField = String(field || '').trim();
        const current = await this.getGeneralSettings();
        const nextData = normalizedField && GENERAL_SETTINGS_FIELDS.includes(normalizedField)
            ? {
                ...current,
                [normalizedField]: DEFAULT_GENERAL_SETTINGS[normalizedField]
            }
            : { ...DEFAULT_GENERAL_SETTINGS };
        try {
            const row = await upsertSettingsRow(nextData);
            return normalizeSettings(row, nextData);
        }
        catch (error) {
            if (!isMissingTableError(error))
                throw error;
            return nextData;
        }
    }
};

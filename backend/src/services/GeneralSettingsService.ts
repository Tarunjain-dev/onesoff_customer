import prisma from '../config/db';

const PLATFORM_SETTINGS_ID = 'default';

export type GeneralSettingsPayload = {
  location?: unknown;
  address?: unknown;
  contactNumber?: unknown;
  whatsappNumber?: unknown;
  customerCareEmail?: unknown;
  playStoreUrl?: unknown;
  appStoreUrl?: unknown;
  facebookUrl?: unknown;
  instagramUrl?: unknown;
  twitterUrl?: unknown;
  linkedinUrl?: unknown;
};

export type GeneralSettingsRecord = {
  location: string[];
  address: string;
  contactNumber: string;
  whatsappNumber: string;
  customerCareEmail: string;
  playStoreUrl: string;
  appStoreUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
};

const DEFAULT_GENERAL_SETTINGS: GeneralSettingsRecord = {
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
] as const;

type GeneralSettingsField = (typeof GENERAL_SETTINGS_FIELDS)[number];

const isMissingTableError = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return code === 'P2021' || message.includes('does not exist in the current database');
};

const normalizeString = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  return value.trim();
};

const normalizeLocation = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return normalized.length > 0 ? Array.from(new Set(normalized)) : fallback;
};

const normalizeSettings = (
  source: Partial<Record<GeneralSettingsField, unknown>> | null | undefined,
  fallback: GeneralSettingsRecord
): GeneralSettingsRecord => ({
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

const upsertSettingsRow = async (data: Partial<GeneralSettingsRecord>) =>
  prisma.platformSetting.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    update: data,
    create: {
      id: PLATFORM_SETTINGS_ID,
      ...data
    }
  });

export const GeneralSettingsService = {
  async getGeneralSettings() {
    try {
      const row = await prisma.platformSetting.upsert({
        where: { id: PLATFORM_SETTINGS_ID },
        update: {},
        create: {
          id: PLATFORM_SETTINGS_ID
        }
      });

      return normalizeSettings(row as Partial<Record<GeneralSettingsField, unknown>>, DEFAULT_GENERAL_SETTINGS);
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
      return { ...DEFAULT_GENERAL_SETTINGS };
    }
  },

  async createGeneralSettings(payload: GeneralSettingsPayload) {
    const current = await this.getGeneralSettings();
    const nextData = normalizeSettings(payload, current);

    try {
      const row = await upsertSettingsRow(nextData);
      return normalizeSettings(row as Partial<Record<GeneralSettingsField, unknown>>, nextData);
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
      return nextData;
    }
  },

  async updateGeneralSettings(payload: GeneralSettingsPayload) {
    const nextData = normalizeSettings(payload, DEFAULT_GENERAL_SETTINGS);

    try {
      const row = await upsertSettingsRow(nextData);
      return normalizeSettings(row as Partial<Record<GeneralSettingsField, unknown>>, nextData);
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
      return nextData;
    }
  },

  async deleteGeneralSettings(field?: string) {
    const normalizedField = String(field || '').trim() as GeneralSettingsField;
    const current = await this.getGeneralSettings();

    const nextData =
      normalizedField && GENERAL_SETTINGS_FIELDS.includes(normalizedField)
        ? {
            ...current,
            [normalizedField]: DEFAULT_GENERAL_SETTINGS[normalizedField]
          }
        : { ...DEFAULT_GENERAL_SETTINGS };

    try {
      const row = await upsertSettingsRow(nextData);
      return normalizeSettings(row as Partial<Record<GeneralSettingsField, unknown>>, nextData);
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
      return nextData;
    }
  }
};

export { DEFAULT_GENERAL_SETTINGS, GENERAL_SETTINGS_FIELDS };

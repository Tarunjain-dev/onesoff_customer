import prisma from '../config/db';

export type CustomerProfileDetails = {
  userId: bigint;
  email: string | null;
  gender: string | null;
  dob: Date | null;
  aadharNumber: string | null;
  addressLine1: string | null;
  landmark: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
  additionalInfo: string | null;
};

const normalizeNullableString = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeNullableDate = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export const readCustomerProfileDetails = async (
  userId: bigint
): Promise<CustomerProfileDetails | null> => {
  return prisma.customerProfile.findUnique({
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

export const upsertCustomerProfileDetails = async (
  userId: bigint,
  data: {
    email?: unknown;
    gender?: unknown;
    dob?: unknown;
    aadharNumber?: unknown;
    addressLine1?: unknown;
    landmark?: unknown;
    pincode?: unknown;
    city?: unknown;
    state?: unknown;
    additionalInfo?: unknown;
  }
) => {
  const existing = await readCustomerProfileDetails(userId);
  const next = {
    email:
      normalizeNullableString(data.email) ??
      existing?.email ??
      null,
    gender:
      normalizeNullableString(data.gender) ??
      existing?.gender ??
      null,
    dob: normalizeNullableDate(data.dob) ?? existing?.dob ?? null,
    aadharNumber:
      normalizeNullableString(data.aadharNumber) ??
      existing?.aadharNumber ??
      null,
    addressLine1:
      normalizeNullableString(data.addressLine1) ??
      existing?.addressLine1 ??
      null,
    landmark:
      normalizeNullableString(data.landmark) ??
      existing?.landmark ??
      null,
    pincode:
      normalizeNullableString(data.pincode) ??
      existing?.pincode ??
      null,
    city:
      normalizeNullableString(data.city) ??
      existing?.city ??
      null,
    state:
      normalizeNullableString(data.state) ??
      existing?.state ??
      null,
    additionalInfo:
      normalizeNullableString(data.additionalInfo) ??
      existing?.additionalInfo ??
      null
  };

  return prisma.customerProfile.upsert({
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

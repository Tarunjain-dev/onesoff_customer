import { UserRole } from '@prisma/client';

const DEFAULT_SEQUENCE_WIDTH = 6;

const toBigIntValue = (value: string | number | bigint) => {
  return typeof value === 'bigint' ? value : BigInt(value);
};

const padSequence = (value: string | number | bigint, width = DEFAULT_SEQUENCE_WIDTH) => {
  return toBigIntValue(value).toString().padStart(width, '0');
};

const formatYearMonth = (value?: Date | string | null) => {
  const parsed = value ? new Date(value) : new Date();
  const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
};

export const getPublicCodePrefix = (role: UserRole | string | null | undefined) => {
  const normalized = String(role || '').trim().toUpperCase();

  if (normalized === UserRole.CUSTOMER) return 'CUS';
  if (normalized === UserRole.VENDOR) return 'VND';
  if (normalized === UserRole.INDIVIDUAL_VENDOR) return 'IND';
  if (normalized === UserRole.ADMIN) return 'ADM';
  if (normalized === UserRole.ADMIN_AS_VENDOR) return 'AAV';

  return 'USR';
};

export const buildUserPublicCode = (
  role: UserRole | string | null | undefined,
  userId: string | number | bigint
) => {
  return `${getPublicCodePrefix(role)}-${padSequence(userId)}`;
};

export const buildOrderNo = (
  orderId: string | number | bigint,
  createdAt?: Date | string | null
) => {
  return `ORD-${formatYearMonth(createdAt)}-${padSequence(orderId)}`;
};

export const buildTemporaryOrderNo = () => {
  const randomToken = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TMP-${Date.now()}-${randomToken}`;
};

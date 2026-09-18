import { UserRole } from '@prisma/client';

export const INDIVIDUAL_VENDOR_ROLE = UserRole.INDIVIDUAL_VENDOR;
export const ADMIN_AS_VENDOR_ROLE = UserRole.ADMIN_AS_VENDOR;

export const SHOP_VENDOR_ROLES: UserRole[] = [UserRole.VENDOR];
export const INDIVIDUAL_VENDOR_ROLES: UserRole[] = [INDIVIDUAL_VENDOR_ROLE];
export const VENDOR_ROLES: UserRole[] = [UserRole.VENDOR, INDIVIDUAL_VENDOR_ROLE];
export const MANAGED_VENDOR_ROLES: UserRole[] = [INDIVIDUAL_VENDOR_ROLE];
export const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN];
export const ADMIN_AS_VENDOR_ROLES: UserRole[] = [ADMIN_AS_VENDOR_ROLE];
export const ADMIN_PORTAL_ROLES: UserRole[] = [UserRole.ADMIN, ADMIN_AS_VENDOR_ROLE];

export const isVendorRole = (role: UserRole | string | null | undefined) =>
  VENDOR_ROLES.includes(String(role || '') as UserRole);

export const isAdminRole = (role: UserRole | string | null | undefined) =>
  ADMIN_ROLES.includes(String(role || '') as UserRole);

export const isAdminAsVendorRole = (role: UserRole | string | null | undefined) =>
  ADMIN_AS_VENDOR_ROLES.includes(String(role || '') as UserRole);

export const expandAuthorizedRoles = (roles: UserRole[]) => {
  return Array.from(new Set<UserRole>(roles));
};

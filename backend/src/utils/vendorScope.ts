import { UserRole } from '@prisma/client';
import { VENDOR_ROLES } from './roles';

export type VendorRoleFilter = Record<string, any> | undefined;

export const getVendorUserRoleWhere = (roleFilter?: Record<string, any>) =>
  roleFilter && Object.keys(roleFilter).length > 0
    ? roleFilter
    : { role: { in: VENDOR_ROLES } };

export const getVendorProfileUserWhere = (roleFilter?: Record<string, any>) => ({
  user: getVendorUserRoleWhere(roleFilter)
});

export const getVendorRoleScope = (roleFilter?: Record<string, any>): UserRole[] => {
  const userWhere = getVendorUserRoleWhere(roleFilter);
  const roleClause = userWhere?.role;

  if (typeof roleClause === 'string') {
    return [roleClause as UserRole];
  }

  if (roleClause && typeof roleClause === 'object' && Array.isArray(roleClause.in)) {
    return roleClause.in as UserRole[];
  }

  return VENDOR_ROLES;
};

export const matchesVendorRoleScope = (role: unknown, roleFilter?: Record<string, any>) =>
  getVendorRoleScope(roleFilter).includes(String(role || '') as UserRole);

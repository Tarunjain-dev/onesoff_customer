"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesVendorRoleScope = exports.getVendorRoleScope = exports.getVendorProfileUserWhere = exports.getVendorUserRoleWhere = void 0;
const roles_1 = require("./roles");
const getVendorUserRoleWhere = (roleFilter) => roleFilter && Object.keys(roleFilter).length > 0
    ? roleFilter
    : { role: { in: roles_1.VENDOR_ROLES } };
exports.getVendorUserRoleWhere = getVendorUserRoleWhere;
const getVendorProfileUserWhere = (roleFilter) => ({
    user: (0, exports.getVendorUserRoleWhere)(roleFilter)
});
exports.getVendorProfileUserWhere = getVendorProfileUserWhere;
const getVendorRoleScope = (roleFilter) => {
    const userWhere = (0, exports.getVendorUserRoleWhere)(roleFilter);
    const roleClause = userWhere?.role;
    if (typeof roleClause === 'string') {
        return [roleClause];
    }
    if (roleClause && typeof roleClause === 'object' && Array.isArray(roleClause.in)) {
        return roleClause.in;
    }
    return roles_1.VENDOR_ROLES;
};
exports.getVendorRoleScope = getVendorRoleScope;
const matchesVendorRoleScope = (role, roleFilter) => (0, exports.getVendorRoleScope)(roleFilter).includes(String(role || ''));
exports.matchesVendorRoleScope = matchesVendorRoleScope;

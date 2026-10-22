"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorFilter = exports.authorizeAdmin = exports.authorize = exports.authenticate = void 0;
const roles_1 = require("@/utils/roles");
const authSession_1 = require("@/utils/authSession");
const authenticate = async (req, res, next) => {
    const token = (0, authSession_1.parseBearerToken)(req.headers.authorization);
    if (!token) {
        return res.status(401).json({ success: false, error: "Access token required" });
    }
    try {
        const payload = await (0, authSession_1.verifySessionBackedAccessToken)(token);
        if (!payload) {
            return res.status(401).json({ success: false, error: "Session expired. Please login again." });
        }
        req.user = {
            userId: payload.userId,
            role: payload.role,
            sessionId: payload.sessionId,
            customerId: payload.customerId || payload.userId,
            vendorId: payload.vendorId,
            adminId: payload.adminId
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ success: false, error: "Invalid token" });
    }
};
exports.authenticate = authenticate;
const authorize = (roles) => {
    return (req, res, next) => {
        const allowedRoles = (0, roles_1.expandAuthorizedRoles)(roles);
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: "Access denied" });
        }
        next();
    };
};
exports.authorize = authorize;
const authorizeAdmin = (req, res, next) => {
    if (!req.user || !roles_1.ADMIN_ROLES.includes(req.user.role)) {
        return res.status(403).json({ success: false, error: "Admin access required" });
    }
    next();
};
exports.authorizeAdmin = authorizeAdmin;
const vendorFilter = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    let filter = {};
    if (roles_1.ADMIN_ROLES.includes(req.user.role)) {
        filter = { role: { in: roles_1.VENDOR_ROLES } };
    }
    else if (roles_1.ADMIN_AS_VENDOR_ROLES.includes(req.user.role)) {
        filter = { role: { in: roles_1.MANAGED_VENDOR_ROLES } };
    }
    else if (roles_1.VENDOR_ROLES.includes(req.user.role)) {
        filter = { id: req.user.userId ? BigInt(req.user.userId) : undefined };
    }
    else {
        return res.status(403).json({ success: false, error: "Unauthorized" });
    }
    req.vendorFilter = filter;
    next();
};
exports.vendorFilter = vendorFilter;

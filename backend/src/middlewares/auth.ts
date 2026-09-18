import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import {
  ADMIN_AS_VENDOR_ROLES,
  ADMIN_ROLES,
  expandAuthorizedRoles,
  MANAGED_VENDOR_ROLES,
  VENDOR_ROLES
} from "@/utils/roles";
import {
  parseBearerToken,
  verifySessionBackedAccessToken
} from "@/utils/authSession";

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      vendorFilter?: Record<string, any>
    }
  }
}

interface AuthPayload {
  userId: string;
  role: UserRole;
  sessionId: string;
  customerId?: string;
  vendorId?: string;
  adminId?: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
  vendorFilter?: Record<string, any>
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = parseBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ success: false, error: "Access token required" });
  }

  try {
    const payload = await verifySessionBackedAccessToken(token);
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
  } catch (error) {
    return res.status(401).json({ success: false, error: "Invalid token" });
  }
};

export const authorize = (roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const allowedRoles = expandAuthorizedRoles(roles);
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    next();
  };
};

export const authorizeAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
};

export const vendorFilter = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Not authenticated" });
  }

  let filter: Record<string, any> = {};

  if (ADMIN_ROLES.includes(req.user.role)) {
    filter = { role: { in: VENDOR_ROLES } };
  } else if (ADMIN_AS_VENDOR_ROLES.includes(req.user.role)) {
    filter = { role: { in: MANAGED_VENDOR_ROLES } };
  } else if (VENDOR_ROLES.includes(req.user.role)) {
    filter = { id: req.user.userId ? BigInt(req.user.userId) : undefined };
  } else {
    return res.status(403).json({ success: false, error: "Unauthorized" });
  }

  req.vendorFilter = filter;
  next();
};

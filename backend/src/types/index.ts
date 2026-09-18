import { Request } from 'express';
import { UserRole } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: UserRole;
    sessionId: string;
    customerId?: string;
    vendorId?: string;
    adminId?: string;
  };
  vendorFilter?: Record<string, any>;
}

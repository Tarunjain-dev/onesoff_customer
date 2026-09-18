import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { AgreementService } from '../services/AgreementService';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/errors';
import { AuthRequest } from '../types';
import { parseBearerToken, verifySessionBackedAccessToken } from '@/utils/authSession';

const resolveOptionalAuth = async (req: AuthRequest) => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    return null;
  }

  const payload = await verifySessionBackedAccessToken(token);
  if (!payload) return null;
  return {
    userId: String(payload?.userId || '').trim(),
    role: String(payload?.role || '').trim().toUpperCase() as UserRole
  };
};

type OptionalAuthUser = Awaited<ReturnType<typeof resolveOptionalAuth>>;

export const AgreementController = {
  async getAdminAgreements(req: AuthRequest, res: Response) {
    try {
      const agreements = await AgreementService.getAdminAgreements(req.query || {});
      return ApiResponse.success(res, agreements);
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, error.message || 'Failed to fetch agreements', 500);
    }
  },

  async getAdminAgreementDetail(req: AuthRequest, res: Response) {
    try {
      const includeDeleted = String(req.query?.includeDeleted || '').trim().toLowerCase() === 'true';
      const agreementId = Array.isArray(req.params.agreementId)
        ? req.params.agreementId[0]
        : req.params.agreementId;
      const agreement = await AgreementService.getAdminAgreementDetail(
        String(agreementId || ''),
        includeDeleted
      );
      return ApiResponse.success(res, agreement);
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, error.message || 'Failed to fetch agreement detail', 500);
    }
  },

  async createAgreement(req: AuthRequest, res: Response) {
    try {
      const adminUserId = String(req.user?.userId || '').trim();
      const agreement = await AgreementService.createAgreement(adminUserId, req.body || {});
      return ApiResponse.success(res, agreement, 'Agreement created successfully', 201);
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, error.message || 'Failed to create agreement', 500);
    }
  },

  async updateAgreement(req: AuthRequest, res: Response) {
    try {
      const adminUserId = String(req.user?.userId || '').trim();
      const agreementId = Array.isArray(req.params.agreementId)
        ? req.params.agreementId[0]
        : req.params.agreementId;
      const agreement = await AgreementService.updateAgreement(
        adminUserId,
        String(agreementId || ''),
        req.body || {}
      );
      return ApiResponse.success(res, agreement, 'Agreement updated successfully');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, error.message || 'Failed to update agreement', 500);
    }
  },

  async deleteAgreement(req: AuthRequest, res: Response) {
    try {
      const adminUserId = String(req.user?.userId || '').trim();
      const agreementId = Array.isArray(req.params.agreementId)
        ? req.params.agreementId[0]
        : req.params.agreementId;
      const agreement = await AgreementService.softDeleteAgreement(
        adminUserId,
        String(agreementId || ''),
        req.body || {}
      );
      return ApiResponse.success(res, agreement, 'Agreement deleted successfully');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, error.message || 'Failed to delete agreement', 500);
    }
  },

  async getAgreementHistory(req: AuthRequest, res: Response) {
    try {
      const agreementId = Array.isArray(req.params.agreementId)
        ? req.params.agreementId[0]
        : req.params.agreementId;
      const history = await AgreementService.getAgreementHistory(String(agreementId || ''));
      return ApiResponse.success(res, history);
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, error.message || 'Failed to fetch agreement history', 500);
    }
  },

  async getPublicAgreements(req: AuthRequest, res: Response) {
    try {
      const authUser = await resolveOptionalAuth(req);
      const agreements = await AgreementService.getPublicAgreements(
        (authUser as OptionalAuthUser)?.role,
        (authUser as OptionalAuthUser)?.userId
      );
      return ApiResponse.success(res, agreements);
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, error.message || 'Failed to fetch public agreements', 500);
    }
  },

  async acceptAgreement(req: AuthRequest, res: Response) {
    try {
      const agreementId = Array.isArray(req.params.agreementId)
        ? req.params.agreementId[0]
        : req.params.agreementId;
      const userId = String(req.user?.userId || '').trim();
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        return ApiResponse.unauthorized(res, 'Authentication required');
      }

      const acceptance = await AgreementService.acceptAgreement(
        String(agreementId || ''),
        userId,
        userRole,
        req.body || {}
      );
      return ApiResponse.success(res, acceptance, 'Agreement accepted successfully');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, error.message || 'Failed to accept agreement', 500);
    }
  }
};

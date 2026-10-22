"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgreementController = void 0;
const AgreementService_1 = require("../services/AgreementService");
const ApiResponse_1 = require("../utils/ApiResponse");
const errors_1 = require("../utils/errors");
const authSession_1 = require("@/utils/authSession");
const resolveOptionalAuth = async (req) => {
    const token = (0, authSession_1.parseBearerToken)(req.headers.authorization);
    if (!token) {
        return null;
    }
    const payload = await (0, authSession_1.verifySessionBackedAccessToken)(token);
    if (!payload)
        return null;
    return {
        userId: String(payload?.userId || '').trim(),
        role: String(payload?.role || '').trim().toUpperCase()
    };
};
exports.AgreementController = {
    async getAdminAgreements(req, res) {
        try {
            const agreements = await AgreementService_1.AgreementService.getAdminAgreements(req.query || {});
            return ApiResponse_1.ApiResponse.success(res, agreements);
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch agreements', 500);
        }
    },
    async getAdminAgreementDetail(req, res) {
        try {
            const includeDeleted = String(req.query?.includeDeleted || '').trim().toLowerCase() === 'true';
            const agreementId = Array.isArray(req.params.agreementId)
                ? req.params.agreementId[0]
                : req.params.agreementId;
            const agreement = await AgreementService_1.AgreementService.getAdminAgreementDetail(String(agreementId || ''), includeDeleted);
            return ApiResponse_1.ApiResponse.success(res, agreement);
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch agreement detail', 500);
        }
    },
    async createAgreement(req, res) {
        try {
            const adminUserId = String(req.user?.userId || '').trim();
            const agreement = await AgreementService_1.AgreementService.createAgreement(adminUserId, req.body || {});
            return ApiResponse_1.ApiResponse.success(res, agreement, 'Agreement created successfully', 201);
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to create agreement', 500);
        }
    },
    async updateAgreement(req, res) {
        try {
            const adminUserId = String(req.user?.userId || '').trim();
            const agreementId = Array.isArray(req.params.agreementId)
                ? req.params.agreementId[0]
                : req.params.agreementId;
            const agreement = await AgreementService_1.AgreementService.updateAgreement(adminUserId, String(agreementId || ''), req.body || {});
            return ApiResponse_1.ApiResponse.success(res, agreement, 'Agreement updated successfully');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to update agreement', 500);
        }
    },
    async deleteAgreement(req, res) {
        try {
            const adminUserId = String(req.user?.userId || '').trim();
            const agreementId = Array.isArray(req.params.agreementId)
                ? req.params.agreementId[0]
                : req.params.agreementId;
            const agreement = await AgreementService_1.AgreementService.softDeleteAgreement(adminUserId, String(agreementId || ''), req.body || {});
            return ApiResponse_1.ApiResponse.success(res, agreement, 'Agreement deleted successfully');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to delete agreement', 500);
        }
    },
    async getAgreementHistory(req, res) {
        try {
            const agreementId = Array.isArray(req.params.agreementId)
                ? req.params.agreementId[0]
                : req.params.agreementId;
            const history = await AgreementService_1.AgreementService.getAgreementHistory(String(agreementId || ''));
            return ApiResponse_1.ApiResponse.success(res, history);
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch agreement history', 500);
        }
    },
    async getPublicAgreements(req, res) {
        try {
            const authUser = await resolveOptionalAuth(req);
            const agreements = await AgreementService_1.AgreementService.getPublicAgreements(authUser?.role, authUser?.userId);
            return ApiResponse_1.ApiResponse.success(res, agreements);
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch public agreements', 500);
        }
    },
    async acceptAgreement(req, res) {
        try {
            const agreementId = Array.isArray(req.params.agreementId)
                ? req.params.agreementId[0]
                : req.params.agreementId;
            const userId = String(req.user?.userId || '').trim();
            const userRole = req.user?.role;
            if (!userId || !userRole) {
                return ApiResponse_1.ApiResponse.unauthorized(res, 'Authentication required');
            }
            const acceptance = await AgreementService_1.AgreementService.acceptAgreement(String(agreementId || ''), userId, userRole, req.body || {});
            return ApiResponse_1.ApiResponse.success(res, acceptance, 'Agreement accepted successfully');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to accept agreement', 500);
        }
    }
};

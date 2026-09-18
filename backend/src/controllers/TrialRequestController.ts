import { Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';
import { TrialRequestService } from '../services/TrialRequestService';

export const TrialRequestController = {
  async createRequest(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) throw new Error('Customer ID required');
      const request = await TrialRequestService.createTrialRequest(customerId, req.body);
      return ApiResponse.success(res, request, 'Trial request created');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getCustomerRequests(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) throw new Error('Customer ID required');
      const { status, page = 1, limit = 10 } = req.query;
      const requests = await TrialRequestService.getCustomerTrialRequests(customerId, {
        status: status as string,
        page: Number(page),
        limit: Number(limit)
      });
      return ApiResponse.success(res, requests);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getCustomerRequestById(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) throw new Error('Customer ID required');
      const trialRequestId = String(req.params?.trialRequestId || '');
      const request = await TrialRequestService.getCustomerTrialRequestById(customerId, trialRequestId);
      return ApiResponse.success(res, request);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getVendorRequests(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');
      const { status, search, page = 1, limit = 10 } = req.query;
      const requests = await TrialRequestService.getVendorTrialRequests(vendorId, {
        status: status as string,
        search: search as string,
        page: Number(page),
        limit: Number(limit)
      });
      return ApiResponse.success(res, requests);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async vendorRespond(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');
      const { trialRequestId, action, rejectionReason } = req.body;
      const request = await TrialRequestService.respondToTrialRequest(vendorId, String(trialRequestId), action, rejectionReason);
      return ApiResponse.success(res, request, `Trial request ${String(action).toLowerCase()}ed`);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async vendorStart(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');
      const { trialRequestId, trialCode } = req.body;
      const request = await TrialRequestService.startTrialRequest(vendorId, String(trialRequestId), trialCode);
      return ApiResponse.success(res, request, 'Trial request started');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async vendorFinalize(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');
      const { trialRequestId } = req.body;
      const request = await TrialRequestService.completeTrialRequest(vendorId, String(trialRequestId));
      return ApiResponse.success(res, request, 'Trial request completed');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async vendorMarkNoShow(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');
      const { trialRequestId, reason } = req.body;
      const request = await TrialRequestService.markTrialNoShow(vendorId, String(trialRequestId), reason);
      return ApiResponse.success(res, request, 'Trial request marked as no-show');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async getAdminScopedRequests(req: AuthRequest, res: Response) {
    try {
      const { status, search, page = 1, limit = 10 } = req.query;
      const requests = await TrialRequestService.getAdminScopedTrialRequests(req.vendorFilter, {
        status: status as string,
        search: search as string,
        page: Number(page),
        limit: Number(limit)
      });
      return ApiResponse.success(res, requests);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async adminScopedRespond(req: AuthRequest, res: Response) {
    try {
      const { trialRequestId, action, rejectionReason } = req.body;
      const request = await TrialRequestService.respondToAdminScopedTrialRequest(
        String(trialRequestId),
        action,
        req.vendorFilter,
        rejectionReason
      );
      return ApiResponse.success(res, request, `Trial request ${String(action).toLowerCase()}ed`);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async adminScopedStart(req: AuthRequest, res: Response) {
    try {
      const { trialRequestId, trialCode } = req.body;
      const request = await TrialRequestService.startAdminScopedTrialRequest(
        String(trialRequestId),
        trialCode,
        req.vendorFilter
      );
      return ApiResponse.success(res, request, 'Trial request started');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async adminScopedFinalize(req: AuthRequest, res: Response) {
    try {
      const { trialRequestId } = req.body;
      const request = await TrialRequestService.completeAdminScopedTrialRequest(
        String(trialRequestId),
        undefined,
        req.vendorFilter
      );
      return ApiResponse.success(res, request, 'Trial request completed');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

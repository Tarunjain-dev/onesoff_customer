"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrialRequestController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const TrialRequestService_1 = require("../services/TrialRequestService");
exports.TrialRequestController = {
    async createRequest(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId)
                throw new Error('Customer ID required');
            const request = await TrialRequestService_1.TrialRequestService.createTrialRequest(customerId, req.body);
            return ApiResponse_1.ApiResponse.success(res, request, 'Trial request created');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getCustomerRequests(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId)
                throw new Error('Customer ID required');
            const { status, page = 1, limit = 10 } = req.query;
            const requests = await TrialRequestService_1.TrialRequestService.getCustomerTrialRequests(customerId, {
                status: status,
                page: Number(page),
                limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, requests);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getCustomerRequestById(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId)
                throw new Error('Customer ID required');
            const trialRequestId = String(req.params?.trialRequestId || '');
            const request = await TrialRequestService_1.TrialRequestService.getCustomerTrialRequestById(customerId, trialRequestId);
            return ApiResponse_1.ApiResponse.success(res, request);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getVendorRequests(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const { status, search, page = 1, limit = 10 } = req.query;
            const requests = await TrialRequestService_1.TrialRequestService.getVendorTrialRequests(vendorId, {
                status: status,
                search: search,
                page: Number(page),
                limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, requests);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async vendorRespond(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const { trialRequestId, action, rejectionReason } = req.body;
            const request = await TrialRequestService_1.TrialRequestService.respondToTrialRequest(vendorId, String(trialRequestId), action, rejectionReason);
            return ApiResponse_1.ApiResponse.success(res, request, `Trial request ${String(action).toLowerCase()}ed`);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async vendorStart(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const { trialRequestId, trialCode } = req.body;
            const request = await TrialRequestService_1.TrialRequestService.startTrialRequest(vendorId, String(trialRequestId), trialCode);
            return ApiResponse_1.ApiResponse.success(res, request, 'Trial request started');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async vendorFinalize(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const { trialRequestId } = req.body;
            const request = await TrialRequestService_1.TrialRequestService.completeTrialRequest(vendorId, String(trialRequestId));
            return ApiResponse_1.ApiResponse.success(res, request, 'Trial request completed');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async vendorMarkNoShow(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const { trialRequestId, reason } = req.body;
            const request = await TrialRequestService_1.TrialRequestService.markTrialNoShow(vendorId, String(trialRequestId), reason);
            return ApiResponse_1.ApiResponse.success(res, request, 'Trial request marked as no-show');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getAdminScopedRequests(req, res) {
        try {
            const { status, search, page = 1, limit = 10 } = req.query;
            const requests = await TrialRequestService_1.TrialRequestService.getAdminScopedTrialRequests(req.vendorFilter, {
                status: status,
                search: search,
                page: Number(page),
                limit: Number(limit)
            });
            return ApiResponse_1.ApiResponse.success(res, requests);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async adminScopedRespond(req, res) {
        try {
            const { trialRequestId, action, rejectionReason } = req.body;
            const request = await TrialRequestService_1.TrialRequestService.respondToAdminScopedTrialRequest(String(trialRequestId), action, req.vendorFilter, rejectionReason);
            return ApiResponse_1.ApiResponse.success(res, request, `Trial request ${String(action).toLowerCase()}ed`);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async adminScopedStart(req, res) {
        try {
            const { trialRequestId, trialCode } = req.body;
            const request = await TrialRequestService_1.TrialRequestService.startAdminScopedTrialRequest(String(trialRequestId), trialCode, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, request, 'Trial request started');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async adminScopedFinalize(req, res) {
        try {
            const { trialRequestId } = req.body;
            const request = await TrialRequestService_1.TrialRequestService.completeAdminScopedTrialRequest(String(trialRequestId), undefined, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, request, 'Trial request completed');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplaintController = void 0;
const ComplaintService_1 = require("../services/ComplaintService");
const ApiResponse_1 = require("../utils/ApiResponse");
const toSingleParam = (value) => Array.isArray(value) ? value[0] : value;
exports.ComplaintController = {
    async createCustomerComplaint(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const files = (req.files || []);
            const complaint = await ComplaintService_1.ComplaintService.createComplaint({
                customerId: String(customerId),
                orderId: String(req.body?.orderId || ''),
                orderItemId: String(req.body?.orderItemId || ''),
                category: String(req.body?.category || ''),
                subCategory: String(req.body?.subCategory || ''),
                description: String(req.body?.description || ''),
                imageFiles: files
            });
            return ApiResponse_1.ApiResponse.success(res, complaint, 'Support ticket created successfully', 201);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to create support ticket');
        }
    },
    async getCustomerComplaints(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const complaints = await ComplaintService_1.ComplaintService.getCustomerComplaints(String(customerId));
            return ApiResponse_1.ApiResponse.success(res, complaints);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch support tickets');
        }
    },
    async getCustomerComplaintDetail(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const complaintId = toSingleParam(req.params.complaintId);
            const complaint = await ComplaintService_1.ComplaintService.getCustomerComplaintDetail(String(customerId), String(complaintId || ''));
            return ApiResponse_1.ApiResponse.success(res, complaint);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch support ticket');
        }
    },
    async setCustomerComplaintFeedback(req, res) {
        try {
            const customerId = req.user?.customerId || req.user?.userId;
            if (!customerId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const complaintId = toSingleParam(req.params.complaintId);
            const helpful = Boolean(req.body?.helpful);
            const complaint = await ComplaintService_1.ComplaintService.setCustomerFeedback(String(customerId), String(complaintId || ''), helpful);
            return ApiResponse_1.ApiResponse.success(res, complaint, 'Support ticket feedback saved');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to save support feedback');
        }
    },
    async getComplaints(req, res) {
        try {
            const status = toSingleParam(req.query.status);
            const complaints = await ComplaintService_1.ComplaintService.getComplaints(status);
            return ApiResponse_1.ApiResponse.success(res, complaints);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch complaints');
        }
    },
    async getComplaintDetail(req, res) {
        try {
            const complaintId = toSingleParam(req.params.complaintId);
            const complaint = await ComplaintService_1.ComplaintService.getComplaintDetail(String(complaintId || ''));
            return ApiResponse_1.ApiResponse.success(res, complaint);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch complaint detail');
        }
    },
    async resolveComplaint(req, res) {
        try {
            const complaintId = toSingleParam(req.params.complaintId);
            const status = String(req.body?.status || '');
            const adminResponse = String(req.body?.adminResponse || '');
            const notes = String(req.body?.notes || '');
            const result = await ComplaintService_1.ComplaintService.resolveComplaint(String(complaintId || ''), status, adminResponse, notes);
            return ApiResponse_1.ApiResponse.success(res, result, 'Complaint updated successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to update complaint');
        }
    },
    async createAdminAsVendorTicket(req, res) {
        try {
            const adminId = req.user?.adminId || req.user?.userId;
            if (!adminId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const files = (req.files || []);
            const complaint = await ComplaintService_1.ComplaintService.createAdminAsVendorTicket({
                adminId: String(adminId),
                orderId: String(req.body?.orderId || ''),
                subject: String(req.body?.subject || ''),
                category: String(req.body?.category || ''),
                subCategory: String(req.body?.subCategory || ''),
                description: String(req.body?.description || ''),
                priority: String(req.body?.priority || 'MEDIUM'),
                imageFiles: files
            });
            return ApiResponse_1.ApiResponse.success(res, complaint, 'Support ticket created successfully', 201);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to create support ticket');
        }
    },
    async createIndividualVendorTicket(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const files = (req.files || []);
            const complaint = await ComplaintService_1.ComplaintService.createIndividualVendorTicket({
                userId: String(userId),
                orderId: String(req.body?.orderId || ''),
                subject: String(req.body?.subject || ''),
                category: String(req.body?.category || ''),
                subCategory: String(req.body?.subCategory || ''),
                description: String(req.body?.description || ''),
                priority: String(req.body?.priority || 'MEDIUM'),
                imageFiles: files
            });
            return ApiResponse_1.ApiResponse.success(res, complaint, 'Support ticket created successfully', 201);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to create support ticket');
        }
    },
    async getIndividualVendorTickets(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const complaints = await ComplaintService_1.ComplaintService.getIndividualVendorTickets(String(userId));
            return ApiResponse_1.ApiResponse.success(res, complaints);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch support tickets');
        }
    },
    async getIndividualVendorTicketDetail(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const ticketId = toSingleParam(req.params.ticketId || req.params.complaintId);
            const complaint = await ComplaintService_1.ComplaintService.getIndividualVendorTicketDetail(String(userId), String(ticketId || ''));
            return ApiResponse_1.ApiResponse.success(res, complaint);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch support ticket');
        }
    },
    async getAdminAsVendorTickets(req, res) {
        try {
            const adminId = req.user?.adminId || req.user?.userId;
            if (!adminId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const complaints = await ComplaintService_1.ComplaintService.getAdminAsVendorTickets(String(adminId), req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, complaints);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch support tickets');
        }
    },
    async getAdminAsVendorTicketDetail(req, res) {
        try {
            const adminId = req.user?.adminId || req.user?.userId;
            if (!adminId) {
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized', 401);
            }
            const ticketId = toSingleParam(req.params.ticketId);
            const complaint = await ComplaintService_1.ComplaintService.getAdminAsVendorTicketDetail(String(adminId), String(ticketId || ''), req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, complaint);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch support ticket');
        }
    },
    async resolveAdminAsVendorTicket(req, res) {
        try {
            const ticketId = toSingleParam(req.params.ticketId || req.params.complaintId);
            const status = String(req.body?.status || '');
            const adminResponse = String(req.body?.adminResponse || '');
            const notes = String(req.body?.notes || '');
            const result = await ComplaintService_1.ComplaintService.resolveSupportTicket(String(ticketId || ''), status, adminResponse, notes, {
                userId: String(req.user?.userId || ''),
                role: String(req.user?.role || ''),
                name: String(req.user?.name || '')
            }, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, result, 'Complaint updated successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to update complaint');
        }
    },
    async addMessageToTicket(req, res) {
        try {
            const ticketId = toSingleParam(req.params.ticketId || req.params.complaintId);
            const message = String(req.body?.message || '');
            const isInternal = String(req.body?.isInternal || '').toLowerCase() === 'true';
            const files = (req.files || []);
            const result = await ComplaintService_1.ComplaintService.addMessageToTicket(String(ticketId || ''), message, isInternal, files, {
                userId: String(req.user?.userId || ''),
                role: String(req.user?.role || ''),
                name: String(req.user?.name || '')
            }, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, result, 'Message added successfully');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to add message');
        }
    }
};

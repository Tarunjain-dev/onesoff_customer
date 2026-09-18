import { Request, Response } from 'express';
import { ComplaintService } from '../services/ComplaintService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';

const toSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const ComplaintController = {
  async createCustomerComplaint(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      const files = ((req as any).files || []) as any[];
      const complaint = await ComplaintService.createComplaint({
        customerId: String(customerId),
        orderId: String(req.body?.orderId || ''),
        orderItemId: String(req.body?.orderItemId || ''),
        category: String(req.body?.category || ''),
        subCategory: String(req.body?.subCategory || ''),
        description: String(req.body?.description || ''),
        imageFiles: files
      });

      return ApiResponse.success(res, complaint, 'Support ticket created successfully', 201);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to create support ticket');
    }
  },

  async getCustomerComplaints(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      const complaints = await ComplaintService.getCustomerComplaints(String(customerId));
      return ApiResponse.success(res, complaints);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch support tickets');
    }
  },

  async getCustomerComplaintDetail(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      const complaintId = toSingleParam(req.params.complaintId);
      const complaint = await ComplaintService.getCustomerComplaintDetail(
        String(customerId),
        String(complaintId || '')
      );
      return ApiResponse.success(res, complaint);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch support ticket');
    }
  },

  async setCustomerComplaintFeedback(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user?.customerId || req.user?.userId;
      if (!customerId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      const complaintId = toSingleParam(req.params.complaintId);
      const helpful = Boolean(req.body?.helpful);
      const complaint = await ComplaintService.setCustomerFeedback(
        String(customerId),
        String(complaintId || ''),
        helpful
      );
      return ApiResponse.success(res, complaint, 'Support ticket feedback saved');
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to save support feedback');
    }
  },

  async getComplaints(req: Request, res: Response) {
    try {
      const status = toSingleParam(req.query.status as string | string[] | undefined);
      const complaints = await ComplaintService.getComplaints(status);
      return ApiResponse.success(res, complaints);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch complaints');
    }
  },

  async getComplaintDetail(req: Request, res: Response) {
    try {
      const complaintId = toSingleParam(req.params.complaintId);
      const complaint = await ComplaintService.getComplaintDetail(String(complaintId || ''));
      return ApiResponse.success(res, complaint);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch complaint detail');
    }
  },

  async resolveComplaint(req: Request, res: Response) {
    try {
      const complaintId = toSingleParam(req.params.complaintId);
      const status = String(req.body?.status || '');
      const adminResponse = String(req.body?.adminResponse || '');
      const notes = String(req.body?.notes || '');
      const result = await ComplaintService.resolveComplaint(
        String(complaintId || ''),
        status,
        adminResponse,
        notes
      );
      return ApiResponse.success(res, result, 'Complaint updated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to update complaint');
    }
  },

  async createAdminAsVendorTicket(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.adminId || req.user?.userId;
      if (!adminId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      const files = ((req as any).files || []) as any[];
      const complaint = await ComplaintService.createAdminAsVendorTicket({
        adminId: String(adminId),
        orderId: String(req.body?.orderId || ''),
        subject: String(req.body?.subject || ''),
        category: String(req.body?.category || ''),
        subCategory: String(req.body?.subCategory || ''),
        description: String(req.body?.description || ''),
        priority: String(req.body?.priority || 'MEDIUM'),
        imageFiles: files
      });

      return ApiResponse.success(res, complaint, 'Support ticket created successfully', 201);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to create support ticket');
    }
  },

  async createIndividualVendorTicket(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      const files = ((req as any).files || []) as any[];
      const complaint = await ComplaintService.createIndividualVendorTicket({
        userId: String(userId),
        orderId: String(req.body?.orderId || ''),
        subject: String(req.body?.subject || ''),
        category: String(req.body?.category || ''),
        subCategory: String(req.body?.subCategory || ''),
        description: String(req.body?.description || ''),
        priority: String(req.body?.priority || 'MEDIUM'),
        imageFiles: files
      });

      return ApiResponse.success(res, complaint, 'Support ticket created successfully', 201);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to create support ticket');
    }
  },

  async getIndividualVendorTickets(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      const complaints = await ComplaintService.getIndividualVendorTickets(String(userId));
      return ApiResponse.success(res, complaints);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch support tickets');
    }
  },

  async getIndividualVendorTicketDetail(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      const ticketId = toSingleParam(req.params.ticketId || req.params.complaintId);
      const complaint = await ComplaintService.getIndividualVendorTicketDetail(
        String(userId),
        String(ticketId || '')
      );
      return ApiResponse.success(res, complaint);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch support ticket');
    }
  },

  async getAdminAsVendorTickets(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.adminId || req.user?.userId;
      if (!adminId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      const complaints = await ComplaintService.getAdminAsVendorTickets(
        String(adminId),
        req.vendorFilter
      );
      return ApiResponse.success(res, complaints);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch support tickets');
    }
  },

  async getAdminAsVendorTicketDetail(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.adminId || req.user?.userId;
      if (!adminId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      const ticketId = toSingleParam(req.params.ticketId);
      const complaint = await ComplaintService.getAdminAsVendorTicketDetail(
        String(adminId),
        String(ticketId || ''),
        req.vendorFilter
      );
      return ApiResponse.success(res, complaint);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch support ticket');
    }
  },

  async resolveAdminAsVendorTicket(req: AuthRequest, res: Response) {
    try {
      const ticketId = toSingleParam(req.params.ticketId || req.params.complaintId);
      const status = String(req.body?.status || '');
      const adminResponse = String(req.body?.adminResponse || '');
      const notes = String(req.body?.notes || '');
      const result = await ComplaintService.resolveSupportTicket(
        String(ticketId || ''),
        status,
        adminResponse,
        notes,
        {
          userId: String(req.user?.userId || ''),
          role: String(req.user?.role || ''),
          name: String((req as any).user?.name || '')
        },
        req.vendorFilter
      );
      return ApiResponse.success(res, result, 'Complaint updated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to update complaint');
    }
  },

  async addMessageToTicket(req: AuthRequest, res: Response) {
    try {
      const ticketId = toSingleParam(req.params.ticketId || req.params.complaintId);
      const message = String(req.body?.message || '');
      const isInternal = String(req.body?.isInternal || '').toLowerCase() === 'true';
      const files = ((req as any).files || []) as any[];
      
      const result = await ComplaintService.addMessageToTicket(
        String(ticketId || ''),
        message,
        isInternal,
        files,
        {
          userId: String(req.user?.userId || ''),
          role: String(req.user?.role || ''),
          name: String((req as any).user?.name || '')
        },
        req.vendorFilter
      );
      return ApiResponse.success(res, result, 'Message added successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to add message');
    }
  }
};

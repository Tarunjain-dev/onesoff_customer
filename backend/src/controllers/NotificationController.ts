import { Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';
import { NotificationService } from '../services/NotificationService';

export const NotificationController = {
  async listMyNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized');
      const result =
        req.user?.role === 'INDIVIDUAL_VENDOR'
          ? await NotificationService.listIndividualVendorNotifications(
              userId,
              req.query
            )
          : req.user?.role === 'ADMIN_AS_VENDOR'
            ? await NotificationService.listAdminAsVendorNotifications(
                userId,
                req.query
              )
          : await NotificationService.listMyNotifications(userId, req.query);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async listIndividualVendorNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized');
      const result = await NotificationService.listIndividualVendorNotifications(
        userId,
        req.query
      );
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async registerFcmToken(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized');

      const token = String(req.body?.token || '').trim();
      const platform = req.body?.platform ? String(req.body.platform) : undefined;
      const result = await NotificationService.registerFcmToken(userId, token, platform);
      if (!result.success) return ApiResponse.error(res, result.error || 'Failed');
      return ApiResponse.success(res, result, 'Token registered');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async unregisterFcmToken(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized');

      const token = String(req.body?.token || '').trim();
      const result = await NotificationService.unregisterFcmToken(userId, token);
      if (!result.success) return ApiResponse.error(res, result.error || 'Failed');
      return ApiResponse.success(res, result, 'Token unregistered');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async markRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized');

      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map((id: any) => String(id || '').trim()).filter(Boolean)
        : [];
      const markAll = Boolean(req.body?.markAll) || ids.length === 0;
      const result =
        req.user?.role === 'INDIVIDUAL_VENDOR'
          ? await NotificationService.markIndividualVendorNotificationsRead(
              userId,
              {
                ids,
                markAll
              }
            )
          : req.user?.role === 'ADMIN_AS_VENDOR'
            ? await NotificationService.markAdminAsVendorNotificationsRead(
                userId,
                {
                  ids,
                  markAll
                }
              )
          : await NotificationService.markMyNotificationsRead(userId, {
              ids,
              markAll
            });
      return ApiResponse.success(res, result, markAll ? 'All notifications marked as read' : 'Notifications marked as read');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async markIndividualVendorRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ApiResponse.error(res, 'Unauthorized');

      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map((id: any) => String(id || '').trim()).filter(Boolean)
        : [];
      const markAll = Boolean(req.body?.markAll) || ids.length === 0;
      const result = await NotificationService.markIndividualVendorNotificationsRead(
        userId,
        {
          ids,
          markAll
        }
      );
      return ApiResponse.success(
        res,
        result,
        markAll
          ? 'All notifications marked as read'
          : 'Notifications marked as read'
      );
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

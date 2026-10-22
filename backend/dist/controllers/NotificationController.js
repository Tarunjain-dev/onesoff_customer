"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const NotificationService_1 = require("../services/NotificationService");
exports.NotificationController = {
    async listMyNotifications(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized');
            const result = req.user?.role === 'INDIVIDUAL_VENDOR'
                ? await NotificationService_1.NotificationService.listIndividualVendorNotifications(userId, req.query)
                : req.user?.role === 'ADMIN_AS_VENDOR'
                    ? await NotificationService_1.NotificationService.listAdminAsVendorNotifications(userId, req.query)
                    : await NotificationService_1.NotificationService.listMyNotifications(userId, req.query);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async listIndividualVendorNotifications(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized');
            const result = await NotificationService_1.NotificationService.listIndividualVendorNotifications(userId, req.query);
            return ApiResponse_1.ApiResponse.success(res, result);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async registerFcmToken(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized');
            const token = String(req.body?.token || '').trim();
            const platform = req.body?.platform ? String(req.body.platform) : undefined;
            const result = await NotificationService_1.NotificationService.registerFcmToken(userId, token, platform);
            if (!result.success)
                return ApiResponse_1.ApiResponse.error(res, result.error || 'Failed');
            return ApiResponse_1.ApiResponse.success(res, result, 'Token registered');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async unregisterFcmToken(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized');
            const token = String(req.body?.token || '').trim();
            const result = await NotificationService_1.NotificationService.unregisterFcmToken(userId, token);
            if (!result.success)
                return ApiResponse_1.ApiResponse.error(res, result.error || 'Failed');
            return ApiResponse_1.ApiResponse.success(res, result, 'Token unregistered');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async markRead(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized');
            const ids = Array.isArray(req.body?.ids)
                ? req.body.ids.map((id) => String(id || '').trim()).filter(Boolean)
                : [];
            const markAll = Boolean(req.body?.markAll) || ids.length === 0;
            const result = req.user?.role === 'INDIVIDUAL_VENDOR'
                ? await NotificationService_1.NotificationService.markIndividualVendorNotificationsRead(userId, {
                    ids,
                    markAll
                })
                : req.user?.role === 'ADMIN_AS_VENDOR'
                    ? await NotificationService_1.NotificationService.markAdminAsVendorNotificationsRead(userId, {
                        ids,
                        markAll
                    })
                    : await NotificationService_1.NotificationService.markMyNotificationsRead(userId, {
                        ids,
                        markAll
                    });
            return ApiResponse_1.ApiResponse.success(res, result, markAll ? 'All notifications marked as read' : 'Notifications marked as read');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async markIndividualVendorRead(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return ApiResponse_1.ApiResponse.error(res, 'Unauthorized');
            const ids = Array.isArray(req.body?.ids)
                ? req.body.ids.map((id) => String(id || '').trim()).filter(Boolean)
                : [];
            const markAll = Boolean(req.body?.markAll) || ids.length === 0;
            const result = await NotificationService_1.NotificationService.markIndividualVendorNotificationsRead(userId, {
                ids,
                markAll
            });
            return ApiResponse_1.ApiResponse.success(res, result, markAll
                ? 'All notifications marked as read'
                : 'Notifications marked as read');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

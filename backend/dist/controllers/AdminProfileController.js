"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminProfileController = void 0;
const zod_1 = require("zod");
const AdminProfileService_1 = require("../services/AdminProfileService");
const ApiResponse_1 = require("../utils/ApiResponse");
const updateProfileSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).optional(),
    email: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal(''), zod_1.z.null()]).optional(),
    phone: zod_1.z
        .union([zod_1.z.string().regex(/^\+?\d{10,15}$/), zod_1.z.literal(''), zod_1.z.null()])
        .optional()
})
    .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update profile'
});
exports.AdminProfileController = {
    async getProfile(req, res) {
        try {
            const adminUserId = req.user?.userId;
            if (!adminUserId) {
                return ApiResponse_1.ApiResponse.unauthorized(res, 'Unauthorized');
            }
            const profile = await AdminProfileService_1.AdminProfileService.getProfile(adminUserId);
            return ApiResponse_1.ApiResponse.success(res, profile);
        }
        catch (error) {
            const statusCode = error?.message === 'Admin not found' ? 404 : 400;
            return ApiResponse_1.ApiResponse.error(res, error?.message || 'Failed to fetch admin profile', statusCode);
        }
    },
    async updateProfile(req, res) {
        try {
            const adminUserId = req.user?.userId;
            if (!adminUserId) {
                return ApiResponse_1.ApiResponse.unauthorized(res, 'Unauthorized');
            }
            const payload = updateProfileSchema.parse(req.body);
            const profile = await AdminProfileService_1.AdminProfileService.updateProfile(adminUserId, payload);
            return ApiResponse_1.ApiResponse.success(res, profile, 'Profile updated');
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return ApiResponse_1.ApiResponse.error(res, error.issues[0]?.message || 'Invalid profile payload', 400);
            }
            const statusCode = error?.message === 'Admin not found' ? 404 : 400;
            return ApiResponse_1.ApiResponse.error(res, error?.message || 'Failed to update admin profile', statusCode);
        }
    }
};

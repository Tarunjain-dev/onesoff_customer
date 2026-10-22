"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RentalAvailabilityController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const RentalAvailabilityService_1 = require("../services/RentalAvailabilityService");
const AdminRentalAvailabilityService_1 = require("../services/AdminRentalAvailabilityService");
exports.RentalAvailabilityController = {
    async getProducts(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const { page = 1, limit = 20, search = '' } = req.query;
            const data = await RentalAvailabilityService_1.RentalAvailabilityService.getVendorProducts(vendorId, {
                page: Number(page),
                limit: Number(limit),
                search: String(search || '')
            });
            return ApiResponse_1.ApiResponse.success(res, data);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getCalendar(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const { productId, month, variantId } = req.query;
            const data = await RentalAvailabilityService_1.RentalAvailabilityService.getCalendar(vendorId, {
                productId: String(productId || ''),
                month: month ? String(month) : undefined,
                variantId: variantId ? String(variantId) : undefined
            });
            return ApiResponse_1.ApiResponse.success(res, data);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async upsertDate(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const { productId, variantId, date, mode, note } = req.body;
            const data = await RentalAvailabilityService_1.RentalAvailabilityService.upsertDate(vendorId, {
                productId: String(productId || ''),
                variantId: variantId ? String(variantId) : undefined,
                date: String(date || ''),
                mode: String(mode || '').toUpperCase(),
                note: note ? String(note) : undefined
            });
            return ApiResponse_1.ApiResponse.success(res, data, 'Availability updated');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async upsertRange(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const { productId, variantId, startDate, endDate, mode, note } = req.body;
            const data = await RentalAvailabilityService_1.RentalAvailabilityService.upsertRange(vendorId, {
                productId: String(productId || ''),
                variantId: variantId ? String(variantId) : undefined,
                startDate: String(startDate || ''),
                endDate: String(endDate || ''),
                mode: String(mode || '').toUpperCase(),
                note: note ? String(note) : undefined
            });
            return ApiResponse_1.ApiResponse.success(res, data, 'Availability range updated');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async clearMonth(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId) {
                throw new Error('Vendor ID required');
            }
            const { productId, variantId, month } = req.body;
            const data = await RentalAvailabilityService_1.RentalAvailabilityService.clearMonth(vendorId, {
                productId: String(productId || ''),
                variantId: variantId ? String(variantId) : undefined,
                month: String(month || '')
            });
            return ApiResponse_1.ApiResponse.success(res, data, 'Month overrides cleared');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getCalendarByAdmin(req, res) {
        try {
            const { vendorId, productId, month, variantId } = req.query;
            const data = await AdminRentalAvailabilityService_1.AdminRentalAvailabilityService.getScopedCalendar({
                vendorId: String(vendorId || ''),
                productId: String(productId || ''),
                month: month ? String(month) : undefined,
                variantId: variantId ? String(variantId) : undefined
            }, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, data);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async getProductsByAdmin(req, res) {
        try {
            const { vendorId, page = 1, limit = 200 } = req.query;
            const data = await AdminRentalAvailabilityService_1.AdminRentalAvailabilityService.getScopedVendorProducts({
                vendorId: String(vendorId || ''),
                page: Number(page),
                limit: Number(limit)
            }, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, data);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async upsertDateByAdmin(req, res) {
        try {
            const { vendorId, productId, variantId, date, mode, note } = req.body;
            const data = await AdminRentalAvailabilityService_1.AdminRentalAvailabilityService.upsertScopedDate({
                vendorId: String(vendorId || ''),
                productId: String(productId || ''),
                variantId: variantId ? String(variantId) : undefined,
                date: String(date || ''),
                mode: String(mode || '').toUpperCase(),
                note: note ? String(note) : undefined
            }, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, data, 'Availability updated');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async clearMonthByAdmin(req, res) {
        try {
            const { vendorId, productId, variantId, month } = req.body;
            const data = await AdminRentalAvailabilityService_1.AdminRentalAvailabilityService.clearScopedMonth({
                vendorId: String(vendorId || ''),
                productId: String(productId || ''),
                variantId: variantId ? String(variantId) : undefined,
                month: String(month || '')
            }, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, data, 'Month overrides cleared');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

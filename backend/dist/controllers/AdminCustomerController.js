"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminCustomerController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const AdminCustomerService_1 = require("../services/AdminCustomerService");
exports.AdminCustomerController = {
    async getCustomers(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const customers = await AdminCustomerService_1.AdminCustomerService.getScopedCustomers({
                page: Number(page),
                limit: Number(limit)
            }, req.vendorFilter);
            return ApiResponse_1.ApiResponse.success(res, customers);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Failed to fetch customers');
        }
    }
};

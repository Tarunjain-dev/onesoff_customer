"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const CategoryService_1 = require("../services/CategoryService");
exports.CategoryController = {
    async listCategories(_req, res) {
        try {
            const data = await CategoryService_1.CategoryService.getCategoryCatalog();
            return ApiResponse_1.ApiResponse.success(res, data, 'Categories fetched');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async createCategory(req, res) {
        try {
            const data = await CategoryService_1.CategoryService.createCategory(req.body || {});
            return ApiResponse_1.ApiResponse.success(res, data, 'Category created');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async updateCategory(req, res) {
        try {
            const data = await CategoryService_1.CategoryService.updateCategory(String(req.params.categoryId || ''), req.body || {});
            return ApiResponse_1.ApiResponse.success(res, data, 'Category updated');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async deleteCategory(req, res) {
        try {
            const data = await CategoryService_1.CategoryService.deleteCategory(String(req.params.categoryId || ''));
            return ApiResponse_1.ApiResponse.success(res, data, 'Category deleted');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};

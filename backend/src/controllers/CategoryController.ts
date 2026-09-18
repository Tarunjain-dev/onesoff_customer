import { Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { CategoryService } from '../services/CategoryService';
import { AuthRequest } from '../types';

export const CategoryController = {
  async listCategories(_req: AuthRequest, res: Response) {
    try {
      const data = await CategoryService.getCategoryCatalog();
      return ApiResponse.success(res, data, 'Categories fetched');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async createCategory(req: AuthRequest, res: Response) {
    try {
      const data = await CategoryService.createCategory(req.body || {});
      return ApiResponse.success(res, data, 'Category created');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async updateCategory(req: AuthRequest, res: Response) {
    try {
      const data = await CategoryService.updateCategory(
        String(req.params.categoryId || ''),
        req.body || {}
      );
      return ApiResponse.success(res, data, 'Category updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async deleteCategory(req: AuthRequest, res: Response) {
    try {
      const data = await CategoryService.deleteCategory(String(req.params.categoryId || ''));
      return ApiResponse.success(res, data, 'Category deleted');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};

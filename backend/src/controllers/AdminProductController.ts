import { Response } from 'express';
import { ProductService } from '../services/ProductService';
import { ProductApprovalFlowService } from '../services/ProductApprovalFlowService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';
import { AppError } from '../utils/errors';
import { matchesVendorRoleScope } from '../utils/vendorScope';

const resolveVendorId = (product: any) =>
  String(
    product?.vendorId ||
      product?.vendor?.id ||
      product?.vendor?.user?.id ||
      product?.vendor?.userId ||
      ''
  )

const canAccessApprovalFlowProduct = (req: AuthRequest, product: any) =>
  matchesVendorRoleScope(product?.vendor?.user?.role, req.vendorFilter)

export const AdminProductController = {
  async approveStageOne(req: AuthRequest, res: Response) {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const existingProduct = await ProductService.getProduct(productId);
      if (!canAccessApprovalFlowProduct(req, existingProduct)) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      const product = await ProductApprovalFlowService.approveStageOne(existingProduct);
      return ApiResponse.success(res, product, 'Product moved to Approved 1');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async approveStageTwo(req: AuthRequest, res: Response) {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const existingProduct = await ProductService.getProduct(productId);
      if (!canAccessApprovalFlowProduct(req, existingProduct)) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      const rentalPrice = Number(req.body?.rentalPrice);
      const currentProductValue = Number(req.body?.currentProductValue);
      const product = await ProductApprovalFlowService.approveStageTwo(
        existingProduct,
        rentalPrice,
        currentProductValue
      );
      return ApiResponse.success(res, product, 'Approved 2 sent to vendor');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async rejectApproval(req: AuthRequest, res: Response) {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const existingProduct = await ProductService.getProduct(productId);
      if (!canAccessApprovalFlowProduct(req, existingProduct)) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      const product = await ProductApprovalFlowService.rejectProduct(existingProduct);
      return ApiResponse.success(res, product, 'Product rejected');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async approveWithdrawal(req: AuthRequest, res: Response) {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const existingProduct = await ProductService.getProduct(productId);
      if (!canAccessApprovalFlowProduct(req, existingProduct)) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      const product = await ProductApprovalFlowService.approveWithdrawal(existingProduct);
      return ApiResponse.success(res, product, 'Withdrawal approved');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async updateProduct(req: AuthRequest, res: Response) {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const existingProduct = await ProductService.getProduct(productId);
      if (!canAccessApprovalFlowProduct(req, existingProduct)) {
        return ApiResponse.error(res, 'Product not found', 404);
      }
      const vendorId = resolveVendorId(existingProduct);

      if (!vendorId) {
        return ApiResponse.error(res, 'Vendor profile not found', 404);
      }

      const product = await ProductService.updateProduct(vendorId, productId, req.body);
      return ApiResponse.success(res, product, 'Product updated');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async deleteProduct(req: AuthRequest, res: Response) {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const existingProduct = await ProductService.getProduct(productId);
      if (!matchesVendorRoleScope(existingProduct?.vendor?.user?.role, req.vendorFilter)) {
        return ApiResponse.error(res, 'Product not found', 404);
      }
      const vendorId = resolveVendorId(existingProduct);

      if (!vendorId) {
        return ApiResponse.error(res, 'Vendor profile not found', 404);
      }

      const result = await ProductService.deleteProduct(vendorId, productId);
      return ApiResponse.success(res, result, 'Product deleted');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async addVariant(req: AuthRequest, res: Response) {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const existingProduct = await ProductService.getProduct(productId);
      if (!matchesVendorRoleScope(existingProduct?.vendor?.user?.role, req.vendorFilter)) {
        return ApiResponse.error(res, 'Product not found', 404);
      }
      const variant = await ProductService.addVariant(productId, req.body);
      return ApiResponse.success(res, variant, 'Variant added');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async deleteVariant(req: AuthRequest, res: Response) {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const variantId = Array.isArray(req.params.variantId)
        ? req.params.variantId[0]
        : req.params.variantId;
      const existingProduct = await ProductService.getProduct(productId);
      if (!matchesVendorRoleScope(existingProduct?.vendor?.user?.role, req.vendorFilter)) {
        return ApiResponse.error(res, 'Product not found', 404);
      }
      const vendorId = resolveVendorId(existingProduct);

      if (!vendorId) {
        return ApiResponse.error(res, 'Vendor profile not found', 404);
      }

      const result = await ProductService.deleteVariant(vendorId, productId, variantId);
      return ApiResponse.success(res, result, 'Variant removed');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  }
};

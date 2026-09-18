import { Response } from 'express';
import { ProductService, readProductApprovalFlowMetadata } from '../services/ProductService';
import { ProductApprovalFlowService } from '../services/ProductApprovalFlowService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';
import { AppError } from '../utils/errors';
import { RentalAvailabilityService } from '../services/RentalAvailabilityService';
import { S3Service } from '../services/S3Service';
import { MANAGED_VENDOR_ROLES } from '@/utils/roles';
import { parseBearerToken, verifySessionBackedAccessToken } from '@/utils/authSession';

const normalizeImageUrls = (value: unknown): string[] => {
  const parseStringValue = (input: string): string[] => {
    const trimmed = input.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((entry) => String(entry || '').trim())
            .filter(Boolean);
        }
      } catch {
        // Fall back to treating it as a plain string below.
      }
    }

    return [trimmed];
  };

  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => {
        if (typeof entry === 'string') return parseStringValue(entry);
        return String(entry || '').trim() ? [String(entry).trim()] : [];
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return parseStringValue(value);
  }

  return [];
};

const resolveOptionalAuth = async (req: AuthRequest) => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    return null;
  }

  const payload = await verifySessionBackedAccessToken(token);
  if (!payload) return null;
  return {
    userId: String(payload?.userId || '').trim(),
    role: String(payload?.role || '').trim().toUpperCase()
  };
};

type OptionalAuthUser = Awaited<ReturnType<typeof resolveOptionalAuth>>;

const canViewUnapprovedProduct = (product: any, authUser: OptionalAuthUser) => {
  const approvalFlow =
    product?.approvalFlow || readProductApprovalFlowMetadata(product?.productDetailsFull);
  const currentStage = String(approvalFlow?.currentStage || '').trim().toUpperCase();
  const normalizedStatus = String(product?.status || '').trim().toUpperCase();
  if (normalizedStatus === 'ACTIVE' && (!currentStage || currentStage === 'LIVE')) {
    return true;
  }

  const requesterRole = String(authUser?.role || '').trim().toUpperCase();
  if (requesterRole === 'ADMIN') {
    return true;
  }

  if (requesterRole === 'ADMIN_AS_VENDOR') {
    const vendorRole = String(product?.vendor?.user?.role || '').trim().toUpperCase();
    return MANAGED_VENDOR_ROLES.includes(vendorRole as any);
  }

  const requesterUserId = String(authUser?.userId || '').trim();
  const ownerUserId = String(product?.vendor?.user?.id || '').trim();
  return Boolean(
    requesterUserId &&
      ownerUserId &&
      (requesterRole === 'VENDOR' || requesterRole === 'INDIVIDUAL_VENDOR') &&
      requesterUserId === ownerUserId
  );
};

const filterVisibleProducts = (
  payload: any,
  authUser: OptionalAuthUser
) => {
  if (Array.isArray(payload)) {
    return payload.filter(product => canViewUnapprovedProduct(product, authUser));
  }

  if (Array.isArray(payload?.products)) {
    return {
      ...payload,
      products: payload.products.filter((product: any) =>
        canViewUnapprovedProduct(product, authUser)
      )
    };
  }

  return payload;
};

export const ProductController = {
  async createProduct(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');
      
      // Upload files to S3 if present
      const files = (req.files as Express.Multer.File[]) || [];
      const bodyImageUrls = normalizeImageUrls(req.body?.images);
      let imageUrls: string[] = [];
      
      if (files.length > 0) {
        imageUrls = await S3Service.uploadMultipleImages(files, `products/${vendorId}`);
      }
      
      const productData = {
        ...req.body,
        images: imageUrls.length > 0 ? [...bodyImageUrls, ...imageUrls] : bodyImageUrls
      };
      
      const product = await ProductService.createProduct(vendorId, productData);
      return ApiResponse.success(res, product, 'Product created');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, error.message || 'Internal server error', 500);
    }
  },

  async getProducts(req: AuthRequest, res: Response) {
    try {
      const authUser = await resolveOptionalAuth(req);
      const products = await ProductService.getProducts(req.query, {
        requesterRole: authUser?.role,
        requesterUserId: authUser?.userId
      });
      const decorated = await ProductApprovalFlowService.attachApprovalFlowToCollection(products);
      return ApiResponse.success(res, filterVisibleProducts(decorated, authUser));
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async getProduct(req: AuthRequest, res: Response) {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const product = await ProductService.getProduct(productId);
      const authUser = await resolveOptionalAuth(req);
      if (!canViewUnapprovedProduct(product, authUser)) {
        return ApiResponse.error(res, 'Product not found', 404);
      }
      const decorated = await ProductApprovalFlowService.attachApprovalFlowToProduct(product);
      return ApiResponse.success(res, decorated);
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async updateProduct(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      
      // Upload files to S3 if present
      const files = (req.files as Express.Multer.File[]) || [];
      const bodyImageUrls = normalizeImageUrls(req.body?.images);
      let imageUrls: string[] = [];
      
      if (files.length > 0) {
        imageUrls = await S3Service.uploadMultipleImages(files, `products/${vendorId}`);
      }
      
      const updateData = {
        ...req.body,
        ...((imageUrls.length > 0 || bodyImageUrls.length > 0) && {
          images: imageUrls.length > 0 ? [...bodyImageUrls, ...imageUrls] : bodyImageUrls
        })
      };
      
      const product = await ProductService.updateProduct(vendorId, productId, updateData);
      return ApiResponse.success(res, product, 'Product updated');
    } catch (error: any) {
      console.error('updateProduct error:', error);
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, error.message || 'Internal server error', 500);
    }
  },

  async addVariant(req: AuthRequest, res: Response) {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const variant = await ProductService.addVariant(productId, req.body);
      return ApiResponse.success(res, variant, 'Variant added');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async updateVariant(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const variantId = Array.isArray(req.params.variantId) ? req.params.variantId[0] : req.params.variantId;
      const variant = await ProductService.updateVariant(vendorId, productId, variantId, req.body);
      return ApiResponse.success(res, variant, 'Variant updated');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async deleteVariant(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const variantId = Array.isArray(req.params.variantId) ? req.params.variantId[0] : req.params.variantId;
      const result = await ProductService.deleteVariant(vendorId, productId, variantId);
      return ApiResponse.success(res, result, 'Variant removed');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async getRentalAvailabilityCalendar(req: AuthRequest, res: Response) {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const month = req.query.month ? String(req.query.month) : undefined;
      const variantId = req.query.variantId ? String(req.query.variantId) : undefined;
      const data = await RentalAvailabilityService.getPublicCalendar(productId, { productId, month, variantId });
      return ApiResponse.success(res, data);
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async deleteProduct(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ProductService.deleteProduct(vendorId, productId);
      return ApiResponse.success(res, result, 'Product deleted');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Internal server error', 500);
    }
  },

  async respondToApprovalFlow(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');

      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const action = String(req.body?.action || '').trim().toUpperCase();
      if (action !== 'AGREE' && action !== 'REJECT') {
        return ApiResponse.error(res, 'Invalid action', 400);
      }

      const product = await ProductService.getProduct(productId);
      const updatedProduct = await ProductApprovalFlowService.respondToVendorDecision(
        product,
        String(vendorId),
        action as 'AGREE' | 'REJECT'
      );

      return ApiResponse.success(res, updatedProduct, 'Product approval response saved');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, error.message || 'Internal server error', 500);
    }
  },

  async requestWithdrawal(req: AuthRequest, res: Response) {
    try {
      const vendorId = req.user?.vendorId || req.user?.userId;
      if (!vendorId) throw new Error('Vendor ID required');

      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const product = await ProductService.getProduct(productId);
      const updatedProduct = await ProductApprovalFlowService.requestWithdrawal(
        product,
        String(vendorId)
      );

      return ApiResponse.success(res, updatedProduct, 'Withdrawal request sent');
    } catch (error: any) {
      if (error instanceof AppError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, error.message || 'Internal server error', 500);
    }
  }
};

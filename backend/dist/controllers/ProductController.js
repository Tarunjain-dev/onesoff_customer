"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductController = void 0;
const ProductService_1 = require("../services/ProductService");
const ProductApprovalFlowService_1 = require("../services/ProductApprovalFlowService");
const ApiResponse_1 = require("../utils/ApiResponse");
const errors_1 = require("../utils/errors");
const RentalAvailabilityService_1 = require("../services/RentalAvailabilityService");
const S3Service_1 = require("../services/S3Service");
const roles_1 = require("@/utils/roles");
const authSession_1 = require("@/utils/authSession");
const normalizeImageUrls = (value) => {
    const parseStringValue = (input) => {
        const trimmed = input.trim();
        if (!trimmed)
            return [];
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed
                        .map((entry) => String(entry || '').trim())
                        .filter(Boolean);
                }
            }
            catch {
                // Fall back to treating it as a plain string below.
            }
        }
        return [trimmed];
    };
    if (Array.isArray(value)) {
        return value
            .flatMap((entry) => {
            if (typeof entry === 'string')
                return parseStringValue(entry);
            return String(entry || '').trim() ? [String(entry).trim()] : [];
        })
            .filter(Boolean);
    }
    if (typeof value === 'string') {
        return parseStringValue(value);
    }
    return [];
};
const resolveOptionalAuth = async (req) => {
    const token = (0, authSession_1.parseBearerToken)(req.headers.authorization);
    if (!token) {
        return null;
    }
    const payload = await (0, authSession_1.verifySessionBackedAccessToken)(token);
    if (!payload)
        return null;
    return {
        userId: String(payload?.userId || '').trim(),
        role: String(payload?.role || '').trim().toUpperCase()
    };
};
const canViewUnapprovedProduct = (product, authUser) => {
    const approvalFlow = product?.approvalFlow || (0, ProductService_1.readProductApprovalFlowMetadata)(product?.productDetailsFull);
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
        return roles_1.MANAGED_VENDOR_ROLES.includes(vendorRole);
    }
    const requesterUserId = String(authUser?.userId || '').trim();
    const ownerUserId = String(product?.vendor?.user?.id || '').trim();
    return Boolean(requesterUserId &&
        ownerUserId &&
        (requesterRole === 'VENDOR' || requesterRole === 'INDIVIDUAL_VENDOR') &&
        requesterUserId === ownerUserId);
};
const filterVisibleProducts = (payload, authUser) => {
    if (Array.isArray(payload)) {
        return payload.filter(product => canViewUnapprovedProduct(product, authUser));
    }
    if (Array.isArray(payload?.products)) {
        return {
            ...payload,
            products: payload.products.filter((product) => canViewUnapprovedProduct(product, authUser))
        };
    }
    return payload;
};
exports.ProductController = {
    async createProduct(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            // Upload files to S3 if present
            const files = req.files || [];
            const bodyImageUrls = normalizeImageUrls(req.body?.images);
            let imageUrls = [];
            if (files.length > 0) {
                imageUrls = await S3Service_1.S3Service.uploadMultipleImages(files, `products/${vendorId}`);
            }
            const productData = {
                ...req.body,
                images: imageUrls.length > 0 ? [...bodyImageUrls, ...imageUrls] : bodyImageUrls
            };
            const product = await ProductService_1.ProductService.createProduct(vendorId, productData);
            return ApiResponse_1.ApiResponse.success(res, product, 'Product created');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Internal server error', 500);
        }
    },
    async getProducts(req, res) {
        try {
            const authUser = await resolveOptionalAuth(req);
            const products = await ProductService_1.ProductService.getProducts(req.query, {
                requesterRole: authUser?.role,
                requesterUserId: authUser?.userId
            });
            const decorated = await ProductApprovalFlowService_1.ProductApprovalFlowService.attachApprovalFlowToCollection(products);
            return ApiResponse_1.ApiResponse.success(res, filterVisibleProducts(decorated, authUser));
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, 'Internal server error', 500);
        }
    },
    async getProduct(req, res) {
        try {
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const product = await ProductService_1.ProductService.getProduct(productId);
            const authUser = await resolveOptionalAuth(req);
            if (!canViewUnapprovedProduct(product, authUser)) {
                return ApiResponse_1.ApiResponse.error(res, 'Product not found', 404);
            }
            const decorated = await ProductApprovalFlowService_1.ProductApprovalFlowService.attachApprovalFlowToProduct(product);
            return ApiResponse_1.ApiResponse.success(res, decorated);
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, 'Internal server error', 500);
        }
    },
    async updateProduct(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            // Upload files to S3 if present
            const files = req.files || [];
            const bodyImageUrls = normalizeImageUrls(req.body?.images);
            let imageUrls = [];
            if (files.length > 0) {
                imageUrls = await S3Service_1.S3Service.uploadMultipleImages(files, `products/${vendorId}`);
            }
            const updateData = {
                ...req.body,
                ...((imageUrls.length > 0 || bodyImageUrls.length > 0) && {
                    images: imageUrls.length > 0 ? [...bodyImageUrls, ...imageUrls] : bodyImageUrls
                })
            };
            const product = await ProductService_1.ProductService.updateProduct(vendorId, productId, updateData);
            return ApiResponse_1.ApiResponse.success(res, product, 'Product updated');
        }
        catch (error) {
            console.error('updateProduct error:', error);
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Internal server error', 500);
        }
    },
    async addVariant(req, res) {
        try {
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const variant = await ProductService_1.ProductService.addVariant(productId, req.body);
            return ApiResponse_1.ApiResponse.success(res, variant, 'Variant added');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, 'Internal server error', 500);
        }
    },
    async updateVariant(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const variantId = Array.isArray(req.params.variantId) ? req.params.variantId[0] : req.params.variantId;
            const variant = await ProductService_1.ProductService.updateVariant(vendorId, productId, variantId, req.body);
            return ApiResponse_1.ApiResponse.success(res, variant, 'Variant updated');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, 'Internal server error', 500);
        }
    },
    async deleteVariant(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const variantId = Array.isArray(req.params.variantId) ? req.params.variantId[0] : req.params.variantId;
            const result = await ProductService_1.ProductService.deleteVariant(vendorId, productId, variantId);
            return ApiResponse_1.ApiResponse.success(res, result, 'Variant removed');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, 'Internal server error', 500);
        }
    },
    async getRentalAvailabilityCalendar(req, res) {
        try {
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const month = req.query.month ? String(req.query.month) : undefined;
            const variantId = req.query.variantId ? String(req.query.variantId) : undefined;
            const data = await RentalAvailabilityService_1.RentalAvailabilityService.getPublicCalendar(productId, { productId, month, variantId });
            return ApiResponse_1.ApiResponse.success(res, data);
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, 'Internal server error', 500);
        }
    },
    async deleteProduct(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await ProductService_1.ProductService.deleteProduct(vendorId, productId);
            return ApiResponse_1.ApiResponse.success(res, result, 'Product deleted');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, 'Internal server error', 500);
        }
    },
    async respondToApprovalFlow(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const action = String(req.body?.action || '').trim().toUpperCase();
            if (action !== 'AGREE' && action !== 'REJECT') {
                return ApiResponse_1.ApiResponse.error(res, 'Invalid action', 400);
            }
            const product = await ProductService_1.ProductService.getProduct(productId);
            const updatedProduct = await ProductApprovalFlowService_1.ProductApprovalFlowService.respondToVendorDecision(product, String(vendorId), action);
            return ApiResponse_1.ApiResponse.success(res, updatedProduct, 'Product approval response saved');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Internal server error', 500);
        }
    },
    async requestWithdrawal(req, res) {
        try {
            const vendorId = req.user?.vendorId || req.user?.userId;
            if (!vendorId)
                throw new Error('Vendor ID required');
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const product = await ProductService_1.ProductService.getProduct(productId);
            const updatedProduct = await ProductApprovalFlowService_1.ProductApprovalFlowService.requestWithdrawal(product, String(vendorId));
            return ApiResponse_1.ApiResponse.success(res, updatedProduct, 'Withdrawal request sent');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Internal server error', 500);
        }
    }
};

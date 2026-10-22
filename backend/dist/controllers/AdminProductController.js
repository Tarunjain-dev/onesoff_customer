"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminProductController = void 0;
const ProductService_1 = require("../services/ProductService");
const ProductApprovalFlowService_1 = require("../services/ProductApprovalFlowService");
const ApiResponse_1 = require("../utils/ApiResponse");
const errors_1 = require("../utils/errors");
const vendorScope_1 = require("../utils/vendorScope");
const resolveVendorId = (product) => String(product?.vendorId ||
    product?.vendor?.id ||
    product?.vendor?.user?.id ||
    product?.vendor?.userId ||
    '');
const canAccessApprovalFlowProduct = (req, product) => (0, vendorScope_1.matchesVendorRoleScope)(product?.vendor?.user?.role, req.vendorFilter);
exports.AdminProductController = {
    async approveStageOne(req, res) {
        try {
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const existingProduct = await ProductService_1.ProductService.getProduct(productId);
            if (!canAccessApprovalFlowProduct(req, existingProduct)) {
                return ApiResponse_1.ApiResponse.error(res, 'Product not found', 404);
            }
            const product = await ProductApprovalFlowService_1.ProductApprovalFlowService.approveStageOne(existingProduct);
            return ApiResponse_1.ApiResponse.success(res, product, 'Product moved to Approved 1');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, 'Internal server error', 500);
        }
    },
    async approveStageTwo(req, res) {
        try {
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const existingProduct = await ProductService_1.ProductService.getProduct(productId);
            if (!canAccessApprovalFlowProduct(req, existingProduct)) {
                return ApiResponse_1.ApiResponse.error(res, 'Product not found', 404);
            }
            const rentalPrice = Number(req.body?.rentalPrice);
            const currentProductValue = Number(req.body?.currentProductValue);
            const product = await ProductApprovalFlowService_1.ProductApprovalFlowService.approveStageTwo(existingProduct, rentalPrice, currentProductValue);
            return ApiResponse_1.ApiResponse.success(res, product, 'Approved 2 sent to vendor');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, 'Internal server error', 500);
        }
    },
    async rejectApproval(req, res) {
        try {
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const existingProduct = await ProductService_1.ProductService.getProduct(productId);
            if (!canAccessApprovalFlowProduct(req, existingProduct)) {
                return ApiResponse_1.ApiResponse.error(res, 'Product not found', 404);
            }
            const product = await ProductApprovalFlowService_1.ProductApprovalFlowService.rejectProduct(existingProduct);
            return ApiResponse_1.ApiResponse.success(res, product, 'Product rejected');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, 'Internal server error', 500);
        }
    },
    async approveWithdrawal(req, res) {
        try {
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const existingProduct = await ProductService_1.ProductService.getProduct(productId);
            if (!canAccessApprovalFlowProduct(req, existingProduct)) {
                return ApiResponse_1.ApiResponse.error(res, 'Product not found', 404);
            }
            const product = await ProductApprovalFlowService_1.ProductApprovalFlowService.approveWithdrawal(existingProduct);
            return ApiResponse_1.ApiResponse.success(res, product, 'Withdrawal approved');
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
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const existingProduct = await ProductService_1.ProductService.getProduct(productId);
            if (!canAccessApprovalFlowProduct(req, existingProduct)) {
                return ApiResponse_1.ApiResponse.error(res, 'Product not found', 404);
            }
            const vendorId = resolveVendorId(existingProduct);
            if (!vendorId) {
                return ApiResponse_1.ApiResponse.error(res, 'Vendor profile not found', 404);
            }
            const product = await ProductService_1.ProductService.updateProduct(vendorId, productId, req.body);
            return ApiResponse_1.ApiResponse.success(res, product, 'Product updated');
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
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const existingProduct = await ProductService_1.ProductService.getProduct(productId);
            if (!(0, vendorScope_1.matchesVendorRoleScope)(existingProduct?.vendor?.user?.role, req.vendorFilter)) {
                return ApiResponse_1.ApiResponse.error(res, 'Product not found', 404);
            }
            const vendorId = resolveVendorId(existingProduct);
            if (!vendorId) {
                return ApiResponse_1.ApiResponse.error(res, 'Vendor profile not found', 404);
            }
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
    async addVariant(req, res) {
        try {
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const existingProduct = await ProductService_1.ProductService.getProduct(productId);
            if (!(0, vendorScope_1.matchesVendorRoleScope)(existingProduct?.vendor?.user?.role, req.vendorFilter)) {
                return ApiResponse_1.ApiResponse.error(res, 'Product not found', 404);
            }
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
    async deleteVariant(req, res) {
        try {
            const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const variantId = Array.isArray(req.params.variantId)
                ? req.params.variantId[0]
                : req.params.variantId;
            const existingProduct = await ProductService_1.ProductService.getProduct(productId);
            if (!(0, vendorScope_1.matchesVendorRoleScope)(existingProduct?.vendor?.user?.role, req.vendorFilter)) {
                return ApiResponse_1.ApiResponse.error(res, 'Product not found', 404);
            }
            const vendorId = resolveVendorId(existingProduct);
            if (!vendorId) {
                return ApiResponse_1.ApiResponse.error(res, 'Vendor profile not found', 404);
            }
            const result = await ProductService_1.ProductService.deleteVariant(vendorId, productId, variantId);
            return ApiResponse_1.ApiResponse.success(res, result, 'Variant removed');
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                return ApiResponse_1.ApiResponse.error(res, error.message, error.statusCode);
            }
            return ApiResponse_1.ApiResponse.error(res, 'Internal server error', 500);
        }
    }
};

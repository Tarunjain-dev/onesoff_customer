"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductApprovalFlowService = void 0;
const db_1 = __importDefault(require("../config/db"));
const ProductService_1 = require("./ProductService");
const NotificationService_1 = require("./NotificationService");
const socketServer_1 = require("../realtime/socketServer");
const errors_1 = require("../utils/errors");
const normalizeStage = (value) => {
    const normalized = String(value || '').toUpperCase();
    if (normalized === 'APPROVED_1')
        return 'APPROVED_1';
    if (normalized === 'PENDING_VENDOR_AGREEMENT')
        return 'PENDING_VENDOR_AGREEMENT';
    if (normalized === 'LIVE')
        return 'LIVE';
    if (normalized === 'REJECTED')
        return 'REJECTED';
    return 'PENDING_APPROVAL';
};
const normalizeVendorDecision = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized)
        return null;
    if (normalized === 'AGREE')
        return 'AGREE';
    if (normalized === 'REJECT')
        return 'REJECT';
    return undefined;
};
const normalizeWithdrawalStatus = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized)
        return null;
    if (normalized === 'REQUESTED')
        return 'REQUESTED';
    if (normalized === 'APPROVED')
        return 'APPROVED';
    return undefined;
};
const normalizeStatusOverride = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized)
        return null;
    if (normalized === 'ACTIVE')
        return 'ACTIVE';
    if (normalized === 'INACTIVE')
        return 'INACTIVE';
    if (normalized === 'OUT_OF_STOCK')
        return 'OUT_OF_STOCK';
    return undefined;
};
const inferDefaultFlow = (product) => {
    const productId = String(product?.id || '');
    const createdAt = String(product?.createdAt || new Date().toISOString());
    const status = String(product?.status || '').toUpperCase();
    if (status === 'ACTIVE') {
        return {
            productId,
            currentStage: 'LIVE',
            submittedAt: createdAt,
            approved1At: String(product?.updatedAt || createdAt),
            approved2At: String(product?.updatedAt || createdAt),
            finalRentalPrice: Number(product?.rentalPrice || 0) || null,
            currentProductValue: null,
            withdrawalStatus: null,
            withdrawalRequestedAt: null,
            withdrawalApprovedAt: null,
            vendorDecision: 'AGREE',
            vendorDecisionAt: String(product?.updatedAt || createdAt),
            listedAt: String(product?.updatedAt || createdAt),
            statusOverride: null
        };
    }
    if (status === 'REJECTED') {
        return {
            productId,
            currentStage: 'REJECTED',
            submittedAt: createdAt,
            rejectedAt: String(product?.updatedAt || createdAt),
            statusOverride: null
        };
    }
    if (status === 'APPROVED_1') {
        return {
            productId,
            currentStage: 'APPROVED_1',
            submittedAt: createdAt,
            approved1At: String(product?.updatedAt || createdAt),
            finalRentalPrice: Number(product?.rentalPrice || 0) || null,
            currentProductValue: null,
            withdrawalStatus: null,
            withdrawalRequestedAt: null,
            withdrawalApprovedAt: null,
            statusOverride: null
        };
    }
    if (status === 'PENDING_VENDOR_AGREEMENT') {
        return {
            productId,
            currentStage: 'PENDING_VENDOR_AGREEMENT',
            submittedAt: createdAt,
            approved1At: String(product?.updatedAt || createdAt),
            approved2At: String(product?.updatedAt || createdAt),
            finalRentalPrice: Number(product?.rentalPrice || 0) || null,
            currentProductValue: null,
            withdrawalStatus: null,
            withdrawalRequestedAt: null,
            withdrawalApprovedAt: null,
            statusOverride: null
        };
    }
    return {
        productId,
        currentStage: 'PENDING_APPROVAL',
        submittedAt: createdAt,
        finalRentalPrice: Number(product?.rentalPrice || 0) || null,
        currentProductValue: null,
        withdrawalStatus: null,
        withdrawalRequestedAt: null,
        withdrawalApprovedAt: null,
        statusOverride: null
    };
};
const normalizePersistedFlow = (product, flow) => {
    const fallback = inferDefaultFlow(product);
    return {
        ...fallback,
        ...flow,
        productId: String(product?.id || ''),
        currentStage: normalizeStage(flow.currentStage),
        withdrawalStatus: normalizeWithdrawalStatus(flow.withdrawalStatus),
        vendorDecision: normalizeVendorDecision(flow.vendorDecision),
        statusOverride: normalizeStatusOverride(flow.statusOverride) ?? null
    };
};
const getNormalizedFlow = (product) => {
    const persistedFlow = (0, ProductService_1.readProductApprovalFlowMetadata)(product?.productDetailsFull);
    if (persistedFlow) {
        return normalizePersistedFlow(product, persistedFlow);
    }
    return inferDefaultFlow(product);
};
const mapStageToProductStatus = (stage) => {
    if (stage === 'LIVE')
        return 'ACTIVE';
    if (stage === 'REJECTED')
        return 'REJECTED';
    if (stage === 'APPROVED_1')
        return 'APPROVED_1';
    if (stage === 'PENDING_VENDOR_AGREEMENT')
        return 'PENDING_VENDOR_AGREEMENT';
    return 'INACTIVE';
};
const resolveFlowStatus = (flow) => flow.statusOverride || mapStageToProductStatus(flow.currentStage);
const resolvePersistedRentalPrice = (flow, overrideRentalPrice) => {
    if (overrideRentalPrice !== undefined) {
        return overrideRentalPrice;
    }
    const flowPrice = Number(flow.finalRentalPrice || 0);
    if (flow.currentStage === 'LIVE' && Number.isFinite(flowPrice) && flowPrice > 0) {
        return flowPrice;
    }
    return undefined;
};
const computeSecurityDeposit = (rentalPrice) => Number(((Number(rentalPrice) * 80) / 100).toFixed(2));
const decorateProduct = (product, flow) => ({
    ...product,
    approvalFlow: {
        currentStage: flow.currentStage,
        submittedAt: flow.submittedAt,
        approved1At: flow.approved1At || null,
        approved2At: flow.approved2At || null,
        finalRentalPrice: flow.finalRentalPrice !== undefined && flow.finalRentalPrice !== null
            ? Number(flow.finalRentalPrice)
            : null,
        currentProductValue: flow.currentProductValue !== undefined && flow.currentProductValue !== null
            ? Number(flow.currentProductValue)
            : null,
        withdrawalStatus: flow.withdrawalStatus || null,
        withdrawalRequestedAt: flow.withdrawalRequestedAt || null,
        withdrawalApprovedAt: flow.withdrawalApprovedAt || null,
        vendorDecision: flow.vendorDecision || null,
        vendorDecisionAt: flow.vendorDecisionAt || null,
        listedAt: flow.listedAt || null,
        rejectedAt: flow.rejectedAt || null,
        vendorActionRequired: flow.currentStage === 'PENDING_VENDOR_AGREEMENT',
        statusOverride: flow.statusOverride || null
    }
});
const getIndividualVendorNotificationUserId = (product) => {
    const role = String(product?.vendor?.user?.role || '').trim().toUpperCase();
    const userId = String(product?.vendor?.user?.id || '').trim();
    return role === 'INDIVIDUAL_VENDOR' && userId ? userId : null;
};
const getAllowedVendorIdentifiers = (product) => Array.from(new Set([
    product?.vendor?.user?.id,
    product?.vendor?.userId,
    product?.vendorId,
    product?.vendor?.id
]
    .filter(value => value !== undefined && value !== null && String(value).trim())
    .map(value => String(value).trim())));
const emitApprovalFlowRealtimeUpdate = (product, reason) => {
    const productId = String(product?.id || '').trim();
    const vendorId = String(product?.vendor?.id || product?.vendorId || '').trim();
    const vendorUserId = String(product?.vendor?.user?.id || product?.vendor?.userId || '').trim();
    const vendorRole = String(product?.vendor?.user?.role || '').trim().toUpperCase();
    const refs = Object.fromEntries(Object.entries({ productId, vendorId }).filter(([, value]) => value));
    if (vendorUserId) {
        (0, socketServer_1.emitDataUpdatedToUser)(vendorUserId, {
            domains: ['products', 'dashboard'],
            refs,
            reason
        });
    }
    if (vendorRole === 'INDIVIDUAL_VENDOR') {
        (0, socketServer_1.emitDataUpdatedToRole)('ADMIN_AS_VENDOR', {
            domains: ['products', 'dashboard'],
            refs,
            reason
        });
        return;
    }
    if (vendorRole === 'VENDOR') {
        (0, socketServer_1.emitDataUpdatedToRole)('ADMIN', {
            domains: ['products', 'dashboard'],
            refs,
            reason
        });
    }
};
const persistFlowToDatabase = async (product, flow, options) => {
    const productId = String(product?.id || '').trim();
    if (!productId) {
        throw new errors_1.ValidationError('Product not found');
    }
    const persistedRentalPrice = resolvePersistedRentalPrice(flow, options?.rentalPrice);
    const productDetailsFull = (0, ProductService_1.withProductApprovalFlowMetadata)(product?.productDetailsFull, flow, String(product?.fullDescription || product?.productDetailsFull?.aboutItem || ''));
    await db_1.default.product.update({
        where: { id: BigInt(productId) },
        data: {
            status: options?.status || resolveFlowStatus(flow),
            productDetailsFull: productDetailsFull,
            ...(persistedRentalPrice !== undefined
                ? {
                    rentalPrice: persistedRentalPrice,
                    securityDeposit: computeSecurityDeposit(persistedRentalPrice)
                }
                : {})
        }
    });
    const refreshedProduct = await ProductService_1.ProductService.getProduct(productId);
    return decorateProduct(refreshedProduct, flow);
};
const needsDatabaseSync = (product, flow) => {
    const currentStatus = String(product?.status || '').trim().toUpperCase();
    const targetStatus = resolveFlowStatus(flow);
    if (currentStatus !== targetStatus) {
        return true;
    }
    const targetRentalPrice = resolvePersistedRentalPrice(flow);
    if (targetRentalPrice !== undefined) {
        const currentRentalPrice = Number(product?.rentalPrice || 0);
        if (!Number.isFinite(currentRentalPrice) || currentRentalPrice !== targetRentalPrice) {
            return true;
        }
    }
    return false;
};
const decorateOrMigrateProduct = async (product) => {
    if (!product)
        return product;
    const flow = getNormalizedFlow(product);
    if ((0, ProductService_1.readProductApprovalFlowMetadata)(product?.productDetailsFull)) {
        if (needsDatabaseSync(product, flow)) {
            return persistFlowToDatabase(product, flow, {
                status: resolveFlowStatus(flow)
            });
        }
        return decorateProduct(product, flow);
    }
    return decorateProduct(product, flow);
};
exports.ProductApprovalFlowService = {
    async attachApprovalFlowToProduct(product) {
        if (!product)
            return product;
        return decorateOrMigrateProduct(product);
    },
    async attachApprovalFlowToCollection(payload) {
        if (Array.isArray(payload)) {
            return Promise.all(payload.map(product => decorateOrMigrateProduct(product)));
        }
        if (Array.isArray(payload?.products)) {
            return {
                ...payload,
                products: await Promise.all(payload.products.map((product) => decorateOrMigrateProduct(product)))
            };
        }
        return payload;
    },
    async approveStageOne(product) {
        const flow = getNormalizedFlow(product);
        if (flow.currentStage === 'LIVE') {
            throw new errors_1.ValidationError('Product is already live');
        }
        const now = new Date().toISOString();
        const nextFlow = {
            ...flow,
            currentStage: 'APPROVED_1',
            approved1At: flow.approved1At || now,
            rejectedAt: null,
            vendorDecision: null,
            vendorDecisionAt: null,
            statusOverride: null
        };
        const updatedProduct = await persistFlowToDatabase(product, nextFlow, {
            status: 'APPROVED_1'
        });
        const vendorUserId = getIndividualVendorNotificationUserId(product);
        if (vendorUserId) {
            await NotificationService_1.NotificationService.notifyIndividualVendorProductStatusChanged(vendorUserId, {
                productId: String(product?.id || ''),
                productName: String(product?.name || 'Product'),
                status: nextFlow.currentStage
            }).catch(() => null);
        }
        await NotificationService_1.NotificationService.notifyAdminAsVendorProductUpdate({
            title: 'Product approved for stage 1',
            message: `${String(product?.name || 'Product')} moved to Approved 1.`,
            productId: String(product?.id || ''),
            status: nextFlow.currentStage,
            vendorId: String(product?.vendor?.user?.id || product?.vendor?.userId || '')
        }).catch(() => null);
        emitApprovalFlowRealtimeUpdate(updatedProduct, 'PRODUCT_APPROVAL_STAGE_ONE');
        return updatedProduct;
    },
    async approveStageTwo(product, rentalPrice, currentProductValue) {
        if (!Number.isFinite(rentalPrice) || rentalPrice <= 0) {
            throw new errors_1.ValidationError('Valid rental price is required');
        }
        if (!Number.isFinite(currentProductValue) || currentProductValue <= 0) {
            throw new errors_1.ValidationError('Valid current product value is required');
        }
        const flow = getNormalizedFlow(product);
        if (flow.currentStage !== 'APPROVED_1') {
            throw new errors_1.ValidationError('Product must be in Approved 1 before Approved 2');
        }
        const now = new Date().toISOString();
        const nextFlow = {
            ...flow,
            currentStage: 'PENDING_VENDOR_AGREEMENT',
            approved2At: now,
            finalRentalPrice: rentalPrice,
            currentProductValue,
            rejectedAt: null,
            vendorDecision: null,
            vendorDecisionAt: null,
            statusOverride: null
        };
        const updatedProduct = await persistFlowToDatabase(product, nextFlow, {
            status: 'PENDING_VENDOR_AGREEMENT'
        });
        const vendorUserId = getIndividualVendorNotificationUserId(product);
        if (vendorUserId) {
            await NotificationService_1.NotificationService.notifyIndividualVendorProductStatusChanged(vendorUserId, {
                productId: String(product?.id || ''),
                productName: String(product?.name || 'Product'),
                status: nextFlow.currentStage
            }).catch(() => null);
        }
        await NotificationService_1.NotificationService.notifyAdminAsVendorProductUpdate({
            title: 'Product sent for vendor confirmation',
            message: `${String(product?.name || 'Product')} moved to Approved 2 and is waiting for vendor agreement.`,
            productId: String(product?.id || ''),
            status: nextFlow.currentStage,
            vendorId: String(product?.vendor?.user?.id || product?.vendor?.userId || '')
        }).catch(() => null);
        emitApprovalFlowRealtimeUpdate(updatedProduct, 'PRODUCT_APPROVAL_STAGE_TWO');
        return updatedProduct;
    },
    async rejectProduct(product) {
        const flow = getNormalizedFlow(product);
        const now = new Date().toISOString();
        const nextFlow = {
            ...flow,
            currentStage: 'REJECTED',
            rejectedAt: now,
            vendorDecision: flow.currentStage === 'PENDING_VENDOR_AGREEMENT'
                ? 'REJECT'
                : flow.vendorDecision || null,
            vendorDecisionAt: flow.currentStage === 'PENDING_VENDOR_AGREEMENT'
                ? now
                : flow.vendorDecisionAt || null,
            statusOverride: null
        };
        const updatedProduct = await persistFlowToDatabase(product, nextFlow, {
            status: 'REJECTED'
        });
        const vendorUserId = getIndividualVendorNotificationUserId(product);
        if (vendorUserId) {
            await NotificationService_1.NotificationService.notifyIndividualVendorProductStatusChanged(vendorUserId, {
                productId: String(product?.id || ''),
                productName: String(product?.name || 'Product'),
                status: nextFlow.currentStage
            }).catch(() => null);
        }
        await NotificationService_1.NotificationService.notifyAdminAsVendorProductUpdate({
            title: 'Product rejected',
            message: `${String(product?.name || 'Product')} was rejected in the approval workflow.`,
            productId: String(product?.id || ''),
            status: nextFlow.currentStage,
            vendorId: String(product?.vendor?.user?.id || product?.vendor?.userId || '')
        }).catch(() => null);
        emitApprovalFlowRealtimeUpdate(updatedProduct, 'PRODUCT_REJECTED');
        return updatedProduct;
    },
    async requestWithdrawal(product, vendorUserId) {
        const normalizedVendorUserId = String(vendorUserId || '').trim();
        const allowedVendorIdentifiers = getAllowedVendorIdentifiers(product);
        if (!normalizedVendorUserId || !allowedVendorIdentifiers.includes(normalizedVendorUserId)) {
            throw new errors_1.ValidationError('Product not found');
        }
        const flow = getNormalizedFlow(product);
        if (!['APPROVED_1', 'LIVE'].includes(flow.currentStage)) {
            throw new errors_1.ValidationError('Withdrawal request is allowed only after the outfit reaches Approved 1');
        }
        if (flow.withdrawalStatus === 'REQUESTED') {
            throw new errors_1.ValidationError('Withdrawal request is already pending');
        }
        if (flow.withdrawalStatus === 'APPROVED') {
            throw new errors_1.ValidationError('Withdrawal is already approved for this product');
        }
        const now = new Date().toISOString();
        const nextFlow = {
            ...flow,
            withdrawalStatus: 'REQUESTED',
            withdrawalRequestedAt: now,
            withdrawalApprovedAt: null
        };
        const updatedProduct = await persistFlowToDatabase(product, nextFlow, {
            status: resolveFlowStatus(nextFlow)
        });
        await NotificationService_1.NotificationService.notifyAdminAsVendorProductUpdate({
            title: 'Withdrawal request received',
            message: `${String(product?.name || 'Product')} now has a withdrawal request from the individual vendor.`,
            productId: String(product?.id || ''),
            status: 'WITHDRAWAL',
            vendorId: normalizedVendorUserId
        }).catch(() => null);
        emitApprovalFlowRealtimeUpdate(updatedProduct, 'PRODUCT_WITHDRAWAL_REQUESTED');
        return updatedProduct;
    },
    async approveWithdrawal(product) {
        const flow = getNormalizedFlow(product);
        if (flow.withdrawalStatus !== 'REQUESTED') {
            throw new errors_1.ValidationError('No withdrawal request is pending for this product');
        }
        const now = new Date().toISOString();
        const nextFlow = {
            ...flow,
            withdrawalStatus: 'APPROVED',
            withdrawalApprovedAt: now,
            statusOverride: 'INACTIVE'
        };
        const updatedProduct = await persistFlowToDatabase(product, nextFlow, {
            status: 'INACTIVE'
        });
        const vendorUserId = getIndividualVendorNotificationUserId(product);
        if (vendorUserId) {
            await NotificationService_1.NotificationService.notifyIndividualVendorProductStatusChanged(vendorUserId, {
                productId: String(product?.id || ''),
                productName: String(product?.name || 'Product'),
                status: 'WITHDRAWAL'
            }).catch(() => null);
        }
        await NotificationService_1.NotificationService.notifyAdminAsVendorProductUpdate({
            title: 'Withdrawal approved',
            message: `${String(product?.name || 'Product')} withdrawal was approved and the product is now inactive.`,
            productId: String(product?.id || ''),
            status: 'WITHDRAWAL',
            vendorId: String(product?.vendor?.user?.id || product?.vendor?.userId || '')
        }).catch(() => null);
        emitApprovalFlowRealtimeUpdate(updatedProduct, 'PRODUCT_WITHDRAWAL_APPROVED');
        return updatedProduct;
    },
    async respondToVendorDecision(product, vendorUserId, action) {
        const normalizedVendorUserId = String(vendorUserId || '').trim();
        const allowedVendorIdentifiers = getAllowedVendorIdentifiers(product);
        if (!normalizedVendorUserId || !allowedVendorIdentifiers.includes(normalizedVendorUserId)) {
            throw new errors_1.ValidationError('Product not found');
        }
        const flow = getNormalizedFlow(product);
        if (flow.currentStage !== 'PENDING_VENDOR_AGREEMENT') {
            throw new errors_1.ValidationError('No vendor approval is pending for this product');
        }
        const now = new Date().toISOString();
        if (action === 'REJECT') {
            const rejectedFlow = {
                ...flow,
                currentStage: 'REJECTED',
                vendorDecision: 'REJECT',
                vendorDecisionAt: now,
                rejectedAt: now,
                statusOverride: null
            };
            const updatedProduct = await persistFlowToDatabase(product, rejectedFlow, {
                status: 'REJECTED'
            });
            await NotificationService_1.NotificationService.notifyAdminAsVendorProductUpdate({
                title: 'Vendor rejected approved 2 pricing',
                message: `${String(product?.name || 'Product')} was rejected by the individual vendor after Approved 2.`,
                productId: String(product?.id || ''),
                status: 'REJECTED',
                vendorId: normalizedVendorUserId
            }).catch(() => null);
            emitApprovalFlowRealtimeUpdate(updatedProduct, 'PRODUCT_VENDOR_REJECTED');
            return updatedProduct;
        }
        const finalRentalPrice = Number(flow.finalRentalPrice || 0);
        if (!Number.isFinite(finalRentalPrice) || finalRentalPrice <= 0) {
            throw new errors_1.ValidationError('Final rental price is missing');
        }
        const updatedProduct = await ProductService_1.ProductService.updateProduct(String(product?.vendorId || product?.vendor?.id || ''), String(product?.id || ''), {
            status: 'ACTIVE',
            rentalPrice: finalRentalPrice
        });
        const agreedFlow = {
            ...flow,
            currentStage: 'LIVE',
            vendorDecision: 'AGREE',
            vendorDecisionAt: now,
            listedAt: now,
            statusOverride: null
        };
        const persistedProduct = await persistFlowToDatabase(updatedProduct, agreedFlow, {
            status: 'ACTIVE'
        });
        await NotificationService_1.NotificationService.notifyAdminAsVendorProductUpdate({
            title: 'Vendor accepted approved 2 pricing',
            message: `${String(product?.name || 'Product')} was accepted by the individual vendor and is now live.`,
            productId: String(product?.id || ''),
            status: 'LIVE',
            vendorId: normalizedVendorUserId
        }).catch(() => null);
        emitApprovalFlowRealtimeUpdate(persistedProduct, 'PRODUCT_VENDOR_ACCEPTED');
        return persistedProduct;
    }
};

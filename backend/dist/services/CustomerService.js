"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerService = void 0;
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const customerProfileStorage_1 = require("./customerProfileStorage");
const S3Service_1 = require("./S3Service");
const DAY_MS = 24 * 60 * 60 * 1000;
const REFUND_VISIBLE_PAYMENT_STATUSES = ['PAID', 'REFUND_PENDING', 'REFUNDED'];
const REFUND_VISIBLE_ITEM_STATUSES = [
    client_1.OrderItemStatus.RETURN_SCHEDULED,
    client_1.OrderItemStatus.LATE_RETURN,
    client_1.OrderItemStatus.RETURNED,
    client_1.OrderItemStatus.DAMAGE_REVIEW,
    client_1.OrderItemStatus.SECURITY_DEPOSIT_REFUNDED,
    client_1.OrderItemStatus.RETURN_REQUESTED,
    client_1.OrderItemStatus.RETURN_RECEIVED,
    client_1.OrderItemStatus.INSPECTED_GOOD,
    client_1.OrderItemStatus.INSPECTED_DAMAGED,
    client_1.OrderItemStatus.INSPECTED_LOST,
    client_1.OrderItemStatus.COMPLETED
];
const parseUserId = (userId) => {
    try {
        return BigInt(userId);
    }
    catch {
        throw new errors_1.ValidationError('Invalid user id');
    }
};
const normalizeAccountNumber = (value) => String(value || '').replace(/\s+/g, '');
const normalizeIfsc = (value) => String(value || '').trim().toUpperCase();
const normalizeToUtcDay = (value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const resolveLateDays = (dueDate, returnedAt) => {
    if (!dueDate || !returnedAt)
        return 0;
    const due = normalizeToUtcDay(new Date(dueDate));
    const returned = normalizeToUtcDay(new Date(returnedAt));
    const diffDays = Math.floor((returned.getTime() - due.getTime()) / DAY_MS);
    return Math.max(0, diffDays);
};
const toIsoString = (value) => {
    if (!value)
        return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
};
const wishlistProductInclude = {
    product: {
        include: {
            images: true,
            variants: true,
            vendor: {
                select: {
                    id: true,
                    shopName: true,
                    ownerName: true
                }
            }
        }
    }
};
const withAccessibleWishlistImages = async (entry) => {
    const images = Array.isArray(entry?.product?.images) ? entry.product.images : [];
    if (images.length === 0)
        return entry;
    const accessibleUrls = await S3Service_1.S3Service.getAccessibleImageUrls(images.map((image) => String(image?.imageUrl || '')));
    return {
        ...entry,
        product: {
            ...entry.product,
            images: images.map((image, index) => ({
                ...image,
                imageUrl: accessibleUrls[index] || image?.imageUrl || ''
            }))
        }
    };
};
const getRefundProductImage = async (product) => {
    const images = Array.isArray(product?.images) ? product.images : [];
    if (images.length === 0)
        return '';
    const coverImage = images.find((image) => image?.isCover) || images[0];
    const rawImage = String(coverImage?.signedUrl ||
        coverImage?.publicUrl ||
        coverImage?.imageUrl ||
        coverImage?.url ||
        '').trim();
    if (!rawImage)
        return '';
    try {
        return await S3Service_1.S3Service.getAccessibleImageUrl(rawImage);
    }
    catch {
        return rawImage;
    }
};
const getRefundItemSku = (item) => String(item?.variant?.sku ||
    item?.variant?.skuCode ||
    item?.sku ||
    item?.skuCode ||
    item?.product?.sku ||
    item?.product?.skuCode ||
    item?.product?.SKU ||
    '-').trim() || '-';
const dedupeTextValues = (values) => {
    const seen = new Set();
    const results = [];
    values.forEach((value) => {
        const normalized = String(value || '').trim();
        if (!normalized)
            return;
        const key = normalized.toLowerCase();
        if (seen.has(key))
            return;
        seen.add(key);
        results.push(normalized);
    });
    return results;
};
const resolveRefundSummaryStatus = (refundedAmount, deductedAmount, status) => {
    if (refundedAmount > 0 && deductedAmount <= 0)
        return 'Fully Refunded';
    if (refundedAmount > 0 && deductedAmount > 0)
        return 'Partially Refunded';
    if (refundedAmount <= 0 && deductedAmount > 0)
        return 'Fully Deducted';
    const normalizedStatus = String(status || '').trim().toUpperCase();
    if (normalizedStatus === 'DAMAGE_REVIEW')
        return 'Under Review';
    if (normalizedStatus === 'RETURNED' ||
        normalizedStatus === 'RETURN_RECEIVED' ||
        normalizedStatus === 'RETURN_SCHEDULED' ||
        normalizedStatus === 'RETURN_REQUESTED' ||
        normalizedStatus === 'LATE_RETURN') {
        return 'Pending Review';
    }
    return 'Pending Review';
};
exports.CustomerService = {
    async getProfile(userId) {
        const userIdBig = parseUserId(userId);
        const customerProfile = await (0, customerProfileStorage_1.readCustomerProfileDetails)(userIdBig);
        const user = await db_1.default.user.findUnique({
            where: { id: userIdBig },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
                customerBankDetail: {
                    select: {
                        accountHolder: true,
                        bankName: true,
                        accountNumber: true,
                        ifscCode: true,
                        upiId: true,
                        updatedAt: true
                    }
                }
            }
        });
        if (!user) {
            throw new Error('User not found');
        }
        const { userId: _customerUserId, ...profileWithoutUserId } = customerProfile || {};
        return {
            ...user,
            id: String(user.id),
            ...profileWithoutUserId
        };
    },
    async updateProfile(userId, data) {
        const userIdBig = parseUserId(userId);
        const user = await db_1.default.user.update({
            where: { id: userIdBig },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.email && { email: data.email }),
                ...(data.phone && { phone: data.phone })
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                status: true
            }
        });
        const profile = await (0, customerProfileStorage_1.upsertCustomerProfileDetails)(userIdBig, {
            email: data.email,
            aadharNumber: data.aadharNumber,
            addressLine1: data.addressLine1,
            landmark: data.landmark,
            pincode: data.pincode,
            city: data.city,
            state: data.state,
            additionalInfo: data.additionalInfo
        });
        const { userId: _profileUserId, ...profileWithoutUserId } = profile || {};
        return {
            ...user,
            id: String(user.id),
            ...profileWithoutUserId
        };
    },
    async getWishlist(userId) {
        const userIdBig = parseUserId(userId);
        const wishlist = await db_1.default.wishlist.findMany({
            where: { userId: userIdBig },
            include: wishlistProductInclude,
            orderBy: { createdAt: 'desc' }
        });
        return Promise.all(wishlist.map(withAccessibleWishlistImages));
    },
    async addToWishlist(userId, productId) {
        const userIdBig = parseUserId(userId);
        const existing = await db_1.default.wishlist.findUnique({
            where: {
                userId_productId: {
                    userId: userIdBig,
                    productId
                }
            },
            include: wishlistProductInclude
        });
        if (existing) {
            return withAccessibleWishlistImages(existing);
        }
        const wishlistItem = await db_1.default.wishlist.create({
            data: {
                userId: userIdBig,
                productId
            },
            include: wishlistProductInclude
        });
        return withAccessibleWishlistImages(wishlistItem);
    },
    async removeFromWishlist(userId, productId) {
        const userIdBig = parseUserId(userId);
        await db_1.default.wishlist.deleteMany({
            where: {
                userId: userIdBig,
                productId
            }
        });
    },
    async getRefundDetails(userId) {
        const userIdBig = parseUserId(userId);
        const orderItems = await db_1.default.orderItem.findMany({
            where: {
                order: {
                    customerId: userIdBig,
                    paymentStatus: { in: REFUND_VISIBLE_PAYMENT_STATUSES }
                },
                OR: [
                    { returnedAt: { not: null } },
                    { securityDepositRefunded: { gt: 0 } },
                    { securityDepositHeld: { gt: 0 } },
                    { status: { in: REFUND_VISIBLE_ITEM_STATUSES } }
                ]
            },
            include: {
                order: {
                    select: {
                        id: true,
                        orderNo: true,
                        createdAt: true
                    }
                },
                product: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        productType: true,
                        images: {
                            select: {
                                imageUrl: true,
                                isCover: true
                            }
                        }
                    }
                },
                variant: {
                    select: {
                        id: true,
                        sku: true,
                        size: true
                    }
                },
                vendorProfile: {
                    select: {
                        id: true,
                        shopName: true,
                        ownerName: true
                    }
                },
                qualityCheck: {
                    select: {
                        outcome: true,
                        damageType: true,
                        estimatedCost: true,
                        notes: true,
                        inspectedAt: true
                    }
                },
                maintenanceTask: {
                    select: {
                        taskType: true,
                        status: true,
                        scheduledDate: true,
                        notes: true,
                        updatedAt: true
                    }
                },
                repairTask: {
                    select: {
                        issueType: true,
                        estimatedCost: true,
                        actualCost: true,
                        notes: true,
                        status: true,
                        updatedAt: true
                    }
                }
            },
            orderBy: [{ refundTransferredAt: 'desc' }, { returnedAt: 'desc' }, { id: 'desc' }]
        });
        const orderItemIds = orderItems.map((item) => item.id);
        const damageClaimsRaw = orderItemIds.length
            ? await db_1.default.damageClaim.findMany({
                where: {
                    orderItemId: { in: orderItemIds }
                },
                select: {
                    orderItemId: true,
                    damageType: true,
                    repairCost: true,
                    photoProof: true,
                    vendorNotes: true,
                    status: true,
                    approvedAmount: true,
                    adminNotes: true,
                    rejectionReason: true,
                    reviewedAt: true
                }
            })
            : [];
        const damageClaims = await Promise.all(damageClaimsRaw.map(async (claim) => {
            const rawPhotoProof = Array.isArray(claim?.photoProof)
                ? claim.photoProof.map((item) => String(item || '').trim()).filter(Boolean)
                : [];
            let accessiblePhotoProof = rawPhotoProof;
            if (rawPhotoProof.length > 0) {
                try {
                    accessiblePhotoProof = await S3Service_1.S3Service.getAccessibleImageUrls(rawPhotoProof);
                }
                catch {
                    accessiblePhotoProof = rawPhotoProof;
                }
            }
            return {
                ...claim,
                photoProof: accessiblePhotoProof
            };
        }));
        const damageClaimMap = new Map(damageClaims.map((claim) => [String(claim?.orderItemId || ''), claim]));
        const refundRows = await Promise.all(orderItems.map(async (item) => {
            const depositAmount = Math.max(0, Number(item.deposit || 0));
            const refundedAmount = Math.min(depositAmount, Math.max(0, Number(item.securityDepositRefunded || 0)));
            const heldAmount = Math.min(depositAmount, Math.max(0, Number(item.securityDepositHeld || 0)));
            const damageClaim = damageClaimMap.get(item.id.toString()) || null;
            const approvedDamageAmount = Math.max(0, Number(damageClaim?.approvedAmount || 0));
            const damageCharges = Math.min(heldAmount, approvedDamageAmount);
            const lateDays = resolveLateDays(item.returnDueDate, item.returnedAt);
            const lateReturnFees = Math.max(0, heldAmount - damageCharges);
            const cleaningMaintenanceCharges = 0;
            const productImage = await getRefundProductImage(item.product);
            const damageType = String(damageClaim?.damageType ||
                item.qualityCheck?.damageType ||
                item.repairTask?.issueType ||
                '').trim();
            const deductionReasonDetails = dedupeTextValues([
                damageCharges > 0
                    ? damageType
                        ? `Damage charge applied for ${damageType.toLowerCase()}.`
                        : 'Damage charge applied after inspection.'
                    : null,
                lateReturnFees > 0
                    ? lateDays > 0
                        ? `Late return fee applied for ${lateDays} day${lateDays === 1 ? '' : 's'}.`
                        : 'Late return fee applied.'
                    : null,
                cleaningMaintenanceCharges > 0
                    ? 'Cleaning/maintenance charge applied.'
                    : null,
                heldAmount > 0 &&
                    damageCharges <= 0 &&
                    lateReturnFees <= 0 &&
                    cleaningMaintenanceCharges <= 0
                    ? 'Security deposit deduction applied after return review.'
                    : null
            ]);
            const additionalNotes = dedupeTextValues([
                damageClaim?.adminNotes,
                damageClaim?.vendorNotes,
                damageClaim?.rejectionReason,
                item.qualityCheck?.notes,
                item.repairTask?.notes,
                item.maintenanceTask?.notes,
                item.refundTransferNotes
            ]);
            const deductionReason = deductionReasonDetails.join(' ') ||
                (refundedAmount > 0
                    ? 'Full security deposit refunded.'
                    : 'Refund pending review.');
            return {
                id: item.id.toString(),
                orderItemId: item.id.toString(),
                orderNo: String(item.order?.orderNo || ''),
                orderDate: toIsoString(item.order?.createdAt) || '',
                productId: item.productId.toString(),
                productName: String(item.product?.name || 'Product'),
                productImage,
                vendorName: String(item.vendorProfile?.shopName || item.vendorProfile?.ownerName || '-').trim() ||
                    '-',
                skuCode: getRefundItemSku(item),
                status: String(item.status || ''),
                refundSummaryStatus: resolveRefundSummaryStatus(refundedAmount, heldAmount, item.status),
                returnDueDate: toIsoString(item.returnDueDate),
                returnedAt: toIsoString(item.returnedAt),
                refundTransferredAt: toIsoString(item.refundTransferredAt),
                originalSecurityDepositAmount: depositAmount,
                damageCharges,
                lateReturnFees,
                cleaningMaintenanceCharges,
                totalDeductionAmount: heldAmount,
                finalRefundAmount: refundedAmount,
                deductionReason,
                deductionReasonDetails,
                additionalNotes,
                damageEvidence: Array.isArray(damageClaim?.photoProof) ? damageClaim.photoProof : [],
                damageType: damageType || null,
                refundTransferMode: item.refundTransferMode || null,
                refundTransferReference: item.refundTransferReference || null,
                refundTransferNotes: item.refundTransferNotes || null
            };
        }));
        return refundRows;
    },
    async getBankDetails(userId) {
        const userIdBig = parseUserId(userId);
        const bankDetails = await db_1.default.customerBankDetail.findUnique({
            where: { customerId: userIdBig },
            select: {
                accountHolder: true,
                bankName: true,
                accountNumber: true,
                ifscCode: true,
                upiId: true,
                updatedAt: true
            }
        });
        return bankDetails;
    },
    async upsertBankDetails(userId, data) {
        const userIdBig = parseUserId(userId);
        const accountHolder = String(data.accountHolder || '').trim();
        const bankName = String(data.bankName || '').trim();
        const accountNumber = normalizeAccountNumber(String(data.accountNumber || ''));
        const ifscCode = normalizeIfsc(String(data.ifscCode || ''));
        const upiId = String(data.upiId || '').trim() || null;
        if (!accountHolder)
            throw new errors_1.ValidationError('accountHolder is required');
        if (!bankName)
            throw new errors_1.ValidationError('bankName is required');
        if (!/^\d{8,24}$/.test(accountNumber)) {
            throw new errors_1.ValidationError('accountNumber must be 8 to 24 digits');
        }
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
            throw new errors_1.ValidationError('ifscCode format is invalid');
        }
        const saved = await db_1.default.customerBankDetail.upsert({
            where: { customerId: userIdBig },
            create: {
                customerId: userIdBig,
                accountHolder,
                bankName,
                accountNumber,
                ifscCode,
                upiId
            },
            update: {
                accountHolder,
                bankName,
                accountNumber,
                ifscCode,
                upiId
            },
            select: {
                accountHolder: true,
                bankName: true,
                accountNumber: true,
                ifscCode: true,
                upiId: true,
                updatedAt: true
            }
        });
        return saved;
    }
};

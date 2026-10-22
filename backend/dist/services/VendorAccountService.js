"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorAccountService = void 0;
const db_1 = __importDefault(require("../config/db"));
const errors_1 = require("../utils/errors");
const roles_1 = require("../utils/roles");
const resolveVendorProfile = async (vendorIdentifier) => {
    const vendorProfile = await db_1.default.vendorProfile.findFirst({
        where: {
            OR: [
                { id: BigInt(vendorIdentifier) },
                { userId: BigInt(vendorIdentifier) }
            ]
        },
        include: { user: true }
    });
    if (!vendorProfile || !(0, roles_1.isVendorRole)(vendorProfile.user.role)) {
        throw new errors_1.ValidationError('Vendor not found');
    }
    return vendorProfile;
};
const deactivateVendorProducts = async (tx, vendorId) => tx.product.updateMany({
    where: { vendorId },
    data: { status: 'INACTIVE' }
});
exports.VendorAccountService = {
    async deactivateAccount(vendorIdentifier) {
        const vendorProfile = await resolveVendorProfile(vendorIdentifier);
        const result = await db_1.default.$transaction(async (tx) => {
            const productUpdate = await deactivateVendorProducts(tx, vendorProfile.id);
            const user = await tx.user.update({
                where: { id: vendorProfile.userId },
                data: {
                    status: 'BLOCKED',
                    onboardingStatus: 'SUSPENDED'
                }
            });
            await tx.authSession.deleteMany({
                where: { userId: vendorProfile.userId }
            });
            return { productCount: productUpdate.count, user };
        });
        return {
            vendorId: vendorProfile.id.toString(),
            userId: vendorProfile.userId.toString(),
            status: result.user.status,
            onboardingStatus: result.user.onboardingStatus,
            productsDeactivated: result.productCount
        };
    },
    async deleteAccount(vendorIdentifier) {
        const vendorProfile = await resolveVendorProfile(vendorIdentifier);
        const result = await db_1.default.$transaction(async (tx) => {
            const productUpdate = await deactivateVendorProducts(tx, vendorProfile.id);
            const user = await tx.user.update({
                where: { id: vendorProfile.userId },
                data: {
                    status: 'BLOCKED',
                    onboardingStatus: 'SUSPENDED'
                }
            });
            await tx.authSession.deleteMany({
                where: { userId: vendorProfile.userId }
            });
            return { productCount: productUpdate.count, user };
        });
        return {
            vendorId: vendorProfile.id.toString(),
            userId: vendorProfile.userId.toString(),
            status: result.user.status,
            onboardingStatus: result.user.onboardingStatus,
            productsRemovedFromListing: result.productCount
        };
    }
};

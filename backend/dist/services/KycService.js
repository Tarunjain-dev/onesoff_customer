"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycService = void 0;
const errors_1 = require("../utils/errors");
const db_1 = __importDefault(require("../config/db"));
const roles_1 = require("../utils/roles");
const vendorScope_1 = require("../utils/vendorScope");
const S3Service_1 = require("./S3Service");
const vendorKycStore = new Map();
const parseBigIntIdentifier = (value) => {
    try {
        return BigInt(value);
    }
    catch {
        return null;
    }
};
const resolveVendorProfile = async (vendorIdentifier) => {
    const identifier = parseBigIntIdentifier(vendorIdentifier);
    if (identifier === null)
        return null;
    return db_1.default.vendorProfile.findFirst({
        where: {
            OR: [{ id: identifier }, { userId: identifier }]
        },
        include: { user: true }
    });
};
const getKycRecord = (vendorIdentifier, profileId) => {
    const keyCandidates = [vendorIdentifier, profileId];
    const directMatch = keyCandidates
        .map((key) => vendorKycStore.get(key))
        .find(Boolean);
    if (directMatch)
        return directMatch;
    return [...vendorKycStore.values()].find((record) => keyCandidates.includes(record.vendorId.toString()));
};
exports.KycService = {
    async uploadVendorKyc(vendorIdentifier, kycData) {
        const { aadhaarNumber, aadhaarFront, aadhaarBack, notes } = kycData;
        const vendor = await resolveVendorProfile(vendorIdentifier);
        if (!vendor)
            throw new errors_1.ValidationError('Vendor not found');
        const profileId = vendor.id.toString();
        const existingKyc = getKycRecord(vendorIdentifier, profileId);
        if (existingKyc && existingKyc.verificationStatus === 'VERIFIED') {
            throw new errors_1.BusinessLogicError('KYC already verified');
        }
        const kycRecord = {
            vendorId: vendor.id,
            aadhaarNumber,
            aadhaarFront,
            aadhaarBack,
            notes,
            uploadStatus: 'UPLOADED',
            verificationStatus: existingKyc?.verificationStatus === 'REJECTED' ? 'REJECTED' : 'NOT_VERIFIED',
            uploadedAt: new Date(),
            verifiedAt: existingKyc?.verifiedAt
        };
        vendorKycStore.set(profileId, kycRecord);
        await db_1.default.user.update({
            where: { id: vendor.userId },
            data: { onboardingStatus: 'PENDING' }
        });
        return kycRecord;
    },
    async reviewKyc(_adminId, vendorIdentifier, status, notes) {
        const vendor = await resolveVendorProfile(vendorIdentifier);
        if (!vendor)
            throw new errors_1.ValidationError('Vendor not found');
        const profileId = vendor.id.toString();
        const kyc = getKycRecord(vendorIdentifier, profileId);
        if (!kyc)
            throw new errors_1.ValidationError('KYC not found');
        if (kyc.verificationStatus === 'VERIFIED' || kyc.verificationStatus === 'REJECTED') {
            throw new errors_1.BusinessLogicError('KYC already reviewed');
        }
        kyc.verificationStatus = status;
        kyc.verifiedAt = new Date();
        kyc.notes = notes;
        vendorKycStore.set(profileId, kyc);
        await db_1.default.user.update({
            where: { id: vendor.userId },
            data: { onboardingStatus: status === 'VERIFIED' ? 'APPROVED' : 'REJECTED' }
        });
        return { message: `KYC ${status.toLowerCase()} successfully` };
    },
    async getPendingKyc(filters) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const skip = (page - 1) * limit;
        const pendingRecords = [...vendorKycStore.values()]
            .filter((record) => record.verificationStatus === 'NOT_VERIFIED')
            .sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
        const pageRecords = pendingRecords.slice(skip, skip + limit);
        const vendorIds = pageRecords.map((record) => record.vendorId);
        const vendors = await db_1.default.vendorProfile.findMany({
            where: { id: { in: vendorIds } },
            include: { user: true }
        });
        const vendorMap = new Map(vendors.map((vendor) => [vendor.id.toString(), vendor]));
        const kycs = pageRecords.map((record) => ({
            ...record,
            vendor: vendorMap.get(record.vendorId.toString()) || null
        }));
        return {
            kycs,
            pagination: { page, limit, total: pendingRecords.length, pages: Math.ceil(pendingRecords.length / limit) }
        };
    },
    async getVendorKycStatus(vendorIdentifier) {
        const vendor = await resolveVendorProfile(vendorIdentifier);
        if (!vendor) {
            throw new errors_1.ValidationError('Vendor not found');
        }
        const kyc = getKycRecord(vendorIdentifier, vendor.id.toString());
        if (!kyc) {
            return {
                verificationStatus: 'NOT_VERIFIED',
                onboardingStatus: vendor.user.onboardingStatus,
                canReceiveOrders: vendor.user.onboardingStatus === 'APPROVED'
            };
        }
        return {
            verificationStatus: kyc.verificationStatus,
            onboardingStatus: vendor.user.onboardingStatus,
            canReceiveOrders: vendor.user.onboardingStatus === 'APPROVED',
            verifiedAt: kyc.verifiedAt,
            notes: kyc.notes
        };
    },
    async getVendorKycForAdmin(vendorIdentifier, roleFilter) {
        const vendorProfile = await resolveVendorProfile(vendorIdentifier);
        if (!vendorProfile ||
            !(0, roles_1.isVendorRole)(vendorProfile.user.role) ||
            !(0, vendorScope_1.matchesVendorRoleScope)(vendorProfile.user.role, roleFilter)) {
            throw new errors_1.ValidationError('Vendor not found');
        }
        const profileId = vendorProfile.id.toString();
        const kyc = getKycRecord(vendorIdentifier, profileId);
        if (!kyc) {
            throw new errors_1.ValidationError('KYC not found');
        }
        const aadhaarFront = kyc.aadhaarFront
            ? await S3Service_1.S3Service.getAccessibleImageUrl(kyc.aadhaarFront)
            : kyc.aadhaarFront;
        const aadhaarBack = kyc.aadhaarBack
            ? await S3Service_1.S3Service.getAccessibleImageUrl(kyc.aadhaarBack)
            : kyc.aadhaarBack;
        return {
            vendor: {
                id: vendorProfile.user.id.toString(),
                name: vendorProfile.user.name,
                email: vendorProfile.user.email,
                phone: vendorProfile.user.phone,
                onboardingStatus: vendorProfile.user.onboardingStatus
            },
            aadhaarNumber: kyc.aadhaarNumber,
            aadhaarFront,
            aadhaarBack,
            uploadStatus: kyc.uploadStatus,
            verificationStatus: kyc.verificationStatus,
            uploadedAt: kyc.uploadedAt,
            verifiedAt: kyc.verifiedAt,
            notes: kyc.notes
        };
    }
};

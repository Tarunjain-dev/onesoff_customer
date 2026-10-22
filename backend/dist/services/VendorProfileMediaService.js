"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorProfileMediaService = void 0;
const db_1 = __importDefault(require("../config/db"));
const S3Service_1 = require("./S3Service");
const fileToDataUrl = (file) => `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
const toBigInt = (value) => typeof value === 'bigint' ? value : BigInt(String(value).trim());
exports.VendorProfileMediaService = {
    async setProfileImage(userId, profileImageUrl) {
        const userIdBig = toBigInt(userId);
        const vendorProfileModel = db_1.default.vendorProfile;
        await vendorProfileModel.updateMany({
            where: { userId: userIdBig },
            data: { profileImageUrl }
        });
        return { profileImageUrl };
    },
    async getProfileImage(userId) {
        const userIdBig = toBigInt(userId);
        const vendorProfileModel = db_1.default.vendorProfile;
        const vendorProfile = await vendorProfileModel.findUnique({
            where: { userId: userIdBig },
            select: { profileImageUrl: true }
        });
        const profileImageUrl = String(vendorProfile?.profileImageUrl || '').trim() || null;
        if (!profileImageUrl)
            return null;
        return S3Service_1.S3Service.getAccessibleImageUrl(profileImageUrl);
    },
    async uploadProfileImage(userId, file) {
        try {
            const imageUrl = await S3Service_1.S3Service.uploadImage(file, 'vendor-profile');
            await exports.VendorProfileMediaService.setProfileImage(userId, imageUrl);
            return S3Service_1.S3Service.getAccessibleImageUrl(imageUrl);
        }
        catch {
            const imageUrl = fileToDataUrl(file);
            await exports.VendorProfileMediaService.setProfileImage(userId, imageUrl);
            return imageUrl;
        }
    }
};

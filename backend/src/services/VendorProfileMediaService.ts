import prisma from '../config/db';
import { S3Service } from './S3Service';

const fileToDataUrl = (file: Express.Multer.File) =>
  `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

const toBigInt = (value: string | bigint) =>
  typeof value === 'bigint' ? value : BigInt(String(value).trim());

export const VendorProfileMediaService = {
  async setProfileImage(userId: string, profileImageUrl: string | null) {
    const userIdBig = toBigInt(userId);
    const vendorProfileModel = (prisma as any).vendorProfile;

    await vendorProfileModel.updateMany({
      where: { userId: userIdBig },
      data: { profileImageUrl }
    });

    return { profileImageUrl };
  },

  async getProfileImage(userId: string) {
    const userIdBig = toBigInt(userId);
    const vendorProfileModel = (prisma as any).vendorProfile;
    const vendorProfile = await vendorProfileModel.findUnique({
      where: { userId: userIdBig },
      select: { profileImageUrl: true }
    });

    const profileImageUrl = String(vendorProfile?.profileImageUrl || '').trim() || null;
    if (!profileImageUrl) return null;
    return S3Service.getAccessibleImageUrl(profileImageUrl);
  },

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    try {
      const imageUrl = await S3Service.uploadImage(file, 'vendor-profile');
      await VendorProfileMediaService.setProfileImage(userId, imageUrl);
      return S3Service.getAccessibleImageUrl(imageUrl);
    } catch {
      const imageUrl = fileToDataUrl(file);
      await VendorProfileMediaService.setProfileImage(userId, imageUrl);
      return imageUrl;
    }
  }
};

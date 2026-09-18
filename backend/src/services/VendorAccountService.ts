import prisma from '../config/db';
import { ValidationError } from '../utils/errors';
import { isVendorRole } from '../utils/roles';

const resolveVendorProfile = async (vendorIdentifier: string) => {
  const vendorProfile = await prisma.vendorProfile.findFirst({
    where: {
      OR: [
        { id: BigInt(vendorIdentifier) },
        { userId: BigInt(vendorIdentifier) }
      ]
    },
    include: { user: true }
  });

  if (!vendorProfile || !isVendorRole(vendorProfile.user.role)) {
    throw new ValidationError('Vendor not found');
  }

  return vendorProfile;
};

const deactivateVendorProducts = async (tx: any, vendorId: bigint) =>
  tx.product.updateMany({
    where: { vendorId },
    data: { status: 'INACTIVE' }
  });

export const VendorAccountService = {
  async deactivateAccount(vendorIdentifier: string) {
    const vendorProfile = await resolveVendorProfile(vendorIdentifier);

    const result = await prisma.$transaction(async (tx) => {
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

  async deleteAccount(vendorIdentifier: string) {
    const vendorProfile = await resolveVendorProfile(vendorIdentifier);

    const result = await prisma.$transaction(async (tx) => {
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

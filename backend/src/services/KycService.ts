import { ValidationError, BusinessLogicError } from '../utils/errors';
import prisma from '../config/db';
import { isVendorRole } from '../utils/roles';
import { matchesVendorRoleScope } from '../utils/vendorScope';
import { S3Service } from './S3Service';

type VendorKycRecord = {
  vendorId: bigint;
  aadhaarNumber: string;
  aadhaarFront: string;
  aadhaarBack: string;
  notes?: string;
  uploadStatus: 'UPLOADED';
  verificationStatus: 'NOT_VERIFIED' | 'VERIFIED' | 'REJECTED';
  uploadedAt: Date;
  verifiedAt?: Date;
};

const vendorKycStore = new Map<string, VendorKycRecord>();

const parseBigIntIdentifier = (value: string): bigint | null => {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

const resolveVendorProfile = async (vendorIdentifier: string) => {
  const identifier = parseBigIntIdentifier(vendorIdentifier);
  if (identifier === null) return null;

  return prisma.vendorProfile.findFirst({
    where: {
      OR: [{ id: identifier }, { userId: identifier }]
    },
    include: { user: true }
  });
};

const getKycRecord = (vendorIdentifier: string, profileId: string) => {
  const keyCandidates = [vendorIdentifier, profileId];

  const directMatch = keyCandidates
    .map((key) => vendorKycStore.get(key))
    .find(Boolean);

  if (directMatch) return directMatch;

  return [...vendorKycStore.values()].find((record) =>
    keyCandidates.includes(record.vendorId.toString())
  );
};

export const KycService = {
  async uploadVendorKyc(vendorIdentifier: string, kycData: any) {
    const { aadhaarNumber, aadhaarFront, aadhaarBack, notes } = kycData;

    const vendor = await resolveVendorProfile(vendorIdentifier);

    if (!vendor) throw new ValidationError('Vendor not found');

    const profileId = vendor.id.toString();
    const existingKyc = getKycRecord(vendorIdentifier, profileId);
    if (existingKyc && existingKyc.verificationStatus === 'VERIFIED') {
      throw new BusinessLogicError('KYC already verified');
    }

    const kycRecord: VendorKycRecord = {
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

    await prisma.user.update({
      where: { id: vendor.userId },
      data: { onboardingStatus: 'PENDING' }
    });

    return kycRecord;
  },

  async reviewKyc(_adminId: string, vendorIdentifier: string, status: 'VERIFIED' | 'REJECTED', notes?: string) {
    const vendor = await resolveVendorProfile(vendorIdentifier);
    if (!vendor) throw new ValidationError('Vendor not found');

    const profileId = vendor.id.toString();
    const kyc = getKycRecord(vendorIdentifier, profileId);
    if (!kyc) throw new ValidationError('KYC not found');
    if (kyc.verificationStatus === 'VERIFIED' || kyc.verificationStatus === 'REJECTED') {
      throw new BusinessLogicError('KYC already reviewed');
    }

    kyc.verificationStatus = status;
    kyc.verifiedAt = new Date();
    kyc.notes = notes;
    vendorKycStore.set(profileId, kyc);

    await prisma.user.update({
      where: { id: vendor.userId },
      data: { onboardingStatus: status === 'VERIFIED' ? 'APPROVED' : 'REJECTED' }
    });

    return { message: `KYC ${status.toLowerCase()} successfully` };
  },

  async getPendingKyc(filters: { page?: number; limit?: number }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const pendingRecords = [...vendorKycStore.values()]
      .filter((record) => record.verificationStatus === 'NOT_VERIFIED')
      .sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());

    const pageRecords = pendingRecords.slice(skip, skip + limit);
    const vendorIds = pageRecords.map((record) => record.vendorId);

    const vendors = await prisma.vendorProfile.findMany({
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

  async getVendorKycStatus(vendorIdentifier: string) {
    const vendor = await resolveVendorProfile(vendorIdentifier);

    if (!vendor) {
      throw new ValidationError('Vendor not found');
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

  async getVendorKycForAdmin(vendorIdentifier: string, roleFilter?: Record<string, any>) {
    const vendorProfile = await resolveVendorProfile(vendorIdentifier);
    if (
      !vendorProfile ||
      !isVendorRole(vendorProfile.user.role) ||
      !matchesVendorRoleScope(vendorProfile.user.role, roleFilter)
    ) {
      throw new ValidationError('Vendor not found');
    }

    const profileId = vendorProfile.id.toString();
    const kyc = getKycRecord(vendorIdentifier, profileId);
    if (!kyc) {
      throw new ValidationError('KYC not found');
    }

    const aadhaarFront = kyc.aadhaarFront
      ? await S3Service.getAccessibleImageUrl(kyc.aadhaarFront)
      : kyc.aadhaarFront;
    const aadhaarBack = kyc.aadhaarBack
      ? await S3Service.getAccessibleImageUrl(kyc.aadhaarBack)
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

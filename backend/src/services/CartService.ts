import prisma from '../config/db';
import { Prisma } from '@prisma/client';
import { VendorProfileService } from './VendorProfileService';
import { S3Service } from './S3Service';
import { RentalAvailabilityService } from './RentalAvailabilityService';

const cartInclude = {
  product: {
    include: {
      images: true,
      vendor: {
        select: {
          id: true,
          address: true,
          city: true,
          state: true,
          user: {
            select: {
              role: true
            }
          },
          shopName: true,
          ownerName: true,
          currentBadgeAssignment: {
            include: {
              badgeRule: true
            }
          }
        }
      }
    }
  },
  variant: true
} as const;

const sortProductImagesByCover = (images: any[]) => {
  if (!Array.isArray(images) || images.length <= 1) {
    return Array.isArray(images) ? images : [];
  }

  return [...images].sort((left, right) => {
    const leftScore = left?.isCover ? 1 : 0;
    const rightScore = right?.isCover ? 1 : 0;
    return rightScore - leftScore;
  });
};

const parseCurrencyLikeValue = (value: unknown) => {
  const normalized = String(value ?? '').replace(/[^0-9.]/g, '').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveProductAlterationCharge = (product: any) => {
  const direct = parseCurrencyLikeValue(
    product?.alterationCharge ?? product?.productDetailsFull?.alterationCharge
  );
  if (direct > 0) return direct;

  const additionalInfo = Array.isArray(product?.productDetailsFull?.additionalInfo)
    ? product.productDetailsFull.additionalInfo
    : [];

  const entry = additionalInfo.find((row: any) =>
    /alteration\s*charge/i.test(String(row?.label || ''))
  );

  return parseCurrencyLikeValue(entry?.value);
};

const buildStockValidationMessage = (remaining: number) => {
  if (remaining <= 0) {
    return 'This product is already at the maximum available quantity in your cart';
  }

  return `Only ${remaining} item${remaining === 1 ? '' : 's'} left in stock for this variant`;
};

const normalizeCartMetaValue = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

const parseCartDate = (value: string | null, fieldName: string) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const parts = raw.split('-').map((part) => part.trim());
  if (parts.length !== 3) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  const isIso = /^\d{4}$/.test(parts[0]);
  const year = Number(isIso ? parts[0] : parts[2]);
  const month = Number(parts[1]);
  const day = Number(isIso ? parts[2] : parts[0]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  return date;
};

const buildDuplicateCartMessage = () =>
  'This variant is already in your cart. Remove it first if you want to choose different dates.';

export const CartService = {
  async getCart(userId: string) {
    const cartItems = await prisma.cart.findMany({
      where: { userId: parseInt(userId) },
      include: {
        product: {
          include: {
            images: true,
            variants: {
              select: {
                id: true,
                size: true,
                quantity: true
              }
            },
            vendor: {
              select: {
                id: true,
                userId: true,
                address: true,
                city: true,
                state: true,
                user: {
                  select: {
                    role: true
                  }
                },
                shopName: true,
                ownerName: true,
                currentBadgeAssignment: {
                  include: {
                    badgeRule: true
                  }
                }
              }
            }
          }
        },
        variant: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const duplicateCartItemIds: Array<typeof cartItems[number]['id']> = [];
    const seenCartSelections = new Set<string>();
    const activeCartItems = cartItems.filter((item) => {
      const key = item.variantId
        ? `variant:${item.variantId.toString()}`
        : `product:${item.productId.toString()}`;

      if (seenCartSelections.has(key)) {
        duplicateCartItemIds.push(item.id);
        return false;
      }

      seenCartSelections.add(key);
      return true;
    });

    if (duplicateCartItemIds.length > 0) {
      await prisma.cart.deleteMany({
        where: {
          id: { in: duplicateCartItemIds }
        }
      });
    }

    const vendorOperationalSettingsByUserId = new Map<
      string,
      {
        lateFeePerDay: number;
        homeDeliveryApplicable: boolean;
        deliveryCharges: number;
      }
    >();

    const cartItemsWithOperationalSettings = await Promise.all(
      activeCartItems.map(async (item) => {
        const vendor = item.product?.vendor as any;
        const vendorUserId = vendor?.userId ? String(vendor.userId) : '';

        let operationalSettings = {
          lateFeePerDay: 0,
          homeDeliveryApplicable: false,
          deliveryCharges: 0
        };

        if (vendorUserId) {
          const cached = vendorOperationalSettingsByUserId.get(vendorUserId);
          if (cached) {
            operationalSettings = cached;
          } else {
            const resolved = await VendorProfileService.getOperationalSettings(vendorUserId);
            operationalSettings = {
              lateFeePerDay: Math.max(0, Number(resolved.lateFeePerDay || 0)),
              homeDeliveryApplicable: resolved.homeDeliveryApplicable === true,
              deliveryCharges: Math.max(0, Number(resolved.deliveryCharges || 0))
            };
            vendorOperationalSettingsByUserId.set(vendorUserId, operationalSettings);
          }
        }

        const sortedImages = sortProductImagesByCover(item.product?.images || []);
        const signedImageUrls = sortedImages.length
          ? await S3Service.getAccessibleImageUrls(
              sortedImages.map((image: any) => String(image?.imageUrl || ''))
            )
          : [];

        return {
          ...item,
          homeDeliveryApplicable: operationalSettings.homeDeliveryApplicable,
          deliveryCharges: operationalSettings.deliveryCharges,
          lateFeePerDay: operationalSettings.lateFeePerDay,
          product: {
            ...item.product,
            images: sortedImages.map((image: any, index: number) => ({
              ...image,
              imageUrl: signedImageUrls[index] || image?.imageUrl
            })),
            vendorOperationalSettings: operationalSettings,
            vendor: {
              ...item.product.vendor,
              badgeName:
                item.product.vendor?.currentBadgeAssignment?.badgeRule?.name || null,
              badgeImageUrl:
                item.product.vendor?.currentBadgeAssignment?.badgeRule?.imageUrl || null,
              ...operationalSettings
            }
          }
        };
      })
    );

    const total = cartItemsWithOperationalSettings.reduce((sum, item) => {
      const price = Number(item.product.rentalPrice || 0);
      return sum + (price * item.quantity);
    }, 0);

    return {
      items: cartItemsWithOperationalSettings,
      total,
      itemCount: cartItemsWithOperationalSettings.length
    };
  },

  async addToCart(
    userId: string,
    productId: number,
    variantId: number | null,
    quantity: number,
    meta?: {
      rentalPeriod?: string;
      issueDate?: string;
      returnDate?: string;
      size?: string;
      color?: string;
      imageUrl?: string;
      alterationRequired?: boolean;
    }
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (!variantId && Array.isArray(product.variants) && product.variants.length > 0) {
      throw new Error('Variant is required');
    }

    if (variantId) {
      const variant = product.variants.find(v => v.id === BigInt(variantId));
      if (!variant) {
        throw new Error('Variant not found');
      }
    }

    const requestedQuantity = Number(quantity);
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      throw new Error('Quantity must be at least 1');
    }

    if (requestedQuantity !== 1) {
      throw new Error('Only one quantity is allowed per variant');
    }

    if (meta?.alterationRequired === true && !Boolean((product as any)?.alterationAvailable)) {
      throw new Error('Alteration is not available for this product');
    }

    const alterationRequired = meta?.alterationRequired === true;
    const alterationCharge = alterationRequired
      ? resolveProductAlterationCharge(product)
      : 0;
    const normalizedRentalPeriod = normalizeCartMetaValue(meta?.rentalPeriod);
    const normalizedIssueDate = normalizeCartMetaValue(meta?.issueDate);
    const normalizedReturnDate = normalizeCartMetaValue(meta?.returnDate);
    const normalizedSize = normalizeCartMetaValue(meta?.size);
    const normalizedColor = normalizeCartMetaValue(meta?.color);
    const normalizedImageUrl = normalizeCartMetaValue(meta?.imageUrl);

    const existingSelection = await prisma.cart.findFirst({
      where: {
        userId: parseInt(userId),
        productId,
        variantId
      }
    });

    if (existingSelection) {
      throw new Error(buildDuplicateCartMessage());
    }

    if (variantId) {
      const variant = product.variants.find(v => v.id === BigInt(variantId));

      if (!variant) {
        throw new Error('Variant not found');
      }

      const availableStock = Number(variant.quantity || 0);

      if (availableStock <= 0) {
        throw new Error('This item is currently out of stock');
      }

      if (requestedQuantity > availableStock) {
        throw new Error(buildStockValidationMessage(availableStock));
      }
    }

    const issueDate = parseCartDate(normalizedIssueDate, 'issueDate');
    const returnDate = parseCartDate(normalizedReturnDate, 'returnDate');
    if (variantId && issueDate && returnDate) {
      await RentalAvailabilityService.assertRangeAvailableForOrder(
        product.vendorId,
        product.id,
        issueDate,
        returnDate,
        requestedQuantity,
        BigInt(variantId),
        { includePendingHolds: true }
      );
    }

    try {
      const cartItem = await prisma.cart.create({
        data: {
          userId: parseInt(userId),
          productId,
          variantId,
          quantity: requestedQuantity,
          rentalPeriod: normalizedRentalPeriod,
          issueDate: normalizedIssueDate,
          returnDate: normalizedReturnDate,
          size: normalizedSize,
          color: normalizedColor,
          imageUrl: normalizedImageUrl,
          alterationRequired,
          alterationCharge
        },
        include: cartInclude
      });

      return cartItem;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Error(buildDuplicateCartMessage());
      }

      throw error;
    }
  },

  async removeFromCart(userId: string, itemId: number) {
    const cartItem = await prisma.cart.findFirst({
      where: {
        id: itemId,
        userId: parseInt(userId)
      }
    });

    if (!cartItem) {
      throw new Error('Cart item not found');
    }

    await prisma.cart.delete({
      where: { id: itemId }
    });
  },

  async clearCart(userId: string) {
    await prisma.cart.deleteMany({
      where: { userId: parseInt(userId) }
    });
  }
};

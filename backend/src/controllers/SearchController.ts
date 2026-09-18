import { Request, Response } from 'express';
import prisma from '../config/db';
import { ApiResponse } from '../utils/ApiResponse';

const resolveGenderValues = (query: string) => {
  const normalized = query.trim().toLowerCase();
  const values = new Set<string>();

  if (/^(men|man|male)$/.test(normalized)) {
    values.add('Male');
  }

  if (/^(women|woman|female)$/.test(normalized)) {
    values.add('Female');
  }

  if (/^(accessory|accessories|unisex)$/.test(normalized)) {
    values.add('Unisex');
  }

  return Array.from(values);
};

export const SearchController = {
  async getSuggestions(req: Request, res: Response) {
    try {
      const q = String(req.query.q || '').trim();
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      if (!q) {
        return ApiResponse.success(res, { products: [], vendors: [] });
      }

      const genderValues = resolveGenderValues(q);
      const productSearchWhere = {
        status: 'ACTIVE',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { shortDescription: { contains: q, mode: 'insensitive' } },
          { productType: { contains: q, mode: 'insensitive' } },
          { occasion: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
          { category: { name: { contains: q, mode: 'insensitive' } } },
          { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
          ...(genderValues.length > 0
            ? [{ gender: { in: genderValues } }]
            : [])
        ]
      } as any;

      const [products, vendors] = await Promise.all([
        prisma.product.findMany({
          where: productSearchWhere,
          select: {
            id: true,
            name: true,
            vendorId: true,
            gender: true,
            productType: true,
            variants: {
              select: {
                sku: true
              },
              take: 5
            },
            category: {
              select: {
                name: true
              }
            }
          } as any,
          take: limit
        }),
        prisma.vendorProfile.findMany({
          where: {
            OR: [
              { shopName: { contains: q, mode: 'insensitive' } },
              { ownerName: { contains: q, mode: 'insensitive' } }
            ]
          },
          select: {
            id: true,
            shopName: true,
            ownerName: true,
            user: {
              select: {
                role: true
              }
            }
          },
          take: limit
        })
      ]);

      return ApiResponse.success(res, {
        products,
        vendors
      });
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Search failed');
    }
  }
};

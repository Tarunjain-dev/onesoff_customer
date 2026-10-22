"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchController = void 0;
const db_1 = __importDefault(require("../config/db"));
const ApiResponse_1 = require("../utils/ApiResponse");
const resolveGenderValues = (query) => {
    const normalized = query.trim().toLowerCase();
    const values = new Set();
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
exports.SearchController = {
    async getSuggestions(req, res) {
        try {
            const q = String(req.query.q || '').trim();
            const limit = Math.min(Number(req.query.limit) || 20, 50);
            if (!q) {
                return ApiResponse_1.ApiResponse.success(res, { products: [], vendors: [] });
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
            };
            const [products, vendors] = await Promise.all([
                db_1.default.product.findMany({
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
                    },
                    take: limit
                }),
                db_1.default.vendorProfile.findMany({
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
            return ApiResponse_1.ApiResponse.success(res, {
                products,
                vendors
            });
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message || 'Search failed');
        }
    }
};

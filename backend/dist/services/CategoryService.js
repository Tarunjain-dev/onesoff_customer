"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = void 0;
const db_1 = __importDefault(require("../config/db"));
const errors_1 = require("../utils/errors");
const DEFAULT_CATEGORY_CATALOG = [
    {
        name: 'Men',
        children: [
            { name: 'Sherwani' },
            { name: 'Suit' },
            { name: 'Blazer' },
            { name: 'Tuxedo' },
            { name: 'Kurta' }
        ]
    },
    {
        name: 'Women',
        children: [
            { name: 'Saree' },
            { name: 'Lehenga' },
            { name: 'Gown' },
            { name: 'Bridal Wear' }
        ]
    },
    {
        name: 'Accessories',
        children: [
            { name: 'Jewellery' },
            { name: 'Accessories' },
            { name: 'Footwear' }
        ]
    },
    {
        name: 'Brands',
        children: [
            { name: 'Sabyasachi' },
            { name: 'Manish Malhotra' },
            { name: 'Biba' },
            { name: 'FabIndia' },
            { name: 'Global Desi' },
            { name: 'W' },
            { name: 'Zara' },
            { name: 'H&M' },
            { name: 'Forever 21' },
            { name: 'AND' },
            { name: 'Pantaloons' },
            { name: 'Lifestyle' },
            { name: 'Ritu Kumar' },
            { name: 'Anita Dongre' },
            { name: 'Libas' },
            { name: 'Soch' },
            { name: 'Aurelia' },
            { name: 'Vero Moda' },
            { name: 'Only' },
            { name: 'Max' },
            { name: 'Reliance Trends' }
        ]
    }
];
const normalizeName = (value) => String(value ?? '').trim();
const parseNullableBigInt = (value) => {
    if (value === undefined || value === null || String(value).trim() === '')
        return null;
    try {
        return BigInt(String(value).trim());
    }
    catch {
        throw new errors_1.ValidationError('Invalid parent category');
    }
};
const buildCategoryMaps = (rows) => {
    const byKey = new Map();
    const byId = new Map();
    rows.forEach((row) => {
        const key = `${String(row.parentId ?? 'root')}::${row.name.trim().toLowerCase()}`;
        byKey.set(key, row);
        byId.set(row.id.toString(), row);
    });
    return { byKey, byId };
};
const ensureCategoryTree = async (nodes, parentId, byKey) => {
    for (const node of nodes) {
        const trimmedName = normalizeName(node.name);
        if (!trimmedName)
            continue;
        const key = `${String(parentId ?? 'root')}::${trimmedName.toLowerCase()}`;
        let category = byKey.get(key);
        if (!category) {
            category = await db_1.default.category.create({
                data: {
                    name: trimmedName,
                    parentId
                }
            });
            byKey.set(key, category);
        }
        if (Array.isArray(node.children) && node.children.length > 0) {
            await ensureCategoryTree(node.children, category.id, byKey);
        }
    }
};
const ensureDefaultCategoryCatalog = async () => {
    const existing = await db_1.default.category.findMany({
        select: {
            id: true,
            name: true,
            parentId: true
        }
    });
    const { byKey } = buildCategoryMaps(existing);
    await ensureCategoryTree(DEFAULT_CATEGORY_CATALOG, null, byKey);
};
const loadCategoryRows = async () => {
    await ensureDefaultCategoryCatalog();
    const categories = await db_1.default.category.findMany({
        orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
        select: {
            id: true,
            name: true,
            parentId: true,
            parent: {
                select: {
                    id: true,
                    name: true
                }
            },
            _count: {
                select: {
                    products: true
                }
            }
        }
    });
    return categories;
};
const buildCategoryTree = (rows) => {
    const childMap = new Map();
    const byId = new Map();
    rows.forEach((row) => {
        byId.set(row.id.toString(), row);
        const parentKey = row.parentId ? row.parentId.toString() : 'root';
        const group = childMap.get(parentKey) || [];
        group.push(row);
        childMap.set(parentKey, group);
    });
    const visit = (row, level) => {
        const children = (childMap.get(row.id.toString()) || [])
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((child) => visit(child, level + 1));
        return {
            id: row.id.toString(),
            name: row.name,
            parentId: row.parentId ? row.parentId.toString() : null,
            parentName: row.parent?.name || null,
            level,
            isLeaf: children.length === 0,
            productCount: Number(row._count?.products || 0),
            children
        };
    };
    const roots = (childMap.get('root') || [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((row) => visit(row, 0));
    const flatten = (nodes) => nodes.flatMap((node) => [
        {
            id: node.id,
            name: node.name,
            parentId: node.parentId,
            parentName: node.parentName,
            level: node.level,
            isLeaf: node.isLeaf,
            productCount: node.productCount
        },
        ...flatten(node.children)
    ]);
    return {
        tree: roots,
        flat: flatten(roots)
    };
};
const assertUniqueSiblingName = async (name, parentId, excludeId) => {
    const siblings = await db_1.default.category.findMany({
        where: {
            parentId
        },
        select: {
            id: true,
            name: true
        }
    });
    const duplicate = siblings.find((row) => {
        if (excludeId && row.id === excludeId)
            return false;
        return row.name.trim().toLowerCase() === name.trim().toLowerCase();
    });
    if (duplicate) {
        throw new errors_1.ValidationError('A category with this name already exists at the same level');
    }
};
const assertParentExists = async (parentId) => {
    if (!parentId)
        return null;
    const parent = await db_1.default.category.findUnique({
        where: { id: parentId },
        select: {
            id: true,
            name: true,
            parentId: true
        }
    });
    if (!parent) {
        throw new errors_1.ValidationError('Parent category not found');
    }
    return parent;
};
const assertNoCycle = async (categoryId, nextParentId) => {
    if (!nextParentId)
        return;
    if (categoryId === nextParentId) {
        throw new errors_1.ValidationError('Category cannot be its own parent');
    }
    let cursor = nextParentId;
    while (cursor) {
        const current = await db_1.default.category.findUnique({
            where: { id: cursor },
            select: {
                id: true,
                parentId: true
            }
        });
        if (!current)
            return;
        if (current.id === categoryId) {
            throw new errors_1.ValidationError('Category hierarchy cannot create a cycle');
        }
        cursor = current.parentId;
    }
};
const serializeCategory = (row) => ({
    id: row.id.toString(),
    name: row.name,
    parentId: row.parentId ? row.parentId.toString() : null,
    parentName: row.parent?.name || null,
    level: row.parentId ? 1 : 0,
    isLeaf: true,
    productCount: Number(row._count?.products || 0)
});
exports.CategoryService = {
    ensureDefaultCategoryCatalog,
    async getCategoryCatalog() {
        const rows = await loadCategoryRows();
        return buildCategoryTree(rows);
    },
    async createCategory(input) {
        await ensureDefaultCategoryCatalog();
        const name = normalizeName(input.name);
        if (!name) {
            throw new errors_1.ValidationError('Category name is required');
        }
        const parentId = parseNullableBigInt(input.parentId);
        await assertParentExists(parentId);
        await assertUniqueSiblingName(name, parentId);
        const category = await db_1.default.category.create({
            data: {
                name,
                parentId
            },
            include: {
                parent: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                _count: {
                    select: {
                        products: true
                    }
                }
            }
        });
        return serializeCategory(category);
    },
    async updateCategory(categoryId, input) {
        await ensureDefaultCategoryCatalog();
        let categoryIdBig;
        try {
            categoryIdBig = BigInt(categoryId);
        }
        catch {
            throw new errors_1.ValidationError('Invalid category id');
        }
        const existing = await db_1.default.category.findUnique({
            where: { id: categoryIdBig },
            select: {
                id: true,
                name: true,
                parentId: true
            }
        });
        if (!existing) {
            throw new errors_1.ValidationError('Category not found');
        }
        const name = normalizeName(input.name || existing.name);
        if (!name) {
            throw new errors_1.ValidationError('Category name is required');
        }
        const parentId = input.parentId === undefined
            ? existing.parentId
            : parseNullableBigInt(input.parentId);
        await assertParentExists(parentId);
        await assertNoCycle(categoryIdBig, parentId);
        await assertUniqueSiblingName(name, parentId, categoryIdBig);
        const updated = await db_1.default.category.update({
            where: { id: categoryIdBig },
            data: {
                name,
                parentId
            },
            include: {
                parent: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                _count: {
                    select: {
                        products: true
                    }
                }
            }
        });
        return serializeCategory(updated);
    },
    async deleteCategory(categoryId) {
        await ensureDefaultCategoryCatalog();
        let categoryIdBig;
        try {
            categoryIdBig = BigInt(categoryId);
        }
        catch {
            throw new errors_1.ValidationError('Invalid category id');
        }
        const category = await db_1.default.category.findUnique({
            where: { id: categoryIdBig },
            include: {
                _count: {
                    select: {
                        children: true,
                        products: true
                    }
                }
            }
        });
        if (!category) {
            throw new errors_1.ValidationError('Category not found');
        }
        if (Number(category._count?.children || 0) > 0) {
            throw new errors_1.BusinessLogicError('Delete child categories first');
        }
        if (Number(category._count?.products || 0) > 0) {
            throw new errors_1.BusinessLogicError('Cannot delete a category that is assigned to products');
        }
        await db_1.default.category.delete({
            where: { id: categoryIdBig }
        });
        return { success: true };
    }
};

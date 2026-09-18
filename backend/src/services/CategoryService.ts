import prisma from '../config/db';
import { BusinessLogicError, ValidationError } from '../utils/errors';

type CategorySeedNode = {
  name: string;
  children?: CategorySeedNode[];
};

export type CategoryTreeNode = {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  level: number;
  isLeaf: boolean;
  productCount: number;
  children: CategoryTreeNode[];
};

export type CategoryFlatNode = Omit<CategoryTreeNode, 'children'>;

type UpsertCategoryInput = {
  name: string;
  parentId?: string | null;
};

const DEFAULT_CATEGORY_CATALOG: CategorySeedNode[] = [
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

const normalizeName = (value: unknown) => String(value ?? '').trim();

const parseNullableBigInt = (value?: string | null) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  try {
    return BigInt(String(value).trim());
  } catch {
    throw new ValidationError('Invalid parent category');
  }
};

const buildCategoryMaps = (rows: Array<{
  id: bigint;
  name: string;
  parentId: bigint | null;
}>) => {
  const byKey = new Map<string, { id: bigint; name: string; parentId: bigint | null }>();
  const byId = new Map<string, { id: bigint; name: string; parentId: bigint | null }>();

  rows.forEach((row) => {
    const key = `${String(row.parentId ?? 'root')}::${row.name.trim().toLowerCase()}`;
    byKey.set(key, row);
    byId.set(row.id.toString(), row);
  });

  return { byKey, byId };
};

const ensureCategoryTree = async (
  nodes: CategorySeedNode[],
  parentId: bigint | null,
  byKey: Map<string, { id: bigint; name: string; parentId: bigint | null }>
) => {
  for (const node of nodes) {
    const trimmedName = normalizeName(node.name);
    if (!trimmedName) continue;

    const key = `${String(parentId ?? 'root')}::${trimmedName.toLowerCase()}`;
    let category = byKey.get(key);

    if (!category) {
      category = await prisma.category.create({
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
  const existing = await prisma.category.findMany({
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

  const categories = await prisma.category.findMany({
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

const buildCategoryTree = (
  rows: Array<{
    id: bigint;
    name: string;
    parentId: bigint | null;
    parent: { id: bigint; name: string } | null;
    _count: { products: number };
  }>
) => {
  const childMap = new Map<string, typeof rows>();
  const byId = new Map<string, (typeof rows)[number]>();

  rows.forEach((row) => {
    byId.set(row.id.toString(), row);
    const parentKey = row.parentId ? row.parentId.toString() : 'root';
    const group = childMap.get(parentKey) || [];
    group.push(row);
    childMap.set(parentKey, group);
  });

  const visit = (
    row: (typeof rows)[number],
    level: number
  ): CategoryTreeNode => {
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

  const flatten = (nodes: CategoryTreeNode[]): CategoryFlatNode[] =>
    nodes.flatMap((node) => [
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

const assertUniqueSiblingName = async (
  name: string,
  parentId: bigint | null,
  excludeId?: bigint
) => {
  const siblings = await prisma.category.findMany({
    where: {
      parentId
    },
    select: {
      id: true,
      name: true
    }
  });

  const duplicate = siblings.find((row) => {
    if (excludeId && row.id === excludeId) return false;
    return row.name.trim().toLowerCase() === name.trim().toLowerCase();
  });

  if (duplicate) {
    throw new ValidationError('A category with this name already exists at the same level');
  }
};

const assertParentExists = async (parentId: bigint | null) => {
  if (!parentId) return null;

  const parent = await prisma.category.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      name: true,
      parentId: true
    }
  });

  if (!parent) {
    throw new ValidationError('Parent category not found');
  }

  return parent;
};

const assertNoCycle = async (categoryId: bigint, nextParentId: bigint | null) => {
  if (!nextParentId) return;
  if (categoryId === nextParentId) {
    throw new ValidationError('Category cannot be its own parent');
  }

  let cursor: bigint | null = nextParentId;
  while (cursor) {
    const current: { id: bigint; parentId: bigint | null } | null =
      await prisma.category.findUnique({
      where: { id: cursor },
      select: {
        id: true,
        parentId: true
      }
      });

    if (!current) return;
    if (current.id === categoryId) {
      throw new ValidationError('Category hierarchy cannot create a cycle');
    }

    cursor = current.parentId;
  }
};

const serializeCategory = (row: {
  id: bigint;
  name: string;
  parentId: bigint | null;
  parent?: { id: bigint; name: string } | null;
  _count?: { products: number };
}): CategoryFlatNode => ({
  id: row.id.toString(),
  name: row.name,
  parentId: row.parentId ? row.parentId.toString() : null,
  parentName: row.parent?.name || null,
  level: row.parentId ? 1 : 0,
  isLeaf: true,
  productCount: Number(row._count?.products || 0)
});

export const CategoryService = {
  ensureDefaultCategoryCatalog,

  async getCategoryCatalog() {
    const rows = await loadCategoryRows();
    return buildCategoryTree(rows);
  },

  async createCategory(input: UpsertCategoryInput) {
    await ensureDefaultCategoryCatalog();

    const name = normalizeName(input.name);
    if (!name) {
      throw new ValidationError('Category name is required');
    }

    const parentId = parseNullableBigInt(input.parentId);
    await assertParentExists(parentId);
    await assertUniqueSiblingName(name, parentId);

    const category = await prisma.category.create({
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

  async updateCategory(categoryId: string, input: UpsertCategoryInput) {
    await ensureDefaultCategoryCatalog();

    let categoryIdBig: bigint;
    try {
      categoryIdBig = BigInt(categoryId);
    } catch {
      throw new ValidationError('Invalid category id');
    }

    const existing = await prisma.category.findUnique({
      where: { id: categoryIdBig },
      select: {
        id: true,
        name: true,
        parentId: true
      }
    });

    if (!existing) {
      throw new ValidationError('Category not found');
    }

    const name = normalizeName(input.name || existing.name);
    if (!name) {
      throw new ValidationError('Category name is required');
    }

    const parentId =
      input.parentId === undefined
        ? existing.parentId
        : parseNullableBigInt(input.parentId);

    await assertParentExists(parentId);
    await assertNoCycle(categoryIdBig, parentId);
    await assertUniqueSiblingName(name, parentId, categoryIdBig);

    const updated = await prisma.category.update({
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

  async deleteCategory(categoryId: string) {
    await ensureDefaultCategoryCatalog();

    let categoryIdBig: bigint;
    try {
      categoryIdBig = BigInt(categoryId);
    } catch {
      throw new ValidationError('Invalid category id');
    }

    const category = await prisma.category.findUnique({
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
      throw new ValidationError('Category not found');
    }

    if (Number(category._count?.children || 0) > 0) {
      throw new BusinessLogicError('Delete child categories first');
    }

    if (Number(category._count?.products || 0) > 0) {
      throw new BusinessLogicError('Cannot delete a category that is assigned to products');
    }

    await prisma.category.delete({
      where: { id: categoryIdBig }
    });

    return { success: true };
  }
};

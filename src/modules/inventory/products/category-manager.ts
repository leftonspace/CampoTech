/**
 * Category Manager
 * Phase 12.2: Product category hierarchy management
 */

import { prisma } from '@/lib/prisma';
import type {
  ProductCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryTreeNode,
} from './product.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new product category
 */
export async function createCategory(
  input: CreateCategoryInput
): Promise<ProductCategory> {
  // Validate parent exists if provided
  if (input.parentId) {
    const parent = await prisma.productCategory.findFirst({
      where: {
        id: input.parentId,
        organizationId: input.organizationId,
      },
    });
    if (!parent) {
      throw new Error('Categoría padre no encontrada');
    }
  }

  // Check code uniqueness
  const existing = await prisma.productCategory.findFirst({
    where: {
      organizationId: input.organizationId,
      code: input.code,
    },
  });
  if (existing) {
    throw new Error(`Ya existe una categoría con el código "${input.code}"`);
  }

  const category = await prisma.productCategory.create({
    data: {
      organizationId: input.organizationId,
      parentId: input.parentId || null,
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description || null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });

  return category as ProductCategory;
}

/**
 * Get a category by ID
 */
export async function getCategory(
  organizationId: string,
  categoryId: string
): Promise<ProductCategory | null> {
  const category = await prisma.productCategory.findFirst({
    where: {
      id: categoryId,
      organizationId,
    },
    include: {
      parent: true,
      children: true,
      _count: {
        select: { products: true },
      },
    },
  });

  return category as ProductCategory | null;
}

/**
 * Update a category
 */
export async function updateCategory(
  organizationId: string,
  categoryId: string,
  input: UpdateCategoryInput
): Promise<ProductCategory> {
  // Verify category exists
  const existing = await prisma.productCategory.findFirst({
    where: {
      id: categoryId,
      organizationId,
    },
  });
  if (!existing) {
    throw new Error('Categoría no encontrada');
  }

  // Validate parent change doesn't create a cycle
  if (input.parentId !== undefined && input.parentId !== existing.parentId) {
    if (input.parentId === categoryId) {
      throw new Error('Una categoría no puede ser su propio padre');
    }
    if (input.parentId) {
      const wouldCreateCycle = await checkCategoryHierarchyCycle(
        organizationId,
        categoryId,
        input.parentId
      );
      if (wouldCreateCycle) {
        throw new Error('El cambio crearía un ciclo en la jerarquía');
      }
    }
  }

  // Check code uniqueness if changing
  if (input.code && input.code !== existing.code) {
    const codeExists = await prisma.productCategory.findFirst({
      where: {
        organizationId,
        code: input.code,
        id: { not: categoryId },
      },
    });
    if (codeExists) {
      throw new Error(`Ya existe una categoría con el código "${input.code}"`);
    }
  }

  const category = await prisma.productCategory.update({
    where: { id: categoryId },
    data: {
      parentId: input.parentId,
      code: input.code?.toUpperCase(),
      name: input.name,
      description: input.description,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
    include: {
      parent: true,
      children: true,
    },
  });

  return category as ProductCategory;
}

/**
 * Delete a category (soft delete by deactivating if has products)
 */
export async function deleteCategory(
  organizationId: string,
  categoryId: string,
  reassignTo?: string
): Promise<{ deleted: boolean; reassigned: number }> {
  // Verify category exists
  const category = await prisma.productCategory.findFirst({
    where: {
      id: categoryId,
      organizationId,
    },
    include: {
      _count: {
        select: { products: true, children: true },
      },
    },
  });
  if (!category) {
    throw new Error('Categoría no encontrada');
  }

  let reassignedCount = 0;

  // Handle products
  if (category._count.products > 0) {
    if (reassignTo) {
      // Reassign products to another category
      const targetCategory = await prisma.productCategory.findFirst({
        where: {
          id: reassignTo,
          organizationId,
        },
      });
      if (!targetCategory) {
        throw new Error('Categoría destino no encontrada');
      }

      const result = await prisma.product.updateMany({
        where: {
          categoryId: categoryId,
          organizationId,
        },
        data: { categoryId: reassignTo },
      });
      reassignedCount = result.count;
    } else {
      // Remove category from products (set to null)
      await prisma.product.updateMany({
        where: {
          categoryId: categoryId,
          organizationId,
        },
        data: { categoryId: null },
      });
    }
  }

  // Handle children - move to parent or root
  if (category._count.children > 0) {
    await prisma.productCategory.updateMany({
      where: {
        parentId: categoryId,
        organizationId,
      },
      data: { parentId: category.parentId || null },
    });
  }

  // Delete the category
  await prisma.productCategory.delete({
    where: { id: categoryId },
  });

  return { deleted: true, reassigned: reassignedCount };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY LISTING & TREE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all categories for an organization
 */
export async function getAllCategories(
  organizationId: string,
  includeInactive: boolean = false
): Promise<ProductCategory[]> {
  const categories = await prisma.productCategory.findMany({
    where: {
      organizationId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: {
      parent: true,
      _count: {
        select: { products: true, children: true },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return categories as ProductCategory[];
}

/**
 * Get root categories (no parent)
 */
export async function getRootCategories(
  organizationId: string
): Promise<ProductCategory[]> {
  const categories = await prisma.productCategory.findMany({
    where: {
      organizationId,
      parentId: null,
      isActive: true,
    },
    include: {
      children: true,
      _count: {
        select: { products: true },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return categories as ProductCategory[];
}

/**
 * Build category tree structure
 */
export async function getCategoryTree(
  organizationId: string,
  includeInactive: boolean = false
): Promise<CategoryTreeNode[]> {
  const categories = await getAllCategories(organizationId, includeInactive);

  // Build tree from flat list
  const categoryMap = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  // First pass: create nodes
  for (const cat of categories) {
    categoryMap.set(cat.id, {
      ...cat,
      children: [],
      level: 0,
      path: [cat.code],
      productCount: (cat as any)._count?.products || 0,
    });
  }

  // Second pass: build hierarchy
  for (const cat of categories) {
    const node = categoryMap.get(cat.id)!;

    if (cat.parentId && categoryMap.has(cat.parentId)) {
      const parent = categoryMap.get(cat.parentId)!;
      parent.children.push(node);
      node.level = parent.level + 1;
      node.path = [...parent.path, cat.code];
    } else {
      roots.push(node);
    }
  }

  // Sort children at each level
  const sortChildren = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortChildren(node.children);
      }
    }
  };
  sortChildren(roots);

  return roots;
}

/**
 * Get category path (breadcrumb)
 */
export async function getCategoryPath(
  organizationId: string,
  categoryId: string
): Promise<ProductCategory[]> {
  const path: ProductCategory[] = [];
  let currentId: string | null = categoryId;

  while (currentId) {
    const category = await prisma.productCategory.findFirst({
      where: {
        id: currentId,
        organizationId,
      },
    });

    if (!category) break;

    path.unshift(category as ProductCategory);
    currentId = category.parentId;

    // Safety: prevent infinite loops
    if (path.length > 20) break;
  }

  return path;
}

/**
 * Get all descendant category IDs (for filtering products by category)
 */
export async function getDescendantCategoryIds(
  organizationId: string,
  categoryId: string
): Promise<string[]> {
  const ids: string[] = [categoryId];
  const queue: string[] = [categoryId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = await prisma.productCategory.findMany({
      where: {
        organizationId,
        parentId: currentId,
        isActive: true,
      },
      select: { id: true },
    });

    for (const child of children) {
      ids.push(child.id);
      queue.push(child.id);
    }

    // Safety: prevent infinite loops
    if (ids.length > 1000) break;
  }

  return ids;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if changing a category's parent would create a cycle
 */
async function checkCategoryHierarchyCycle(
  organizationId: string,
  categoryId: string,
  newParentId: string
): Promise<boolean> {
  let currentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === categoryId) {
      return true; // Cycle detected
    }

    if (visited.has(currentId)) {
      break; // Already visited, no cycle involving our category
    }
    visited.add(currentId);

    const parent = await prisma.productCategory.findFirst({
      where: {
        id: currentId,
        organizationId,
      },
      select: { parentId: true },
    });

    currentId = parent?.parentId || null;
  }

  return false;
}

/**
 * Move category to new position
 */
export async function moveCategory(
  organizationId: string,
  categoryId: string,
  newParentId: string | null,
  newSortOrder: number
): Promise<ProductCategory> {
  return updateCategory(organizationId, categoryId, {
    parentId: newParentId,
    sortOrder: newSortOrder,
  });
}

/**
 * Reorder categories within same parent
 */
export async function reorderCategories(
  organizationId: string,
  parentId: string | null,
  categoryIds: string[]
): Promise<void> {
  const updates = categoryIds.map((id, index) =>
    prisma.productCategory.updateMany({
      where: {
        id,
        organizationId,
        parentId: parentId,
      },
      data: { sortOrder: index },
    })
  );

  await prisma.$transaction(updates);
}

/**
 * Get category statistics
 */
export async function getCategoryStats(organizationId: string): Promise<{
  total: number;
  active: number;
  inactive: number;
  withProducts: number;
  maxDepth: number;
}> {
  const [total, active, withProducts] = await Promise.all([
    prisma.productCategory.count({ where: { organizationId } }),
    prisma.productCategory.count({ where: { organizationId, isActive: true } }),
    prisma.productCategory.count({
      where: {
        organizationId,
        products: { some: {} },
      },
    }),
  ]);

  // Calculate max depth
  const tree = await getCategoryTree(organizationId, true);
  const getMaxDepth = (nodes: CategoryTreeNode[], depth: number = 0): number => {
    if (nodes.length === 0) return depth;
    return Math.max(...nodes.map(n => getMaxDepth(n.children, depth + 1)));
  };
  const maxDepth = getMaxDepth(tree);

  return {
    total,
    active,
    inactive: total - active,
    withProducts,
    maxDepth,
  };
}

/**
 * Search categories
 */
export async function searchCategories(
  organizationId: string,
  query: string,
  limit: number = 10
): Promise<ProductCategory[]> {
  const categories = await prisma.productCategory.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { code: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
    include: {
      parent: true,
    },
    take: limit,
    orderBy: { name: 'asc' },
  });

  return categories as ProductCategory[];
}

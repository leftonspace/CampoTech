/**
 * Price Book Link Service
 * Phase 12: Links inventory products to price book items for billing integration
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProductPriceBookLink {
  productId: string;
  priceBookItemId: string;
  productSku: string;
  productName: string;
  priceBookCode: string;
  priceBookName: string;
  productSalePrice: number;
  priceBookUnitPrice: number;
  priceDifference: number;
  lastSyncedAt: Date | null;
}

export interface UnlinkedProduct {
  id: string;
  sku: string;
  name: string;
  salePrice: number;
  categoryName: string | null;
}

export interface UnlinkedPriceBookItem {
  id: string;
  code: string;
  name: string;
  unitPrice: number;
  categoryName: string | null;
}

export interface LinkSuggestion {
  productId: string;
  productSku: string;
  productName: string;
  priceBookItemId: string;
  priceBookCode: string;
  priceBookName: string;
  matchScore: number;
  matchReason: string;
}

export interface PriceSyncResult {
  synced: number;
  skipped: number;
  errors: Array<{ productId: string; error: string }>;
}

export interface CreatePriceBookItemFromProductResult {
  created: number;
  skipped: number;
  errors: Array<{ productId: string; error: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LINK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all product-to-pricebook links for an organization
 */
export async function getProductPriceBookLinks(
  organizationId: string
): Promise<ProductPriceBookLink[]> {
  const links = await prisma.productPriceBookLink.findMany({
    where: { organizationId },
    include: {
      product: {
        select: { id: true, sku: true, name: true, salePrice: true },
      },
      priceBookItem: {
        select: { id: true, code: true, name: true, unitPrice: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return links.map((link: typeof links[number]) => ({
    productId: link.productId,
    priceBookItemId: link.priceBookItemId,
    productSku: link.product.sku,
    productName: link.product.name,
    priceBookCode: link.priceBookItem.code,
    priceBookName: link.priceBookItem.name,
    productSalePrice: Number(link.product.salePrice),
    priceBookUnitPrice: Number(link.priceBookItem.unitPrice),
    priceDifference: Number(link.priceBookItem.unitPrice) - Number(link.product.salePrice),
    lastSyncedAt: link.lastSyncedAt,
  }));
}

/**
 * Link a product to a price book item
 */
export async function linkProductToPriceBook(
  organizationId: string,
  productId: string,
  priceBookItemId: string
): Promise<ProductPriceBookLink> {
  // Verify both exist in the organization
  const [product, priceBookItem] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, organizationId },
      select: { id: true, sku: true, name: true, salePrice: true },
    }),
    prisma.priceBookItem.findFirst({
      where: { id: priceBookItemId, orgId: organizationId },
      select: { id: true, code: true, name: true, unitPrice: true },
    }),
  ]);

  if (!product) throw new Error('Producto no encontrado');
  if (!priceBookItem) throw new Error('Item de lista de precios no encontrado');

  // Check for existing link
  const existingLink = await prisma.productPriceBookLink.findFirst({
    where: {
      organizationId,
      OR: [{ productId }, { priceBookItemId }],
    },
  });

  if (existingLink) {
    throw new Error('El producto o item ya está vinculado a otro elemento');
  }

  // Create the link
  await prisma.productPriceBookLink.create({
    data: {
      organizationId,
      productId,
      priceBookItemId,
      lastSyncedAt: null,
    },
  });

  return {
    productId,
    priceBookItemId,
    productSku: product.sku,
    productName: product.name,
    priceBookCode: priceBookItem.code,
    priceBookName: priceBookItem.name,
    productSalePrice: Number(product.salePrice),
    priceBookUnitPrice: Number(priceBookItem.unitPrice),
    priceDifference: Number(priceBookItem.unitPrice) - Number(product.salePrice),
    lastSyncedAt: null,
  };
}

/**
 * Remove a product-to-pricebook link
 */
export async function unlinkProductFromPriceBook(
  organizationId: string,
  productId: string
): Promise<boolean> {
  const result = await prisma.productPriceBookLink.deleteMany({
    where: { organizationId, productId },
  });
  return result.count > 0;
}

/**
 * Get link for a specific product
 */
export async function getProductLink(
  organizationId: string,
  productId: string
): Promise<ProductPriceBookLink | null> {
  const link = await prisma.productPriceBookLink.findFirst({
    where: { organizationId, productId },
    include: {
      product: {
        select: { id: true, sku: true, name: true, salePrice: true },
      },
      priceBookItem: {
        select: { id: true, code: true, name: true, unitPrice: true },
      },
    },
  });

  if (!link) return null;

  return {
    productId: link.productId,
    priceBookItemId: link.priceBookItemId,
    productSku: link.product.sku,
    productName: link.product.name,
    priceBookCode: link.priceBookItem.code,
    priceBookName: link.priceBookItem.name,
    productSalePrice: Number(link.product.salePrice),
    priceBookUnitPrice: Number(link.priceBookItem.unitPrice),
    priceDifference: Number(link.priceBookItem.unitPrice) - Number(link.product.salePrice),
    lastSyncedAt: link.lastSyncedAt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNLINKED ITEMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get products not linked to any price book item
 */
export async function getUnlinkedProducts(
  organizationId: string
): Promise<UnlinkedProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
      priceBookLink: null,
    },
    select: {
      id: true,
      sku: true,
      name: true,
      salePrice: true,
      category: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });

  return products.map((p: typeof products[number]) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    salePrice: Number(p.salePrice),
    categoryName: p.category?.name || null,
  }));
}

/**
 * Get price book items not linked to any product
 */
export async function getUnlinkedPriceBookItems(
  organizationId: string
): Promise<UnlinkedPriceBookItem[]> {
  const items = await prisma.priceBookItem.findMany({
    where: {
      orgId: organizationId,
      isActive: true,
      productLink: null,
    },
    select: {
      id: true,
      code: true,
      name: true,
      unitPrice: true,
      category: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });

  return items.map((item: typeof items[number]) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    unitPrice: Number(item.unitPrice),
    categoryName: item.category?.name || null,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-LINKING & SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get suggestions for linking products to price book items
 */
export async function getLinkSuggestions(
  organizationId: string
): Promise<LinkSuggestion[]> {
  const [unlinkedProducts, unlinkedItems] = await Promise.all([
    getUnlinkedProducts(organizationId),
    getUnlinkedPriceBookItems(organizationId),
  ]);

  const suggestions: LinkSuggestion[] = [];

  for (const product of unlinkedProducts) {
    for (const item of unlinkedItems) {
      const matchScore = calculateMatchScore(product, item);
      if (matchScore > 0.5) {
        suggestions.push({
          productId: product.id,
          productSku: product.sku,
          productName: product.name,
          priceBookItemId: item.id,
          priceBookCode: item.code,
          priceBookName: item.name,
          matchScore,
          matchReason: getMatchReason(product, item, matchScore),
        });
      }
    }
  }

  // Sort by match score (highest first)
  return suggestions.sort((a: typeof suggestions[number], b: typeof suggestions[number]) => b.matchScore - a.matchScore);
}

/**
 * Auto-link products to price book items based on exact code/sku matches
 */
export async function autoLinkByCode(
  organizationId: string
): Promise<{ linked: number; suggestions: number }> {
  const [unlinkedProducts, unlinkedItems] = await Promise.all([
    getUnlinkedProducts(organizationId),
    getUnlinkedPriceBookItems(organizationId),
  ]);

  let linked = 0;
  const itemsByCode = new Map(unlinkedItems.map((i: typeof unlinkedItems[number]) => [i.code.toLowerCase(), i]));

  for (const product of unlinkedProducts) {
    // Try exact SKU match
    const matchingItem = itemsByCode.get(product.sku.toLowerCase());
    if (matchingItem) {
      try {
        await linkProductToPriceBook(organizationId, product.id, matchingItem.id);
        linked++;
        itemsByCode.delete(product.sku.toLowerCase());
      } catch {
        // Link might fail if already linked, skip
      }
    }
  }

  const remainingSuggestions = await getLinkSuggestions(organizationId);

  return {
    linked,
    suggestions: remainingSuggestions.length,
  };
}

function calculateMatchScore(
  product: UnlinkedProduct,
  item: UnlinkedPriceBookItem
): number {
  let score = 0;

  // Exact code/sku match
  if (product.sku.toLowerCase() === item.code.toLowerCase()) {
    return 1.0;
  }

  // Partial SKU match
  if (
    product.sku.toLowerCase().includes(item.code.toLowerCase()) ||
    item.code.toLowerCase().includes(product.sku.toLowerCase())
  ) {
    score += 0.4;
  }

  // Name similarity (simple word overlap)
  const productWords = product.name.toLowerCase().split(/\s+/);
  const itemWords = item.name.toLowerCase().split(/\s+/);
  const commonWords = productWords.filter((w) => itemWords.includes(w) && w.length > 2);
  score += (commonWords.length / Math.max(productWords.length, itemWords.length)) * 0.4;

  // Price proximity (within 10%)
  const priceDiff = Math.abs(product.salePrice - item.unitPrice);
  const avgPrice = (product.salePrice + item.unitPrice) / 2;
  if (avgPrice > 0 && priceDiff / avgPrice < 0.1) {
    score += 0.2;
  }

  return Math.min(score, 1);
}

function getMatchReason(
  product: UnlinkedProduct,
  item: UnlinkedPriceBookItem,
  score: number
): string {
  if (product.sku.toLowerCase() === item.code.toLowerCase()) {
    return 'Código exacto';
  }

  const reasons: string[] = [];

  if (
    product.sku.toLowerCase().includes(item.code.toLowerCase()) ||
    item.code.toLowerCase().includes(product.sku.toLowerCase())
  ) {
    reasons.push('Código similar');
  }

  const productWords = product.name.toLowerCase().split(/\s+/);
  const itemWords = item.name.toLowerCase().split(/\s+/);
  const commonWords = productWords.filter((w) => itemWords.includes(w) && w.length > 2);
  if (commonWords.length > 0) {
    reasons.push('Nombre similar');
  }

  const priceDiff = Math.abs(product.salePrice - item.unitPrice);
  const avgPrice = (product.salePrice + item.unitPrice) / 2;
  if (avgPrice > 0 && priceDiff / avgPrice < 0.1) {
    reasons.push('Precio similar');
  }

  return reasons.join(', ') || 'Coincidencia parcial';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE SYNCHRONIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sync prices from products to price book items
 */
export async function syncPricesToPriceBook(
  organizationId: string,
  productIds?: string[]
): Promise<PriceSyncResult> {
  const where: any = { organizationId };
  if (productIds?.length) {
    where.productId = { in: productIds };
  }

  const links = await prisma.productPriceBookLink.findMany({
    where,
    include: {
      product: { select: { salePrice: true } },
    },
  });

  const result: PriceSyncResult = { synced: 0, skipped: 0, errors: [] };

  for (const link of links) {
    try {
      await prisma.priceBookItem.update({
        where: { id: link.priceBookItemId },
        data: { unitPrice: link.product.salePrice },
      });

      await prisma.productPriceBookLink.update({
        where: { id: link.id },
        data: { lastSyncedAt: new Date() },
      });

      result.synced++;
    } catch (error) {
      result.errors.push({
        productId: link.productId,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return result;
}

/**
 * Sync prices from price book items to products
 */
export async function syncPricesFromPriceBook(
  organizationId: string,
  priceBookItemIds?: string[]
): Promise<PriceSyncResult> {
  const where: any = { organizationId };
  if (priceBookItemIds?.length) {
    where.priceBookItemId = { in: priceBookItemIds };
  }

  const links = await prisma.productPriceBookLink.findMany({
    where,
    include: {
      priceBookItem: { select: { unitPrice: true } },
    },
  });

  const result: PriceSyncResult = { synced: 0, skipped: 0, errors: [] };

  for (const link of links) {
    try {
      await prisma.product.update({
        where: { id: link.productId },
        data: { salePrice: link.priceBookItem.unitPrice },
      });

      await prisma.productPriceBookLink.update({
        where: { id: link.id },
        data: { lastSyncedAt: new Date() },
      });

      result.synced++;
    } catch (error) {
      result.errors.push({
        productId: link.productId,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE FROM PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create price book items from unlinked products
 */
export async function createPriceBookItemsFromProducts(
  organizationId: string,
  productIds: string[],
  categoryId?: string
): Promise<CreatePriceBookItemFromProductResult> {
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      organizationId,
      priceBookLink: null,
    },
    select: {
      id: true,
      sku: true,
      name: true,
      description: true,
      salePrice: true,
      taxRate: true,
      unitOfMeasure: true,
    },
  });

  const result: CreatePriceBookItemFromProductResult = {
    created: 0,
    skipped: 0,
    errors: [],
  };

  for (const product of products) {
    try {
      // Check if code already exists
      const existingItem = await prisma.priceBookItem.findFirst({
        where: { orgId: organizationId, code: product.sku },
      });

      if (existingItem) {
        result.skipped++;
        continue;
      }

      // Create price book item
      const newItem = await prisma.priceBookItem.create({
        data: {
          orgId: organizationId,
          categoryId: categoryId || null,
          code: product.sku,
          name: product.name,
          description: product.description,
          unitPrice: product.salePrice,
          unit: product.unitOfMeasure,
          taxRate: product.taxRate,
          isActive: true,
        },
      });

      // Create link
      await prisma.productPriceBookLink.create({
        data: {
          organizationId,
          productId: product.id,
          priceBookItemId: newItem.id,
          lastSyncedAt: new Date(),
        },
      });

      result.created++;
    } catch (error) {
      result.errors.push({
        productId: product.id,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return result;
}

/**
 * Create products from unlinked price book items
 */
export async function createProductsFromPriceBookItems(
  organizationId: string,
  priceBookItemIds: string[],
  categoryId?: string
): Promise<CreatePriceBookItemFromProductResult> {
  const items = await prisma.priceBookItem.findMany({
    where: {
      id: { in: priceBookItemIds },
      orgId: organizationId,
      productLink: null,
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      unitPrice: true,
      taxRate: true,
      unit: true,
    },
  });

  const result: CreatePriceBookItemFromProductResult = {
    created: 0,
    skipped: 0,
    errors: [],
  };

  for (const item of items) {
    try {
      // Check if SKU already exists
      const existingProduct = await prisma.product.findFirst({
        where: { organizationId, sku: item.code },
      });

      if (existingProduct) {
        result.skipped++;
        continue;
      }

      // Create product
      const newProduct = await prisma.product.create({
        data: {
          organizationId,
          categoryId: categoryId || null,
          sku: item.code,
          name: item.name,
          description: item.description,
          salePrice: item.unitPrice,
          costPrice: 0, // Unknown cost
          taxRate: item.taxRate,
          unitOfMeasure: item.unit,
          productType: 'SERVICE',
          isActive: true,
          trackInventory: false,
        },
      });

      // Create link
      await prisma.productPriceBookLink.create({
        data: {
          organizationId,
          productId: newProduct.id,
          priceBookItemId: item.id,
          lastSyncedAt: new Date(),
        },
      });

      result.created++;
    } catch (error) {
      result.errors.push({
        productId: item.id,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS & REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get link statistics
 */
export async function getLinkStats(organizationId: string): Promise<{
  totalProducts: number;
  linkedProducts: number;
  unlinkedProducts: number;
  totalPriceBookItems: number;
  linkedPriceBookItems: number;
  unlinkedPriceBookItems: number;
  priceDifferences: number;
  needsSync: number;
}> {
  const [
    totalProducts,
    linkedProductsCount,
    totalPriceBookItems,
    linkedItemsCount,
    linksWithDiff,
  ] = await Promise.all([
    prisma.product.count({ where: { organizationId, isActive: true } }),
    prisma.productPriceBookLink.count({ where: { organizationId } }),
    prisma.priceBookItem.count({ where: { orgId: organizationId, isActive: true } }),
    prisma.productPriceBookLink.count({ where: { organizationId } }),
    prisma.productPriceBookLink.findMany({
      where: { organizationId },
      include: {
        product: { select: { salePrice: true } },
        priceBookItem: { select: { unitPrice: true } },
      },
    }),
  ]);

  const priceDifferences = linksWithDiff.filter(
    (link: typeof linksWithDiff[number]) => Number(link.product.salePrice) !== Number(link.priceBookItem.unitPrice)
  ).length;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const needsSync = linksWithDiff.filter(
    (link: typeof linksWithDiff[number]) =>
      !link.lastSyncedAt ||
      link.lastSyncedAt < oneDayAgo ||
      Number(link.product.salePrice) !== Number(link.priceBookItem.unitPrice)
  ).length;

  return {
    totalProducts,
    linkedProducts: linkedProductsCount,
    unlinkedProducts: totalProducts - linkedProductsCount,
    totalPriceBookItems,
    linkedPriceBookItems: linkedItemsCount,
    unlinkedPriceBookItems: totalPriceBookItems - linkedItemsCount,
    priceDifferences,
    needsSync,
  };
}

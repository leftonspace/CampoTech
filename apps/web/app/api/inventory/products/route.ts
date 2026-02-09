/**
 * Products API Route
 * Full inventory product management implementation
 * 
 * Security: Zod validation + XSS sanitization (Feb 2026 hardening)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { InventoryService } from '@/src/services/inventory.service';

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: XSS Sanitization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Strip HTML tags from a string to prevent XSS attacks.
 * This is a simple regex-based sanitizer that removes all HTML tags.
 * For rich text, consider using DOMPurify on the frontend.
 */
function stripHtml(input: string | null | undefined): string | null {
  if (!input) return null;
  // Remove all HTML tags
  return input
    .replace(/<[^>]*>/g, '')  // Remove HTML tags
    .replace(/&lt;/g, '<')     // Decode common entities for re-stripping
    .replace(/&gt;/g, '>')
    .replace(/<[^>]*>/g, '')   // Second pass after entity decode
    .trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: Zod Validation Schemas
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_PRICE = 999_999_999;  // ~1 billion ARS max
const MAX_STOCK = 999_999;      // Max stock quantity
const MAX_STRING_LENGTH = 500;  // Max description length

/**
 * Product creation schema with strict validation rules.
 * Prevents negative prices, stock levels, and enforces reasonable limits.
 */
const createProductSchema = z.object({
  // Required fields
  name: z.string().min(1, 'Nombre es requerido').max(255, 'Nombre muy largo'),
  sku: z.string().min(1, 'SKU es requerido').max(50, 'SKU muy largo'),

  // Optional text fields
  description: z.string().max(MAX_STRING_LENGTH, 'Descripción muy larga').optional().nullable(),
  barcode: z.string().max(50).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),

  // Pricing - must be nonnegative with reasonable max
  salePrice: z.number()
    .nonnegative('Precio de venta no puede ser negativo')
    .max(MAX_PRICE, `Precio de venta no puede superar ${MAX_PRICE.toLocaleString()}`)
    .optional()
    .default(0),
  costPrice: z.number()
    .nonnegative('Costo no puede ser negativo')
    .max(MAX_PRICE, `Costo no puede superar ${MAX_PRICE.toLocaleString()}`)
    .optional()
    .default(0),
  marginPercent: z.number().min(-100).max(1000).optional().nullable(),
  taxRate: z.number().min(0).max(100).optional().default(21.0),

  // Stock levels - must be nonnegative integers
  minStockLevel: z.number()
    .int('Stock mínimo debe ser un número entero')
    .nonnegative('Stock mínimo no puede ser negativo')
    .max(MAX_STOCK, `Stock mínimo no puede superar ${MAX_STOCK.toLocaleString()}`)
    .optional()
    .default(0),
  maxStockLevel: z.number()
    .int('Stock máximo debe ser un número entero')
    .nonnegative('Stock máximo no puede ser negativo')
    .max(MAX_STOCK, `Stock máximo no puede superar ${MAX_STOCK.toLocaleString()}`)
    .optional()
    .nullable(),
  reorderQty: z.number().int().nonnegative().max(MAX_STOCK).optional().nullable(),
  initialStock: z.number()
    .int('Stock inicial debe ser un número entero')
    .nonnegative('Stock inicial no puede ser negativo')
    .max(MAX_STOCK, `Stock inicial no puede superar ${MAX_STOCK.toLocaleString()}`)
    .optional()
    .default(0),

  // Enums and types
  productType: z.enum(['PART', 'CONSUMABLE', 'SERVICE', 'TOOL', 'EQUIPMENT']).optional().default('PART'),
  unitOfMeasure: z.string().max(20).optional().default('UNIDAD'),

  // Booleans
  trackInventory: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
  isSerialTracked: z.boolean().optional().default(false),

  // Physical attributes
  weight: z.number().nonnegative().optional().nullable(),
  dimensions: z.string().max(100).optional().nullable(),

  // Media
  imageUrl: z.string().url().optional().nullable(),
  images: z.array(z.string().url()).optional().default([]),

  // Warehouse for initial stock
  warehouseId: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/inventory/products
 * List products with filters and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');
    const search = searchParams.get('search') || searchParams.get('q');
    const categoryId = searchParams.get('categoryId');
    const isActive = searchParams.get('isActive');
    const productType = searchParams.get('productType');
    const lowStock = searchParams.get('lowStock');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Statistics view
    if (view === 'stats') {
      const [totalProducts, activeProducts, products] = await Promise.all([
        prisma.product.count({
          where: { organizationId: session.organizationId },
        }),
        prisma.product.count({
          where: { organizationId: session.organizationId, isActive: true },
        }),
        prisma.product.findMany({
          where: { organizationId: session.organizationId, trackInventory: true },
          select: {
            id: true,
            minStockLevel: true,
            costPrice: true,
            inventoryLevels: {
              select: { quantityOnHand: true },
            },
          },
        }),
      ]);

      let lowStockProducts = 0;
      let outOfStockProducts = 0;
      let totalValue = 0;

      for (const product of products) {
        const totalQty = product.inventoryLevels.reduce(
          (sum: number, level: typeof product.inventoryLevels[number]) => sum + level.quantityOnHand,
          0
        );
        const costPrice = Number(product.costPrice);
        totalValue += totalQty * costPrice;

        if (totalQty === 0) {
          outOfStockProducts++;
        } else if (totalQty <= product.minStockLevel) {
          lowStockProducts++;
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          totalProducts,
          activeProducts,
          lowStockProducts,
          outOfStockProducts,
          totalValue,
        },
      });
    }

    // Categories view
    if (view === 'categories') {
      const categories = await prisma.productCategory.findMany({
        where: { organizationId: session.organizationId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          parentId: true,
          sortOrder: true,
          _count: { select: { products: true } },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          categories: categories.map((cat: typeof categories[number]) => ({
            ...cat,
            productCount: cat._count.products,
            _count: undefined,
          })),
        },
      });
    }

    // Quick search for autocomplete
    if (view === 'search') {
      const products = await prisma.product.findMany({
        where: {
          organizationId: session.organizationId,
          isActive: true,
          OR: search
            ? [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
            ]
            : undefined,
        },
        take: 10,
        select: {
          id: true,
          sku: true,
          name: true,
          salePrice: true,
          costPrice: true,
          unitOfMeasure: true,
          imageUrl: true,
        },
      });

      return NextResponse.json({ success: true, data: { products } });
    }

    // Build pagination
    const result = await InventoryService.listProducts(session.organizationId, {
      search,
      categoryId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      productType,
      lowStock: lowStock === 'true',
    }, {
      page,
      limit: pageSize,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: {
        products: result.items,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Products list error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error listing products' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/products
 * Create a new product
 * 
 * Security hardening (Feb 2026):
 * - Zod validation for all fields (prevents negative prices, enforces limits)
 * - XSS sanitization for description field
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user role - only OWNER can create products
    if (!['OWNER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para crear productos' },
        { status: 403 }
      );
    }

    const rawBody = await request.json();

    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY LAYER 1: Zod Schema Validation
    // ═══════════════════════════════════════════════════════════════════════════
    const parseResult = createProductSchema.safeParse(rawBody);

    if (!parseResult.success) {
      // Extract the first validation error for user-friendly message
      const firstError = parseResult.error.errors[0];
      const errorMessage = firstError
        ? `${firstError.path.join('.')}: ${firstError.message}`
        : 'Datos de producto inválidos';

      console.warn('[Product Create] Validation failed:', parseResult.error.errors);

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          validationErrors: parseResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    // Use validated data from now on
    const body = parseResult.data;

    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY LAYER 2: XSS Sanitization for text fields
    // ═══════════════════════════════════════════════════════════════════════════
    const sanitizedDescription = stripHtml(body.description);
    const sanitizedBrand = stripHtml(body.brand);
    const sanitizedModel = stripHtml(body.model);
    const sanitizedDimensions = stripHtml(body.dimensions);

    // Check if SKU already exists
    const existingProduct = await prisma.product.findFirst({
      where: {
        organizationId: session.organizationId,
        sku: body.sku,
      },
    });

    if (existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un producto con este SKU' },
        { status: 400 }
      );
    }

    // Create product with validated and sanitized data
    const product = await prisma.product.create({
      data: {
        organizationId: session.organizationId,
        sku: body.sku,
        barcode: body.barcode || null,
        name: body.name, // Required field, no HTML stripping (typically plain text)
        description: sanitizedDescription, // ✅ XSS sanitized
        brand: sanitizedBrand,             // ✅ XSS sanitized
        model: sanitizedModel,             // ✅ XSS sanitized
        categoryId: body.categoryId || null,
        productType: body.productType,
        unitOfMeasure: body.unitOfMeasure,
        costPrice: body.costPrice,         // ✅ Zod validated (nonnegative)
        salePrice: body.salePrice,         // ✅ Zod validated (nonnegative)
        marginPercent: body.marginPercent || null,
        taxRate: body.taxRate,
        trackInventory: body.trackInventory,
        minStockLevel: body.minStockLevel, // ✅ Zod validated (nonnegative int)
        maxStockLevel: body.maxStockLevel || null,
        reorderQty: body.reorderQty || null,
        weight: body.weight || null,
        dimensions: sanitizedDimensions,   // ✅ XSS sanitized
        imageUrl: body.imageUrl || null,
        images: body.images,
        isActive: body.isActive,
        isSerialTracked: body.isSerialTracked,
      },
      include: {
        category: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    // If initial stock is provided, create inventory level in specified warehouse
    if (body.initialStock && body.initialStock > 0) {
      // Use specified warehouse or find default
      let targetWarehouseId = body.warehouseId;

      if (!targetWarehouseId) {
        // Find default warehouse
        const defaultWarehouse = await prisma.warehouse.findFirst({
          where: {
            organizationId: session.organizationId,
            isDefault: true,
            isActive: true,
          },
        });
        targetWarehouseId = defaultWarehouse?.id;
      }

      if (targetWarehouseId) {
        // Create inventory level
        await prisma.inventoryLevel.create({
          data: {
            organizationId: session.organizationId,
            productId: product.id,
            warehouseId: targetWarehouseId,
            quantityOnHand: body.initialStock,
            quantityAvailable: body.initialStock,
            unitCost: body.costPrice,
            totalCost: body.costPrice * body.initialStock,
          },
        });

        // Create stock movement
        const movementNumber = `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        await prisma.stockMovement.create({
          data: {
            organizationId: session.organizationId,
            productId: product.id,
            movementNumber,
            movementType: 'INITIAL_STOCK',
            quantity: body.initialStock,
            direction: 'IN',
            toWarehouseId: targetWarehouseId,
            unitCost: body.costPrice,
            totalCost: body.costPrice * body.initialStock,
            notes: 'Stock inicial al crear producto',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Producto creado exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Product creation error:', err.message);

    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Ya existe un producto con este SKU' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Error creating product' },
      { status: 500 }
    );
  }
}

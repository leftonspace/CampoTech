/**
 * Products API Route
 * Full inventory product management implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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

    // Build where clause for main list
    const where: Prisma.ProductWhereInput = {
      organizationId: session.organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (productType) {
      where.productType = productType as any;
    }

    // Get total count
    const total = await prisma.product.count({ where });

    // Build orderBy
    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    if (sortBy === 'name') {
      orderBy.name = sortOrder as 'asc' | 'desc';
    } else if (sortBy === 'sku') {
      orderBy.sku = sortOrder as 'asc' | 'desc';
    } else if (sortBy === 'salePrice') {
      orderBy.salePrice = sortOrder as 'asc' | 'desc';
    } else if (sortBy === 'costPrice') {
      orderBy.costPrice = sortOrder as 'asc' | 'desc';
    } else {
      orderBy.createdAt = sortOrder as 'asc' | 'desc';
    }

    // Fetch products
    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, code: true, name: true },
        },
        inventoryLevels: {
          select: {
            quantityOnHand: true,
            quantityReserved: true,
            quantityAvailable: true,
            warehouse: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Transform products with stock info
    const productsWithStock = products.map((product: typeof products[number]) => {
      const totalOnHand = product.inventoryLevels.reduce(
        (sum: number, level: typeof product.inventoryLevels[number]) => sum + level.quantityOnHand,
        0
      );
      const totalReserved = product.inventoryLevels.reduce(
        (sum: number, level: typeof product.inventoryLevels[number]) => sum + level.quantityReserved,
        0
      );
      const totalAvailable = product.inventoryLevels.reduce(
        (sum: number, level: typeof product.inventoryLevels[number]) => sum + level.quantityAvailable,
        0
      );

      const isLowStock = product.trackInventory && totalOnHand <= product.minStockLevel && totalOnHand > 0;
      const isOutOfStock = product.trackInventory && totalOnHand === 0;

      return {
        ...product,
        stock: {
          onHand: totalOnHand,
          reserved: totalReserved,
          available: totalAvailable,
          isLowStock,
          isOutOfStock,
        },
      };
    });

    // Filter by low stock if requested
    let filteredProducts = productsWithStock;
    if (lowStock === 'true') {
      filteredProducts = productsWithStock.filter(
        (p: typeof productsWithStock[number]) => p.stock.isLowStock || p.stock.isOutOfStock
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        products: filteredProducts,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Products list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error listing products' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/products
 * Create a new product
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

    // Check user role - only OWNER, ADMIN can create products
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para crear productos' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.sku) {
      return NextResponse.json(
        { success: false, error: 'Nombre y SKU son requeridos' },
        { status: 400 }
      );
    }

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

    // Create product
    const product = await prisma.product.create({
      data: {
        organizationId: session.organizationId,
        sku: body.sku,
        barcode: body.barcode || null,
        name: body.name,
        description: body.description || null,
        brand: body.brand || null,
        model: body.model || null,
        categoryId: body.categoryId || null,
        productType: body.productType || 'PART',
        unitOfMeasure: body.unitOfMeasure || 'UNIDAD',
        costPrice: body.costPrice || 0,
        salePrice: body.salePrice || 0,
        marginPercent: body.marginPercent || null,
        taxRate: body.taxRate || 21.0,
        trackInventory: body.trackInventory !== false,
        minStockLevel: body.minStockLevel || 0,
        maxStockLevel: body.maxStockLevel || null,
        reorderQty: body.reorderQty || null,
        weight: body.weight || null,
        dimensions: body.dimensions || null,
        imageUrl: body.imageUrl || null,
        images: body.images || [],
        isActive: body.isActive !== false,
        isSerialTracked: body.isSerialTracked || false,
      },
      include: {
        category: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    // If initial stock is provided and there's a default warehouse, create inventory level
    if (body.initialStock && body.initialStock > 0) {
      // Find default warehouse
      const defaultWarehouse = await prisma.warehouse.findFirst({
        where: {
          organizationId: session.organizationId,
          isDefault: true,
          isActive: true,
        },
      });

      if (defaultWarehouse) {
        // Create inventory level
        await prisma.inventoryLevel.create({
          data: {
            organizationId: session.organizationId,
            productId: product.id,
            warehouseId: defaultWarehouse.id,
            quantityOnHand: body.initialStock,
            quantityAvailable: body.initialStock,
            unitCost: body.costPrice || 0,
            totalCost: (body.costPrice || 0) * body.initialStock,
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
            toWarehouseId: defaultWarehouse.id,
            unitCost: body.costPrice || 0,
            totalCost: (body.costPrice || 0) * body.initialStock,
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
    console.error('Product creation error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { InventoryService } from '@/src/services/inventory.service';

import { ProductWithStock } from '@/lib/types/inventory';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const categoryId = searchParams.get('categoryId') || searchParams.get('category');
    const lowStock = searchParams.get('lowStock') === 'true';

    // Build query using consolidated service
    const result = await InventoryService.listProducts(session.organizationId, {
      search,
      categoryId,
      lowStock,
      isActive: true,
    }, {
      limit: 100, // Reasonable limit for this view
    });

    // Map Product model to the format expected by the frontend
    const mappedItems = result.items.map((product: ProductWithStock) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      category: product.category?.name || 'PARTS',
      unit: product.unitOfMeasure,
      minStockLevel: product.minStockLevel,
      costPrice: Number(product.costPrice),
      salePrice: Number(product.salePrice),
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      totalStock: product.stock.onHand,
      isLowStock: product.stock.isLowStock,
      stocksByLocation: product.inventoryLevels.map((lvl) => ({
        locationId: lvl.warehouseId,
        locationName: lvl.warehouse?.name || 'Depósito',
        locationType: 'WAREHOUSE' as const,
        quantity: lvl.quantityOnHand,
        availableQuantity: lvl.quantityAvailable,
      })),
    }));

    // Calculate stats for the response
    type MappedItem = (typeof mappedItems)[number];
    const stats = {
      totalItems: result.pagination.total,
      lowStockItems: mappedItems.filter((item: MappedItem) => item.isLowStock).length,
      categories: Array.from(new Set(mappedItems.map((item: MappedItem) => item.category))),
    };

    return NextResponse.json({
      success: true,
      data: {
        items: mappedItems,
        stats,
      },
    });
  } catch (error) {
    console.error('Inventory items list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error cargando inventario' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Create product using consolidated service
    const product = await InventoryService.createProduct(session.organizationId, {
      ...body,
      // Map 'category' (string) to 'categoryId' if it looks like a GUID, 
      // otherwise it might need more logic but for now we follow the service schema
      categoryId: body.categoryId || body.category,
      unitOfMeasure: body.unit || body.unitOfMeasure,
    });

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Create inventory item error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error creando artículo' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { InventoryService } from '@/src/services/inventory.service';
import {
  filterEntityByRole,
  getEntityFieldMetadata,
  validateEntityUpdate,
  UserRole,
} from '@/lib/middleware/field-filter';

interface InventoryLevel {
  id: string;
  warehouseId: string;
  warehouse?: { name: string } | null;
  quantityOnHand: number;
  quantityAvailable: number;
}

interface StockMovement {
  id: string;
  performedAt: Date;
  movementType: string;
  quantity: number;
  fromWarehouseId?: string | null;
  fromWarehouse?: { name: string } | null;
  toWarehouseId?: string | null;
  toWarehouse?: { name: string } | null;
  performedBy?: string | null;
  notes?: string | null;
}

interface ProductWithDetails {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category?: { name: string } | null;
  unitOfMeasure: string;
  minStockLevel: number;
  trackInventory: boolean;
  inventoryLevels: InventoryLevel[];
  stockMovements: StockMovement[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const product = await InventoryService.getProductById(session.organizationId, id);

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Artículo no encontrado' },
        { status: 404 }
      );
    }

    // Map Product to the response format expected by the frontend
    const productWithDetails = product as unknown as ProductWithDetails;
    const totalStock = productWithDetails.inventoryLevels.reduce((sum, lvl) => sum + lvl.quantityOnHand, 0);

    const mappedProduct = {
      ...product,
      category: product.category?.name || 'PARTS',
      unit: product.unitOfMeasure,
      totalStock,
      availableStock: productWithDetails.inventoryLevels.reduce((sum, lvl) => sum + lvl.quantityAvailable, 0),
      isLowStock: product.trackInventory && totalStock <= product.minStockLevel,
      stocks: productWithDetails.inventoryLevels.map((lvl) => ({
        id: lvl.id,
        locationId: lvl.warehouseId,
        location: {
          id: lvl.warehouseId,
          name: lvl.warehouse?.name || 'Depósito',
          locationType: 'WAREHOUSE' as const,
        },
        quantity: lvl.quantityOnHand,
      })),
      transactions: productWithDetails.stockMovements.map((mov) => ({
        id: mov.id,
        createdAt: mov.performedAt,
        transactionType: mov.movementType,
        quantity: mov.quantity,
        fromLocation: mov.fromWarehouse ? { id: mov.fromWarehouseId!, name: mov.fromWarehouse.name } : null,
        toLocation: mov.toWarehouse ? { id: mov.toWarehouseId!, name: mov.toWarehouse.name } : null,
        performedBy: mov.performedBy,
        notes: mov.notes,
      })),
    };

    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;
    const filteredData = filterEntityByRole(mappedProduct, 'product', userRole);
    const fieldMeta = getEntityFieldMetadata('product', userRole);

    return NextResponse.json({
      success: true,
      data: filteredData,
      _fieldMeta: fieldMeta,
    });
  } catch (error) {
    console.error('Get inventory item error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo artículo' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;
    if (!['OWNER', 'ADMIN'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const validation = validateEntityUpdate(body, 'product', userRole);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(' ') },
        { status: 403 }
      );
    }

    const updatedProduct = await InventoryService.updateProduct(session.organizationId, id, {
      ...body,
      categoryId: body.categoryId || body.category,
      unitOfMeasure: body.unit || body.unitOfMeasure,
    });

    return NextResponse.json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    console.error('Update inventory item error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error actualizando artículo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const { id } = await params;
    await InventoryService.deleteProduct(session.organizationId, id);

    return NextResponse.json({
      success: true,
      message: 'Artículo eliminado correctamente',
    });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error eliminando artículo' },
      { status: 500 }
    );
  }
}

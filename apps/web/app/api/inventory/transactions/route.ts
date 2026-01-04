import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InventoryService } from '@/src/services/inventory.service';
import { Prisma, MovementType } from '@prisma/client';

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
    const productId = searchParams.get('itemId');
    const warehouseId = searchParams.get('locationId');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Prisma.StockMovementWhereInput = {
      organizationId: session.organizationId,
    };

    if (productId) where.productId = productId;
    if (warehouseId) {
      where.OR = [
        { fromWarehouseId: warehouseId },
        { toWarehouseId: warehouseId },
      ];
    }
    if (type) {
      where.movementType = type as MovementType;
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: {
            select: { id: true, name: true, sku: true, unitOfMeasure: true },
          },
          fromWarehouse: {
            select: { id: true, name: true, type: true },
          },
          toWarehouse: {
            select: { id: true, name: true, type: true },
          },
          performedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { performedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    interface StockMovementWithIncludes {
      id: string;
      productId: string;
      product: {
        name: string;
        sku: string;
        unitOfMeasure: string;
      };
      fromWarehouseId: string | null;
      fromWarehouse: {
        name: string;
        type: string;
      } | null;
      toWarehouseId: string | null;
      toWarehouse: {
        name: string;
        type: string;
      } | null;
      movementType: MovementType;
      quantity: number;
      performedAt: Date;
      performedById: string;
      performedBy: {
        name: string;
      };
      notes: string | null;
    }

    const transactions = (movements as unknown as StockMovementWithIncludes[]).map((m) => ({
      id: m.id,
      itemId: m.productId,
      item: {
        id: m.productId,
        name: m.product.name,
        sku: m.product.sku,
        unit: m.product.unitOfMeasure,
      },
      fromLocationId: m.fromWarehouseId,
      fromLocation: m.fromWarehouse ? {
        id: m.fromWarehouseId,
        name: m.fromWarehouse.name,
        locationType: m.fromWarehouse.type === 'SECONDARY' ? 'HUB' : m.fromWarehouse.type,
      } : null,
      toLocationId: m.toWarehouseId,
      toLocation: m.toWarehouse ? {
        id: m.toWarehouseId,
        name: m.toWarehouse.name,
        locationType: m.toWarehouse.type === 'SECONDARY' ? 'HUB' : m.toWarehouse.type,
      } : null,
      transactionType: m.movementType,
      quantity: m.quantity,
      performedAt: m.performedAt,
      performedById: m.performedById,
      performedBy: m.performedBy,
      notes: m.notes,
    }));

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + transactions.length < total,
        },
      },
    });
  } catch (error) {
    console.error('Inventory transactions list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error cargando transacciones' },
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

    const body = await request.json();
    const {
      itemId,
      fromLocationId,
      toLocationId,
      transactionType,
      quantity,
      notes,
    } = body;

    if (!itemId || !transactionType || !quantity) {
      return NextResponse.json(
        { success: false, error: 'Artículo, tipo y cantidad son requeridos' },
        { status: 400 }
      );
    }

    const qty = Math.abs(Number(quantity));

    if (transactionType === 'TRANSFER') {
      if (!fromLocationId || !toLocationId) {
        return NextResponse.json(
          { success: false, error: 'Se requieren ubicaciones de origen y destino para transferencias' },
          { status: 400 }
        );
      }

      await InventoryService.transferStock(session.organizationId, {
        productId: itemId,
        fromWarehouseId: fromLocationId,
        toWarehouseId: toLocationId,
        quantity: qty,
        notes,
        performedById: session.userId,
      });
    } else {
      // Map other types to adjustment for now or specific service methods if they existed
      // (InventoryService.adjustStock handles both IN and OUT)
      await InventoryService.adjustStock(session.organizationId, {
        productId: itemId,
        warehouseId: (transactionType === 'SALE' || transactionType === 'USE' || transactionType === 'CONSUMPTION') ? fromLocationId : toLocationId,
        quantity: (transactionType === 'SALE' || transactionType === 'USE' || transactionType === 'CONSUMPTION') ? -qty : qty,
        reason: transactionType,
        notes,
        performedById: session.userId,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Transacción completada exitosamente',
    });
  } catch (error) {
    console.error('Create inventory transaction error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error procesando transacción' },
      { status: 500 }
    );
  }
}

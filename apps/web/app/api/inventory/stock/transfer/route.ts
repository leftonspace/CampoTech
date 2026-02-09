/**
 * Stock Transfer API Route
 * POST stock transfers between warehouses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma, TransactionClient } from '@/lib/prisma';
import { validateBody, stockTransferSchema } from '@/lib/validation/api-schemas';

/**
 * POST /api/inventory/stock/transfer
 * Create a stock transfer between warehouses
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

    // Check user role
    if (!['OWNER', 'DISPATCHER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para realizar transferencias' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request body with Zod
    const validation = validateBody(body, stockTransferSchema);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { productId, fromWarehouseId, toWarehouseId, quantity, notes } = validation.data;

    if (fromWarehouseId === toWarehouseId) {
      return NextResponse.json(
        { success: false, error: 'Los almacenes de origen y destino deben ser diferentes' },
        { status: 400 }
      );
    }

    // Verify product exists and belongs to organization
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: session.organizationId,
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Verify both warehouses exist and belong to organization
    const [fromWarehouse, toWarehouse] = await Promise.all([
      prisma.warehouse.findFirst({
        where: { id: fromWarehouseId, organizationId: session.organizationId },
      }),
      prisma.warehouse.findFirst({
        where: { id: toWarehouseId, organizationId: session.organizationId },
      }),
    ]);

    if (!fromWarehouse) {
      return NextResponse.json(
        { success: false, error: 'Almacén de origen no encontrado' },
        { status: 404 }
      );
    }

    if (!toWarehouse) {
      return NextResponse.json(
        { success: false, error: 'Almacén de destino no encontrado' },
        { status: 404 }
      );
    }

    // Get source inventory level
    const sourceLevel = await prisma.inventoryLevel.findFirst({
      where: {
        productId,
        warehouseId: fromWarehouseId,
      },
    });

    if (!sourceLevel) {
      return NextResponse.json(
        { success: false, error: 'No hay stock de este producto en el almacén de origen' },
        { status: 400 }
      );
    }

    if (sourceLevel.quantityAvailable < quantity) {
      if (!fromWarehouse.allowNegative) {
        return NextResponse.json(
          { success: false, error: `Stock disponible insuficiente. Disponible: ${sourceLevel.quantityAvailable}` },
          { status: 400 }
        );
      }
    }

    // Get or prepare destination inventory level
    const destLevel = await prisma.inventoryLevel.findFirst({
      where: {
        productId,
        warehouseId: toWarehouseId,
      },
    });

    // Calculate costs
    const unitCost = Number(sourceLevel.unitCost) || Number(product.costPrice);
    const totalCost = unitCost * quantity;

    // Generate movement number
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.stockMovement.count({
      where: {
        organizationId: session.organizationId,
        createdAt: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
          lte: new Date(today.setHours(23, 59, 59, 999)),
        },
      },
    });
    const movementNumber = `TRF-${datePrefix}-${(count + 1).toString().padStart(4, '0')}`;

    // Perform transfer in transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Reduce source inventory
      const updatedSource = await tx.inventoryLevel.update({
        where: { id: sourceLevel.id },
        data: {
          quantityOnHand: { decrement: quantity },
          quantityAvailable: { decrement: quantity },
          totalCost: { decrement: totalCost },
          lastMovementAt: new Date(),
        },
      });

      // Increase destination inventory
      let updatedDest;
      if (destLevel) {
        updatedDest = await tx.inventoryLevel.update({
          where: { id: destLevel.id },
          data: {
            quantityOnHand: { increment: quantity },
            quantityAvailable: { increment: quantity },
            totalCost: { increment: totalCost },
            lastMovementAt: new Date(),
          },
        });
      } else {
        updatedDest = await tx.inventoryLevel.create({
          data: {
            organizationId: session.organizationId,
            productId,
            warehouseId: toWarehouseId,
            quantityOnHand: quantity,
            quantityAvailable: quantity,
            unitCost,
            totalCost,
          },
        });
      }

      // Create stock movement record
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: session.organizationId,
          productId,
          movementNumber,
          movementType: 'TRANSFER',
          quantity,
          direction: 'OUT',  // Transfer is OUT from source warehouse
          fromWarehouseId,
          toWarehouseId,
          unitCost,
          totalCost,
          reference: `Transferencia: ${fromWarehouse.name} → ${toWarehouse.name}`,
          notes,
          performedById: session.userId,
          performedAt: new Date(),
        },
        include: {
          product: { select: { id: true, sku: true, name: true } },
          fromWarehouse: { select: { id: true, name: true, code: true } },
          toWarehouse: { select: { id: true, name: true, code: true } },
        },
      });

      return {
        movement,
        sourceLevel: updatedSource,
        destLevel: updatedDest,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        movement: result.movement,
        sourceWarehouse: {
          id: fromWarehouseId,
          name: fromWarehouse.name,
          newQuantity: result.sourceLevel.quantityOnHand,
        },
        destWarehouse: {
          id: toWarehouseId,
          name: toWarehouse.name,
          newQuantity: result.destLevel.quantityOnHand,
        },
      },
      message: `Transferencia completada: ${quantity} unidades de ${fromWarehouse.name} a ${toWarehouse.name}`,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Stock transfer error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error processing stock transfer' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inventory/stock/transfer
 * Get transfer history
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
    const productId = searchParams.get('productId');
    const warehouseId = searchParams.get('warehouseId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      organizationId: session.organizationId,
      movementType: 'TRANSFER',
    };

    if (productId) {
      where.productId = productId;
    }

    if (warehouseId) {
      where.OR = [
        { fromWarehouseId: warehouseId },
        { toWarehouseId: warehouseId },
      ];
    }

    if (dateFrom || dateTo) {
      where.performedAt = {};
      if (dateFrom) where.performedAt.gte = new Date(dateFrom);
      if (dateTo) where.performedAt.lte = new Date(dateTo);
    }

    const [total, transfers] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, sku: true, name: true } },
          fromWarehouse: { select: { id: true, name: true, code: true } },
          toWarehouse: { select: { id: true, name: true, code: true } },
        },
        orderBy: { performedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        transfers,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Get transfers error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching transfers' },
      { status: 500 }
    );
  }
}

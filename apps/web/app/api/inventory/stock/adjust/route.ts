/**
 * Stock Adjustment API Route
 * POST stock adjustments (corrections, damages, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/inventory/stock/adjust
 * Create a stock adjustment
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
    if (!['OWNER', 'ADMIN', 'DISPATCHER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para realizar ajustes de inventario' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { productId, warehouseId, adjustmentType, quantity, reason, notes, costPerUnit } = body;

    // Validate required fields
    if (!productId || !warehouseId || !adjustmentType || quantity === undefined) {
      return NextResponse.json(
        { success: false, error: 'productId, warehouseId, adjustmentType y quantity son requeridos' },
        { status: 400 }
      );
    }

    // Validate adjustment type
    const validTypes = ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'THEFT', 'CORRECTION', 'EXPIRED', 'FOUND'];
    if (!validTypes.includes(adjustmentType)) {
      return NextResponse.json(
        { success: false, error: `Tipo de ajuste inválido. Válidos: ${validTypes.join(', ')}` },
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

    // Verify warehouse exists and belongs to organization
    const warehouse = await prisma.warehouse.findFirst({
      where: {
        id: warehouseId,
        organizationId: session.organizationId,
      },
    });

    if (!warehouse) {
      return NextResponse.json(
        { success: false, error: 'Almacén no encontrado' },
        { status: 404 }
      );
    }

    // Determine direction based on adjustment type
    const isIncrease = ['ADJUSTMENT_IN', 'FOUND', 'CORRECTION'].includes(adjustmentType) && quantity > 0;
    const direction = isIncrease ? 'IN' : 'OUT';
    const absQuantity = Math.abs(quantity);

    // Get current inventory level
    let inventoryLevel = await prisma.inventoryLevel.findFirst({
      where: {
        productId,
        warehouseId,
      },
    });

    // Check if we have enough stock for outgoing adjustments
    if (direction === 'OUT' && inventoryLevel) {
      if (inventoryLevel.quantityOnHand < absQuantity) {
        // Check if warehouse allows negative stock
        if (!warehouse.allowNegativeStock) {
          return NextResponse.json(
            { success: false, error: `Stock insuficiente. Disponible: ${inventoryLevel.quantityOnHand}` },
            { status: 400 }
          );
        }
      }
    }

    // Calculate cost
    const unitCost = costPerUnit ?? (inventoryLevel?.unitCost ? Number(inventoryLevel.unitCost) : Number(product.costPrice));
    const totalCost = unitCost * absQuantity;

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
    const movementNumber = `ADJ-${datePrefix}-${(count + 1).toString().padStart(4, '0')}`;

    // Perform adjustment in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update or create inventory level
      if (inventoryLevel) {
        inventoryLevel = await tx.inventoryLevel.update({
          where: { id: inventoryLevel.id },
          data: {
            quantityOnHand: direction === 'IN'
              ? { increment: absQuantity }
              : { decrement: absQuantity },
            quantityAvailable: direction === 'IN'
              ? { increment: absQuantity }
              : { decrement: absQuantity },
            totalCost: direction === 'IN'
              ? { increment: totalCost }
              : { decrement: totalCost },
            lastMovementAt: new Date(),
          },
        });
      } else {
        // Create new inventory level (only for incoming)
        if (direction === 'OUT') {
          throw new Error('No se puede reducir stock de un producto que no tiene inventario');
        }

        inventoryLevel = await tx.inventoryLevel.create({
          data: {
            organizationId: session.organizationId,
            productId,
            warehouseId,
            quantityOnHand: absQuantity,
            quantityAvailable: absQuantity,
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
          movementType: adjustmentType,
          quantity: absQuantity,
          direction,
          fromWarehouseId: direction === 'OUT' ? warehouseId : null,
          toWarehouseId: direction === 'IN' ? warehouseId : null,
          unitCost,
          totalCost,
          reference: reason || `Ajuste de inventario: ${adjustmentType}`,
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

      return { movement, inventoryLevel };
    });

    return NextResponse.json({
      success: true,
      data: {
        movement: result.movement,
        newQuantity: result.inventoryLevel.quantityOnHand,
        newAvailable: result.inventoryLevel.quantityAvailable,
      },
      message: `Ajuste de ${direction === 'IN' ? 'entrada' : 'salida'} registrado: ${absQuantity} unidades`,
    });
  } catch (error: any) {
    console.error('Stock adjustment error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error processing stock adjustment' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inventory/stock/adjust
 * Get adjustment history
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
    const adjustmentType = searchParams.get('adjustmentType');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    // Build where clause
    const adjustmentTypes = ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'THEFT', 'CORRECTION', 'EXPIRED', 'FOUND'];
    const where: any = {
      organizationId: session.organizationId,
      movementType: { in: adjustmentTypes },
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

    if (adjustmentType) {
      where.movementType = adjustmentType;
    }

    if (dateFrom || dateTo) {
      where.performedAt = {};
      if (dateFrom) where.performedAt.gte = new Date(dateFrom);
      if (dateTo) where.performedAt.lte = new Date(dateTo);
    }

    const [total, adjustments] = await Promise.all([
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
        adjustments,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Get adjustments error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching adjustments' },
      { status: 500 }
    );
  }
}

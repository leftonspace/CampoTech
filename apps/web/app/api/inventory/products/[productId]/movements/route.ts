/**
 * Product Movements API Route
 * GET stock movements for a specific product
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ productId: string }>;
}

/**
 * GET /api/inventory/products/:productId/movements
 * Get stock movements for a specific product
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { productId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify product exists and belongs to organization
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: session.organizationId,
      },
      select: { id: true, sku: true, name: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const warehouseId = searchParams.get('warehouseId');
    const movementType = searchParams.get('movementType');
    const direction = searchParams.get('direction');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build where clause
    const where: any = {
      organizationId: session.organizationId,
      productId,
    };

    if (warehouseId) {
      where.OR = [
        { fromWarehouseId: warehouseId },
        { toWarehouseId: warehouseId },
      ];
    }

    if (movementType) {
      where.movementType = movementType;
    }

    if (direction) {
      where.direction = direction;
    }

    if (dateFrom || dateTo) {
      where.performedAt = {};
      if (dateFrom) where.performedAt.gte = new Date(dateFrom);
      if (dateTo) where.performedAt.lte = new Date(dateTo);
    }

    // Get movements
    const [total, movements] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        include: {
          fromWarehouse: { select: { id: true, name: true, code: true } },
          toWarehouse: { select: { id: true, name: true, code: true } },
          job: { select: { id: true, jobNumber: true } },
          purchaseOrder: { select: { id: true, orderNumber: true } },
        },
        orderBy: { performedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Calculate summary
    const allMovements = await prisma.stockMovement.findMany({
      where: { organizationId: session.organizationId, productId },
      select: { quantity: true, direction: true, totalCost: true },
    });

    let totalIn = 0;
    let totalOut = 0;
    let totalCostIn = 0;
    let totalCostOut = 0;

    for (const mov of allMovements) {
      if (mov.direction === 'IN') {
        totalIn += mov.quantity;
        totalCostIn += Number(mov.totalCost);
      } else {
        totalOut += mov.quantity;
        totalCostOut += Number(mov.totalCost);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        product,
        movements,
        summary: {
          totalIn,
          totalOut,
          netChange: totalIn - totalOut,
          totalCostIn,
          totalCostOut,
          totalMovements: allMovements.length,
        },
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Product movements error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching product movements' },
      { status: 500 }
    );
  }
}

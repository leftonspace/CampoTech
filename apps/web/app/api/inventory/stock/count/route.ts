/**
 * Stock Count API Route
 * POST/PUT/GET inventory counting operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/inventory/stock/count
 * Create a new inventory count
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
        { success: false, error: 'No tienes permiso para crear conteos de inventario' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action || 'create';

    // Create new count
    if (action === 'create') {
      const { warehouseId, countType, productIds, assignedToId, scheduledAt, notes } = body;

      if (!warehouseId) {
        return NextResponse.json(
          { success: false, error: 'warehouseId es requerido' },
          { status: 400 }
        );
      }

      // Verify warehouse exists
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: warehouseId, organizationId: session.organizationId },
      });

      if (!warehouse) {
        return NextResponse.json(
          { success: false, error: 'Almacén no encontrado' },
          { status: 404 }
        );
      }

      // Generate count number
      const countNum = await prisma.inventoryCount.count({
        where: { organizationId: session.organizationId },
      });
      const countNumber = `CNT-${(countNum + 1).toString().padStart(6, '0')}`;

      // Get products for the count
      const productsWhere: any = {
        organizationId: session.organizationId,
        trackInventory: true,
        isActive: true,
      };

      if (productIds && productIds.length > 0) {
        productsWhere.id = { in: productIds };
      }

      const products = await prisma.product.findMany({
        where: productsWhere,
        include: {
          inventoryLevels: {
            where: { warehouseId },
          },
        },
      });

      // Create count with items
      const inventoryCount = await prisma.inventoryCount.create({
        data: {
          organizationId: session.organizationId,
          warehouseId,
          countNumber,
          countType: countType || 'FULL',
          status: 'DRAFT',
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          assignedToId: assignedToId || null,
          notes,
          items: {
            create: products.map((product) => ({
              productId: product.id,
              expectedQty: product.inventoryLevels[0]?.quantityOnHand || 0,
            })),
          },
        },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          ...inventoryCount,
          itemCount: inventoryCount._count.items,
        },
        message: `Conteo ${countNumber} creado con ${inventoryCount._count.items} productos`,
      });
    }

    // Start count
    if (action === 'start') {
      const { countId } = body;

      if (!countId) {
        return NextResponse.json(
          { success: false, error: 'countId es requerido' },
          { status: 400 }
        );
      }

      const count = await prisma.inventoryCount.findFirst({
        where: {
          id: countId,
          organizationId: session.organizationId,
          status: 'DRAFT',
        },
      });

      if (!count) {
        return NextResponse.json(
          { success: false, error: 'Conteo no encontrado o no está en estado borrador' },
          { status: 404 }
        );
      }

      const updated = await prisma.inventoryCount.update({
        where: { id: countId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Conteo iniciado',
      });
    }

    // Record count for an item
    if (action === 'recordCount') {
      const { countItemId, countedQty, notes: itemNotes } = body;

      if (!countItemId || countedQty === undefined) {
        return NextResponse.json(
          { success: false, error: 'countItemId y countedQty son requeridos' },
          { status: 400 }
        );
      }

      const item = await prisma.inventoryCountItem.findFirst({
        where: { id: countItemId },
        include: {
          inventoryCount: true,
        },
      });

      if (!item) {
        return NextResponse.json(
          { success: false, error: 'Item de conteo no encontrado' },
          { status: 404 }
        );
      }

      if (item.inventoryCount.organizationId !== session.organizationId) {
        return NextResponse.json(
          { success: false, error: 'No autorizado' },
          { status: 403 }
        );
      }

      if (item.inventoryCount.status !== 'IN_PROGRESS') {
        return NextResponse.json(
          { success: false, error: 'El conteo no está en progreso' },
          { status: 400 }
        );
      }

      const variance = countedQty - item.expectedQty;

      const updated = await prisma.inventoryCountItem.update({
        where: { id: countItemId },
        data: {
          countedQty,
          variance,
          notes: itemNotes,
          countedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: `Conteo registrado. Varianza: ${variance}`,
      });
    }

    // Complete count and submit for review
    if (action === 'complete') {
      const { countId } = body;

      if (!countId) {
        return NextResponse.json(
          { success: false, error: 'countId es requerido' },
          { status: 400 }
        );
      }

      const count = await prisma.inventoryCount.findFirst({
        where: {
          id: countId,
          organizationId: session.organizationId,
          status: 'IN_PROGRESS',
        },
        include: {
          items: true,
        },
      });

      if (!count) {
        return NextResponse.json(
          { success: false, error: 'Conteo no encontrado o no está en progreso' },
          { status: 404 }
        );
      }

      // Check all items are counted
      const uncountedItems = count.items.filter((item) => item.countedQty === null);
      if (uncountedItems.length > 0) {
        return NextResponse.json(
          { success: false, error: `Hay ${uncountedItems.length} items sin contar` },
          { status: 400 }
        );
      }

      // Calculate totals
      const totalItems = count.items.length;
      const matchedItems = count.items.filter((item) => item.variance === 0).length;
      const varianceItems = totalItems - matchedItems;

      const updated = await prisma.inventoryCount.update({
        where: { id: countId },
        data: {
          status: 'PENDING_REVIEW',
          completedAt: new Date(),
          completedById: session.userId,
          totalItems,
          matchedItems,
          varianceItems,
        },
        include: {
          items: {
            include: {
              inventoryCount: false,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: `Conteo completado. ${matchedItems}/${totalItems} items coinciden.`,
      });
    }

    // Approve count and apply adjustments
    if (action === 'approve') {
      const { countId, applyAdjustments } = body;

      if (!countId) {
        return NextResponse.json(
          { success: false, error: 'countId es requerido' },
          { status: 400 }
        );
      }

      // Only OWNER or ADMIN can approve
      if (!['OWNER', 'ADMIN'].includes(session.role)) {
        return NextResponse.json(
          { success: false, error: 'No tienes permiso para aprobar conteos' },
          { status: 403 }
        );
      }

      const count = await prisma.inventoryCount.findFirst({
        where: {
          id: countId,
          organizationId: session.organizationId,
          status: 'PENDING_REVIEW',
        },
        include: {
          items: true,
          warehouse: true,
        },
      });

      if (!count) {
        return NextResponse.json(
          { success: false, error: 'Conteo no encontrado o no está pendiente de revisión' },
          { status: 404 }
        );
      }

      // Generate movement number prefix
      const today = new Date();
      const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');

      await prisma.$transaction(async (tx) => {
        // Apply adjustments if requested
        if (applyAdjustments !== false) {
          let movementCount = await tx.stockMovement.count({
            where: {
              organizationId: session.organizationId,
              createdAt: {
                gte: new Date(today.setHours(0, 0, 0, 0)),
                lte: new Date(today.setHours(23, 59, 59, 999)),
              },
            },
          });

          for (const item of count.items) {
            if (item.variance && item.variance !== 0) {
              const direction = item.variance > 0 ? 'IN' : 'OUT';
              const absVariance = Math.abs(item.variance);

              // Get current inventory level
              const inventoryLevel = await tx.inventoryLevel.findFirst({
                where: {
                  productId: item.productId,
                  warehouseId: count.warehouseId,
                },
              });

              const product = await tx.product.findUnique({
                where: { id: item.productId },
              });

              const unitCost = inventoryLevel?.unitCost
                ? Number(inventoryLevel.unitCost)
                : Number(product?.costPrice || 0);

              // Create adjustment movement
              movementCount++;
              const movementNumber = `CNT-${datePrefix}-${movementCount.toString().padStart(4, '0')}`;

              await tx.stockMovement.create({
                data: {
                  organizationId: session.organizationId,
                  productId: item.productId,
                  movementNumber,
                  movementType: direction === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
                  quantity: absVariance,
                  direction,
                  fromWarehouseId: direction === 'OUT' ? count.warehouseId : null,
                  toWarehouseId: direction === 'IN' ? count.warehouseId : null,
                  inventoryCountId: count.id,
                  unitCost,
                  totalCost: unitCost * absVariance,
                  reference: `Ajuste por conteo ${count.countNumber}`,
                  notes: `Varianza: esperado ${item.expectedQty}, contado ${item.countedQty}`,
                  performedById: session.userId,
                  performedAt: new Date(),
                },
              });

              // Update inventory level
              if (inventoryLevel) {
                await tx.inventoryLevel.update({
                  where: { id: inventoryLevel.id },
                  data: {
                    quantityOnHand: item.countedQty!,
                    quantityAvailable: {
                      increment: item.variance,
                    },
                    lastMovementAt: new Date(),
                  },
                });
              } else if (item.countedQty! > 0) {
                // Create inventory level if doesn't exist and counted > 0
                await tx.inventoryLevel.create({
                  data: {
                    organizationId: session.organizationId,
                    productId: item.productId,
                    warehouseId: count.warehouseId,
                    quantityOnHand: item.countedQty!,
                    quantityAvailable: item.countedQty!,
                    unitCost,
                    totalCost: unitCost * item.countedQty!,
                  },
                });
              }
            }
          }
        }

        // Update count status
        await tx.inventoryCount.update({
          where: { id: countId },
          data: {
            status: 'APPROVED',
            approvedById: session.userId,
            approvedAt: new Date(),
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: applyAdjustments !== false
          ? 'Conteo aprobado y ajustes aplicados'
          : 'Conteo aprobado sin ajustes',
      });
    }

    // Cancel count
    if (action === 'cancel') {
      const { countId, reason } = body;

      if (!countId) {
        return NextResponse.json(
          { success: false, error: 'countId es requerido' },
          { status: 400 }
        );
      }

      const count = await prisma.inventoryCount.findFirst({
        where: {
          id: countId,
          organizationId: session.organizationId,
          status: { in: ['DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW'] },
        },
      });

      if (!count) {
        return NextResponse.json(
          { success: false, error: 'Conteo no encontrado o no puede ser cancelado' },
          { status: 404 }
        );
      }

      await prisma.inventoryCount.update({
        where: { id: countId },
        data: {
          status: 'CANCELLED',
          notes: reason ? `${count.notes || ''}\nCancelado: ${reason}` : count.notes,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Conteo cancelado',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Acción no válida' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Stock count error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error processing stock count' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inventory/stock/count
 * Get inventory counts
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
    const countId = searchParams.get('countId');
    const warehouseId = searchParams.get('warehouseId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // Get single count with items
    if (countId) {
      const count = await prisma.inventoryCount.findFirst({
        where: {
          id: countId,
          organizationId: session.organizationId,
        },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          assignedTo: { select: { id: true, name: true } },
          completedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          items: {
            include: {
              inventoryCount: false,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!count) {
        return NextResponse.json(
          { success: false, error: 'Conteo no encontrado' },
          { status: 404 }
        );
      }

      // Get product info for items
      const productIds = count.items.map((i) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, sku: true, name: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const itemsWithProducts = count.items.map((item) => ({
        ...item,
        product: productMap.get(item.productId),
      }));

      return NextResponse.json({
        success: true,
        data: {
          ...count,
          items: itemsWithProducts,
        },
      });
    }

    // Build where clause for list
    const where: any = {
      organizationId: session.organizationId,
    };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (status) {
      where.status = status;
    }

    const [total, counts] = await Promise.all([
      prisma.inventoryCount.count({ where }),
      prisma.inventoryCount.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        counts: counts.map((c) => ({
          ...c,
          itemCount: c._count.items,
          _count: undefined,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Get counts error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching inventory counts' },
      { status: 500 }
    );
  }
}

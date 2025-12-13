/**
 * Stock API Route
 * Full stock management implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * GET /api/inventory/stock
 * Get stock levels, movements, or counts
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
    const view = searchParams.get('view') || 'levels';

    // Stock levels for a product (or all products if no productId)
    if (view === 'levels') {
      const productId = searchParams.get('productId');
      const warehouseId = searchParams.get('warehouseId');
      const lowStockOnly = searchParams.get('lowStock') === 'true';

      const where: Record<string, unknown> = {
        organizationId: session.organizationId,
      };

      if (productId) {
        where.productId = productId;
      }

      if (warehouseId) {
        where.warehouseId = warehouseId;
      }

      const levels = await prisma.inventoryLevel.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              minStockLevel: true,
              maxStockLevel: true,
              trackInventory: true,
            },
          },
          warehouse: {
            select: { id: true, code: true, name: true },
          },
          storageLocation: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      // Filter by low stock if requested
      let filteredLevels = levels;
      if (lowStockOnly) {
        filteredLevels = levels.filter(
          (level: typeof levels[number]) =>
            level.product.trackInventory &&
            level.quantityOnHand <= level.product.minStockLevel
        );
      }

      // Calculate totals
      const totalOnHand = filteredLevels.reduce((sum: number, l: typeof filteredLevels[number]) => sum + l.quantityOnHand, 0);
      const totalReserved = filteredLevels.reduce((sum: number, l: typeof filteredLevels[number]) => sum + l.quantityReserved, 0);
      const totalAvailable = filteredLevels.reduce((sum: number, l: typeof filteredLevels[number]) => sum + l.quantityAvailable, 0);

      return NextResponse.json({
        success: true,
        data: {
          levels: filteredLevels,
          summary: {
            totalOnHand,
            totalReserved,
            totalAvailable,
            count: filteredLevels.length,
          },
        },
      });
    }

    // Stock movements
    if (view === 'movements') {
      const productId = searchParams.get('productId');
      const warehouseId = searchParams.get('warehouseId');
      const movementType = searchParams.get('movementType');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

      const where: Record<string, unknown> = {
        organizationId: session.organizationId,
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

      if (movementType) {
        where.movementType = movementType as any;
      }

      if (startDate || endDate) {
        where.performedAt = {};
        if (startDate) {
          (where.performedAt as any).gte = new Date(startDate);
        }
        if (endDate) {
          (where.performedAt as any).lte = new Date(endDate);
        }
      }

      const [total, movements] = await Promise.all([
        prisma.stockMovement.count({ where }),
        prisma.stockMovement.findMany({
          where,
          include: {
            product: {
              select: { id: true, sku: true, name: true },
            },
            fromWarehouse: {
              select: { id: true, code: true, name: true },
            },
            toWarehouse: {
              select: { id: true, code: true, name: true },
            },
            job: {
              select: { id: true, jobNumber: true },
            },
          },
          orderBy: { performedAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          movements,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        },
      });
    }

    // Movement report
    if (view === 'report') {
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      const where: Record<string, unknown> = {
        organizationId: session.organizationId,
      };

      if (startDate || endDate) {
        where.performedAt = {};
        if (startDate) {
          (where.performedAt as any).gte = new Date(startDate);
        }
        if (endDate) {
          (where.performedAt as any).lte = new Date(endDate);
        }
      }

      const movements = await prisma.stockMovement.findMany({
        where,
        include: {
          product: {
            select: { categoryId: true },
          },
        },
      });

      let totalIn = 0;
      let totalOut = 0;

      for (const mov of movements) {
        if (mov.direction === 'IN') {
          totalIn += mov.quantity;
        } else {
          totalOut += mov.quantity;
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalIn,
            totalOut,
            netChange: totalIn - totalOut,
          },
        },
      });
    }

    // Reservation stats
    if (view === 'reservations') {
      const reservations = await prisma.stockReservation.findMany({
        where: {
          organizationId: session.organizationId,
          status: 'PENDING',
        },
        include: {
          product: {
            select: { id: true, sku: true, name: true, salePrice: true },
          },
          job: {
            select: { id: true, jobNumber: true },
          },
        },
      });

      const totalReserved = reservations.reduce((sum: number, r: typeof reservations[number]) => sum + r.quantity, 0);
      const reservedValue = reservations.reduce(
        (sum: number, r: typeof reservations[number]) => sum + r.quantity * Number(r.product.salePrice),
        0
      );

      return NextResponse.json({
        success: true,
        data: {
          totalReserved,
          reservedValue,
          reservations,
        },
      });
    }

    // Inventory counts
    if (view === 'counts') {
      const status = searchParams.get('status');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

      const where: Record<string, unknown> = {
        organizationId: session.organizationId,
      };

      if (status) {
        where.status = status as any;
      }

      const [total, counts] = await Promise.all([
        prisma.inventoryCount.count({ where }),
        prisma.inventoryCount.findMany({
          where,
          include: {
            warehouse: {
              select: { id: true, code: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          counts,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid view parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Stock API error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching stock data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/stock
 * Adjust stock, transfer, or create inventory count
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
        { success: false, error: 'No tienes permiso para ajustar stock' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action;

    // Stock adjustment
    if (action === 'adjust') {
      const { productId, warehouseId, quantity, reason, notes } = body;

      if (!productId || !warehouseId || quantity === undefined) {
        return NextResponse.json(
          { success: false, error: 'productId, warehouseId y quantity son requeridos' },
          { status: 400 }
        );
      }

      // Get product and current inventory level
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

      // Find or create inventory level
      let inventoryLevel = await prisma.inventoryLevel.findFirst({
        where: {
          productId,
          warehouseId,
          storageLocationId: null,
          lotNumber: null,
        },
      });

      const adjustmentQty = parseInt(quantity, 10);
      const isIncrease = adjustmentQty > 0;
      const absQty = Math.abs(adjustmentQty);

      if (!inventoryLevel) {
        // Create new inventory level
        if (adjustmentQty < 0) {
          return NextResponse.json(
            { success: false, error: 'No hay stock para ajustar' },
            { status: 400 }
          );
        }

        inventoryLevel = await prisma.inventoryLevel.create({
          data: {
            organizationId: session.organizationId,
            productId,
            warehouseId,
            quantityOnHand: adjustmentQty,
            quantityAvailable: adjustmentQty,
            unitCost: Number(product.costPrice),
            totalCost: Number(product.costPrice) * adjustmentQty,
          },
        });
      } else {
        // Update existing inventory level
        const newQty = inventoryLevel.quantityOnHand + adjustmentQty;

        if (newQty < 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Stock insuficiente. Disponible: ${inventoryLevel.quantityOnHand}`,
            },
            { status: 400 }
          );
        }

        inventoryLevel = await prisma.inventoryLevel.update({
          where: { id: inventoryLevel.id },
          data: {
            quantityOnHand: newQty,
            quantityAvailable: newQty - inventoryLevel.quantityReserved,
            totalCost: Number(inventoryLevel.unitCost) * newQty,
            lastMovementAt: new Date(),
          },
        });
      }

      // Create stock movement record
      const movementNumber = `ADJ-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const movementType = isIncrease ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

      await prisma.stockMovement.create({
        data: {
          organizationId: session.organizationId,
          productId,
          movementNumber,
          movementType,
          quantity: absQty,
          direction: isIncrease ? 'IN' : 'OUT',
          toWarehouseId: isIncrease ? warehouseId : undefined,
          fromWarehouseId: !isIncrease ? warehouseId : undefined,
          unitCost: Number(product.costPrice),
          totalCost: Number(product.costPrice) * absQty,
          reference: reason || 'Ajuste manual',
          notes,
          performedById: session.userId,
        },
      });

      return NextResponse.json({
        success: true,
        data: inventoryLevel,
        message: 'Stock ajustado exitosamente',
      });
    }

    // Stock transfer between warehouses
    if (action === 'transfer') {
      const { productId, fromWarehouseId, toWarehouseId, quantity, notes } = body;

      if (!productId || !fromWarehouseId || !toWarehouseId || !quantity) {
        return NextResponse.json(
          { success: false, error: 'productId, fromWarehouseId, toWarehouseId y quantity son requeridos' },
          { status: 400 }
        );
      }

      if (fromWarehouseId === toWarehouseId) {
        return NextResponse.json(
          { success: false, error: 'El origen y destino no pueden ser iguales' },
          { status: 400 }
        );
      }

      const transferQty = parseInt(quantity, 10);
      if (transferQty <= 0) {
        return NextResponse.json(
          { success: false, error: 'La cantidad debe ser positiva' },
          { status: 400 }
        );
      }

      // Get product
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

      // Check source has enough stock
      const sourceLevel = await prisma.inventoryLevel.findFirst({
        where: {
          productId,
          warehouseId: fromWarehouseId,
        },
      });

      if (!sourceLevel || sourceLevel.quantityAvailable < transferQty) {
        return NextResponse.json(
          {
            success: false,
            error: `Stock insuficiente. Disponible: ${sourceLevel?.quantityAvailable || 0}`,
          },
          { status: 400 }
        );
      }

      // Execute transfer in a transaction
      await prisma.$transaction(async (tx: typeof prisma) => {
        // Reduce source
        await tx.inventoryLevel.update({
          where: { id: sourceLevel.id },
          data: {
            quantityOnHand: { decrement: transferQty },
            quantityAvailable: { decrement: transferQty },
            totalCost: { decrement: Number(sourceLevel.unitCost) * transferQty },
            lastMovementAt: new Date(),
          },
        });

        // Find or create destination level
        let destLevel = await tx.inventoryLevel.findFirst({
          where: {
            productId,
            warehouseId: toWarehouseId,
            storageLocationId: null,
            lotNumber: null,
          },
        });

        if (destLevel) {
          await tx.inventoryLevel.update({
            where: { id: destLevel.id },
            data: {
              quantityOnHand: { increment: transferQty },
              quantityAvailable: { increment: transferQty },
              totalCost: { increment: Number(sourceLevel.unitCost) * transferQty },
              lastMovementAt: new Date(),
            },
          });
        } else {
          await tx.inventoryLevel.create({
            data: {
              organizationId: session.organizationId,
              productId,
              warehouseId: toWarehouseId,
              quantityOnHand: transferQty,
              quantityAvailable: transferQty,
              unitCost: sourceLevel.unitCost,
              totalCost: Number(sourceLevel.unitCost) * transferQty,
            },
          });
        }

        // Create movement record
        const movementNumber = `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        await tx.stockMovement.create({
          data: {
            organizationId: session.organizationId,
            productId,
            movementNumber,
            movementType: 'TRANSFER',
            quantity: transferQty,
            direction: 'OUT',
            fromWarehouseId,
            toWarehouseId,
            unitCost: sourceLevel.unitCost,
            totalCost: Number(sourceLevel.unitCost) * transferQty,
            notes,
            performedById: session.userId,
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Transferencia completada exitosamente',
      });
    }

    // Create inventory count
    if (action === 'createCount') {
      const { warehouseId, countType, productIds, notes } = body;

      if (!warehouseId) {
        return NextResponse.json(
          { success: false, error: 'warehouseId es requerido' },
          { status: 400 }
        );
      }

      const countNumber = `CNT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      // Get products to count
      const where: Record<string, unknown> = {
        organizationId: session.organizationId,
        isActive: true,
        trackInventory: true,
      };

      if (productIds && productIds.length > 0) {
        where.id = { in: productIds };
      }

      const products = await prisma.product.findMany({
        where,
        include: {
          inventoryLevels: {
            where: { warehouseId },
          },
        },
      });

      // Create count with items
      const count = await prisma.inventoryCount.create({
        data: {
          organizationId: session.organizationId,
          warehouseId,
          countNumber,
          countType: countType || 'FULL',
          status: 'DRAFT',
          totalItems: products.length,
          notes,
          items: {
            create: products.map((product: typeof products[number]) => ({
              productId: product.id,
              expectedQty: product.inventoryLevels[0]?.quantityOnHand || 0,
            })),
          },
        },
        include: {
          warehouse: {
            select: { id: true, code: true, name: true },
          },
          _count: { select: { items: true } },
        },
      });

      return NextResponse.json({
        success: true,
        data: count,
        message: 'Conteo de inventario creado exitosamente',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Acción no válida' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Stock action error:', error);
    return NextResponse.json(
      { success: false, error: 'Error processing stock action' },
      { status: 500 }
    );
  }
}

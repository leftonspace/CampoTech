/**
 * Inventory Transactions API Route
 * GET /api/inventory/transactions - List transactions
 * POST /api/inventory/transactions - Create stock movement
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const itemId = searchParams.get('itemId');
    const locationId = searchParams.get('locationId');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: Record<string, unknown> = {
      item: {
        organizationId: session.organizationId,
      },
    };

    if (itemId) where.itemId = itemId;
    if (locationId) where.locationId = locationId;
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          destinationLocation: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          performedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          job: {
            select: {
              id: true,
              jobNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

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
      locationId,
      destinationLocationId,
      type,
      quantity,
      unitCost,
      jobId,
      notes,
      reference,
    } = body;

    // Validate required fields
    if (!itemId || !locationId || !type || !quantity) {
      return NextResponse.json(
        { success: false, error: 'Artículo, ubicación, tipo y cantidad son requeridos' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = [
      'STOCK_IN',
      'STOCK_OUT',
      'TRANSFER',
      'ADJUSTMENT',
      'USED_ON_JOB',
      'RETURNED',
      'DAMAGED',
      'LOST',
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de transacción inválido' },
        { status: 400 }
      );
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { success: false, error: 'La cantidad debe ser un número positivo' },
        { status: 400 }
      );
    }

    // Verify item belongs to organization
    const item = await prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        organizationId: session.organizationId,
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Artículo no encontrado' },
        { status: 404 }
      );
    }

    // Verify location belongs to organization
    const location = await prisma.inventoryLocation.findFirst({
      where: {
        id: locationId,
        organizationId: session.organizationId,
      },
    });

    if (!location) {
      return NextResponse.json(
        { success: false, error: 'Ubicación no encontrada' },
        { status: 404 }
      );
    }

    // For transfers, verify destination location
    if (type === 'TRANSFER') {
      if (!destinationLocationId) {
        return NextResponse.json(
          { success: false, error: 'Se requiere ubicación de destino para transferencias' },
          { status: 400 }
        );
      }

      const destLocation = await prisma.inventoryLocation.findFirst({
        where: {
          id: destinationLocationId,
          organizationId: session.organizationId,
        },
      });

      if (!destLocation) {
        return NextResponse.json(
          { success: false, error: 'Ubicación de destino no encontrada' },
          { status: 404 }
        );
      }
    }

    // Get or create stock record for source location
    let sourceStock = await prisma.inventoryStock.findFirst({
      where: {
        itemId,
        locationId,
      },
    });

    // For outgoing transactions, check if sufficient stock
    const outgoingTypes = ['STOCK_OUT', 'TRANSFER', 'USED_ON_JOB', 'DAMAGED', 'LOST'];
    if (outgoingTypes.includes(type)) {
      if (!sourceStock || sourceStock.quantity < qty) {
        return NextResponse.json(
          { success: false, error: `Stock insuficiente. Disponible: ${sourceStock?.quantity || 0}` },
          { status: 400 }
        );
      }
    }

    // Perform transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update source stock
      if (sourceStock) {
        const newQuantity =
          type === 'STOCK_IN' || type === 'RETURNED'
            ? sourceStock.quantity + qty
            : sourceStock.quantity - qty;

        await tx.inventoryStock.update({
          where: { id: sourceStock.id },
          data: {
            quantity: newQuantity,
            lastUpdated: new Date(),
          },
        });
      } else {
        // Create stock record for incoming
        if (type === 'STOCK_IN' || type === 'RETURNED') {
          await tx.inventoryStock.create({
            data: {
              itemId,
              locationId,
              quantity: qty,
              reservedQuantity: 0,
            },
          });
        }
      }

      // For transfers, update destination stock
      if (type === 'TRANSFER' && destinationLocationId) {
        const destStock = await tx.inventoryStock.findFirst({
          where: {
            itemId,
            locationId: destinationLocationId,
          },
        });

        if (destStock) {
          await tx.inventoryStock.update({
            where: { id: destStock.id },
            data: {
              quantity: destStock.quantity + qty,
              lastUpdated: new Date(),
            },
          });
        } else {
          await tx.inventoryStock.create({
            data: {
              itemId,
              locationId: destinationLocationId,
              quantity: qty,
              reservedQuantity: 0,
            },
          });
        }
      }

      // Create transaction record
      const transaction = await tx.inventoryTransaction.create({
        data: {
          itemId,
          locationId,
          destinationLocationId: type === 'TRANSFER' ? destinationLocationId : null,
          type,
          quantity: qty,
          unitCost: unitCost ? parseFloat(unitCost) : item.unitCost,
          totalCost: unitCost
            ? parseFloat(unitCost) * qty
            : item.unitCost
              ? Number(item.unitCost) * qty
              : null,
          jobId: jobId || null,
          performedById: session.userId,
          notes,
          reference,
        },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          destinationLocation: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return transaction;
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Create inventory transaction error:', error);
    return NextResponse.json(
      { success: false, error: 'Error procesando transacción' },
      { status: 500 }
    );
  }
}

/**
 * Inventory Transactions API Route
 * GET /api/inventory/transactions - List transactions
 * POST /api/inventory/transactions - Create stock movement
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InventoryTransactionType } from '@prisma/client';

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
    const transactionType = searchParams.get('type') as InventoryTransactionType | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: session.organizationId,
    };

    if (itemId) where.itemId = itemId;
    if (locationId) {
      where.OR = [
        { fromLocationId: locationId },
        { toLocationId: locationId },
      ];
    }
    if (transactionType) where.transactionType = transactionType;

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
          fromLocation: {
            select: {
              id: true,
              name: true,
              locationType: true,
            },
          },
          toLocation: {
            select: {
              id: true,
              name: true,
              locationType: true,
            },
          },
          performedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { performedAt: 'desc' },
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
      fromLocationId,
      toLocationId,
      transactionType,
      quantity,
      notes,
    } = body;

    // Validate required fields
    if (!itemId || !transactionType || !quantity) {
      return NextResponse.json(
        { success: false, error: 'Artículo, tipo y cantidad son requeridos' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = Object.values(InventoryTransactionType);
    if (!validTypes.includes(transactionType)) {
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

    // Validate locations based on transaction type
    if (transactionType === 'TRANSFER') {
      if (!fromLocationId || !toLocationId) {
        return NextResponse.json(
          { success: false, error: 'Se requieren ubicaciones de origen y destino para transferencias' },
          { status: 400 }
        );
      }
    }

    // Verify locations exist and belong to organization
    if (fromLocationId) {
      const fromLocation = await prisma.inventoryLocation.findFirst({
        where: {
          id: fromLocationId,
          organizationId: session.organizationId,
        },
      });

      if (!fromLocation) {
        return NextResponse.json(
          { success: false, error: 'Ubicación de origen no encontrada' },
          { status: 404 }
        );
      }
    }

    if (toLocationId) {
      const toLocation = await prisma.inventoryLocation.findFirst({
        where: {
          id: toLocationId,
          organizationId: session.organizationId,
        },
      });

      if (!toLocation) {
        return NextResponse.json(
          { success: false, error: 'Ubicación de destino no encontrada' },
          { status: 404 }
        );
      }
    }

    // For outgoing transactions (USE, TRANSFER from), check sufficient stock
    const outgoingTypes: InventoryTransactionType[] = ['USE', 'TRANSFER'];
    if (outgoingTypes.includes(transactionType) && fromLocationId) {
      const sourceStock = await prisma.inventoryStock.findFirst({
        where: {
          itemId,
          locationId: fromLocationId,
        },
      });

      if (!sourceStock || sourceStock.quantity < qty) {
        return NextResponse.json(
          { success: false, error: `Stock insuficiente. Disponible: ${sourceStock?.quantity || 0}` },
          { status: 400 }
        );
      }
    }

    // Perform transaction
    const result = await prisma.$transaction(async (tx: typeof prisma) => {
      // Decrease stock from source location
      if (fromLocationId) {
        const sourceStock = await tx.inventoryStock.findFirst({
          where: {
            itemId,
            locationId: fromLocationId,
          },
        });

        if (sourceStock) {
          await tx.inventoryStock.update({
            where: { id: sourceStock.id },
            data: {
              quantity: sourceStock.quantity - qty,
            },
          });
        }
      }

      // Increase stock at destination location
      if (toLocationId) {
        const destStock = await tx.inventoryStock.findFirst({
          where: {
            itemId,
            locationId: toLocationId,
          },
        });

        if (destStock) {
          await tx.inventoryStock.update({
            where: { id: destStock.id },
            data: {
              quantity: destStock.quantity + qty,
            },
          });
        } else {
          await tx.inventoryStock.create({
            data: {
              itemId,
              locationId: toLocationId,
              quantity: qty,
            },
          });
        }
      }

      // Create transaction record
      const transaction = await tx.inventoryTransaction.create({
        data: {
          organizationId: session.organizationId,
          itemId,
          fromLocationId: fromLocationId || null,
          toLocationId: toLocationId || null,
          transactionType: transactionType as InventoryTransactionType,
          quantity: qty,
          performedById: session.userId,
          notes,
        },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          fromLocation: {
            select: {
              id: true,
              name: true,
            },
          },
          toLocation: {
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

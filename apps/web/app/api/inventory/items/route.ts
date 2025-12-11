/**
 * Inventory Items API Route
 * GET /api/inventory/items - List inventory items
 * POST /api/inventory/items - Create new item
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
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const lowStock = searchParams.get('lowStock') === 'true';
    const locationId = searchParams.get('locationId');

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: session.organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    // Get items with stock levels
    const items = await prisma.inventoryItem.findMany({
      where,
      include: {
        stocks: {
          include: {
            location: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
          ...(locationId ? { where: { locationId } } : {}),
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Calculate total stock and check for low stock
    const itemsWithTotals = items.map((item) => {
      const totalStock = item.stocks.reduce((sum, s) => sum + s.quantity, 0);
      const isLowStock = totalStock <= (item.minStockLevel || 0);

      return {
        ...item,
        totalStock,
        isLowStock,
        stocksByLocation: item.stocks.map((s) => ({
          locationId: s.locationId,
          locationName: s.location.name,
          locationType: s.location.type,
          quantity: s.quantity,
          reservedQuantity: s.reservedQuantity,
          availableQuantity: s.quantity - s.reservedQuantity,
        })),
      };
    });

    // Filter by low stock if requested
    const filteredItems = lowStock
      ? itemsWithTotals.filter((item) => item.isLowStock)
      : itemsWithTotals;

    // Calculate stats
    const stats = {
      totalItems: items.length,
      lowStockItems: itemsWithTotals.filter((item) => item.isLowStock).length,
      categories: [...new Set(items.map((item) => item.category))].filter(Boolean),
    };

    return NextResponse.json({
      success: true,
      data: {
        items: filteredItems,
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

    // Only admins, owners, and dispatchers can create items
    if (!['ADMIN', 'OWNER', 'DISPATCHER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      sku,
      description,
      category,
      unit,
      unitCost,
      minStockLevel,
      maxStockLevel,
      reorderPoint,
      reorderQuantity,
      imageUrl,
      isActive = true,
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Check for duplicate SKU
    if (sku) {
      const existingSku = await prisma.inventoryItem.findFirst({
        where: {
          organizationId: session.organizationId,
          sku,
        },
      });

      if (existingSku) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un artículo con ese SKU' },
          { status: 400 }
        );
      }
    }

    const item = await prisma.inventoryItem.create({
      data: {
        organizationId: session.organizationId,
        name,
        sku: sku || undefined,
        description,
        category,
        unit: unit || 'unidad',
        unitCost: unitCost ? parseFloat(unitCost) : null,
        minStockLevel: minStockLevel ? parseInt(minStockLevel) : null,
        maxStockLevel: maxStockLevel ? parseInt(maxStockLevel) : null,
        reorderPoint: reorderPoint ? parseInt(reorderPoint) : null,
        reorderQuantity: reorderQuantity ? parseInt(reorderQuantity) : null,
        imageUrl,
        isActive,
      },
    });

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('Create inventory item error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creando artículo' },
      { status: 500 }
    );
  }
}

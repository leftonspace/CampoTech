/**
 * Single Inventory Item API Route
 * GET /api/inventory/items/[id] - Get item details
 * PUT /api/inventory/items/[id] - Update item
 * DELETE /api/inventory/items/[id] - Delete item
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  filterEntityByRole,
  getEntityFieldMetadata,
  validateEntityUpdate,
  UserRole,
} from '@/lib/middleware/field-filter';

export async function GET(
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

    const { id } = await params;

    const item = await prisma.inventoryItem.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
      include: {
        stocks: {
          include: {
            location: {
              select: {
                id: true,
                name: true,
                locationType: true,
              },
            },
          },
        },
        transactions: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
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
            performedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Artículo no encontrado' },
        { status: 404 }
      );
    }

    // Calculate totals
    const totalStock = item.stocks.reduce((sum: number, s: { quantity: number }) => sum + s.quantity, 0);
    const isLowStock = totalStock <= (item.minStockLevel || 0);

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Build item data
    const itemData = {
      ...item,
      totalStock,
      availableStock: totalStock,
      isLowStock,
    };

    // Filter data based on user role (costPrice is restricted)
    const filteredData = filterEntityByRole(itemData, 'product', userRole);
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

    // Normalize user role
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    if (!['OWNER', 'DISPATCHER'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operacion' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify item belongs to organization
    const existing = await prisma.inventoryItem.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Artículo no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate that user can edit the fields they're trying to update
    const validation = validateEntityUpdate(body, 'product', userRole);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(' ') },
        { status: 403 }
      );
    }

    const {
      name,
      sku,
      description,
      category,
      unit,
      costPrice,
      salePrice,
      minStockLevel,
      imageUrl,
      isActive,
    } = body;

    // Check for duplicate SKU (if changing)
    if (sku && sku !== existing.sku) {
      const existingSku = await prisma.inventoryItem.findFirst({
        where: {
          organizationId: session.organizationId,
          sku,
          id: { not: id },
        },
      });

      if (existingSku) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un artículo con ese SKU' },
          { status: 400 }
        );
      }
    }

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(sku !== undefined && { sku }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(unit !== undefined && { unit }),
        ...(costPrice !== undefined && { costPrice: parseFloat(costPrice) }),
        ...(salePrice !== undefined && { salePrice: parseFloat(salePrice) }),
        ...(minStockLevel !== undefined && { minStockLevel: parseInt(minStockLevel) }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('Update inventory item error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando artículo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify item belongs to organization
    const existing = await prisma.inventoryItem.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
      include: {
        stocks: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Artículo no encontrado' },
        { status: 404 }
      );
    }

    // Check if item has stock
    const hasStock = existing.stocks.some((s: { quantity: number }) => s.quantity > 0);
    if (hasStock) {
      return NextResponse.json(
        { success: false, error: 'No se puede eliminar un artículo con stock. Primero ajuste el inventario a cero.' },
        { status: 400 }
      );
    }

    await prisma.inventoryItem.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Artículo eliminado correctamente',
    });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    return NextResponse.json(
      { success: false, error: 'Error eliminando artículo' },
      { status: 500 }
    );
  }
}

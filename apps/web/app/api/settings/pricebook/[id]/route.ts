/**
 * Pricebook Item API Route
 * GET /api/settings/pricebook/[id] - Get a single price item
 * PUT /api/settings/pricebook/[id] - Update a price item
 * DELETE /api/settings/pricebook/[id] - Delete a price item
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError, Decimal } from '@prisma/client/runtime/library';
import { validateBody, pricebookItemSchema } from '@/lib/validation/api-schemas';

// Helper to check if error is "table doesn't exist"
function isTableNotFoundError(error: unknown): boolean {
  return (
    error instanceof PrismaClientKnownRequestError &&
    error.code === 'P2021'
  );
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    let item;
    try {
      item = await prisma.priceItem.findFirst({
        where: {
          id,
          organizationId: session.organizationId,
        },
      });
    } catch (queryError) {
      if (isTableNotFoundError(queryError)) {
        return NextResponse.json(
          { success: false, error: 'Item no encontrado' },
          { status: 404 }
        );
      }
      throw queryError;
    }

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Item no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: item.id,
        name: item.name,
        description: item.description,
        type: item.type.toLowerCase(),
        price: Number(item.price),
        unit: item.unit,
        taxRate: Number(item.taxRate),
        isActive: item.isActive,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Get price item error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo item' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar items' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request body with Zod
    const validation = validateBody(body, pricebookItemSchema);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { name, description, type, price, unit, taxRate, isActive, priceCurrency, priceInUsd } = validation.data;

    // Determine if this is a currency change
    const isUsdPricing = priceCurrency === 'USD';

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type.toUpperCase() as 'SERVICE' | 'PRODUCT';

    // Handle currency-aware price updates
    if (priceCurrency !== undefined) {
      updateData.priceCurrency = priceCurrency;
    }
    if (isUsdPricing) {
      // For USD: store priceInUsd, set price to 0
      if (priceInUsd !== undefined && priceInUsd !== null) {
        updateData.priceInUsd = new Decimal(priceInUsd);
        updateData.price = new Decimal(0);
      }
    } else if (price !== undefined) {
      // For ARS: store price directly, clear priceInUsd
      updateData.price = new Decimal(price);
      if (priceCurrency === 'ARS') {
        updateData.priceInUsd = null;
      }
    }

    if (unit !== undefined) updateData.unit = unit;
    if (taxRate !== undefined) updateData.taxRate = new Decimal(taxRate);
    if (isActive !== undefined) updateData.isActive = isActive;

    let item;
    try {
      // Verify ownership first
      const existing = await prisma.priceItem.findFirst({
        where: {
          id,
          organizationId: session.organizationId,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Item no encontrado' },
          { status: 404 }
        );
      }

      item = await prisma.priceItem.update({
        where: { id },
        data: updateData,
      });
    } catch (queryError) {
      if (isTableNotFoundError(queryError)) {
        return NextResponse.json(
          {
            success: false,
            error: 'La lista de precios no está disponible todavía.',
          },
          { status: 503 }
        );
      }
      throw queryError;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: item.id,
        name: item.name,
        description: item.description,
        type: item.type.toLowerCase(),
        price: Number(item.price),
        unit: item.unit,
        taxRate: Number(item.taxRate),
        isActive: item.isActive,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Update price item error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error actualizando item' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para eliminar items' },
        { status: 403 }
      );
    }

    try {
      // Verify ownership first
      const existing = await prisma.priceItem.findFirst({
        where: {
          id,
          organizationId: session.organizationId,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Item no encontrado' },
          { status: 404 }
        );
      }

      await prisma.priceItem.delete({
        where: { id },
      });
    } catch (queryError) {
      if (isTableNotFoundError(queryError)) {
        return NextResponse.json(
          {
            success: false,
            error: 'La lista de precios no está disponible todavía.',
          },
          { status: 503 }
        );
      }
      throw queryError;
    }

    return NextResponse.json({
      success: true,
      message: 'Item eliminado exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Delete price item error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error eliminando item' },
      { status: 500 }
    );
  }
}

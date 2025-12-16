/**
 * Pricebook API Route
 * GET /api/settings/pricebook - List all price items
 * POST /api/settings/pricebook - Create a new price item
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError, Decimal } from '@prisma/client/runtime/library';

// Helper to check if error is "table doesn't exist"
function isTableNotFoundError(error: unknown): boolean {
  return (
    error instanceof PrismaClientKnownRequestError &&
    error.code === 'P2021'
  );
}

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
    const type = searchParams.get('type');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const where: Record<string, unknown> = {
      organizationId: session.organizationId,
    };

    if (type) {
      where.type = type.toUpperCase() as 'SERVICE' | 'PRODUCT';
    }

    if (activeOnly) {
      where.isActive = true;
    }

    let items: Array<{
      id: string;
      name: string;
      description: string | null;
      type: string;
      price: Decimal;
      unit: string | null;
      taxRate: Decimal;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    try {
      items = await prisma.priceItem.findMany({
        where,
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
    } catch (queryError) {
      // Handle missing table gracefully
      if (isTableNotFoundError(queryError)) {
        console.warn('Price items table not found - returning empty data. Run database migrations to create tables.');
        return NextResponse.json({
          success: true,
          data: [],
          _notice: 'Pricebook table not yet created. Run database migrations.',
        });
      }
      throw queryError;
    }

    // Transform for frontend
    const transformedItems = items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      type: item.type.toLowerCase() as 'service' | 'product',
      price: Number(item.price),
      unit: item.unit,
      taxRate: Number(item.taxRate),
      isActive: item.isActive,
    }));

    return NextResponse.json({
      success: true,
      data: transformedItems,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Get pricebook error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo lista de precios' },
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

    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para crear items' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, type, price, unit, taxRate, isActive } = body;

    if (!name || price === undefined || price === null) {
      return NextResponse.json(
        { success: false, error: 'Nombre y precio son requeridos' },
        { status: 400 }
      );
    }

    let item;
    try {
      item = await prisma.priceItem.create({
        data: {
          organizationId: session.organizationId,
          name,
          description: description || null,
          type: (type?.toUpperCase() as 'SERVICE' | 'PRODUCT') || 'SERVICE',
          price: new Decimal(price),
          unit: unit || null,
          taxRate: taxRate ? new Decimal(taxRate) : new Decimal(21),
          isActive: isActive !== false,
        },
      });
    } catch (queryError) {
      if (isTableNotFoundError(queryError)) {
        console.warn('Price items table not found - cannot create item. Run database migrations to create tables.');
        return NextResponse.json(
          {
            success: false,
            error: 'La lista de precios no está disponible todavía. Contacte al administrador.',
            _notice: 'Pricebook table not yet created. Run database migrations.',
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
    console.error('Create price item error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error creando item de precio' },
      { status: 500 }
    );
  }
}

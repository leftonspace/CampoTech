/**
 * Product Categories API Route
 * Full CRUD for inventory product categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

/**
 * GET /api/inventory/categories
 * List all categories with hierarchy
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
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const flat = searchParams.get('flat') === 'true';

    const where: Record<string, unknown> = {
      organizationId: session.organizationId,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    const categories = await prisma.productCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        parentId: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        _count: { select: { products: true, children: true } },
      },
    });

    // If flat is requested, return without hierarchy
    if (flat) {
      return NextResponse.json({
        success: true,
        data: {
          categories: categories.map((cat: typeof categories[number]) => ({
            ...cat,
            productCount: cat._count.products,
            childrenCount: cat._count.children,
            _count: undefined,
          })),
        },
      });
    }

    // Build hierarchy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const categoryMap = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootCategories: any[] = [];

    // First pass: create all category objects
    for (const cat of categories) {
      categoryMap.set(cat.id, {
        ...cat,
        productCount: cat._count.products,
        childrenCount: cat._count.children,
        _count: undefined,
        children: [],
      });
    }

    // Second pass: build hierarchy
    for (const cat of categories) {
      const category = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(category);
      } else {
        rootCategories.push(category);
      }
    }

    return NextResponse.json({
      success: true,
      data: { categories: rootCategories },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Categories list error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error listing categories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/categories
 * Create a new category
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
    if (!['OWNER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para crear categorías' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.code) {
      return NextResponse.json(
        { success: false, error: 'Nombre y código son requeridos' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existingCategory = await prisma.productCategory.findFirst({
      where: {
        organizationId: session.organizationId,
        code: body.code.toUpperCase(),
      },
    });

    if (existingCategory) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una categoría con este código' },
        { status: 400 }
      );
    }

    // If parentId provided, verify it exists
    if (body.parentId) {
      const parent = await prisma.productCategory.findFirst({
        where: {
          id: body.parentId,
          organizationId: session.organizationId,
        },
      });

      if (!parent) {
        return NextResponse.json(
          { success: false, error: 'Categoría padre no encontrada' },
          { status: 400 }
        );
      }
    }

    // Get next sortOrder
    const maxSortOrder = await prisma.productCategory.aggregate({
      where: {
        organizationId: session.organizationId,
        parentId: body.parentId || null,
      },
      _max: { sortOrder: true },
    });

    const category = await prisma.productCategory.create({
      data: {
        organizationId: session.organizationId,
        code: body.code.toUpperCase(),
        name: body.name,
        description: body.description || null,
        parentId: body.parentId || null,
        sortOrder: body.sortOrder ?? (maxSortOrder._max.sortOrder ?? 0) + 1,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Categoría creada exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Category creation error:', err.message);

    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Ya existe una categoría con este código' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Error creating category' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inventory/categories
 * Bulk update categories (for reordering)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user role
    if (!['OWNER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar categorías' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.categories || !Array.isArray(body.categories)) {
      return NextResponse.json(
        { success: false, error: 'Se requiere un array de categorías' },
        { status: 400 }
      );
    }

    // Update each category's sortOrder
    await prisma.$transaction(
      body.categories.map((cat: { id: string; sortOrder: number; parentId?: string }) =>
        prisma.productCategory.updateMany({
          where: {
            id: cat.id,
            organizationId: session.organizationId,
          },
          data: {
            sortOrder: cat.sortOrder,
            parentId: cat.parentId ?? undefined,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: 'Categorías actualizadas exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Categories update error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error updating categories' },
      { status: 500 }
    );
  }
}

/**
 * Category Detail API Route
 * GET, PATCH, DELETE for individual categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

interface RouteParams {
  params: Promise<{ categoryId: string }>;
}

/**
 * GET /api/inventory/categories/:categoryId
 * Get a single category with details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { categoryId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const category = await prisma.productCategory.findFirst({
      where: {
        id: categoryId,
        organizationId: session.organizationId,
      },
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
        children: {
          select: { id: true, code: true, name: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...category,
        productCount: category._count.products,
        _count: undefined,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Category detail error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error fetching category' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inventory/categories/:categoryId
 * Update a category
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { categoryId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user role
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar categorías' },
        { status: 403 }
      );
    }

    // Check category exists
    const existingCategory = await prisma.productCategory.findFirst({
      where: {
        id: categoryId,
        organizationId: session.organizationId,
      },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // If code is being changed, check it doesn't already exist
    if (body.code && body.code !== existingCategory.code) {
      const duplicateCode = await prisma.productCategory.findFirst({
        where: {
          organizationId: session.organizationId,
          code: body.code.toUpperCase(),
          NOT: { id: categoryId },
        },
      });

      if (duplicateCode) {
        return NextResponse.json(
          { success: false, error: 'Ya existe una categoría con este código' },
          { status: 400 }
        );
      }
    }

    // Prevent circular parent reference
    if (body.parentId === categoryId) {
      return NextResponse.json(
        { success: false, error: 'Una categoría no puede ser su propia padre' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.code !== undefined) updateData.code = body.code.toUpperCase();
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.parentId !== undefined) {
      if (body.parentId) {
        updateData.parent = { connect: { id: body.parentId } };
      } else {
        updateData.parent = { disconnect: true };
      }
    }

    const category = await prisma.productCategory.update({
      where: { id: categoryId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Categoría actualizada exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Category update error:', err.message);

    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Ya existe una categoría con este código' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Error updating category' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/categories/:categoryId
 * Delete a category
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { categoryId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user role
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para eliminar categorías' },
        { status: 403 }
      );
    }

    // Check category exists
    const existingCategory = await prisma.productCategory.findFirst({
      where: {
        id: categoryId,
        organizationId: session.organizationId,
      },
      include: {
        _count: { select: { products: true, children: true } },
      },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const forceDelete = searchParams.get('force') === 'true';

    // Check if has products or children
    if ((existingCategory._count.products > 0 || existingCategory._count.children > 0) && !forceDelete) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede eliminar una categoría con productos o subcategorías. Use ?force=true para eliminar de todos modos.',
          data: {
            productCount: existingCategory._count.products,
            childrenCount: existingCategory._count.children,
          },
        },
        { status: 400 }
      );
    }

    // If force delete, move products and children to no category
    if (forceDelete) {
      await prisma.$transaction([
        // Remove category from products
        prisma.product.updateMany({
          where: { categoryId },
          data: { categoryId: null },
        }),
        // Move children to root level
        prisma.productCategory.updateMany({
          where: { parentId: categoryId },
          data: { parentId: null },
        }),
        // Delete category
        prisma.productCategory.delete({
          where: { id: categoryId },
        }),
      ]);
    } else {
      await prisma.productCategory.delete({
        where: { id: categoryId },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Categoría eliminada exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Category delete error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error deleting category' },
      { status: 500 }
    );
  }
}

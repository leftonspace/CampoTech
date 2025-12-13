/**
 * Product Detail API Route
 * GET, PATCH, DELETE for individual products
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

interface RouteParams {
  params: Promise<{ productId: string }>;
}

/**
 * GET /api/inventory/products/:productId
 * Get a single product with full details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { productId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: session.organizationId,
      },
      include: {
        category: {
          select: { id: true, code: true, name: true },
        },
        inventoryLevels: {
          include: {
            warehouse: {
              select: { id: true, code: true, name: true },
            },
            storageLocation: {
              select: { id: true, code: true, name: true },
            },
          },
        },
        supplierProducts: {
          include: {
            supplier: {
              select: { id: true, code: true, name: true },
            },
          },
        },
        stockMovements: {
          take: 10,
          orderBy: { performedAt: 'desc' },
          select: {
            id: true,
            movementNumber: true,
            movementType: true,
            quantity: true,
            direction: true,
            unitCost: true,
            notes: true,
            performedAt: true,
            fromWarehouse: {
              select: { id: true, code: true, name: true },
            },
            toWarehouse: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Calculate stock totals
    const totalOnHand = product.inventoryLevels.reduce(
      (sum: number, level: typeof product.inventoryLevels[number]) => sum + level.quantityOnHand,
      0
    );
    const totalReserved = product.inventoryLevels.reduce(
      (sum: number, level: typeof product.inventoryLevels[number]) => sum + level.quantityReserved,
      0
    );
    const totalAvailable = product.inventoryLevels.reduce(
      (sum: number, level: typeof product.inventoryLevels[number]) => sum + level.quantityAvailable,
      0
    );
    const totalOnOrder = product.inventoryLevels.reduce(
      (sum: number, level: typeof product.inventoryLevels[number]) => sum + level.quantityOnOrder,
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        stock: {
          onHand: totalOnHand,
          reserved: totalReserved,
          available: totalAvailable,
          onOrder: totalOnOrder,
          isLowStock: product.trackInventory && totalOnHand <= product.minStockLevel && totalOnHand > 0,
          isOutOfStock: product.trackInventory && totalOnHand === 0,
        },
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Product detail error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error fetching product' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inventory/products/:productId
 * Update a product
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { productId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user role
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar productos' },
        { status: 403 }
      );
    }

    // Check product exists and belongs to organization
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: session.organizationId,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // If SKU is being changed, check it doesn't already exist
    if (body.sku && body.sku !== existingProduct.sku) {
      const duplicateSku = await prisma.product.findFirst({
        where: {
          organizationId: session.organizationId,
          sku: body.sku,
          NOT: { id: productId },
        },
      });

      if (duplicateSku) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un producto con este SKU' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    // Only update fields that are provided
    if (body.sku !== undefined) updateData.sku = body.sku;
    if (body.barcode !== undefined) updateData.barcode = body.barcode;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.brand !== undefined) updateData.brand = body.brand;
    if (body.model !== undefined) updateData.model = body.model;
    if (body.categoryId !== undefined) {
      if (body.categoryId) {
        updateData.category = { connect: { id: body.categoryId } };
      } else {
        updateData.category = { disconnect: true };
      }
    }
    if (body.productType !== undefined) updateData.productType = body.productType;
    if (body.unitOfMeasure !== undefined) updateData.unitOfMeasure = body.unitOfMeasure;
    if (body.costPrice !== undefined) updateData.costPrice = body.costPrice;
    if (body.salePrice !== undefined) updateData.salePrice = body.salePrice;
    if (body.marginPercent !== undefined) updateData.marginPercent = body.marginPercent;
    if (body.taxRate !== undefined) updateData.taxRate = body.taxRate;
    if (body.trackInventory !== undefined) updateData.trackInventory = body.trackInventory;
    if (body.minStockLevel !== undefined) updateData.minStockLevel = body.minStockLevel;
    if (body.maxStockLevel !== undefined) updateData.maxStockLevel = body.maxStockLevel;
    if (body.reorderQty !== undefined) updateData.reorderQty = body.reorderQty;
    if (body.weight !== undefined) updateData.weight = body.weight;
    if (body.dimensions !== undefined) updateData.dimensions = body.dimensions;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.images !== undefined) updateData.images = body.images;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.isSerialTracked !== undefined) updateData.isSerialTracked = body.isSerialTracked;

    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        category: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Producto actualizado exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Product update error:', err.message);

    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Ya existe un producto con este SKU' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Error updating product' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/products/:productId
 * Delete a product (soft delete by setting isActive = false)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { productId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user role
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para eliminar productos' },
        { status: 403 }
      );
    }

    // Check product exists and belongs to organization
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: session.organizationId,
      },
      include: {
        inventoryLevels: {
          select: { quantityOnHand: true },
        },
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Check if product has inventory
    const totalStock = existingProduct.inventoryLevels.reduce(
      (sum: number, level: typeof existingProduct.inventoryLevels[number]) => sum + level.quantityOnHand,
      0
    );

    const { searchParams } = new URL(request.url);
    const forceDelete = searchParams.get('force') === 'true';

    if (totalStock > 0 && !forceDelete) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede eliminar un producto con stock. Use ?force=true para eliminar de todos modos.',
          data: { currentStock: totalStock },
        },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive = false
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Producto eliminado exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Product delete error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error deleting product' },
      { status: 500 }
    );
  }
}

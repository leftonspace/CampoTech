/**
 * Suppliers API Route
 * Full CRUD for inventory suppliers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

/**
 * GET /api/inventory/suppliers
 * List or search suppliers
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
    const supplierId = searchParams.get('supplierId');
    const view = searchParams.get('view');
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // Get single supplier
    if (supplierId && !view) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: supplierId,
          organizationId: session.organizationId,
        },
        include: {
          supplierProducts: {
            include: {
              product: {
                select: { id: true, sku: true, name: true },
              },
            },
          },
          _count: {
            select: { purchaseOrders: true },
          },
        },
      });

      if (!supplier) {
        return NextResponse.json(
          { success: false, error: 'Proveedor no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          ...supplier,
          orderCount: supplier._count.purchaseOrders,
          _count: undefined,
        },
      });
    }

    // Supplier performance
    if (supplierId && view === 'performance') {
      const orders = await prisma.purchaseOrder.findMany({
        where: {
          supplierId,
          organizationId: session.organizationId,
        },
        select: {
          status: true,
          total: true,
          createdAt: true,
          receivedDate: true,
          expectedDate: true,
        },
      });

      const totalOrders = orders.length;
      const completedOrders = orders.filter((o: typeof orders[number]) => o.status === 'RECEIVED').length;
      const onTimeOrders = orders.filter(
        (o: typeof orders[number]) =>
          o.status === 'RECEIVED' &&
          o.receivedDate &&
          o.expectedDate &&
          o.receivedDate <= o.expectedDate
      ).length;

      return NextResponse.json({
        success: true,
        data: {
          totalOrders,
          completedOrders,
          onTimeDeliveryRate: completedOrders > 0 ? (onTimeOrders / completedOrders) * 100 : 0,
          totalSpent: orders.reduce((sum: number, o: typeof orders[number]) => sum + Number(o.total), 0),
        },
      });
    }

    // Supplier products
    if (supplierId && view === 'products') {
      const products = await prisma.supplierProduct.findMany({
        where: { supplierId },
        include: {
          product: {
            select: { id: true, sku: true, name: true, costPrice: true },
          },
        },
      });

      return NextResponse.json({ success: true, data: { products } });
    }

    // Top suppliers by order volume
    if (view === 'top') {
      const suppliers = await prisma.supplier.findMany({
        where: {
          organizationId: session.organizationId,
          isActive: true,
        },
        include: {
          _count: { select: { purchaseOrders: true } },
        },
        orderBy: {
          purchaseOrders: { _count: 'desc' },
        },
        take: 10,
      });

      return NextResponse.json({
        success: true,
        data: {
          suppliers: suppliers.map((s: typeof suppliers[number]) => ({
            ...s,
            orderCount: s._count.purchaseOrders,
            _count: undefined,
          })),
        },
      });
    }

    // Build where clause for list
    const where: Record<string, unknown> = {
      organizationId: session.organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cuit: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        include: {
          _count: { select: { purchaseOrders: true, supplierProducts: true } },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        suppliers: suppliers.map((s: typeof suppliers[number]) => ({
          ...s,
          orderCount: s._count.purchaseOrders,
          productCount: s._count.supplierProducts,
          _count: undefined,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Suppliers list error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error listing suppliers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/suppliers
 * Create supplier or manage supplier products
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
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para crear proveedores' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action;

    // Add product to supplier
    if (action === 'addProduct') {
      const { supplierId, productId, supplierSku, supplierPrice, leadTimeDays } = body;

      if (!supplierId || !productId) {
        return NextResponse.json(
          { success: false, error: 'supplierId y productId son requeridos' },
          { status: 400 }
        );
      }

      const supplierProduct = await prisma.supplierProduct.create({
        data: {
          supplierId,
          productId,
          supplierSku: supplierSku || null,
          purchasePrice: supplierPrice || 0,
          leadTimeDays: leadTimeDays || null,
          isPreferred: body.isPreferred || false,
        },
        include: {
          product: {
            select: { id: true, sku: true, name: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: supplierProduct,
        message: 'Producto agregado al proveedor',
      });
    }

    // Create new supplier
    if (!body.name || !body.code) {
      return NextResponse.json(
        { success: false, error: 'Nombre y código son requeridos' },
        { status: 400 }
      );
    }

    // Check code uniqueness
    const existingSupplier = await prisma.supplier.findFirst({
      where: {
        organizationId: session.organizationId,
        code: body.code.toUpperCase(),
      },
    });

    if (existingSupplier) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un proveedor con este código' },
        { status: 400 }
      );
    }

    // Build address JSON from separate fields if provided
    const addressData = body.address || (body.city || body.state || body.postalCode || body.country ? {
      street: body.street || null,
      city: body.city || null,
      province: body.state || null,
      postalCode: body.postalCode || null,
      country: body.country || 'AR',
    } : null);

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: session.organizationId,
        code: body.code.toUpperCase(),
        name: body.name,
        cuit: body.cuit || body.taxId || null,
        contactName: body.contactName || null,
        email: body.email || body.contactEmail || null,
        phone: body.phone || body.contactPhone || null,
        address: addressData,
        paymentTermDays: body.paymentTermDays || body.paymentTerms || 30,
        notes: body.notes || null,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json({
      success: true,
      data: supplier,
      message: 'Proveedor creado exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Supplier creation error:', err.message);

    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Ya existe un proveedor con este código' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Error creating supplier' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/inventory/suppliers
 * Update supplier
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user role
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar proveedores' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'ID del proveedor es requerido' },
        { status: 400 }
      );
    }

    // Check supplier exists
    const existingSupplier = await prisma.supplier.findFirst({
      where: {
        id: body.id,
        organizationId: session.organizationId,
      },
    });

    if (!existingSupplier) {
      return NextResponse.json(
        { success: false, error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.code !== undefined) updateData.code = body.code.toUpperCase();
    if (body.name !== undefined) updateData.name = body.name;
    if (body.cuit !== undefined || body.taxId !== undefined) updateData.cuit = body.cuit || body.taxId;
    if (body.contactName !== undefined) updateData.contactName = body.contactName;
    if (body.email !== undefined || body.contactEmail !== undefined) updateData.email = body.email || body.contactEmail;
    if (body.phone !== undefined || body.contactPhone !== undefined) updateData.phone = body.phone || body.contactPhone;
    if (body.address !== undefined) updateData.address = body.address;
    // Handle separate address fields by building JSON
    if (body.city !== undefined || body.state !== undefined || body.postalCode !== undefined || body.country !== undefined) {
      const currentAddress = existingSupplier.address as Record<string, any> || {};
      updateData.address = {
        ...currentAddress,
        city: body.city ?? currentAddress.city,
        province: body.state ?? currentAddress.province,
        postalCode: body.postalCode ?? currentAddress.postalCode,
        country: body.country ?? currentAddress.country ?? 'AR',
      };
    }
    if (body.paymentTermDays !== undefined || body.paymentTerms !== undefined) updateData.paymentTermDays = body.paymentTermDays || body.paymentTerms;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const supplier = await prisma.supplier.update({
      where: { id: body.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: supplier,
      message: 'Proveedor actualizado exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Supplier update error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error updating supplier' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/suppliers
 * Delete supplier
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user role
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para eliminar proveedores' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('id');
    const supplierProductId = searchParams.get('supplierProductId');

    // Remove product from supplier
    if (supplierProductId) {
      await prisma.supplierProduct.delete({
        where: { id: supplierProductId },
      });

      return NextResponse.json({
        success: true,
        message: 'Producto eliminado del proveedor',
      });
    }

    if (!supplierId) {
      return NextResponse.json(
        { success: false, error: 'ID del proveedor es requerido' },
        { status: 400 }
      );
    }

    // Check supplier exists
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: session.organizationId,
      },
      include: {
        _count: { select: { purchaseOrders: true } },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }

    // Check if supplier has orders
    if (supplier._count.purchaseOrders > 0) {
      // Soft delete
      await prisma.supplier.update({
        where: { id: supplierId },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: 'Proveedor desactivado (tiene órdenes de compra asociadas)',
      });
    }

    // Hard delete
    await prisma.supplier.delete({
      where: { id: supplierId },
    });

    return NextResponse.json({
      success: true,
      message: 'Proveedor eliminado exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Supplier deletion error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error deleting supplier' },
      { status: 500 }
    );
  }
}

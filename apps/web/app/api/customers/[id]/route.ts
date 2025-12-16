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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id: params.id,
        organizationId: session.organizationId,
      },
      include: {
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Filter data based on user role
    const filteredData = filterEntityByRole(customer, 'customer', userRole);
    const fieldMeta = getEntityFieldMetadata('customer', userRole);

    return NextResponse.json({
      success: true,
      data: filteredData,
      _fieldMeta: fieldMeta,
    });
  } catch (error) {
    console.error('Get customer error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching customer' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // First verify customer belongs to this organization
    const existing = await prisma.customer.findFirst({
      where: {
        id: params.id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Validate that user can edit the fields they're trying to update
    const validation = validateEntityUpdate(body, 'customer', userRole);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(' ') },
        { status: 403 }
      );
    }

    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address || {},
        notes: body.notes,
      },
    });

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('Update customer error:', error);
    return NextResponse.json(
      { success: false, error: 'Error updating customer' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // First verify customer belongs to this organization
    const existing = await prisma.customer.findFirst({
      where: {
        id: params.id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    await prisma.customer.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    return NextResponse.json(
      { success: false, error: 'Error deleting customer' },
      { status: 500 }
    );
  }
}

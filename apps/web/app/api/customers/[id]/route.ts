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
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Fetch customer with recent jobs and invoices
    const customer = await prisma.customer.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
      include: {
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            technician: {
              select: { id: true, name: true },
            },
          },
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

    // Get computed statistics
    const [jobCount, totalSpentResult, averageRatingResult] = await Promise.all([
      // Total job count
      prisma.job.count({
        where: { customerId: id },
      }),
      // Total spent from paid/sent invoices
      prisma.invoice.aggregate({
        where: {
          customerId: id,
          status: { in: ['PAID', 'SENT'] },
        },
        _sum: { total: true },
      }),
      // Average rating from reviews
      prisma.review.aggregate({
        where: {
          customerId: id,
          rating: { not: null },
        },
        _avg: { rating: true },
      }),
    ]);

    // Enrich customer with computed fields
    const enrichedCustomer = {
      ...customer,
      jobCount,
      totalSpent: Number(totalSpentResult._sum.total) || 0,
      averageRating: averageRatingResult._avg.rating || null,
    };

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Filter data based on user role
    const filteredData = filterEntityByRole(enrichedCustomer, 'customer', userRole);
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // First verify customer belongs to this organization
    const existing = await prisma.customer.findFirst({
      where: {
        id,
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

    // Build update data - only include fields that are provided
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.isVip !== undefined) updateData.isVip = body.isVip;
    if (body.customerNumber !== undefined) updateData.customerNumber = body.customerNumber;

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // First verify customer belongs to this organization
    const existing = await prisma.customer.findFirst({
      where: {
        id,
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
      where: { id },
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

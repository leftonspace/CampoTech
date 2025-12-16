import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  filterEntitiesByRole,
  getEntityFieldMetadata,
  UserRole,
} from '@/lib/middleware/field-filter';

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
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    const where: any = {
      organizationId: session.organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Filter data based on user role
    const filteredCustomers = filterEntitiesByRole(customers, 'customer', userRole);
    const fieldMeta = getEntityFieldMetadata('customer', userRole);

    return NextResponse.json({
      success: true,
      data: filteredCustomers,
      _fieldMeta: fieldMeta,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Customers list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching customers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address || {},
        notes: body.notes,
        organizationId: session.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creating customer' },
      { status: 500 }
    );
  }
}

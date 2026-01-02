import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  filterEntitiesByRole,
  getEntityFieldMetadata,
  UserRole,
} from '@/lib/middleware/field-filter';
import { CustomerService } from '@/services/customer.service';

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
    const filter = searchParams.get('filter'); // 'vip' | 'new' | 'frequent' | null
    const sort = searchParams.get('sort'); // 'name' | 'jobs' | 'revenue' | 'recent'

    const organizationId = session.organizationId;

    const result = await CustomerService.listCustomers(organizationId, {
      search: search || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filter: filter as any,
    }, {
      page,
      limit,
      sort: sort === 'jobs' ? 'jobCount' : (sort === 'revenue' ? 'totalSpent' : (sort || 'createdAt')),
      order: 'desc',
    });

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Filter data based on user role
    const filteredCustomers = filterEntitiesByRole(result.items, 'customer', userRole);
    const fieldMeta = getEntityFieldMetadata('customer', userRole);

    return NextResponse.json({
      success: true,
      data: filteredCustomers,
      _fieldMeta: fieldMeta,
      pagination: result.pagination,
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

    const customer = await CustomerService.createCustomer(session.organizationId, {
      name: body.name,
      phone: body.phone,
      email: body.email,
      address: body.address || {},
      notes: body.notes,
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

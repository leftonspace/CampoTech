import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  filterEntityByRole,
  getEntityFieldMetadata,
  validateEntityUpdate,
  UserRole,
} from '@/lib/middleware/field-filter';
import { CustomerService } from '@/src/services/customer.service';

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

    const customer = await CustomerService.getCustomerById(session.organizationId, id, {
      includeRecent: true
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

    // CustomerService.updateCustomer handles organizationId verification
    const customer = await CustomerService.updateCustomer(session.organizationId, id, body);

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('Update customer error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error updating customer' },
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

    await CustomerService.deleteCustomer(session.organizationId, id);

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

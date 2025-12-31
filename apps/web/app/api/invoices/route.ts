import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  filterEntitiesByRole,
  getEntityFieldMetadata,
  UserRole,
  canAccessModule,
} from '@/lib/middleware/field-filter';
import { onInvoiceCreated } from '@/src/modules/whatsapp/notification-triggers.service';
import { InvoiceService } from '@/services/invoice.service';

/**
 * Invoices API
 * List and create invoices
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
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Check module access - invoices are hidden from TECHNICIAN
    if (!canAccessModule('invoices', userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver facturas' },
        { status: 403 }
      );
    }

    const result = await InvoiceService.listInvoices(session.organizationId, {
      status: status || undefined,
      customerId: customerId || undefined,
    }, {
      page,
      limit,
    });

    // Filter data based on user role
    const filteredInvoices = filterEntitiesByRole(result.items, 'invoice', userRole);
    const fieldMeta = getEntityFieldMetadata('invoice', userRole);

    return NextResponse.json({
      success: true,
      data: filteredInvoices,
      _fieldMeta: fieldMeta,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Invoices list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching invoices' },
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
    const {
      customerId,
      asDraft,
    } = body;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: { message: 'Customer ID is required' } },
        { status: 400 }
      );
    }

    if (!body.lineItems || body.lineItems.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'At least one line item is required' } },
        { status: 400 }
      );
    }

    const invoice = await InvoiceService.createInvoice(session.organizationId, body);

    // Trigger WhatsApp notification for new invoice (non-blocking, only if not draft)
    if (!asDraft) {
      onInvoiceCreated(invoice.id, customerId, session.organizationId).catch((err) => {
        console.error('WhatsApp notification error:', err);
      });
    }

    return NextResponse.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error('Invoice create error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Error creating invoice' } },
      { status: 500 }
    );
  }
}

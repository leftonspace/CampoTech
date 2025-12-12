import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  filterEntitiesByRole,
  getEntityFieldMetadata,
  UserRole,
  canAccessModule,
} from '@/lib/middleware/field-filter';

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

    const where: any = {
      organizationId: session.organizationId,
    };

    if (status) {
      // Map frontend status values to enum values
      const statusMap: Record<string, string> = {
        'pending_cae': 'PENDING',
        'draft': 'DRAFT',
        'pending': 'PENDING',
        'sent': 'SENT',
        'paid': 'PAID',
        'overdue': 'OVERDUE',
        'cancelled': 'CANCELLED',
      };
      const mappedStatus = statusMap[status.toLowerCase()] || status.toUpperCase();
      // Only add to query if it's a valid status
      const validStatuses = ['DRAFT', 'PENDING', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];
      if (validStatuses.includes(mappedStatus)) {
        where.status = mappedStatus;
      }
    }

    if (customerId) {
      where.customerId = customerId;
    }

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'VIEWER') as UserRole;

    // Check module access - invoices are hidden from TECHNICIAN
    if (!canAccessModule('invoices', userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver facturas' },
        { status: 403 }
      );
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          lineItems: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    // Filter data based on user role
    const filteredInvoices = filterEntitiesByRole(invoices, 'invoice', userRole);
    const fieldMeta = getEntityFieldMetadata('invoice', userRole);

    return NextResponse.json({
      success: true,
      data: filteredInvoices,
      _fieldMeta: fieldMeta,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
      invoiceType,
      issueDate,
      dueDate,
      notes,
      jobId,
      lineItems,
      asDraft,
    } = body;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: { message: 'Customer ID is required' } },
        { status: 400 }
      );
    }

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'At least one line item is required' } },
        { status: 400 }
      );
    }

    // Calculate totals
    let subtotal = 0;
    let totalIva = 0;

    const processedLineItems = lineItems.map((item: any) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemIva = (itemSubtotal * item.ivaRate) / 100;
      subtotal += itemSubtotal;
      totalIva += itemIva;

      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.ivaRate || 21,
        subtotal: itemSubtotal,
        taxAmount: itemIva,
        total: itemSubtotal + itemIva,
      };
    });

    // Generate invoice number
    const lastInvoice = await prisma.invoice.findFirst({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });

    const nextNumber = lastInvoice?.invoiceNumber
      ? parseInt(lastInvoice.invoiceNumber.split('-')[1] || '0') + 1
      : 1;
    const invoiceNumber = `${invoiceType}-${String(nextNumber).padStart(8, '0')}`;

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: session.organizationId,
        customerId,
        invoiceNumber,
        type: invoiceType || 'FACTURA_C',
        status: asDraft ? 'DRAFT' : 'PENDING',
        issuedAt: issueDate ? new Date(issueDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        jobId: jobId || null,
        subtotal,
        taxAmount: totalIva,
        total: subtotal + totalIva,
        items: processedLineItems, // Required Json field
        lineItems: {
          create: processedLineItems,
        },
      },
      include: {
        customer: true,
        lineItems: true,
      },
    });

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

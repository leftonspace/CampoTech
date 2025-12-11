import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Payments API
 * List and create payments
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
    const invoiceId = searchParams.get('invoiceId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {
      organizationId: session.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              customer: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Payments list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching payments' },
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
    const { invoiceId, amount, method, reference, notes } = body;

    if (!invoiceId || !amount) {
      return NextResponse.json(
        { success: false, error: { message: 'Invoice ID and amount are required' } },
        { status: 400 }
      );
    }

    // Verify invoice exists and belongs to organization
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: session.organizationId,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: { message: 'Invoice not found' } },
        { status: 404 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        organizationId: session.organizationId,
        invoiceId,
        amount,
        method: method || 'cash',
        status: 'completed',
        reference,
        notes,
        paidAt: new Date(),
      },
      include: {
        invoice: true,
      },
    });

    // Update invoice status if fully paid
    const totalPaid = await prisma.payment.aggregate({
      where: {
        invoiceId,
        status: 'completed',
      },
      _sum: {
        amount: true,
      },
    });

    const paidAmount = totalPaid._sum.amount ? Number(totalPaid._sum.amount) : 0;
    const invoiceTotal = invoice.total ? Number(invoice.total) : 0;
    if (paidAmount >= invoiceTotal) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID' },
      });
    }

    return NextResponse.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error('Payment create error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Error creating payment' } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { onPaymentReceived } from '@/src/modules/whatsapp/notification-triggers.service';
import { PaymentService } from '@/services/payment.service';

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

    const result = await PaymentService.listPayments(session.organizationId, {
      status: status || undefined,
      invoiceId: invoiceId || undefined,
    }, {
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
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
    const { invoiceId, amount } = body;

    if (!invoiceId || !amount) {
      return NextResponse.json(
        { success: false, error: { message: 'Invoice ID and amount are required' } },
        { status: 400 }
      );
    }

    const payment = await PaymentService.createPayment(session.organizationId, body);

    // Trigger WhatsApp notification for payment received (non-blocking)
    onPaymentReceived(payment.id, payment.invoice.customerId, session.organizationId).catch((err) => {
      console.error('WhatsApp notification error:', err);
    });

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

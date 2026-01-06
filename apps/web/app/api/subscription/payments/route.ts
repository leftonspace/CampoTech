/**
 * Subscription Payments API
 * =========================
 *
 * GET /api/subscription/payments - Get payment history for subscription
 *
 * Returns paginated list of subscription payments for the organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Payment History
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only OWNER can view payment history (billing access is OWNER only)
    const allowedRoles = ['OWNER'];
    if (!allowedRoles.includes(session.role?.toUpperCase() || '')) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver el historial de pagos' },
        { status: 403 }
      );
    }

    // Get pagination params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

    // Validate pagination
    const validPage = Math.max(1, page);
    const validPageSize = Math.min(50, Math.max(1, pageSize));
    const skip = (validPage - 1) * validPageSize;

    // Get total count
    const total = await prisma.subscriptionPayment.count({
      where: {
        organizationId: session.organizationId,
      },
    });

    // Get payments
    const payments = await prisma.subscriptionPayment.findMany({
      where: {
        organizationId: session.organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: validPageSize,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        paymentMethod: true,
        paymentType: true,
        billingCycle: true,
        periodStart: true,
        periodEnd: true,
        failureReason: true,
        paidAt: true,
        createdAt: true,
        mpPaymentId: true,
      },
    });

    // Transform payments for response
    type PaymentEntry = (typeof payments)[number];
    const transformedPayments = payments.map((payment: PaymentEntry) => {
      // Parse payment method for card info
      let last4: string | undefined;
      let cardBrand: string | undefined;

      if (payment.paymentMethod) {
        try {
          const method = JSON.parse(payment.paymentMethod);
          last4 = method.last_four_digits;
          cardBrand = method.payment_method_id || method.issuer;
        } catch {
          // paymentMethod might not be JSON
        }
      }

      return {
        id: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        paymentType: payment.paymentType,
        last4,
        cardBrand,
        billingCycle: payment.billingCycle,
        periodStart: payment.periodStart?.toISOString(),
        periodEnd: payment.periodEnd?.toISOString(),
        paidAt: payment.paidAt?.toISOString(),
        failureReason: payment.failureReason,
        createdAt: payment.createdAt.toISOString(),
        // Invoice URL would come from AFIP integration if available
        invoiceUrl: null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        payments: transformedPayments,
        pagination: {
          page: validPage,
          pageSize: validPageSize,
          total,
          totalPages: Math.ceil(total / validPageSize),
        },
      },
    });
  } catch (error) {
    console.error('[Payments API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener historial de pagos' },
      { status: 500 }
    );
  }
}

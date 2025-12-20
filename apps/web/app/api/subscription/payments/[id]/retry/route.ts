/**
 * Retry Failed Payment API
 * ========================
 *
 * POST /api/subscription/payments/[id]/retry - Retry a failed payment
 *
 * Creates a new checkout preference for retrying a failed payment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createCheckoutPreference } from '@/lib/mercadopago/checkout';
import { logAuditEntry } from '@/lib/audit/logger';
import type { SubscriptionTier } from '@/lib/config/tier-limits';
import type { BillingCycle } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only OWNER can retry payments
    if (session.role?.toUpperCase() !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Solo el propietario puede reintentar pagos' },
        { status: 403 }
      );
    }

    const { id: paymentId } = await params;

    // Get the failed payment
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: {
        subscription: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Pago no encontrado' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (payment.organizationId !== session.organizationId) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para reintentar este pago' },
        { status: 403 }
      );
    }

    // Verify payment is failed
    if (payment.status !== 'failed') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden reintentar pagos fallidos' },
        { status: 400 }
      );
    }

    // Get organization for payer info
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        subscriptionTier: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      );
    }

    // Get user for payer info
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        name: true,
        email: true,
        phone: true,
      },
    });

    // Create new checkout preference
    const result = await createCheckoutPreference({
      organizationId: session.organizationId,
      tier: (payment.subscription?.tier || organization.subscriptionTier) as Exclude<SubscriptionTier, 'FREE'>,
      billingCycle: (payment.billingCycle || 'MONTHLY') as BillingCycle,
      userId: session.userId,
      payerEmail: user?.email || organization.email || undefined,
      payerName: user?.name || undefined,
      payerPhone: user?.phone || organization.phone || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Log retry attempt
    await logAuditEntry({
      organizationId: session.organizationId,
      userId: session.userId,
      userRole: session.role || 'OWNER',
      action: 'UPDATE',
      entityType: 'subscription_payment',
      entityId: paymentId,
      metadata: {
        action: 'retry',
        originalPaymentId: paymentId,
        newPreferenceId: result.preferenceId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        checkoutUrl: result.checkoutUrl,
        sandboxUrl: result.sandboxUrl,
        preferenceId: result.preferenceId,
      },
    });
  } catch (error) {
    console.error('[Retry Payment API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al reintentar pago' },
      { status: 500 }
    );
  }
}

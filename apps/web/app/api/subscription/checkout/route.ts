/**
 * Subscription Checkout API
 * =========================
 *
 * POST /api/subscription/checkout - Create checkout preference for subscription
 *
 * Creates a MercadoPago checkout preference and returns the checkout URL.
 * Only organization owners can initiate subscription purchases.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createCheckoutPreference } from '@/lib/mercadopago/checkout';
import { SUBSCRIPTION_PLANS, isMercadoPagoConfigured } from '@/lib/mercadopago/config';
import { isMercadoPagoConfigured as checkMPConfig } from '@/lib/mercadopago/client';
import { prisma } from '@/lib/prisma';
import { logAuditEntry } from '@/lib/audit/logger';
import type { SubscriptionTier } from '@/lib/config/tier-limits';
import type { BillingCycle } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create Checkout Preference
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only OWNER can purchase subscriptions
    if (session.role?.toUpperCase() !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Solo el propietario puede comprar suscripciones' },
        { status: 403 }
      );
    }

    // Check if MercadoPago is configured
    if (!checkMPConfig()) {
      console.error('[Checkout API] MercadoPago not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'El sistema de pagos no está configurado. Contacte soporte.',
          code: 'MP_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { tier, billingCycle } = body as {
      tier: string;
      billingCycle: string;
    };

    // Validate tier
    const validTiers: SubscriptionTier[] = ['INICIAL', 'PROFESIONAL', 'EMPRESA'];
    if (!tier || !validTiers.includes(tier as SubscriptionTier)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Plan no válido',
          validTiers,
        },
        { status: 400 }
      );
    }

    // Validate billing cycle
    const validCycles: BillingCycle[] = ['MONTHLY', 'YEARLY'];
    if (!billingCycle || !validCycles.includes(billingCycle as BillingCycle)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ciclo de facturación no válido',
          validCycles,
        },
        { status: 400 }
      );
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        subscriptionStatus: true,
        subscriptionTier: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      );
    }

    // Get user details for payer info
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    // Create checkout preference
    const result = await createCheckoutPreference({
      organizationId: session.organizationId,
      tier: tier as Exclude<SubscriptionTier, 'FREE'>,
      billingCycle: billingCycle as BillingCycle,
      userId: session.userId,
      payerEmail: user?.email || organization.email || undefined,
      payerName: user?.name || undefined,
      payerPhone: user?.phone || organization.phone || undefined,
    });

    if (!result.success) {
      console.error('[Checkout API] Failed to create preference:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: result.code,
        },
        { status: 400 }
      );
    }

    // Log the checkout initiation
    await logAuditEntry({
      organizationId: session.organizationId,
      userId: session.userId,
      userRole: session.role || 'OWNER',
      action: 'CREATE',
      entityType: 'subscription_checkout',
      entityId: result.preferenceId,
      metadata: {
        tier,
        billingCycle,
        preferenceId: result.preferenceId,
        expiresAt: result.expiresAt.toISOString(),
      },
    });

    // Get plan details for response
    const plan = SUBSCRIPTION_PLANS[tier as Exclude<SubscriptionTier, 'FREE'>];

    return NextResponse.json({
      success: true,
      data: {
        preferenceId: result.preferenceId,
        checkoutUrl: result.checkoutUrl,
        sandboxUrl: result.sandboxUrl,
        expiresAt: result.expiresAt.toISOString(),
        plan: {
          tier,
          name: plan.name,
          billingCycle,
          price: billingCycle === 'MONTHLY'
            ? plan.monthly.priceARS
            : plan.yearly.priceARS,
          currency: 'ARS',
        },
      },
    });
  } catch (error) {
    console.error('[Checkout API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al crear el checkout. Intente nuevamente.',
      },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Checkout Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Return available plans and pricing
    const plans = Object.entries(SUBSCRIPTION_PLANS).map(([tier, plan]) => ({
      tier,
      name: plan.name,
      description: plan.description,
      features: plan.features,
      monthly: {
        price: plan.monthly.priceARS,
        priceFormatted: new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
          minimumFractionDigits: 0,
        }).format(plan.monthly.priceARS),
      },
      yearly: {
        price: plan.yearly.priceARS,
        priceFormatted: new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
          minimumFractionDigits: 0,
        }).format(plan.yearly.priceARS),
        savings: plan.yearly.savingsPercent,
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        plans,
        paymentMethods: {
          creditCards: true,
          debitCards: true,
          cash: true,
          bankTransfer: true,
          mercadoPagoWallet: true,
          maxInstallments: 12,
        },
        configured: checkMPConfig(),
      },
    });
  } catch (error) {
    console.error('[Checkout API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener configuración' },
      { status: 500 }
    );
  }
}

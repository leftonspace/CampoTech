/**
 * MercadoPago Subscription Checkout
 * ==================================
 *
 * Creates checkout preferences for subscription payments.
 * Supports all payment methods: credit, debit, cash, transfer, wallet.
 */

import { getPreferenceAPI } from './client';
import {
  SUBSCRIPTION_PLANS,
  getPlanPrice,
  MAX_INSTALLMENTS,
  STATEMENT_DESCRIPTOR,
  PREFERENCE_EXPIRATION_MINUTES,
  getBackUrls,
  getNotificationUrl,
} from './config';
import type { SubscriptionTier } from '@/lib/config/tier-limits';
import type { BillingCycle } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateCheckoutPreferenceParams {
  organizationId: string;
  tier: Exclude<SubscriptionTier, 'FREE'>;
  billingCycle: BillingCycle;
  userId: string;
  payerEmail?: string;
  payerName?: string;
  payerPhone?: string;
}

export interface CheckoutPreferenceResult {
  success: true;
  preferenceId: string;
  checkoutUrl: string;
  sandboxUrl: string;
  expiresAt: Date;
}

export interface CheckoutPreferenceError {
  success: false;
  error: string;
  code?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTERNAL REFERENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate external reference for subscription payment
 * Format: sub_{orgId}_{tier}_{cycle}_{timestamp}
 */
export function generateExternalReference(
  organizationId: string,
  tier: SubscriptionTier,
  billingCycle: BillingCycle
): string {
  const timestamp = Date.now();
  return `sub_${organizationId}_${tier}_${billingCycle}_${timestamp}`;
}

/**
 * Parse external reference to get subscription details
 */
export function parseExternalReference(externalReference: string): {
  type: 'subscription';
  organizationId: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  timestamp: number;
} | null {
  if (!externalReference.startsWith('sub_')) return null;

  const parts = externalReference.split('_');
  if (parts.length !== 5) return null;

  const [, organizationId, tier, cycle, timestamp] = parts;

  return {
    type: 'subscription',
    organizationId,
    tier: tier as SubscriptionTier,
    billingCycle: cycle as BillingCycle,
    timestamp: parseInt(timestamp, 10),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKOUT PREFERENCE CREATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a MercadoPago checkout preference for subscription payment
 */
export async function createCheckoutPreference(
  params: CreateCheckoutPreferenceParams
): Promise<CheckoutPreferenceResult | CheckoutPreferenceError> {
  const { organizationId, tier, billingCycle, userId, payerEmail, payerName, payerPhone } = params;

  try {
    // Get plan details
    const plan = SUBSCRIPTION_PLANS[tier];
    if (!plan) {
      return {
        success: false,
        error: `Plan no válido: ${tier}`,
        code: 'INVALID_TIER',
      };
    }

    // Get pricing
    const { priceARS } = getPlanPrice(tier, billingCycle);

    // Get organization details for metadata
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    if (!organization) {
      return {
        success: false,
        error: 'Organización no encontrada',
        code: 'ORG_NOT_FOUND',
      };
    }

    // Build item description
    const periodLabel = billingCycle === 'MONTHLY' ? 'mensual' : 'anual';
    const itemTitle = `CampoTech ${plan.name} - Suscripción ${periodLabel}`;

    // Generate external reference
    const externalReference = generateExternalReference(organizationId, tier, billingCycle);

    // Calculate expiration
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PREFERENCE_EXPIRATION_MINUTES * 60 * 1000);

    // Get base URL for back URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.campotech.com';

    // Build payer info
    const payer: Record<string, unknown> = {};
    if (payerEmail || organization.email) {
      payer.email = payerEmail || organization.email;
    }
    if (payerName) {
      const nameParts = payerName.split(' ');
      payer.name = nameParts[0];
      if (nameParts.length > 1) {
        payer.surname = nameParts.slice(1).join(' ');
      }
    }
    if (payerPhone || organization.phone) {
      const phone = payerPhone || organization.phone;
      if (phone) {
        // Extract area code and number for Argentine phones
        const cleanPhone = phone.replace(/\D/g, '');
        payer.phone = {
          area_code: cleanPhone.slice(0, 2),
          number: cleanPhone.slice(2),
        };
      }
    }

    // Create preference using MercadoPago SDK
    const preferenceAPI = getPreferenceAPI();

    const preferenceData = {
      items: [
        {
          id: `${tier}_${billingCycle}`,
          title: itemTitle,
          description: plan.description,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: priceARS,
        },
      ],
      payer: Object.keys(payer).length > 0 ? payer : undefined,
      back_urls: getBackUrls(baseUrl),
      auto_return: 'approved' as const,
      notification_url: getNotificationUrl(baseUrl),
      external_reference: externalReference,
      statement_descriptor: STATEMENT_DESCRIPTOR,
      payment_methods: {
        // Accept all payment methods
        excluded_payment_methods: [],
        excluded_payment_types: [],
        // Maximum installments
        installments: MAX_INSTALLMENTS,
        // Default installments suggestion
        default_installments: 1,
      },
      expires: true,
      expiration_date_from: now.toISOString(),
      expiration_date_to: expiresAt.toISOString(),
      metadata: {
        organization_id: organizationId,
        organization_name: organization.name,
        tier,
        billing_cycle: billingCycle,
        user_id: userId,
        created_at: now.toISOString(),
      },
    };

    const response = await preferenceAPI.create({ body: preferenceData });

    if (!response.id || !response.init_point) {
      console.error('[Checkout] Invalid response from MercadoPago:', response);
      return {
        success: false,
        error: 'Respuesta inválida de MercadoPago',
        code: 'INVALID_RESPONSE',
      };
    }

    console.log('[Checkout] Preference created:', {
      preferenceId: response.id,
      organizationId,
      tier,
      billingCycle,
      amount: priceARS,
    });

    return {
      success: true,
      preferenceId: response.id,
      checkoutUrl: response.init_point,
      sandboxUrl: response.sandbox_init_point || response.init_point,
      expiresAt,
    };
  } catch (error) {
    console.error('[Checkout] Error creating preference:', error);

    // Handle specific MercadoPago errors
    if (error instanceof Error) {
      if (error.message.includes('invalid_token')) {
        return {
          success: false,
          error: 'Token de MercadoPago inválido. Contacte soporte.',
          code: 'INVALID_TOKEN',
        };
      }
      if (error.message.includes('rate_limit')) {
        return {
          success: false,
          error: 'Demasiadas solicitudes. Intente nuevamente en unos minutos.',
          code: 'RATE_LIMITED',
        };
      }
    }

    return {
      success: false,
      error: 'Error al crear el checkout. Intente nuevamente.',
      code: 'UNKNOWN_ERROR',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify a payment by external reference
 */
export async function verifyPaymentByReference(
  externalReference: string
): Promise<{
  found: boolean;
  status?: 'approved' | 'pending' | 'rejected' | 'cancelled';
  paymentId?: string;
  amount?: number;
}> {
  try {
    // This would typically query MercadoPago API to verify payment
    // For now, return not found - actual implementation would use Payment API
    console.log('[Checkout] Verifying payment for reference:', externalReference);

    return { found: false };
  } catch (error) {
    console.error('[Checkout] Error verifying payment:', error);
    return { found: false };
  }
}

/**
 * MercadoPago Subscription Configuration
 * ======================================
 *
 * Defines subscription plans, pricing, and MercadoPago plan IDs.
 * All prices are in ARS (Argentine Pesos).
 */

import type { SubscriptionTier } from '@/lib/config/tier-limits';
import type { BillingCycle } from '@/lib/types/subscription';

/**
 * Check if MercadoPago is properly configured
 */
export function isMercadoPagoConfigured(): boolean {
  return !!(
    process.env.MERCADOPAGO_ACCESS_TOKEN &&
    process.env.MERCADOPAGO_PUBLIC_KEY
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION PLANS
// ═══════════════════════════════════════════════════════════════════════════════

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  description: string;
  monthly: {
    priceARS: number;
    priceUSD: number;
    mpPlanId: string | null;
  };
  yearly: {
    priceARS: number;
    priceUSD: number;
    mpPlanId: string | null;
    savingsPercent: number;
  };
  features: string[];
}

/**
 * Subscription plans with pricing in ARS
 * Yearly plans include 17% discount
 */
export const SUBSCRIPTION_PLANS: Record<Exclude<SubscriptionTier, 'FREE'>, SubscriptionPlan> = {
  INICIAL: {
    tier: 'INICIAL',
    name: 'Inicial',
    description: 'Ideal para empezar tu negocio de servicios',
    monthly: {
      priceARS: 25000,
      priceUSD: 25,
      mpPlanId: process.env.MP_PLAN_INICIAL_MONTHLY || null,
    },
    yearly: {
      priceARS: 249000, // 25000 * 12 * 0.83 = 249,000
      priceUSD: 249,
      mpPlanId: process.env.MP_PLAN_INICIAL_YEARLY || null,
      savingsPercent: 17,
    },
    features: [
      'Hasta 5 usuarios',
      'Hasta 200 clientes',
      'Hasta 300 trabajos/mes',
      'Soporte por email',
    ],
  },
  PROFESIONAL: {
    tier: 'PROFESIONAL',
    name: 'Profesional',
    description: 'Para equipos en crecimiento',
    monthly: {
      priceARS: 55000,
      priceUSD: 55,
      mpPlanId: process.env.MP_PLAN_PROFESIONAL_MONTHLY || null,
    },
    yearly: {
      priceARS: 547800, // 55000 * 12 * 0.83 = 547,800
      priceUSD: 548,
      mpPlanId: process.env.MP_PLAN_PROFESIONAL_YEARLY || null,
      savingsPercent: 17,
    },
    features: [
      'Hasta 15 usuarios',
      'Hasta 1,000 clientes',
      'Hasta 1,000 trabajos/mes',
      'Integraciones avanzadas',
      'Soporte prioritario',
    ],
  },
  EMPRESA: {
    tier: 'EMPRESA',
    name: 'Empresa',
    description: 'Para operaciones a gran escala',
    monthly: {
      priceARS: 120000,
      priceUSD: 120,
      mpPlanId: process.env.MP_PLAN_EMPRESA_MONTHLY || null,
    },
    yearly: {
      priceARS: 1195200, // 120000 * 12 * 0.83 = 1,195,200
      priceUSD: 1195,
      mpPlanId: process.env.MP_PLAN_EMPRESA_YEARLY || null,
      savingsPercent: 17,
    },
    features: [
      'Usuarios ilimitados',
      'Clientes ilimitados',
      'Trabajos ilimitados',
      'API access',
      'Soporte dedicado',
      'SLA garantizado',
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get plan details by tier
 */
export function getPlanByTier(tier: SubscriptionTier): SubscriptionPlan | null {
  if (tier === 'FREE') return null;
  return SUBSCRIPTION_PLANS[tier] || null;
}

/**
 * Get price for a specific tier and billing cycle
 */
export function getPlanPrice(
  tier: Exclude<SubscriptionTier, 'FREE'>,
  billingCycle: BillingCycle
): { priceARS: number; priceUSD: number } {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (!plan) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  if (billingCycle === 'MONTHLY') {
    return {
      priceARS: plan.monthly.priceARS,
      priceUSD: plan.monthly.priceUSD,
    };
  }

  return {
    priceARS: plan.yearly.priceARS,
    priceUSD: plan.yearly.priceUSD,
  };
}

/**
 * Get MercadoPago plan ID for a tier and billing cycle
 */
export function getMPPlanId(
  tier: Exclude<SubscriptionTier, 'FREE'>,
  billingCycle: BillingCycle
): string | null {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (!plan) return null;

  return billingCycle === 'MONTHLY'
    ? plan.monthly.mpPlanId
    : plan.yearly.mpPlanId;
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: 'ARS' | 'USD' = 'ARS'): string {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get all available paid plans
 */
export function getAllPaidPlans(): SubscriptionPlan[] {
  return Object.values(SUBSCRIPTION_PLANS);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maximum installments (cuotas) allowed for subscription payments
 */
export const MAX_INSTALLMENTS = 12;

/**
 * Statement descriptor shown on customer's card statement
 */
export const STATEMENT_DESCRIPTOR = 'CampoTech';

/**
 * Checkout preference expiration in minutes
 */
export const PREFERENCE_EXPIRATION_MINUTES = 30;

/**
 * Back URLs for checkout flow
 */
export function getBackUrls(baseUrl: string) {
  return {
    success: `${baseUrl}/checkout/success`,
    failure: `${baseUrl}/checkout/failure`,
    pending: `${baseUrl}/checkout/pending`,
  };
}

/**
 * Webhook notification URL
 */
export function getNotificationUrl(baseUrl: string): string {
  return `${baseUrl}/api/webhooks/mercadopago/subscription`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT METHODS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PaymentMethodInfo {
  id: string;
  name: string;
  type: 'credit_card' | 'debit_card' | 'ticket' | 'bank_transfer' | 'wallet';
  icon: string;
  description?: string;
}

/**
 * Accepted payment methods in Argentina
 */
export const ACCEPTED_PAYMENT_METHODS: PaymentMethodInfo[] = [
  // Credit Cards
  { id: 'visa', name: 'Visa', type: 'credit_card', icon: 'visa' },
  { id: 'master', name: 'Mastercard', type: 'credit_card', icon: 'mastercard' },
  { id: 'amex', name: 'American Express', type: 'credit_card', icon: 'amex' },
  { id: 'naranja', name: 'Naranja', type: 'credit_card', icon: 'naranja' },
  { id: 'cabal', name: 'Cabal', type: 'credit_card', icon: 'cabal' },
  { id: 'cencosud', name: 'Cencosud', type: 'credit_card', icon: 'cencosud' },
  { id: 'tarshop', name: 'Tarjeta Shopping', type: 'credit_card', icon: 'tarshop' },
  { id: 'diners', name: 'Diners', type: 'credit_card', icon: 'diners' },
  // Debit Cards
  { id: 'debvisa', name: 'Visa Débito', type: 'debit_card', icon: 'visa' },
  { id: 'debmaster', name: 'Mastercard Débito', type: 'debit_card', icon: 'mastercard' },
  { id: 'maestro', name: 'Maestro', type: 'debit_card', icon: 'maestro' },
  { id: 'debcabal', name: 'Cabal Débito', type: 'debit_card', icon: 'cabal' },
  // Cash payments
  { id: 'pagofacil', name: 'Pago Fácil', type: 'ticket', icon: 'pagofacil', description: 'Pagá en efectivo en sucursales Pago Fácil' },
  { id: 'rapipago', name: 'Rapipago', type: 'ticket', icon: 'rapipago', description: 'Pagá en efectivo en sucursales Rapipago' },
  // Bank Transfer
  { id: 'pse', name: 'Transferencia Bancaria', type: 'bank_transfer', icon: 'bank', description: 'Transferencia desde tu homebanking' },
  // Wallet
  { id: 'account_money', name: 'Dinero en Mercado Pago', type: 'wallet', icon: 'mercadopago', description: 'Usá el saldo de tu cuenta de Mercado Pago' },
];

/**
 * Group payment methods by type
 */
export function groupPaymentMethods() {
  return {
    creditCards: ACCEPTED_PAYMENT_METHODS.filter(m => m.type === 'credit_card'),
    debitCards: ACCEPTED_PAYMENT_METHODS.filter(m => m.type === 'debit_card'),
    cash: ACCEPTED_PAYMENT_METHODS.filter(m => m.type === 'ticket'),
    bankTransfer: ACCEPTED_PAYMENT_METHODS.filter(m => m.type === 'bank_transfer'),
    wallet: ACCEPTED_PAYMENT_METHODS.filter(m => m.type === 'wallet'),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTALLMENTS (CUOTAS)
// ═══════════════════════════════════════════════════════════════════════════════

export interface InstallmentOption {
  installments: number;
  interestFree: boolean;
  description: string;
}

/**
 * Available installment options
 * Note: Interest-free options depend on agreements with card issuers
 */
export const INSTALLMENT_OPTIONS: InstallmentOption[] = [
  { installments: 1, interestFree: true, description: 'Pago único' },
  { installments: 3, interestFree: true, description: '3 cuotas sin interés' },
  { installments: 6, interestFree: false, description: '6 cuotas' },
  { installments: 9, interestFree: false, description: '9 cuotas' },
  { installments: 12, interestFree: false, description: '12 cuotas' },
];

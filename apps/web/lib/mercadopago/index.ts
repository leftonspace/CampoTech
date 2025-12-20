/**
 * MercadoPago Subscription Module
 * ================================
 *
 * Exports all MercadoPago subscription-related functionality.
 */

// Client initialization
export {
  getMercadoPagoClient,
  getPreferenceAPI,
  getPaymentAPI,
  getPublicKey,
  isMercadoPagoConfigured,
} from './client';

// Configuration and pricing
export {
  SUBSCRIPTION_PLANS,
  getPlanByTier,
  getPlanPrice,
  getMPPlanId,
  formatPrice,
  getAllPaidPlans,
  MAX_INSTALLMENTS,
  STATEMENT_DESCRIPTOR,
  PREFERENCE_EXPIRATION_MINUTES,
  getBackUrls,
  getNotificationUrl,
  ACCEPTED_PAYMENT_METHODS,
  groupPaymentMethods,
  INSTALLMENT_OPTIONS,
  type SubscriptionPlan,
  type PaymentMethodInfo,
  type InstallmentOption,
} from './config';

// Checkout functionality
export {
  createCheckoutPreference,
  generateExternalReference,
  parseExternalReference,
  verifyPaymentByReference,
  type CreateCheckoutPreferenceParams,
  type CheckoutPreferenceResult,
  type CheckoutPreferenceError,
} from './checkout';

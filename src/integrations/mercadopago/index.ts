/**
 * MercadoPago Integration Module
 * ==============================
 *
 * Complete integration with MercadoPago for payment processing in Argentina.
 *
 * Components:
 * - OAuth: Authentication and token management
 * - Preference: Payment checkout creation
 * - Webhook: Payment notification handling
 * - Cuotas: Installment plans and TEA/CFT calculation
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export * from './mercadopago.types';

// ═══════════════════════════════════════════════════════════════════════════════
// OAUTH (AUTHENTICATION)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  generateAuthorizationUrl,
  generateState,
  validateState,
  exchangeCodeForTokens,
  refreshAccessToken,
  areCredentialsValid,
  credentialsNeedRefresh,
  makeAuthenticatedRequest,
  getCachedCredentials,
  setCachedCredentials,
  invalidateCredentials,
  clearCredentialCache,
  ensureValidCredentials,
  MPTokenManager,
  getCacheStats,
} from './oauth';
export type {
  AuthorizationUrlParams,
  TokenManagerConfig,
  CacheStats,
} from './oauth';

// ═══════════════════════════════════════════════════════════════════════════════
// PREFERENCE (CHECKOUT)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  buildPreferenceItems,
  buildPayerInfo,
  buildPaymentMethods,
  buildPreferenceRequest,
  generateExternalReference,
  parseExternalReference,
  createPreference,
  getPreference,
  updatePreference,
  createSimplePreference,
  calculatePreferenceTotal,
} from './preference';
export type {
  InvoiceLineItem,
  CustomerInfo,
  PreferenceBuildOptions,
  CreatePreferenceResult,
  CreatePreferenceError,
} from './preference';

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK (NOTIFICATIONS)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  validateWebhookSignature,
  validateSimpleSignature,
  generateIdempotencyKey,
  wasWebhookProcessed,
  markWebhookProcessed,
  cleanupIdempotencyCache,
  parseWebhookNotification,
  fetchPayment,
  processWebhook,
  mapPaymentStatus,
  isPaymentFinal,
  paymentRequiresAction,
} from './webhook';
export type { WebhookContext } from './webhook';

// ═══════════════════════════════════════════════════════════════════════════════
// CUOTAS (INSTALLMENTS)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  calculateTEACFT,
  fetchInstallmentOptions,
  processInstallmentOptions,
  getInstallmentOptionsForDisplay,
  validateInstallmentPlan,
  getInterestFreeOptions,
  getBestInstallmentOption,
} from './cuotas';
export type {
  InstallmentOption,
  PromotionalInstallment,
} from './cuotas';

// ═══════════════════════════════════════════════════════════════════════════════
// CHARGEBACK (DISPUTES)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  ChargebackHandler,
  getChargebackHandler,
  processChargebackWebhook,
} from './chargeback';
export type {
  Chargeback,
  ChargebackStatus,
  ChargebackReason,
  ChargebackProcessResult,
  ChargebackEvidence,
} from './chargeback';

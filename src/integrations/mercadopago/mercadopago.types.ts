/**
 * MercadoPago Integration Types
 * =============================
 *
 * Type definitions for MercadoPago payment integration.
 * Includes OAuth, preferences, webhooks, and installments.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export type MPEnvironment = 'sandbox' | 'production';

export interface MPConfig {
  environment: MPEnvironment;
  appId: string;
  clientSecret: string;
  redirectUri: string;
  webhookSecret?: string;
}

export interface MPCredentials {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: Date;
  scope: string;
  userId: number;
  publicKey?: string;
}

export const MP_API_BASE_URL = 'https://api.mercadopago.com';
export const MP_AUTH_URL = 'https://auth.mercadopago.com/authorization';

// ═══════════════════════════════════════════════════════════════════════════════
// OAUTH
// ═══════════════════════════════════════════════════════════════════════════════

export interface OAuthTokenRequest {
  grant_type: 'authorization_code' | 'refresh_token';
  client_id: string;
  client_secret: string;
  code?: string;
  refresh_token?: string;
  redirect_uri?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key: string;
}

export interface OAuthError {
  error: string;
  error_description?: string;
  status: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT METHODS
// ═══════════════════════════════════════════════════════════════════════════════

export type PaymentMethodType =
  | 'credit_card'
  | 'debit_card'
  | 'account_money'
  | 'ticket'      // Cash payment (e.g., Rapipago, Pago Fácil)
  | 'atm'
  | 'bank_transfer';

export type PaymentMethodId =
  | 'visa'
  | 'master'
  | 'amex'
  | 'naranja'
  | 'cabal'
  | 'tarshop'
  | 'debvisa'
  | 'debmaster'
  | 'maestro'
  | 'account_money'
  | 'rapipago'
  | 'pagofacil'
  | 'cbu';

export interface PaymentMethod {
  id: PaymentMethodId;
  name: string;
  type: PaymentMethodType;
  status: 'active' | 'deactivated' | 'temporally_deactivated';
  thumbnail: string;
  minAllowedAmount: number;
  maxAllowedAmount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT PREFERENCE
// ═══════════════════════════════════════════════════════════════════════════════

export interface PreferenceItem {
  id?: string;
  title: string;
  description?: string;
  pictureUrl?: string;
  categoryId?: string;
  quantity: number;
  currencyId?: 'ARS' | 'USD';
  unitPrice: number;
}

export interface PreferencePayer {
  name?: string;
  surname?: string;
  email: string;
  phone?: {
    areaCode?: string;
    number: string;
  };
  identification?: {
    type: 'DNI' | 'CUIT' | 'CUIL';
    number: string;
  };
  address?: {
    streetName?: string;
    streetNumber?: number;
    zipCode?: string;
  };
}

export interface PreferenceBackUrls {
  success: string;
  failure: string;
  pending: string;
}

export interface PreferencePaymentMethods {
  excludedPaymentMethods?: { id: string }[];
  excludedPaymentTypes?: { id: string }[];
  installments?: number;
  defaultInstallments?: number;
  defaultPaymentMethodId?: string;
}

export interface CreatePreferenceRequest {
  items: PreferenceItem[];
  payer?: PreferencePayer;
  backUrls?: PreferenceBackUrls;
  autoReturn?: 'approved' | 'all';
  paymentMethods?: PreferencePaymentMethods;
  notificationUrl?: string;
  statementDescriptor?: string;
  externalReference?: string;
  expires?: boolean;
  expirationDateFrom?: string;
  expirationDateTo?: string;
  metadata?: Record<string, any>;
}

export interface PreferenceResponse {
  id: string;
  initPoint: string;
  sandboxInitPoint: string;
  dateCreated: string;
  externalReference?: string;
  items: PreferenceItem[];
  payer?: PreferencePayer;
  backUrls?: PreferenceBackUrls;
  notificationUrl?: string;
  collectorId: number;
  expirationDateTo?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════

export type PaymentStatus =
  | 'pending'
  | 'approved'
  | 'authorized'
  | 'in_process'
  | 'in_mediation'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

export type PaymentStatusDetail =
  | 'accredited'
  | 'pending_contingency'
  | 'pending_review_manual'
  | 'cc_rejected_bad_filled_card_number'
  | 'cc_rejected_bad_filled_date'
  | 'cc_rejected_bad_filled_other'
  | 'cc_rejected_bad_filled_security_code'
  | 'cc_rejected_blacklist'
  | 'cc_rejected_call_for_authorize'
  | 'cc_rejected_card_disabled'
  | 'cc_rejected_card_error'
  | 'cc_rejected_duplicated_payment'
  | 'cc_rejected_high_risk'
  | 'cc_rejected_insufficient_amount'
  | 'cc_rejected_invalid_installments'
  | 'cc_rejected_max_attempts'
  | 'cc_rejected_other_reason';

export interface Payment {
  id: number;
  dateCreated: string;
  dateApproved?: string;
  dateLastUpdated: string;
  moneyReleaseDate?: string;
  operationType: 'regular_payment' | 'money_transfer' | 'recurring_payment';
  payerId: number;
  payerEmail?: string;
  payerIdentification?: {
    type: string;
    number: string;
  };
  status: PaymentStatus;
  statusDetail: PaymentStatusDetail;
  currencyId: 'ARS';
  description?: string;
  externalReference?: string;
  paymentMethodId: PaymentMethodId;
  paymentTypeId: PaymentMethodType;
  transactionAmount: number;
  transactionAmountRefunded?: number;
  netReceivedAmount?: number;
  installments: number;
  installmentAmount?: number;
  feeDetails?: {
    type: string;
    feePayer: 'collector' | 'payer';
    amount: number;
  }[];
  captured?: boolean;
  card?: {
    id: number;
    lastFourDigits: string;
    firstSixDigits: string;
    expirationMonth: number;
    expirationYear: number;
    cardholderName?: string;
  };
  statementDescriptor?: string;
  notificationUrl?: string;
  refunds?: PaymentRefund[];
}

export interface PaymentRefund {
  id: number;
  paymentId: number;
  amount: number;
  status: 'approved' | 'rejected' | 'pending';
  dateCreated: string;
  source: {
    id: string;
    name: string;
    type: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export type WebhookTopic =
  | 'payment'
  | 'chargebacks'
  | 'merchant_orders';

export type WebhookAction =
  | 'payment.created'
  | 'payment.updated'
  | 'chargeback.created'
  | 'chargeback.updated';

export interface WebhookNotification {
  id: number;
  liveMode: boolean;
  type: WebhookTopic;
  dateCreated: string;
  userId: number;
  apiVersion: string;
  action: WebhookAction;
  data: {
    id: string;
  };
}

export interface WebhookProcessResult {
  success: boolean;
  action: WebhookAction;
  paymentId?: string;
  invoiceId?: string;
  status?: PaymentStatus;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTALLMENTS / CUOTAS
// ═══════════════════════════════════════════════════════════════════════════════

export interface InstallmentOption {
  installments: number;
  installmentRate: number;
  discountRate: number;
  reimbursementRate?: number;
  labels: string[];
  installmentRateCollector?: string[];
  minAllowedAmount: number;
  maxAllowedAmount: number;
  recommendedMessage?: string;
  installmentAmount: number;
  totalAmount: number;
  paymentMethodOptionId?: string;
}

export interface PayerCost {
  installments: number;
  installmentRate: number;
  discountRate: number;
  labels: string[];
  installmentAmount: number;
  totalAmount: number;
  minAllowedAmount: number;
  maxAllowedAmount: number;
}

export interface InstallmentsResponse {
  paymentMethodId: PaymentMethodId;
  paymentTypeId: PaymentMethodType;
  issuer: {
    id: string;
    name: string;
  };
  processingMode: string;
  merchantAccountId?: string;
  payerCosts: PayerCost[];
}

/**
 * TEA/CFT calculation result
 * Required for BCRA compliance
 */
export interface TEACFTResult {
  tea: number;        // Tasa Efectiva Anual (%)
  cft: number;        // Costo Financiero Total (%)
  cftLabel: string;   // "CFT: XX.XX%"
  monthlyRate: number;
  totalInterest: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECONCILIATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReconciliationItem {
  mpPaymentId: string;
  localPaymentId?: string;
  status: 'missing_local' | 'status_mismatch' | 'amount_mismatch' | 'synced';
  mpStatus?: PaymentStatus;
  localStatus?: string;
  mpAmount?: number;
  localAmount?: number;
  externalReference?: string;
  discrepancy?: string;
}

export interface ReconciliationResult {
  totalProcessed: number;
  synced: number;
  created: number;
  updated: number;
  discrepancies: number;
  items: ReconciliationItem[];
  startTime: Date;
  endTime: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

export type MPErrorType = 'transient' | 'permanent' | 'authentication';

export interface MPError {
  code: string;
  message: string;
  status: number;
  cause?: Array<{
    code: string;
    description: string;
  }>;
}

export const MP_ERROR_CODES: Record<string, { type: MPErrorType; message: string }> = {
  'invalid_token': { type: 'authentication', message: 'Token inválido' },
  'expired_token': { type: 'authentication', message: 'Token expirado' },
  'invalid_client': { type: 'permanent', message: 'Cliente inválido' },
  'rate_limit': { type: 'transient', message: 'Límite de requests excedido' },
  'service_unavailable': { type: 'transient', message: 'Servicio no disponible' },
  'bad_request': { type: 'permanent', message: 'Solicitud inválida' },
};

export function classifyMPError(error: MPError | Error): MPErrorType {
  if ('status' in error) {
    if (error.status === 401 || error.status === 403) return 'authentication';
    if (error.status >= 500 || error.status === 429) return 'transient';
  }

  if ('code' in error && typeof error.code === 'string') {
    const knownError = MP_ERROR_CODES[error.code];
    if (knownError) return knownError.type;
  }

  return 'permanent';
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MPPaymentRecord {
  id: string;
  orgId: string;
  invoiceId: string;
  mpPaymentId?: string;
  mpPreferenceId?: string;
  externalReference: string;
  amount: number;
  currency: 'ARS';
  status: PaymentStatus | 'pending_preference';
  paymentMethod?: PaymentMethodType;
  installments: number;
  installmentAmount?: number;
  tea?: number;
  cft?: number;
  webhookIdempotencyKey?: string;
  mpResponse?: Payment;
  createdAt: Date;
  updatedAt: Date;
}

export interface MPJobData {
  paymentId: string;
  webhookId?: string;
  action: 'process_webhook' | 'reconcile' | 'create_preference';
  attempt: number;
}

export interface MPJobResult {
  success: boolean;
  paymentId?: string;
  action: string;
  error?: string;
  processedAt: Date;
}

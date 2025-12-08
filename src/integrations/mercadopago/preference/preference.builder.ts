/**
 * MercadoPago Payment Preference Builder
 * ======================================
 *
 * Builds and creates payment preferences (checkout links) for MercadoPago.
 * Handles line items, payer info, back URLs, and payment method configuration.
 */

import {
  CreatePreferenceRequest,
  PreferenceItem,
  PreferencePayer,
  PreferenceBackUrls,
  PreferencePaymentMethods,
  PreferenceResponse,
  MP_API_BASE_URL,
} from '../mercadopago.types';
import { makeAuthenticatedRequest } from '../oauth';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE TO PREFERENCE CONVERSION
// ═══════════════════════════════════════════════════════════════════════════════

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  productCode?: string;
}

export interface CustomerInfo {
  name?: string;
  email: string;
  phone?: string;
  documentType?: 'DNI' | 'CUIT' | 'CUIL';
  documentNumber?: string;
}

export interface PreferenceBuildOptions {
  invoiceId: string;
  orgId: string;
  items: InvoiceLineItem[];
  customer?: CustomerInfo;
  backUrls?: PreferenceBackUrls;
  notificationUrl?: string;
  maxInstallments?: number;
  excludedPaymentMethods?: string[];
  excludedPaymentTypes?: string[];
  expirationMinutes?: number;
  metadata?: Record<string, any>;
}

/**
 * Build preference items from invoice line items
 */
export function buildPreferenceItems(lineItems: InvoiceLineItem[]): PreferenceItem[] {
  return lineItems.map((item, index) => ({
    id: item.productCode || `item-${index}`,
    title: item.description,
    quantity: item.quantity,
    currencyId: 'ARS',
    unitPrice: Math.round(item.unitPrice * 100) / 100, // Round to 2 decimals
  }));
}

/**
 * Build payer info from customer
 */
export function buildPayerInfo(customer?: CustomerInfo): PreferencePayer | undefined {
  if (!customer) return undefined;

  const payer: PreferencePayer = {
    email: customer.email,
  };

  if (customer.name) {
    const nameParts = customer.name.split(' ');
    payer.name = nameParts[0];
    payer.surname = nameParts.slice(1).join(' ') || undefined;
  }

  if (customer.phone) {
    payer.phone = {
      number: customer.phone.replace(/\D/g, ''),
    };
  }

  if (customer.documentType && customer.documentNumber) {
    payer.identification = {
      type: customer.documentType,
      number: customer.documentNumber,
    };
  }

  return payer;
}

/**
 * Build payment methods configuration
 */
export function buildPaymentMethods(options: {
  maxInstallments?: number;
  excludedPaymentMethods?: string[];
  excludedPaymentTypes?: string[];
}): PreferencePaymentMethods {
  const paymentMethods: PreferencePaymentMethods = {};

  if (options.maxInstallments) {
    paymentMethods.installments = options.maxInstallments;
  }

  if (options.excludedPaymentMethods?.length) {
    paymentMethods.excludedPaymentMethods = options.excludedPaymentMethods.map((id) => ({ id }));
  }

  if (options.excludedPaymentTypes?.length) {
    paymentMethods.excludedPaymentTypes = options.excludedPaymentTypes.map((id) => ({ id }));
  }

  return paymentMethods;
}

/**
 * Generate external reference for payment tracking
 */
export function generateExternalReference(invoiceId: string, orgId: string): string {
  return `${orgId}:${invoiceId}`;
}

/**
 * Parse external reference to get invoice and org IDs
 */
export function parseExternalReference(
  externalReference: string
): { orgId: string; invoiceId: string } | null {
  const parts = externalReference.split(':');
  if (parts.length !== 2) return null;

  return {
    orgId: parts[0],
    invoiceId: parts[1],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREFERENCE BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a complete preference request
 */
export function buildPreferenceRequest(options: PreferenceBuildOptions): CreatePreferenceRequest {
  const items = buildPreferenceItems(options.items);
  const payer = buildPayerInfo(options.customer);
  const paymentMethods = buildPaymentMethods({
    maxInstallments: options.maxInstallments,
    excludedPaymentMethods: options.excludedPaymentMethods,
    excludedPaymentTypes: options.excludedPaymentTypes,
  });

  const externalReference = generateExternalReference(options.invoiceId, options.orgId);

  const request: CreatePreferenceRequest = {
    items,
    externalReference,
    autoReturn: 'approved',
  };

  if (payer) {
    request.payer = payer;
  }

  if (options.backUrls) {
    request.backUrls = options.backUrls;
  }

  if (options.notificationUrl) {
    request.notificationUrl = options.notificationUrl;
  }

  if (Object.keys(paymentMethods).length > 0) {
    request.paymentMethods = paymentMethods;
  }

  // Set expiration if specified
  if (options.expirationMinutes) {
    request.expires = true;
    const now = new Date();
    const expiry = new Date(now.getTime() + options.expirationMinutes * 60 * 1000);
    request.expirationDateFrom = now.toISOString();
    request.expirationDateTo = expiry.toISOString();
  }

  // Add metadata
  if (options.metadata) {
    request.metadata = options.metadata;
  }

  return request;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreatePreferenceResult {
  success: true;
  preference: PreferenceResponse;
  checkoutUrl: string;
  sandboxUrl: string;
}

export interface CreatePreferenceError {
  success: false;
  error: string;
  status?: number;
}

/**
 * Create a payment preference via MercadoPago API
 */
export async function createPreference(
  accessToken: string,
  request: CreatePreferenceRequest
): Promise<CreatePreferenceResult | CreatePreferenceError> {
  log.info('Creating payment preference', {
    items: request.items.length,
    externalReference: request.externalReference,
  });

  const result = await makeAuthenticatedRequest<PreferenceResponse>(
    accessToken,
    'POST',
    '/checkout/preferences',
    request
  );

  if (!result.success) {
    log.error('Failed to create preference', {
      error: result.error,
      status: result.status,
    });
    return {
      success: false,
      error: result.error,
      status: result.status,
    };
  }

  const preference = result.data;

  log.info('Preference created successfully', {
    preferenceId: preference.id,
    checkoutUrl: preference.initPoint,
  });

  return {
    success: true,
    preference,
    checkoutUrl: preference.initPoint,
    sandboxUrl: preference.sandboxInitPoint,
  };
}

/**
 * Get preference by ID
 */
export async function getPreference(
  accessToken: string,
  preferenceId: string
): Promise<{ success: true; preference: PreferenceResponse } | CreatePreferenceError> {
  const result = await makeAuthenticatedRequest<PreferenceResponse>(
    accessToken,
    'GET',
    `/checkout/preferences/${preferenceId}`
  );

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      status: result.status,
    };
  }

  return {
    success: true,
    preference: result.data,
  };
}

/**
 * Update preference
 */
export async function updatePreference(
  accessToken: string,
  preferenceId: string,
  updates: Partial<CreatePreferenceRequest>
): Promise<{ success: true; preference: PreferenceResponse } | CreatePreferenceError> {
  const result = await makeAuthenticatedRequest<PreferenceResponse>(
    accessToken,
    'PUT',
    `/checkout/preferences/${preferenceId}`,
    updates
  );

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      status: result.status,
    };
  }

  return {
    success: true,
    preference: result.data,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a simple preference for a single item
 */
export async function createSimplePreference(
  accessToken: string,
  options: {
    title: string;
    unitPrice: number;
    quantity?: number;
    payerEmail: string;
    externalReference: string;
    notificationUrl?: string;
  }
): Promise<CreatePreferenceResult | CreatePreferenceError> {
  const request: CreatePreferenceRequest = {
    items: [
      {
        title: options.title,
        quantity: options.quantity || 1,
        currencyId: 'ARS',
        unitPrice: options.unitPrice,
      },
    ],
    payer: {
      email: options.payerEmail,
    },
    externalReference: options.externalReference,
    autoReturn: 'approved',
  };

  if (options.notificationUrl) {
    request.notificationUrl = options.notificationUrl;
  }

  return createPreference(accessToken, request);
}

/**
 * Calculate total amount from preference items
 */
export function calculatePreferenceTotal(items: PreferenceItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

/**
 * MercadoPago Subscription Client
 * ===============================
 *
 * Simplified MercadoPago client for subscription payments.
 * Uses the platform access token for subscription operations.
 */

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

let mpClient: MercadoPagoConfig | null = null;

/**
 * Get or initialize the MercadoPago client
 */
export function getMercadoPagoClient(): MercadoPagoConfig {
  if (!mpClient) {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('MP_ACCESS_TOKEN environment variable is not set');
    }

    mpClient = new MercadoPagoConfig({
      accessToken,
      options: {
        timeout: 30000,
      },
    });
  }

  return mpClient;
}

/**
 * Get Preference API instance
 */
export function getPreferenceAPI() {
  const client = getMercadoPagoClient();
  return new Preference(client);
}

/**
 * Get Payment API instance
 */
export function getPaymentAPI() {
  const client = getMercadoPagoClient();
  return new Payment(client);
}

/**
 * Get the public key for frontend checkout
 */
export function getPublicKey(): string {
  const publicKey = process.env.MP_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error('MP_PUBLIC_KEY environment variable is not set');
  }
  return publicKey;
}

/**
 * Check if MercadoPago is properly configured
 */
export function isMercadoPagoConfigured(): boolean {
  return !!(process.env.MP_ACCESS_TOKEN && process.env.MP_PUBLIC_KEY);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MPPreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  date_created: string;
  external_reference?: string;
}

export interface MPPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  external_reference?: string;
  transaction_amount: number;
  currency_id: string;
  date_created: string;
  date_approved?: string;
  payment_method_id: string;
  payment_type_id: string;
  installments: number;
}

/**
 * MercadoPago SDK Type Declarations
 *
 * Minimal type declarations for the mercadopago SDK.
 * These types are based on the MercadoPago Node.js SDK v2.
 */

declare module 'mercadopago' {
  export interface MercadoPagoConfigOptions {
    timeout?: number;
    idempotencyKey?: string;
  }

  export interface MercadoPagoConfigParams {
    accessToken: string;
    options?: MercadoPagoConfigOptions;
  }

  export class MercadoPagoConfig {
    constructor(params: MercadoPagoConfigParams);
    accessToken: string;
    options?: MercadoPagoConfigOptions;
  }

  export interface PreferenceItem {
    id?: string;
    title: string;
    description?: string;
    category_id?: string;
    quantity: number;
    currency_id?: string;
    unit_price: number;
  }

  export interface PreferencePayer {
    name?: string;
    surname?: string;
    email: string;
    phone?: {
      area_code?: string;
      number?: string;
    };
    identification?: {
      type?: string;
      number?: string;
    };
    address?: {
      street_name?: string;
      street_number?: number;
      zip_code?: string;
    };
  }

  export interface PreferenceBackUrls {
    success?: string;
    pending?: string;
    failure?: string;
  }

  export interface PreferenceRequest {
    items: PreferenceItem[];
    payer?: PreferencePayer | Record<string, unknown>;
    back_urls?: PreferenceBackUrls;
    auto_return?: 'approved' | 'all';
    payment_methods?: {
      excluded_payment_methods?: Array<{ id: string }>;
      excluded_payment_types?: Array<{ id: string }>;
      installments?: number;
    };
    notification_url?: string;
    statement_descriptor?: string;
    external_reference?: string;
    expires?: boolean;
    expiration_date_from?: string;
    expiration_date_to?: string;
    metadata?: Record<string, unknown>;
  }

  export interface PreferenceResponse {
    id: string;
    init_point: string;
    sandbox_init_point: string;
    date_created: string;
    items: PreferenceItem[];
    payer?: PreferencePayer;
    back_urls?: PreferenceBackUrls;
    external_reference?: string;
    metadata?: Record<string, unknown>;
  }

  export interface PreferenceGetParams {
    preferenceId: string;
  }

  export class Preference {
    constructor(client: MercadoPagoConfig);
    create(params: { body: PreferenceRequest }): Promise<{ id: string; init_point: string; sandbox_init_point: string }>;
    get(params: PreferenceGetParams): Promise<PreferenceResponse>;
  }

  export interface PaymentResponse {
    id: number;
    date_created: string;
    date_approved: string | null;
    date_last_updated: string;
    money_release_date: string | null;
    collector_id: number;
    operation_type: string;
    payer: {
      id: string | null;
      email: string;
      identification: {
        type: string;
        number: string;
      } | null;
      type: string | null;
    };
    binary_mode: boolean;
    live_mode: boolean;
    order: Record<string, unknown>;
    external_reference: string | null;
    description: string;
    metadata: Record<string, unknown>;
    currency_id: string;
    transaction_amount: number;
    transaction_amount_refunded: number;
    coupon_amount: number;
    transaction_details: {
      net_received_amount: number;
      total_paid_amount: number;
      overpaid_amount: number;
      installment_amount: number;
    };
    fee_details: Array<{
      type: string;
      amount: number;
      fee_payer: string;
    }>;
    captured: boolean;
    status: 'pending' | 'approved' | 'authorized' | 'in_process' | 'in_mediation' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';
    status_detail: string;
    payment_method_id: string;
    payment_type_id: string;
    issuer_id: string | null;
    installments: number;
    card: {
      id: string | null;
      first_six_digits: string;
      last_four_digits: string;
      expiration_month: number;
      expiration_year: number;
      date_created: string;
      date_last_updated: string;
      cardholder: {
        name: string;
        identification: {
          number: string;
          type: string;
        };
      };
    } | null;
    statement_descriptor: string | null;
    notification_url: string | null;
    refunds: unknown[];
    processing_mode: string;
    merchant_account_id: string | null;
    merchant_number: string | null;
    acquirer_reconciliation: unknown[];
  }

  export class Payment {
    constructor(client: MercadoPagoConfig);
    get(params: { id: string }): Promise<PaymentResponse>;
    capture(params: { id: string; transaction_amount?: number }): Promise<PaymentResponse>;
    cancel(params: { id: string }): Promise<PaymentResponse>;
  }
}

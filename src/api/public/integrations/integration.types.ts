/**
 * Integration Types
 * ==================
 *
 * Type definitions for third-party integrations.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// BASE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type IntegrationProvider =
  | 'google_calendar'
  | 'quickbooks'
  | 'zapier'
  | 'slack'
  | 'mercadopago';

export type IntegrationStatus =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'pending';

export interface Integration {
  id: string;
  org_id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  config: Record<string, any>;
  credentials?: IntegrationCredentials;
  last_sync_at?: Date;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface IntegrationCredentials {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: Date;
  api_key?: string;
  realm_id?: string;
}

export interface SyncResult {
  success: boolean;
  items_synced: number;
  items_failed: number;
  errors?: SyncError[];
  started_at: Date;
  completed_at: Date;
}

export interface SyncError {
  item_id?: string;
  item_type?: string;
  error: string;
  details?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE CALENDAR TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface GoogleCalendarConfig {
  calendar_id: string;
  sync_jobs: boolean;
  sync_direction: 'one_way' | 'two_way';
  default_duration_minutes: number;
  event_color?: string;
  include_customer_info: boolean;
  include_address: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICKBOOKS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface QuickBooksConfig {
  realm_id: string;
  sync_customers: boolean;
  sync_invoices: boolean;
  sync_payments: boolean;
  default_income_account?: string;
  default_tax_code?: string;
  auto_create_customers: boolean;
}

export interface QuickBooksCustomer {
  Id?: string;
  DisplayName: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
}

export interface QuickBooksInvoice {
  Id?: string;
  DocNumber?: string;
  CustomerRef: { value: string };
  Line: QuickBooksInvoiceLine[];
  DueDate?: string;
  TotalAmt?: number;
  Balance?: number;
}

export interface QuickBooksInvoiceLine {
  Amount: number;
  Description?: string;
  DetailType: 'SalesItemLineDetail';
  SalesItemLineDetail: {
    ItemRef?: { value: string };
    Qty?: number;
    UnitPrice?: number;
    TaxCodeRef?: { value: string };
  };
}

export interface QuickBooksPayment {
  Id?: string;
  TotalAmt: number;
  CustomerRef: { value: string };
  PaymentMethodRef?: { value: string };
  Line?: Array<{
    Amount: number;
    LinkedTxn?: Array<{
      TxnId: string;
      TxnType: 'Invoice';
    }>;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZAPIER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ZapierConfig {
  api_key: string;
  enabled_triggers: string[];
  enabled_actions: string[];
}

export interface ZapierTrigger {
  id: string;
  name: string;
  description: string;
  event_type: string;
  sample_data: Record<string, any>;
}

export interface ZapierAction {
  id: string;
  name: string;
  description: string;
  action_type: string;
  input_fields: ZapierField[];
  output_fields: ZapierField[];
}

export interface ZapierField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'text';
  required?: boolean;
  helpText?: string;
  choices?: Array<{ value: string; label: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntegrationEvent {
  id: string;
  integration_id: string;
  event_type: 'sync_started' | 'sync_completed' | 'sync_failed' | 'item_synced' | 'item_failed';
  data: Record<string, any>;
  created_at: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntegrationProviderConfig {
  google_calendar: {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    scopes: string[];
  };
  quickbooks: {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    environment: 'sandbox' | 'production';
  };
  zapier: {
    client_id: string;
    allowed_scopes: string[];
  };
}

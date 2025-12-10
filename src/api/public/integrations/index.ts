/**
 * Integrations Module
 * ===================
 *
 * Pre-built integrations for third-party services.
 * Provides ready-to-use connectors for popular platforms.
 */

// Types
export {
  IntegrationProvider,
  IntegrationStatus,
  BaseIntegrationConfig,
  IntegrationCredentials,
  IntegrationConnection,
  SyncDirection,
  SyncFrequency,
  SyncStatus,
  SyncResult,
  SyncLog,
  FieldMapping,
  MappingConfig,
  IntegrationError,
  IntegrationErrorCode,
  createIntegrationError,
} from './integration.types';

// Google Calendar Integration
export {
  GoogleCalendarService,
  createGoogleCalendarService,
  GoogleCalendarConfig,
  CalendarEvent,
  CalendarSyncOptions,
  GoogleCalendarCredentials,
} from './google-calendar.service';

// QuickBooks Integration
export {
  QuickBooksService,
  createQuickBooksService,
  QuickBooksConfig,
  QuickBooksCredentials,
  QuickBooksCustomer,
  QuickBooksInvoice,
  QuickBooksPayment,
  QuickBooksSyncOptions,
} from './quickbooks.service';

// Zapier Integration
export {
  ZapierService,
  createZapierService,
  ZapierConfig,
  ZapierTrigger,
  ZapierAction,
  ZapierWebhook,
  TriggerType,
  ActionType,
  AVAILABLE_TRIGGERS,
  AVAILABLE_ACTIONS,
} from './zapier.service';

// Integration Registry
export interface IntegrationRegistry {
  googleCalendar: typeof import('./google-calendar.service').GoogleCalendarService;
  quickbooks: typeof import('./quickbooks.service').QuickBooksService;
  zapier: typeof import('./zapier.service').ZapierService;
}

// Factory function for creating integrations
export interface CreateIntegrationOptions {
  provider: 'google_calendar' | 'quickbooks' | 'zapier';
  config: any;
}

/**
 * Get available integrations and their capabilities
 */
export function getAvailableIntegrations() {
  return {
    google_calendar: {
      name: 'Google Calendar',
      description: 'Sync jobs with Google Calendar',
      capabilities: ['sync_jobs', 'create_events', 'update_events', 'delete_events'],
      authType: 'oauth2',
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      setupUrl: '/integrations/google-calendar/setup',
    },
    quickbooks: {
      name: 'QuickBooks Online',
      description: 'Sync customers, invoices, and payments with QuickBooks',
      capabilities: [
        'sync_customers',
        'sync_invoices',
        'sync_payments',
        'create_invoices',
        'record_payments',
      ],
      authType: 'oauth2',
      scopes: ['com.intuit.quickbooks.accounting'],
      setupUrl: '/integrations/quickbooks/setup',
    },
    zapier: {
      name: 'Zapier',
      description: 'Connect with 5000+ apps via Zapier',
      capabilities: ['triggers', 'actions', 'webhooks'],
      authType: 'api_key',
      triggers: [
        'new_customer',
        'new_job',
        'job_completed',
        'new_invoice',
        'invoice_paid',
        'new_payment',
      ],
      actions: [
        'create_customer',
        'create_job',
        'create_invoice',
        'update_job_status',
        'send_invoice',
      ],
      setupUrl: '/integrations/zapier/setup',
    },
  };
}

/**
 * Validate integration configuration
 */
export function validateIntegrationConfig(
  provider: string,
  config: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (provider) {
    case 'google_calendar':
      if (!config.clientId) errors.push('clientId is required');
      if (!config.clientSecret) errors.push('clientSecret is required');
      if (!config.redirectUri) errors.push('redirectUri is required');
      break;

    case 'quickbooks':
      if (!config.clientId) errors.push('clientId is required');
      if (!config.clientSecret) errors.push('clientSecret is required');
      if (!config.redirectUri) errors.push('redirectUri is required');
      if (!config.environment) errors.push('environment is required (sandbox or production)');
      break;

    case 'zapier':
      if (!config.webhookSecret) errors.push('webhookSecret is required');
      break;

    default:
      errors.push(`Unknown provider: ${provider}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

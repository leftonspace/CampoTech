/**
 * QuickBooks Integration Service
 * ===============================
 *
 * Service for syncing customers, invoices, and payments with QuickBooks Online.
 */

import { Pool } from 'pg';
import {
  Integration,
  QuickBooksConfig,
  QuickBooksCustomer,
  QuickBooksInvoice,
  QuickBooksPayment,
  SyncResult,
  SyncError,
  IntegrationCredentials,
} from './integration.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface QuickBooksServiceConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
}

const QUICKBOOKS_OAUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QUICKBOOKS_API_SANDBOX = 'https://sandbox-quickbooks.api.intuit.com';
const QUICKBOOKS_API_PRODUCTION = 'https://quickbooks.api.intuit.com';

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class QuickBooksService {
  private apiBaseUrl: string;

  constructor(
    private pool: Pool,
    private config: QuickBooksServiceConfig
  ) {
    this.apiBaseUrl = config.environment === 'production'
      ? QUICKBOOKS_API_PRODUCTION
      : QUICKBOOKS_API_SANDBOX;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OAUTH FLOW
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      state,
    });

    return `${QUICKBOOKS_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, realmId: string): Promise<IntegrationCredentials> {
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expires_at: new Date(Date.now() + data.expires_in * 1000),
      realm_id: realmId,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<IntegrationCredentials> {
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expires_at: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INTEGRATION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Connect QuickBooks integration
   */
  async connect(
    orgId: string,
    credentials: IntegrationCredentials,
    config: Partial<QuickBooksConfig>
  ): Promise<Integration> {
    const defaultConfig: QuickBooksConfig = {
      realm_id: credentials.realm_id!,
      sync_customers: true,
      sync_invoices: true,
      sync_payments: true,
      auto_create_customers: true,
      ...config,
    };

    const result = await this.pool.query(
      `INSERT INTO integrations (
        org_id, provider, status, config, credentials, created_at, updated_at
      )
      VALUES ($1, 'quickbooks', 'connected', $2, $3, NOW(), NOW())
      ON CONFLICT (org_id, provider)
      DO UPDATE SET
        status = 'connected',
        config = $2,
        credentials = $3,
        error_message = NULL,
        updated_at = NOW()
      RETURNING *`,
      [orgId, JSON.stringify(defaultConfig), JSON.stringify(credentials)]
    );

    return this.mapRowToIntegration(result.rows[0]);
  }

  /**
   * Disconnect integration
   */
  async disconnect(orgId: string): Promise<void> {
    await this.pool.query(
      `UPDATE integrations
       SET status = 'disconnected', credentials = NULL, updated_at = NOW()
       WHERE org_id = $1 AND provider = 'quickbooks'`,
      [orgId]
    );
  }

  /**
   * Get integration for an organization
   */
  async getIntegration(orgId: string): Promise<Integration | null> {
    const result = await this.pool.query(
      `SELECT * FROM integrations WHERE org_id = $1 AND provider = 'quickbooks'`,
      [orgId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToIntegration(result.rows[0]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CUSTOMER SYNC
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Sync a customer to QuickBooks
   */
  async syncCustomer(integration: Integration, customer: any): Promise<string> {
    const accessToken = await this.getValidAccessToken(integration);
    const realmId = (integration.config as QuickBooksConfig).realm_id;

    // Check for existing mapping
    const mappingResult = await this.pool.query(
      `SELECT remote_id FROM integration_mappings
       WHERE integration_id = $1 AND local_type = 'customer' AND local_id = $2 AND remote_type = 'qb_customer'`,
      [integration.id, customer.id]
    );

    const qbCustomer: QuickBooksCustomer = {
      DisplayName: customer.name,
      GivenName: customer.name.split(' ')[0],
      FamilyName: customer.name.split(' ').slice(1).join(' ') || undefined,
      PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
      PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
      BillAddr: customer.address ? {
        Line1: customer.address.street,
        City: customer.address.city,
        CountrySubDivisionCode: customer.address.state,
        PostalCode: customer.address.postal_code,
        Country: customer.address.country,
      } : undefined,
    };

    let qbCustomerId: string;

    if (mappingResult.rows.length > 0) {
      // Update existing customer
      qbCustomer.Id = mappingResult.rows[0].remote_id;

      // Get SyncToken
      const existingCustomer = await this.qbApiRequest(
        'GET',
        `/v3/company/${realmId}/customer/${qbCustomer.Id}`,
        accessToken
      );
      (qbCustomer as any).SyncToken = existingCustomer.Customer.SyncToken;

      const response = await this.qbApiRequest(
        'POST',
        `/v3/company/${realmId}/customer`,
        accessToken,
        qbCustomer
      );
      qbCustomerId = response.Customer.Id;
    } else {
      // Create new customer
      const response = await this.qbApiRequest(
        'POST',
        `/v3/company/${realmId}/customer`,
        accessToken,
        qbCustomer
      );
      qbCustomerId = response.Customer.Id;

      // Store mapping
      await this.pool.query(
        `INSERT INTO integration_mappings (integration_id, local_type, local_id, remote_type, remote_id, created_at)
         VALUES ($1, 'customer', $2, 'qb_customer', $3, NOW())`,
        [integration.id, customer.id, qbCustomerId]
      );
    }

    return qbCustomerId;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INVOICE SYNC
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Sync an invoice to QuickBooks
   */
  async syncInvoice(integration: Integration, invoice: any): Promise<string> {
    const accessToken = await this.getValidAccessToken(integration);
    const realmId = (integration.config as QuickBooksConfig).realm_id;

    // Get or create QuickBooks customer
    let qbCustomerId = await this.getQbCustomerId(integration, invoice.customer_id);
    if (!qbCustomerId) {
      // Sync customer first
      const customerResult = await this.pool.query(
        `SELECT * FROM customers WHERE id = $1`,
        [invoice.customer_id]
      );
      if (customerResult.rows.length > 0) {
        qbCustomerId = await this.syncCustomer(integration, customerResult.rows[0]);
      } else {
        throw new Error('Customer not found');
      }
    }

    // Check for existing mapping
    const mappingResult = await this.pool.query(
      `SELECT remote_id FROM integration_mappings
       WHERE integration_id = $1 AND local_type = 'invoice' AND local_id = $2 AND remote_type = 'qb_invoice'`,
      [integration.id, invoice.id]
    );

    const qbInvoice: QuickBooksInvoice = {
      CustomerRef: { value: qbCustomerId },
      Line: invoice.line_items.map((item: any) => ({
        Amount: item.quantity * item.unit_price - (item.discount || 0),
        Description: item.description,
        DetailType: 'SalesItemLineDetail' as const,
        SalesItemLineDetail: {
          Qty: item.quantity,
          UnitPrice: item.unit_price,
        },
      })),
      DueDate: invoice.due_date ? invoice.due_date.split('T')[0] : undefined,
    };

    let qbInvoiceId: string;

    if (mappingResult.rows.length > 0) {
      // Update existing invoice
      qbInvoice.Id = mappingResult.rows[0].remote_id;

      // Get SyncToken
      const existingInvoice = await this.qbApiRequest(
        'GET',
        `/v3/company/${realmId}/invoice/${qbInvoice.Id}`,
        accessToken
      );
      (qbInvoice as any).SyncToken = existingInvoice.Invoice.SyncToken;

      const response = await this.qbApiRequest(
        'POST',
        `/v3/company/${realmId}/invoice`,
        accessToken,
        qbInvoice
      );
      qbInvoiceId = response.Invoice.Id;
    } else {
      // Create new invoice
      const response = await this.qbApiRequest(
        'POST',
        `/v3/company/${realmId}/invoice`,
        accessToken,
        qbInvoice
      );
      qbInvoiceId = response.Invoice.Id;

      // Store mapping
      await this.pool.query(
        `INSERT INTO integration_mappings (integration_id, local_type, local_id, remote_type, remote_id, created_at)
         VALUES ($1, 'invoice', $2, 'qb_invoice', $3, NOW())`,
        [integration.id, invoice.id, qbInvoiceId]
      );
    }

    return qbInvoiceId;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAYMENT SYNC
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Sync a payment to QuickBooks
   */
  async syncPayment(integration: Integration, payment: any): Promise<string> {
    const accessToken = await this.getValidAccessToken(integration);
    const realmId = (integration.config as QuickBooksConfig).realm_id;

    // Get QuickBooks customer ID
    const qbCustomerId = await this.getQbCustomerId(integration, payment.customer_id);
    if (!qbCustomerId) {
      throw new Error('Customer not synced to QuickBooks');
    }

    // Get QuickBooks invoice ID if linked
    let qbInvoiceId: string | undefined;
    if (payment.invoice_id) {
      qbInvoiceId = await this.getQbInvoiceId(integration, payment.invoice_id);
    }

    const qbPayment: QuickBooksPayment = {
      TotalAmt: payment.amount,
      CustomerRef: { value: qbCustomerId },
    };

    if (qbInvoiceId) {
      qbPayment.Line = [{
        Amount: payment.amount,
        LinkedTxn: [{
          TxnId: qbInvoiceId,
          TxnType: 'Invoice',
        }],
      }];
    }

    const response = await this.qbApiRequest(
      'POST',
      `/v3/company/${realmId}/payment`,
      accessToken,
      qbPayment
    );

    const qbPaymentId = response.Payment.Id;

    // Store mapping
    await this.pool.query(
      `INSERT INTO integration_mappings (integration_id, local_type, local_id, remote_type, remote_id, created_at)
       VALUES ($1, 'payment', $2, 'qb_payment', $3, NOW())
       ON CONFLICT (integration_id, local_type, local_id, remote_type)
       DO UPDATE SET remote_id = $3, updated_at = NOW()`,
      [integration.id, payment.id, qbPaymentId]
    );

    return qbPaymentId;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FULL SYNC
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Full sync of all data to QuickBooks
   */
  async syncAll(orgId: string): Promise<SyncResult> {
    const startedAt = new Date();
    const errors: SyncError[] = [];
    let itemsSynced = 0;
    let itemsFailed = 0;

    const integration = await this.getIntegration(orgId);
    if (!integration || integration.status !== 'connected') {
      throw new Error('QuickBooks integration not connected');
    }

    const config = integration.config as QuickBooksConfig;

    // Sync customers
    if (config.sync_customers) {
      const customersResult = await this.pool.query(
        `SELECT * FROM customers WHERE org_id = $1`,
        [orgId]
      );

      for (const customer of customersResult.rows) {
        try {
          await this.syncCustomer(integration, customer);
          itemsSynced++;
        } catch (error: any) {
          itemsFailed++;
          errors.push({
            item_id: customer.id,
            item_type: 'customer',
            error: error.message,
          });
        }
      }
    }

    // Sync invoices
    if (config.sync_invoices) {
      const invoicesResult = await this.pool.query(
        `SELECT * FROM invoices WHERE org_id = $1 AND status != 'draft'`,
        [orgId]
      );

      for (const invoice of invoicesResult.rows) {
        try {
          await this.syncInvoice(integration, invoice);
          itemsSynced++;
        } catch (error: any) {
          itemsFailed++;
          errors.push({
            item_id: invoice.id,
            item_type: 'invoice',
            error: error.message,
          });
        }
      }
    }

    // Sync payments
    if (config.sync_payments) {
      const paymentsResult = await this.pool.query(
        `SELECT * FROM payments WHERE org_id = $1 AND status = 'completed'`,
        [orgId]
      );

      for (const payment of paymentsResult.rows) {
        try {
          await this.syncPayment(integration, payment);
          itemsSynced++;
        } catch (error: any) {
          itemsFailed++;
          errors.push({
            item_id: payment.id,
            item_type: 'payment',
            error: error.message,
          });
        }
      }
    }

    // Update last sync time
    await this.pool.query(
      `UPDATE integrations SET last_sync_at = NOW() WHERE id = $1`,
      [integration.id]
    );

    return {
      success: itemsFailed === 0,
      items_synced: itemsSynced,
      items_failed: itemsFailed,
      errors: errors.length > 0 ? errors : undefined,
      started_at: startedAt,
      completed_at: new Date(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private async getValidAccessToken(integration: Integration): Promise<string> {
    const credentials = integration.credentials!;

    if (credentials.expires_at && new Date(credentials.expires_at) <= new Date()) {
      const newCredentials = await this.refreshToken(credentials.refresh_token!);
      newCredentials.realm_id = credentials.realm_id;

      await this.pool.query(
        `UPDATE integrations SET credentials = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(newCredentials), integration.id]
      );

      return newCredentials.access_token!;
    }

    return credentials.access_token!;
  }

  private async qbApiRequest(
    method: string,
    path: string,
    accessToken: string,
    body?: any
  ): Promise<any> {
    const url = `${this.apiBaseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ Fault: { Error: [{ Message: 'Unknown error' }] } }));
      throw new Error(error.Fault?.Error?.[0]?.Message || 'QuickBooks API request failed');
    }

    return response.json();
  }

  private async getQbCustomerId(integration: Integration, customerId: string): Promise<string | null> {
    const result = await this.pool.query(
      `SELECT remote_id FROM integration_mappings
       WHERE integration_id = $1 AND local_type = 'customer' AND local_id = $2 AND remote_type = 'qb_customer'`,
      [integration.id, customerId]
    );
    return result.rows[0]?.remote_id || null;
  }

  private async getQbInvoiceId(integration: Integration, invoiceId: string): Promise<string | null> {
    const result = await this.pool.query(
      `SELECT remote_id FROM integration_mappings
       WHERE integration_id = $1 AND local_type = 'invoice' AND local_id = $2 AND remote_type = 'qb_invoice'`,
      [integration.id, invoiceId]
    );
    return result.rows[0]?.remote_id || null;
  }

  private mapRowToIntegration(row: any): Integration {
    return {
      id: row.id,
      org_id: row.org_id,
      provider: row.provider,
      status: row.status,
      config: row.config,
      credentials: row.credentials,
      last_sync_at: row.last_sync_at,
      error_message: row.error_message,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createQuickBooksService(
  pool: Pool,
  config: QuickBooksServiceConfig
): QuickBooksService {
  return new QuickBooksService(pool, config);
}

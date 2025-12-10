/**
 * Google Calendar Integration Service
 * =====================================
 *
 * Service for syncing jobs with Google Calendar.
 */

import { Pool } from 'pg';
import {
  Integration,
  GoogleCalendarConfig,
  GoogleCalendarEvent,
  SyncResult,
  SyncError,
  IntegrationCredentials,
} from './integration.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface GoogleCalendarServiceConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class GoogleCalendarService {
  private config: GoogleCalendarServiceConfig;

  constructor(
    private pool: Pool,
    config: GoogleCalendarServiceConfig
  ) {
    this.config = {
      ...config,
      scopes: config.scopes || DEFAULT_SCOPES,
    };
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
      scope: this.config.scopes!.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<IntegrationCredentials> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
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
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<IntegrationCredentials> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();

    return {
      access_token: data.access_token,
      refresh_token: refreshToken,
      token_type: data.token_type,
      expires_at: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INTEGRATION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Connect Google Calendar integration
   */
  async connect(
    orgId: string,
    credentials: IntegrationCredentials,
    config: Partial<GoogleCalendarConfig>
  ): Promise<Integration> {
    const defaultConfig: GoogleCalendarConfig = {
      calendar_id: 'primary',
      sync_jobs: true,
      sync_direction: 'one_way',
      default_duration_minutes: 60,
      include_customer_info: true,
      include_address: true,
      ...config,
    };

    const result = await this.pool.query(
      `INSERT INTO integrations (
        org_id, provider, status, config, credentials, created_at, updated_at
      )
      VALUES ($1, 'google_calendar', 'connected', $2, $3, NOW(), NOW())
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
       WHERE org_id = $1 AND provider = 'google_calendar'`,
      [orgId]
    );
  }

  /**
   * Get integration for an organization
   */
  async getIntegration(orgId: string): Promise<Integration | null> {
    const result = await this.pool.query(
      `SELECT * FROM integrations WHERE org_id = $1 AND provider = 'google_calendar'`,
      [orgId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToIntegration(result.rows[0]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CALENDAR OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List user's calendars
   */
  async listCalendars(accessToken: string): Promise<any[]> {
    const response = await this.googleApiRequest(
      'GET',
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      accessToken
    );

    return response.items || [];
  }

  /**
   * Create calendar event for a job
   */
  async createEventForJob(
    integration: Integration,
    job: any
  ): Promise<GoogleCalendarEvent> {
    const config = integration.config as GoogleCalendarConfig;
    const accessToken = await this.getValidAccessToken(integration);

    const event = this.jobToCalendarEvent(job, config);

    const response = await this.googleApiRequest(
      'POST',
      `https://www.googleapis.com/calendar/v3/calendars/${config.calendar_id}/events`,
      accessToken,
      event
    );

    // Store event mapping
    await this.pool.query(
      `INSERT INTO integration_mappings (integration_id, local_type, local_id, remote_type, remote_id, created_at)
       VALUES ($1, 'job', $2, 'calendar_event', $3, NOW())
       ON CONFLICT (integration_id, local_type, local_id, remote_type)
       DO UPDATE SET remote_id = $3, updated_at = NOW()`,
      [integration.id, job.id, response.id]
    );

    return response;
  }

  /**
   * Update calendar event for a job
   */
  async updateEventForJob(
    integration: Integration,
    job: any
  ): Promise<GoogleCalendarEvent | null> {
    const config = integration.config as GoogleCalendarConfig;
    const accessToken = await this.getValidAccessToken(integration);

    // Get existing event mapping
    const mappingResult = await this.pool.query(
      `SELECT remote_id FROM integration_mappings
       WHERE integration_id = $1 AND local_type = 'job' AND local_id = $2 AND remote_type = 'calendar_event'`,
      [integration.id, job.id]
    );

    if (mappingResult.rows.length === 0) {
      // No existing event, create new one
      return this.createEventForJob(integration, job);
    }

    const eventId = mappingResult.rows[0].remote_id;
    const event = this.jobToCalendarEvent(job, config);

    try {
      const response = await this.googleApiRequest(
        'PUT',
        `https://www.googleapis.com/calendar/v3/calendars/${config.calendar_id}/events/${eventId}`,
        accessToken,
        event
      );
      return response;
    } catch (error: any) {
      if (error.status === 404) {
        // Event was deleted, create new one
        return this.createEventForJob(integration, job);
      }
      throw error;
    }
  }

  /**
   * Delete calendar event for a job
   */
  async deleteEventForJob(integration: Integration, jobId: string): Promise<void> {
    const config = integration.config as GoogleCalendarConfig;
    const accessToken = await this.getValidAccessToken(integration);

    // Get event mapping
    const mappingResult = await this.pool.query(
      `SELECT remote_id FROM integration_mappings
       WHERE integration_id = $1 AND local_type = 'job' AND local_id = $2 AND remote_type = 'calendar_event'`,
      [integration.id, jobId]
    );

    if (mappingResult.rows.length === 0) return;

    const eventId = mappingResult.rows[0].remote_id;

    try {
      await this.googleApiRequest(
        'DELETE',
        `https://www.googleapis.com/calendar/v3/calendars/${config.calendar_id}/events/${eventId}`,
        accessToken
      );
    } catch (error: any) {
      // Ignore 404 errors (event already deleted)
      if (error.status !== 404) throw error;
    }

    // Remove mapping
    await this.pool.query(
      `DELETE FROM integration_mappings
       WHERE integration_id = $1 AND local_type = 'job' AND local_id = $2 AND remote_type = 'calendar_event'`,
      [integration.id, jobId]
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SYNC OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Sync all jobs to Google Calendar
   */
  async syncJobs(orgId: string): Promise<SyncResult> {
    const startedAt = new Date();
    const errors: SyncError[] = [];
    let itemsSynced = 0;
    let itemsFailed = 0;

    const integration = await this.getIntegration(orgId);
    if (!integration || integration.status !== 'connected') {
      throw new Error('Google Calendar integration not connected');
    }

    const config = integration.config as GoogleCalendarConfig;
    if (!config.sync_jobs) {
      return {
        success: true,
        items_synced: 0,
        items_failed: 0,
        started_at: startedAt,
        completed_at: new Date(),
      };
    }

    // Get scheduled jobs
    const jobsResult = await this.pool.query(
      `SELECT j.*, c.name as customer_name, c.phone as customer_phone
       FROM jobs j
       LEFT JOIN customers c ON j.customer_id = c.id
       WHERE j.org_id = $1
         AND j.status IN ('scheduled', 'assigned', 'en_route', 'in_progress')
         AND j.scheduled_start IS NOT NULL`,
      [orgId]
    );

    for (const job of jobsResult.rows) {
      try {
        await this.updateEventForJob(integration, job);
        itemsSynced++;
      } catch (error: any) {
        itemsFailed++;
        errors.push({
          item_id: job.id,
          item_type: 'job',
          error: error.message,
        });
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

    // Check if token needs refresh
    if (credentials.expires_at && new Date(credentials.expires_at) <= new Date()) {
      const newCredentials = await this.refreshToken(credentials.refresh_token!);

      await this.pool.query(
        `UPDATE integrations SET credentials = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(newCredentials), integration.id]
      );

      return newCredentials.access_token!;
    }

    return credentials.access_token!;
  }

  private async googleApiRequest(
    method: string,
    url: string,
    accessToken: string,
    body?: any
  ): Promise<any> {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      const err = new Error(error.error?.message || 'Google API request failed') as any;
      err.status = response.status;
      throw err;
    }

    if (response.status === 204) return null;
    return response.json();
  }

  private jobToCalendarEvent(job: any, config: GoogleCalendarConfig): any {
    const startDate = new Date(job.scheduled_start);
    const endDate = job.scheduled_end
      ? new Date(job.scheduled_end)
      : new Date(startDate.getTime() + config.default_duration_minutes * 60000);

    let description = job.description || '';
    if (config.include_customer_info && job.customer_name) {
      description += `\n\nCustomer: ${job.customer_name}`;
      if (job.customer_phone) {
        description += `\nPhone: ${job.customer_phone}`;
      }
    }

    const event: any = {
      summary: `${job.title} - ${job.service_type}`,
      description: description.trim(),
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'America/Argentina/Buenos_Aires',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'America/Argentina/Buenos_Aires',
      },
      extendedProperties: {
        private: {
          campotech_job_id: job.id,
          campotech_customer_id: job.customer_id,
        },
      },
    };

    if (config.include_address && job.address) {
      const addr = job.address;
      event.location = [addr.street, addr.city, addr.state, addr.postal_code]
        .filter(Boolean)
        .join(', ');
    }

    if (config.event_color) {
      event.colorId = config.event_color;
    }

    return event;
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

export function createGoogleCalendarService(
  pool: Pool,
  config: GoogleCalendarServiceConfig
): GoogleCalendarService {
  return new GoogleCalendarService(pool, config);
}

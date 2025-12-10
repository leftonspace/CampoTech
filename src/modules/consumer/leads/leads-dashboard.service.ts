/**
 * Leads Dashboard Service
 * =======================
 *
 * Business dashboard integration for consumer marketplace leads.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Lead {
  id: string;
  requestNumber: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  budgetRange: string | null;
  preferredSchedule: string | null;
  photos: string[];
  consumer: {
    displayName: string | null;
    profilePhotoUrl: string | null;
    totalRequests: number;
    completedJobs: number;
  };
  location: {
    city: string;
    neighborhood: string | null;
    distance: number | null;
  };
  status: 'new' | 'viewed' | 'quoted' | 'accepted' | 'expired';
  myQuote: QuoteInfo | null;
  competingQuotes: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface QuoteInfo {
  id: string;
  quoteNumber: string;
  priceMin: number;
  priceMax: number;
  description: string;
  status: string;
  createdAt: Date;
}

export interface LeadStats {
  newLeads: number;
  viewedLeads: number;
  quotedLeads: number;
  acceptedLeads: number;
  totalLeadsThisMonth: number;
  conversionRate: number;
  avgResponseTimeHours: number;
}

export interface LeadFilterParams {
  status?: string[];
  category?: string;
  urgency?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  city?: string;
  maxDistance?: number;
  page?: number;
  limit?: number;
}

export interface QuoteSubmission {
  serviceRequestId: string;
  priceMin: number;
  priceMax: number;
  durationHours?: number;
  description: string;
  includesPartsMessage?: string;
  validDays?: number;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class LeadsDashboardService {
  constructor(private pool: Pool) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // GET LEADS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get leads for a business profile
   */
  async getLeads(
    businessProfileId: string,
    params: LeadFilterParams = {}
  ): Promise<{ leads: Lead[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions: string[] = ['sr.status != $1'];
    const values: unknown[] = ['cancelled'];
    let paramIndex = 2;

    // Category filter
    if (params.category) {
      conditions.push(`sr.category = $${paramIndex}`);
      values.push(params.category);
      paramIndex++;
    }

    // Urgency filter
    if (params.urgency && params.urgency.length > 0) {
      conditions.push(`sr.urgency = ANY($${paramIndex})`);
      values.push(params.urgency);
      paramIndex++;
    }

    // Date range filter
    if (params.dateFrom) {
      conditions.push(`sr.created_at >= $${paramIndex}`);
      values.push(params.dateFrom);
      paramIndex++;
    }

    if (params.dateTo) {
      conditions.push(`sr.created_at <= $${paramIndex}`);
      values.push(params.dateTo);
      paramIndex++;
    }

    // City filter
    if (params.city) {
      conditions.push(`sr.city = $${paramIndex}`);
      values.push(params.city);
      paramIndex++;
    }

    // Status filter (based on lead status, not request status)
    if (params.status && params.status.length > 0) {
      const statusConditions: string[] = [];
      if (params.status.includes('new')) {
        statusConditions.push(`NOT EXISTS (SELECT 1 FROM consumer.lead_views lv WHERE lv.service_request_id = sr.id AND lv.business_profile_id = $${paramIndex})`);
        values.push(businessProfileId);
        paramIndex++;
      }
      if (params.status.includes('viewed')) {
        statusConditions.push(`EXISTS (SELECT 1 FROM consumer.lead_views lv WHERE lv.service_request_id = sr.id AND lv.business_profile_id = $${paramIndex}) AND NOT EXISTS (SELECT 1 FROM consumer.quotes q WHERE q.service_request_id = sr.id AND q.business_profile_id = $${paramIndex + 1})`);
        values.push(businessProfileId, businessProfileId);
        paramIndex += 2;
      }
      if (statusConditions.length > 0) {
        conditions.push(`(${statusConditions.join(' OR ')})`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await this.pool.query<{ total: string }>(
      `SELECT COUNT(DISTINCT sr.id) as total
       FROM consumer.service_requests sr
       JOIN consumer.consumer_profiles cp ON sr.consumer_id = cp.id
       ${whereClause}`,
      values
    );

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    // Fetch leads
    values.push(businessProfileId, limit, offset);
    const bpParamIndex = paramIndex;

    const result = await this.pool.query<{
      id: string;
      request_number: string;
      title: string;
      description: string;
      category: string;
      urgency: string;
      budget_range: string | null;
      preferred_schedule: string | null;
      photos: string[];
      city: string;
      neighborhood: string | null;
      lat: number;
      lng: number;
      created_at: Date;
      expires_at: Date;
      consumer_display_name: string | null;
      consumer_photo: string | null;
      consumer_total_requests: string;
      consumer_completed_jobs: string;
      quote_id: string | null;
      quote_number: string | null;
      quote_price_min: number | null;
      quote_price_max: number | null;
      quote_description: string | null;
      quote_status: string | null;
      quote_created_at: Date | null;
      competing_quotes: string;
      is_viewed: boolean;
    }>(
      `SELECT
        sr.id,
        sr.request_number,
        sr.title,
        sr.description,
        sr.category,
        sr.urgency,
        sr.budget_range,
        sr.preferred_schedule,
        sr.photos,
        sr.city,
        sr.neighborhood,
        sr.lat,
        sr.lng,
        sr.created_at,
        sr.expires_at,
        cp.display_name as consumer_display_name,
        cp.profile_photo_url as consumer_photo,
        COALESCE((SELECT COUNT(*) FROM consumer.service_requests WHERE consumer_id = cp.id), 0) as consumer_total_requests,
        COALESCE((SELECT COUNT(*) FROM consumer.service_requests WHERE consumer_id = cp.id AND status = 'completed'), 0) as consumer_completed_jobs,
        q.id as quote_id,
        q.quote_number,
        q.price_min as quote_price_min,
        q.price_max as quote_price_max,
        q.description as quote_description,
        q.status as quote_status,
        q.created_at as quote_created_at,
        COALESCE((SELECT COUNT(*) FROM consumer.quotes WHERE service_request_id = sr.id AND id != COALESCE(q.id, '')), 0) as competing_quotes,
        EXISTS (SELECT 1 FROM consumer.lead_views lv WHERE lv.service_request_id = sr.id AND lv.business_profile_id = $${bpParamIndex}) as is_viewed
       FROM consumer.service_requests sr
       JOIN consumer.consumer_profiles cp ON sr.consumer_id = cp.id
       LEFT JOIN consumer.quotes q ON q.service_request_id = sr.id AND q.business_profile_id = $${bpParamIndex}
       ${whereClause}
       ORDER BY sr.created_at DESC
       LIMIT $${bpParamIndex + 1} OFFSET $${bpParamIndex + 2}`,
      values
    );

    const leads = result.rows.map((row) => {
      let status: Lead['status'] = 'new';
      if (row.quote_status === 'accepted') {
        status = 'accepted';
      } else if (row.quote_id) {
        status = 'quoted';
      } else if (row.is_viewed) {
        status = 'viewed';
      }

      if (new Date(row.expires_at) < new Date() && status !== 'accepted') {
        status = 'expired';
      }

      return {
        id: row.id,
        requestNumber: row.request_number,
        title: row.title,
        description: row.description,
        category: row.category,
        urgency: row.urgency,
        budgetRange: row.budget_range,
        preferredSchedule: row.preferred_schedule,
        photos: row.photos || [],
        consumer: {
          displayName: row.consumer_display_name,
          profilePhotoUrl: row.consumer_photo,
          totalRequests: parseInt(row.consumer_total_requests, 10),
          completedJobs: parseInt(row.consumer_completed_jobs, 10),
        },
        location: {
          city: row.city,
          neighborhood: row.neighborhood,
          distance: null, // Would be calculated based on business location
        },
        status,
        myQuote: row.quote_id
          ? {
              id: row.quote_id,
              quoteNumber: row.quote_number!,
              priceMin: row.quote_price_min!,
              priceMax: row.quote_price_max!,
              description: row.quote_description!,
              status: row.quote_status!,
              createdAt: row.quote_created_at!,
            }
          : null,
        competingQuotes: parseInt(row.competing_quotes, 10),
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };
    });

    return { leads, total, page, totalPages };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET LEAD DETAILS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get detailed lead information
   */
  async getLeadDetails(
    serviceRequestId: string,
    businessProfileId: string
  ): Promise<Lead | null> {
    // Mark as viewed
    await this.markLeadViewed(serviceRequestId, businessProfileId);

    const result = await this.pool.query<{
      id: string;
      request_number: string;
      title: string;
      description: string;
      category: string;
      urgency: string;
      budget_range: string | null;
      preferred_schedule: string | null;
      photos: string[];
      city: string;
      neighborhood: string | null;
      address: string;
      lat: number;
      lng: number;
      created_at: Date;
      expires_at: Date;
      consumer_display_name: string | null;
      consumer_photo: string | null;
      consumer_total_requests: string;
      consumer_completed_jobs: string;
      quote_id: string | null;
      quote_number: string | null;
      quote_price_min: number | null;
      quote_price_max: number | null;
      quote_description: string | null;
      quote_status: string | null;
      quote_created_at: Date | null;
      competing_quotes: string;
    }>(
      `SELECT
        sr.id,
        sr.request_number,
        sr.title,
        sr.description,
        sr.category,
        sr.urgency,
        sr.budget_range,
        sr.preferred_schedule,
        sr.photos,
        sr.city,
        sr.neighborhood,
        sr.address,
        sr.lat,
        sr.lng,
        sr.created_at,
        sr.expires_at,
        cp.display_name as consumer_display_name,
        cp.profile_photo_url as consumer_photo,
        COALESCE((SELECT COUNT(*) FROM consumer.service_requests WHERE consumer_id = cp.id), 0) as consumer_total_requests,
        COALESCE((SELECT COUNT(*) FROM consumer.service_requests WHERE consumer_id = cp.id AND status = 'completed'), 0) as consumer_completed_jobs,
        q.id as quote_id,
        q.quote_number,
        q.price_min as quote_price_min,
        q.price_max as quote_price_max,
        q.description as quote_description,
        q.status as quote_status,
        q.created_at as quote_created_at,
        COALESCE((SELECT COUNT(*) FROM consumer.quotes WHERE service_request_id = sr.id AND id != COALESCE(q.id, '')), 0) as competing_quotes
       FROM consumer.service_requests sr
       JOIN consumer.consumer_profiles cp ON sr.consumer_id = cp.id
       LEFT JOIN consumer.quotes q ON q.service_request_id = sr.id AND q.business_profile_id = $2
       WHERE sr.id = $1`,
      [serviceRequestId, businessProfileId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    let status: Lead['status'] = 'viewed';
    if (row.quote_status === 'accepted') {
      status = 'accepted';
    } else if (row.quote_id) {
      status = 'quoted';
    }

    if (new Date(row.expires_at) < new Date() && status !== 'accepted') {
      status = 'expired';
    }

    return {
      id: row.id,
      requestNumber: row.request_number,
      title: row.title,
      description: row.description,
      category: row.category,
      urgency: row.urgency,
      budgetRange: row.budget_range,
      preferredSchedule: row.preferred_schedule,
      photos: row.photos || [],
      consumer: {
        displayName: row.consumer_display_name,
        profilePhotoUrl: row.consumer_photo,
        totalRequests: parseInt(row.consumer_total_requests, 10),
        completedJobs: parseInt(row.consumer_completed_jobs, 10),
      },
      location: {
        city: row.city,
        neighborhood: row.neighborhood,
        distance: null,
      },
      status,
      myQuote: row.quote_id
        ? {
            id: row.quote_id,
            quoteNumber: row.quote_number!,
            priceMin: row.quote_price_min!,
            priceMax: row.quote_price_max!,
            description: row.quote_description!,
            status: row.quote_status!,
            createdAt: row.quote_created_at!,
          }
        : null,
      competingQuotes: parseInt(row.competing_quotes, 10),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LEAD STATS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get lead statistics for a business
   */
  async getLeadStats(businessProfileId: string): Promise<LeadStats> {
    const result = await this.pool.query<{
      new_leads: string;
      viewed_leads: string;
      quoted_leads: string;
      accepted_leads: string;
      total_leads_month: string;
      total_quotes: string;
      accepted_quotes: string;
      avg_response_hours: string | null;
    }>(
      `WITH lead_data AS (
        SELECT
          sr.id,
          EXISTS (SELECT 1 FROM consumer.lead_views lv WHERE lv.service_request_id = sr.id AND lv.business_profile_id = $1) as is_viewed,
          EXISTS (SELECT 1 FROM consumer.quotes q WHERE q.service_request_id = sr.id AND q.business_profile_id = $1) as has_quote,
          (SELECT q.status FROM consumer.quotes q WHERE q.service_request_id = sr.id AND q.business_profile_id = $1 LIMIT 1) as quote_status
        FROM consumer.service_requests sr
        WHERE sr.status != 'cancelled'
      )
      SELECT
        COUNT(*) FILTER (WHERE NOT is_viewed) as new_leads,
        COUNT(*) FILTER (WHERE is_viewed AND NOT has_quote) as viewed_leads,
        COUNT(*) FILTER (WHERE has_quote AND quote_status != 'accepted') as quoted_leads,
        COUNT(*) FILTER (WHERE quote_status = 'accepted') as accepted_leads,
        (SELECT COUNT(*) FROM consumer.service_requests WHERE created_at >= date_trunc('month', NOW())) as total_leads_month,
        (SELECT COUNT(*) FROM consumer.quotes WHERE business_profile_id = $1) as total_quotes,
        (SELECT COUNT(*) FROM consumer.quotes WHERE business_profile_id = $1 AND status = 'accepted') as accepted_quotes,
        (SELECT AVG(EXTRACT(EPOCH FROM (q.created_at - sr.created_at)) / 3600)
         FROM consumer.quotes q
         JOIN consumer.service_requests sr ON q.service_request_id = sr.id
         WHERE q.business_profile_id = $1) as avg_response_hours
       FROM lead_data`,
      [businessProfileId]
    );

    const data = result.rows[0];
    const totalQuotes = parseInt(data.total_quotes, 10);
    const acceptedQuotes = parseInt(data.accepted_quotes, 10);

    return {
      newLeads: parseInt(data.new_leads, 10),
      viewedLeads: parseInt(data.viewed_leads, 10),
      quotedLeads: parseInt(data.quoted_leads, 10),
      acceptedLeads: parseInt(data.accepted_leads, 10),
      totalLeadsThisMonth: parseInt(data.total_leads_month, 10),
      conversionRate: totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0,
      avgResponseTimeHours: data.avg_response_hours
        ? parseFloat(data.avg_response_hours)
        : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBMIT QUOTE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Submit a quote for a lead
   */
  async submitQuote(
    businessProfileId: string,
    quote: QuoteSubmission
  ): Promise<{ id: string; quoteNumber: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if already quoted
      const existingQuote = await client.query(
        `SELECT id FROM consumer.quotes
         WHERE service_request_id = $1 AND business_profile_id = $2`,
        [quote.serviceRequestId, businessProfileId]
      );

      if (existingQuote.rows.length > 0) {
        throw new Error('Ya has enviado una cotización para esta solicitud');
      }

      // Generate quote number
      const quoteNumber = await this.generateQuoteNumber(client);

      // Calculate valid until date
      const validDays = quote.validDays || 7;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validDays);

      // Create quote
      const result = await client.query<{ id: string }>(
        `INSERT INTO consumer.quotes (
          service_request_id, business_profile_id, quote_number,
          price_min, price_max, duration_hours, description,
          includes_parts_message, valid_until, notes, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'sent')
        RETURNING id`,
        [
          quote.serviceRequestId,
          businessProfileId,
          quoteNumber,
          quote.priceMin,
          quote.priceMax,
          quote.durationHours,
          quote.description,
          quote.includesPartsMessage,
          validUntil,
          quote.notes,
        ]
      );

      // Update request status
      await client.query(
        `UPDATE consumer.service_requests
         SET status = 'quotes_received', quote_count = quote_count + 1
         WHERE id = $1 AND status = 'open'`,
        [quote.serviceRequestId]
      );

      await client.query('COMMIT');

      return { id: result.rows[0].id, quoteNumber };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONVERT LEAD TO JOB
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Convert an accepted lead to a job
   */
  async convertLeadToJob(
    quoteId: string,
    businessProfileId: string,
    jobDetails: {
      scheduledDate?: Date;
      scheduledTime?: string;
      notes?: string;
    }
  ): Promise<{ jobId: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Verify quote is accepted and belongs to this business
      const quoteCheck = await client.query<{
        service_request_id: string;
        status: string;
      }>(
        `SELECT service_request_id, status FROM consumer.quotes
         WHERE id = $1 AND business_profile_id = $2`,
        [quoteId, businessProfileId]
      );

      if (quoteCheck.rows.length === 0) {
        throw new Error('Cotización no encontrada');
      }

      if (quoteCheck.rows[0].status !== 'accepted') {
        throw new Error('La cotización no ha sido aceptada');
      }

      // Update service request to in_progress
      await client.query(
        `UPDATE consumer.service_requests
         SET status = 'in_progress',
             accepted_quote_id = $1,
             scheduled_date = $2,
             scheduled_time = $3
         WHERE id = $4`,
        [
          quoteId,
          jobDetails.scheduledDate,
          jobDetails.scheduledTime,
          quoteCheck.rows[0].service_request_id,
        ]
      );

      // Create job record (linking to existing system)
      const jobResult = await client.query<{ id: string }>(
        `INSERT INTO consumer.jobs (
          service_request_id, quote_id, business_profile_id,
          scheduled_date, scheduled_time, notes, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
        RETURNING id`,
        [
          quoteCheck.rows[0].service_request_id,
          quoteId,
          businessProfileId,
          jobDetails.scheduledDate,
          jobDetails.scheduledTime,
          jobDetails.notes,
        ]
      );

      await client.query('COMMIT');

      return { jobId: jobResult.rows[0].id };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private async markLeadViewed(
    serviceRequestId: string,
    businessProfileId: string
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO consumer.lead_views (service_request_id, business_profile_id, viewed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (service_request_id, business_profile_id) DO NOTHING`,
      [serviceRequestId, businessProfileId]
    );
  }

  private async generateQuoteNumber(client: any): Promise<string> {
    const result = await client.query<{ quote_number: string }>(
      `SELECT 'Q' || LPAD(nextval('consumer.quote_number_seq')::text, 8, '0') as quote_number`
    );
    return result.rows[0].quote_number;
  }
}

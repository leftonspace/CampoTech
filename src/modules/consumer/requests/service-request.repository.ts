/**
 * Service Request Repository
 * ==========================
 *
 * Data access layer for consumer service requests.
 * Phase 15: Consumer Marketplace
 */

import { Pool, PoolClient } from 'pg';
import {
  ServiceRequest,
  CreateServiceRequestDTO,
  UpdateServiceRequestDTO,
  ServiceRequestStatus,
  ServiceCategory,
  ServiceUrgency,
  BudgetRange,
  ConsumerPaginationParams,
  ConsumerPaginatedResult,
  ServiceRequestSearchParams,
} from '../consumer.types';

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class ServiceRequestRepository {
  constructor(private pool: Pool) {}

  /**
   * Find request by ID
   */
  async findById(id: string, client?: PoolClient): Promise<ServiceRequest | null> {
    const conn = client || this.pool;
    const result = await conn.query(
      `SELECT * FROM consumer_service_requests WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find request by request number
   */
  async findByRequestNumber(requestNumber: string, client?: PoolClient): Promise<ServiceRequest | null> {
    const conn = client || this.pool;
    const result = await conn.query(
      `SELECT * FROM consumer_service_requests WHERE request_number = $1 AND deleted_at IS NULL`,
      [requestNumber]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find requests by consumer ID
   */
  async findByConsumerId(
    consumerId: string,
    params: { status?: ServiceRequestStatus },
    pagination: ConsumerPaginationParams,
    client?: PoolClient
  ): Promise<ConsumerPaginatedResult<ServiceRequest>> {
    const conn = client || this.pool;
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE consumer_id = $1 AND deleted_at IS NULL';
    const values: any[] = [consumerId];
    let paramIndex = 2;

    if (params.status) {
      whereClause += ` AND status = $${paramIndex}`;
      values.push(params.status);
      paramIndex++;
    }

    // Count
    const countResult = await conn.query(
      `SELECT COUNT(*) FROM consumer_service_requests ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get data
    const result = await conn.query(
      `SELECT * FROM consumer_service_requests ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      data: result.rows.map(row => this.mapRow(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find open requests for matching
   */
  async findOpenForMatching(
    params: {
      category?: ServiceCategory;
      city?: string;
      neighborhood?: string;
      urgency?: ServiceUrgency;
    },
    pagination: ConsumerPaginationParams,
    client?: PoolClient
  ): Promise<ConsumerPaginatedResult<ServiceRequest>> {
    const conn = client || this.pool;
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = `WHERE status IN ('open', 'quotes_received') AND deleted_at IS NULL AND expires_at > NOW()`;
    const values: any[] = [];
    let paramIndex = 1;

    if (params.category) {
      whereClause += ` AND category = $${paramIndex}`;
      values.push(params.category);
      paramIndex++;
    }

    if (params.city) {
      whereClause += ` AND city = $${paramIndex}`;
      values.push(params.city);
      paramIndex++;
    }

    if (params.neighborhood) {
      whereClause += ` AND neighborhood = $${paramIndex}`;
      values.push(params.neighborhood);
      paramIndex++;
    }

    if (params.urgency) {
      whereClause += ` AND urgency = $${paramIndex}`;
      values.push(params.urgency);
      paramIndex++;
    }

    // Count
    const countResult = await conn.query(
      `SELECT COUNT(*) FROM consumer_service_requests ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get data (order by urgency and creation date)
    const result = await conn.query(
      `SELECT * FROM consumer_service_requests ${whereClause}
       ORDER BY
         CASE urgency
           WHEN 'emergency' THEN 1
           WHEN 'today' THEN 2
           WHEN 'this_week' THEN 3
           ELSE 4
         END,
         created_at ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      data: result.rows.map(row => this.mapRow(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new service request
   */
  async create(consumerId: string, data: CreateServiceRequestDTO, client?: PoolClient): Promise<ServiceRequest> {
    const conn = client || this.pool;

    const result = await conn.query(
      `INSERT INTO consumer_service_requests (
        consumer_id, category, service_type, title, description,
        photo_urls, voice_note_url,
        address, address_extra, lat, lng, neighborhood, city, province,
        urgency, preferred_date, preferred_time_slot, flexible_dates,
        budget_range, budget_min, budget_max, budget_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *`,
      [
        consumerId,
        data.category,
        data.serviceType || null,
        data.title,
        data.description,
        data.photoUrls || [],
        data.voiceNoteUrl || null,
        data.address,
        data.addressExtra || null,
        data.lat || null,
        data.lng || null,
        data.neighborhood || null,
        data.city || 'Buenos Aires',
        data.province || 'CABA',
        data.urgency || 'flexible',
        data.preferredDate || null,
        data.preferredTimeSlot || null,
        data.flexibleDates !== false,
        data.budgetRange || 'not_specified',
        data.budgetMin || null,
        data.budgetMax || null,
        data.budgetNotes || null,
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Update service request
   */
  async update(id: string, data: UpdateServiceRequestDTO, client?: PoolClient): Promise<ServiceRequest | null> {
    const conn = client || this.pool;

    const fields: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      photoUrls: 'photo_urls',
      urgency: 'urgency',
      preferredDate: 'preferred_date',
      preferredTimeSlot: 'preferred_time_slot',
      budgetRange: 'budget_range',
      budgetMin: 'budget_min',
      budgetMax: 'budget_max',
    };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && fieldMap[key]) {
        fields.push(`${fieldMap[key]} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return this.findById(id, client);
    }

    const result = await conn.query(
      `UPDATE consumer_service_requests
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Update request status
   */
  async updateStatus(
    id: string,
    status: ServiceRequestStatus,
    additionalData?: Record<string, any>,
    client?: PoolClient
  ): Promise<ServiceRequest | null> {
    const conn = client || this.pool;

    let setClause = 'status = $2, status_changed_at = NOW()';
    const values: any[] = [id, status];
    let paramIndex = 3;

    if (additionalData) {
      for (const [key, value] of Object.entries(additionalData)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        setClause += `, ${snakeKey} = $${paramIndex}`;
        values.push(value);
        paramIndex++;
      }
    }

    const result = await conn.query(
      `UPDATE consumer_service_requests
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Add matched business
   */
  async addMatchedBusiness(id: string, businessId: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_service_requests
       SET matched_business_ids = array_append(matched_business_ids, $2)
       WHERE id = $1 AND NOT ($2 = ANY(matched_business_ids))`,
      [id, businessId]
    );
  }

  /**
   * Increment quotes received
   */
  async incrementQuotesReceived(id: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_service_requests
       SET quotes_received = quotes_received + 1
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Accept quote
   */
  async acceptQuote(id: string, quoteId: string, client?: PoolClient): Promise<ServiceRequest | null> {
    const conn = client || this.pool;
    const result = await conn.query(
      `UPDATE consumer_service_requests
       SET status = 'accepted', accepted_quote_id = $2, accepted_at = NOW(),
           status_changed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, quoteId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Link job
   */
  async linkJob(id: string, jobId: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_service_requests SET job_id = $2, updated_at = NOW() WHERE id = $1`,
      [id, jobId]
    );
  }

  /**
   * Cancel request
   */
  async cancel(
    id: string,
    reason: string,
    cancelledBy: 'consumer' | 'system',
    client?: PoolClient
  ): Promise<ServiceRequest | null> {
    const conn = client || this.pool;
    const result = await conn.query(
      `UPDATE consumer_service_requests
       SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $2,
           cancelled_by = $3, status_changed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, reason, cancelledBy]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Soft delete
   */
  async softDelete(id: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_service_requests SET deleted_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  /**
   * Get requests stats for a consumer
   */
  async getConsumerStats(consumerId: string, client?: PoolClient): Promise<{
    total: number;
    open: number;
    completed: number;
    cancelled: number;
    avgQuotesReceived: number;
  }> {
    const conn = client || this.pool;
    const result = await conn.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status IN ('open', 'quotes_received')) as open,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
         ROUND(AVG(quotes_received)::numeric, 2) as avg_quotes_received
       FROM consumer_service_requests
       WHERE consumer_id = $1 AND deleted_at IS NULL`,
      [consumerId]
    );

    const row = result.rows[0];
    return {
      total: parseInt(row.total, 10),
      open: parseInt(row.open, 10),
      completed: parseInt(row.completed, 10),
      cancelled: parseInt(row.cancelled, 10),
      avgQuotesReceived: parseFloat(row.avg_quotes_received) || 0,
    };
  }

  /**
   * Expire old requests
   */
  async expireOldRequests(client?: PoolClient): Promise<number> {
    const conn = client || this.pool;
    const result = await conn.query(
      `UPDATE consumer_service_requests
       SET status = 'expired', status_changed_at = NOW(), updated_at = NOW()
       WHERE status IN ('open', 'quotes_received')
         AND expires_at < NOW()
         AND deleted_at IS NULL`
    );
    return result.rowCount || 0;
  }

  /**
   * Map database row to ServiceRequest
   */
  private mapRow(row: Record<string, any>): ServiceRequest {
    return {
      id: row.id,
      consumerId: row.consumer_id,
      requestNumber: row.request_number,
      category: row.category as ServiceCategory,
      serviceType: row.service_type,
      title: row.title,
      description: row.description,
      photoUrls: row.photo_urls || [],
      voiceNoteUrl: row.voice_note_url,
      videoUrl: row.video_url,
      address: row.address,
      addressExtra: row.address_extra,
      lat: row.lat ? parseFloat(row.lat) : undefined,
      lng: row.lng ? parseFloat(row.lng) : undefined,
      neighborhood: row.neighborhood,
      city: row.city,
      province: row.province,
      postalCode: row.postal_code,
      urgency: row.urgency as ServiceUrgency,
      preferredDate: row.preferred_date,
      preferredTimeSlot: row.preferred_time_slot,
      flexibleDates: row.flexible_dates,
      availableDates: row.available_dates || [],
      budgetRange: row.budget_range as BudgetRange,
      budgetMin: row.budget_min ? parseFloat(row.budget_min) : undefined,
      budgetMax: row.budget_max ? parseFloat(row.budget_max) : undefined,
      budgetNotes: row.budget_notes,
      status: row.status as ServiceRequestStatus,
      statusChangedAt: row.status_changed_at,
      matchedBusinessIds: row.matched_business_ids || [],
      maxQuotes: row.max_quotes,
      quotesReceived: row.quotes_received,
      quotesViewed: row.quotes_viewed,
      acceptedQuoteId: row.accepted_quote_id,
      acceptedAt: row.accepted_at,
      cancelledAt: row.cancelled_at,
      cancellationReason: row.cancellation_reason,
      cancelledBy: row.cancelled_by,
      jobId: row.job_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      deletedAt: row.deleted_at,
    };
  }
}

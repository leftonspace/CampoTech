/**
 * Quote Repository
 * ================
 *
 * Data access for business quotes.
 * Phase 15: Consumer Marketplace
 */

import { Pool, PoolClient } from 'pg';
import {
  BusinessQuote,
  QuoteStatus,
  ServiceCategory,
  BudgetRange,
} from '../consumer.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateQuoteInput {
  requestId: string;
  businessProfileId: string;
  orgId: string;
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  estimatedDurationHours?: number;
  description: string;
  includesPartsMessage?: string;
  validUntil: Date;
  notes?: string;
}

export interface UpdateQuoteInput {
  estimatedPriceMin?: number;
  estimatedPriceMax?: number;
  estimatedDurationHours?: number;
  description?: string;
  includesPartsMessage?: string;
  validUntil?: Date;
  notes?: string;
}

export interface QuoteMessage {
  id: string;
  quoteId: string;
  senderId: string;
  senderType: 'consumer' | 'business';
  message: string;
  attachments?: string[];
  readAt?: Date;
  createdAt: Date;
}

export interface CreateMessageInput {
  quoteId: string;
  senderId: string;
  senderType: 'consumer' | 'business';
  message: string;
  attachments?: string[];
}

export interface QuoteDeclineInput {
  requestId: string;
  businessProfileId: string;
  declineReason: string;
  declineNotes?: string;
}

export interface QuoteSearchParams {
  requestId?: string;
  businessProfileId?: string;
  consumerId?: string;
  status?: QuoteStatus | QuoteStatus[];
  minPrice?: number;
  maxPrice?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class QuoteRepository {
  constructor(private pool: Pool) {}

  private getClient(): Pool | PoolClient {
    return this.pool;
  }

  /**
   * Create a new quote
   */
  async create(input: CreateQuoteInput): Promise<BusinessQuote> {
    const client = this.getClient();
    const result = await client.query<BusinessQuote>(
      `INSERT INTO business_quotes (
         request_id,
         business_profile_id,
         org_id,
         estimated_price_min,
         estimated_price_max,
         estimated_duration_hours,
         description,
         includes_parts_message,
         valid_until,
         notes,
         status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       RETURNING *`,
      [
        input.requestId,
        input.businessProfileId,
        input.orgId,
        input.estimatedPriceMin,
        input.estimatedPriceMax,
        input.estimatedDurationHours,
        input.description,
        input.includesPartsMessage,
        input.validUntil,
        input.notes,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  /**
   * Find quote by ID
   */
  async findById(id: string): Promise<BusinessQuote | null> {
    const result = await this.pool.query<BusinessQuote>(
      `SELECT * FROM business_quotes WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find quote by number
   */
  async findByNumber(quoteNumber: string): Promise<BusinessQuote | null> {
    const result = await this.pool.query<BusinessQuote>(
      `SELECT * FROM business_quotes WHERE quote_number = $1`,
      [quoteNumber]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find quotes by request ID
   */
  async findByRequestId(requestId: string): Promise<BusinessQuote[]> {
    const result = await this.pool.query<BusinessQuote>(
      `SELECT * FROM business_quotes
       WHERE request_id = $1
       ORDER BY created_at DESC`,
      [requestId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Find quotes by business profile
   */
  async findByBusinessProfile(
    businessProfileId: string,
    status?: QuoteStatus | QuoteStatus[]
  ): Promise<BusinessQuote[]> {
    let query = `SELECT * FROM business_quotes WHERE business_profile_id = $1`;
    const params: any[] = [businessProfileId];

    if (status) {
      if (Array.isArray(status)) {
        query += ` AND status = ANY($2)`;
        params.push(status);
      } else {
        query += ` AND status = $2`;
        params.push(status);
      }
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.pool.query<BusinessQuote>(query, params);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Find quotes for consumer
   */
  async findForConsumer(
    consumerId: string,
    status?: QuoteStatus | QuoteStatus[]
  ): Promise<BusinessQuote[]> {
    let query = `
      SELECT bq.*
      FROM business_quotes bq
      JOIN consumer_service_requests csr ON bq.request_id = csr.id
      WHERE csr.consumer_id = $1
    `;
    const params: any[] = [consumerId];

    if (status) {
      if (Array.isArray(status)) {
        query += ` AND bq.status = ANY($2)`;
        params.push(status);
      } else {
        query += ` AND bq.status = $2`;
        params.push(status);
      }
    }

    query += ` ORDER BY bq.created_at DESC`;

    const result = await this.pool.query<BusinessQuote>(query, params);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Update quote
   */
  async update(id: string, input: UpdateQuoteInput): Promise<BusinessQuote | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.estimatedPriceMin !== undefined) {
      fields.push(`estimated_price_min = $${paramIndex++}`);
      values.push(input.estimatedPriceMin);
    }
    if (input.estimatedPriceMax !== undefined) {
      fields.push(`estimated_price_max = $${paramIndex++}`);
      values.push(input.estimatedPriceMax);
    }
    if (input.estimatedDurationHours !== undefined) {
      fields.push(`estimated_duration_hours = $${paramIndex++}`);
      values.push(input.estimatedDurationHours);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.includesPartsMessage !== undefined) {
      fields.push(`includes_parts_message = $${paramIndex++}`);
      values.push(input.includesPartsMessage);
    }
    if (input.validUntil !== undefined) {
      fields.push(`valid_until = $${paramIndex++}`);
      values.push(input.validUntil);
    }
    if (input.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(input.notes);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query<BusinessQuote>(
      `UPDATE business_quotes
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Update quote status
   */
  async updateStatus(id: string, status: QuoteStatus): Promise<BusinessQuote | null> {
    const additionalFields: string[] = [];

    if (status === 'sent') {
      additionalFields.push('sent_at = NOW()');
    } else if (status === 'viewed') {
      additionalFields.push('viewed_at = COALESCE(viewed_at, NOW())');
    } else if (status === 'accepted') {
      additionalFields.push('accepted_at = NOW()');
    } else if (status === 'rejected') {
      additionalFields.push('rejected_at = NOW()');
    } else if (status === 'expired') {
      additionalFields.push('expired_at = NOW()');
    }

    const setClause = [`status = $1`, `updated_at = NOW()`, ...additionalFields].join(', ');

    const result = await this.pool.query<BusinessQuote>(
      `UPDATE business_quotes
       SET ${setClause}
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Mark quote as viewed
   */
  async markViewed(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE business_quotes
       SET viewed_at = COALESCE(viewed_at, NOW()),
           status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Accept a quote
   */
  async accept(id: string, jobId?: string): Promise<BusinessQuote | null> {
    const result = await this.pool.query<BusinessQuote>(
      `UPDATE business_quotes
       SET status = 'accepted',
           accepted_at = NOW(),
           job_id = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, jobId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Reject a quote
   */
  async reject(id: string, reason?: string): Promise<BusinessQuote | null> {
    const result = await this.pool.query<BusinessQuote>(
      `UPDATE business_quotes
       SET status = 'rejected',
           rejected_at = NOW(),
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, reason]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Expire old quotes
   */
  async expireOldQuotes(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE business_quotes
       SET status = 'expired',
           expired_at = NOW(),
           updated_at = NOW()
       WHERE status IN ('pending', 'sent', 'viewed')
         AND valid_until < NOW()
       RETURNING id`
    );
    return result.rowCount || 0;
  }

  /**
   * Record decline
   */
  async recordDecline(input: QuoteDeclineInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO business_quote_declines (
         request_id,
         business_profile_id,
         decline_reason,
         decline_notes
       ) VALUES ($1, $2, $3, $4)`,
      [input.requestId, input.businessProfileId, input.declineReason, input.declineNotes]
    );
  }

  /**
   * Check if business has already quoted
   */
  async hasBusinessQuoted(requestId: string, businessProfileId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM business_quotes
       WHERE request_id = $1 AND business_profile_id = $2
       LIMIT 1`,
      [requestId, businessProfileId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if business has declined
   */
  async hasBusinessDeclined(requestId: string, businessProfileId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM business_quote_declines
       WHERE request_id = $1 AND business_profile_id = $2
       LIMIT 1`,
      [requestId, businessProfileId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get quote comparison data for a request
   */
  async getQuoteComparison(requestId: string): Promise<{
    quotes: BusinessQuote[];
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    avgDuration: number;
  }> {
    const quotes = await this.findByRequestId(requestId);
    const validQuotes = quotes.filter(q =>
      ['sent', 'viewed'].includes(q.status) && q.validUntil > new Date()
    );

    if (validQuotes.length === 0) {
      return { quotes: [], avgPrice: 0, minPrice: 0, maxPrice: 0, avgDuration: 0 };
    }

    const prices = validQuotes.map(q => (q.estimatedPriceMin + q.estimatedPriceMax) / 2);
    const durations = validQuotes
      .filter(q => q.estimatedDurationHours)
      .map(q => q.estimatedDurationHours!);

    return {
      quotes: validQuotes,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      avgDuration: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a message
   */
  async createMessage(input: CreateMessageInput): Promise<QuoteMessage> {
    const result = await this.pool.query<QuoteMessage>(
      `INSERT INTO quote_messages (
         quote_id,
         sender_id,
         sender_type,
         message,
         attachments
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.quoteId, input.senderId, input.senderType, input.message, input.attachments]
    );
    return this.mapMessageRow(result.rows[0]);
  }

  /**
   * Get messages for a quote
   */
  async getMessages(quoteId: string): Promise<QuoteMessage[]> {
    const result = await this.pool.query<QuoteMessage>(
      `SELECT * FROM quote_messages
       WHERE quote_id = $1
       ORDER BY created_at ASC`,
      [quoteId]
    );
    return result.rows.map(row => this.mapMessageRow(row));
  }

  /**
   * Mark messages as read
   */
  async markMessagesRead(quoteId: string, readerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE quote_messages
       SET read_at = COALESCE(read_at, NOW())
       WHERE quote_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [quoteId, readerId]
    );
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(quoteId: string, readerId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM quote_messages
       WHERE quote_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [quoteId, readerId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get business quote stats
   */
  async getBusinessStats(businessProfileId: string): Promise<{
    totalQuotes: number;
    acceptedQuotes: number;
    pendingQuotes: number;
    avgPriceQuoted: number;
    acceptanceRate: number;
  }> {
    const result = await this.pool.query<{
      total_quotes: string;
      accepted_quotes: string;
      pending_quotes: string;
      avg_price: number;
    }>(
      `SELECT
         COUNT(*) as total_quotes,
         COUNT(*) FILTER (WHERE status = 'accepted') as accepted_quotes,
         COUNT(*) FILTER (WHERE status IN ('pending', 'sent', 'viewed')) as pending_quotes,
         AVG((estimated_price_min + estimated_price_max) / 2) as avg_price
       FROM business_quotes
       WHERE business_profile_id = $1`,
      [businessProfileId]
    );

    const row = result.rows[0];
    const total = parseInt(row.total_quotes, 10);
    const accepted = parseInt(row.accepted_quotes, 10);

    return {
      totalQuotes: total,
      acceptedQuotes: accepted,
      pendingQuotes: parseInt(row.pending_quotes, 10),
      avgPriceQuoted: row.avg_price || 0,
      acceptanceRate: total > 0 ? accepted / total : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAPPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private mapRow(row: any): BusinessQuote {
    return {
      id: row.id,
      quoteNumber: row.quote_number,
      requestId: row.request_id,
      businessProfileId: row.business_profile_id,
      orgId: row.org_id,
      estimatedPriceMin: parseFloat(row.estimated_price_min),
      estimatedPriceMax: parseFloat(row.estimated_price_max),
      estimatedDurationHours: row.estimated_duration_hours,
      description: row.description,
      includesPartsMessage: row.includes_parts_message,
      validUntil: row.valid_until,
      status: row.status,
      sentAt: row.sent_at,
      viewedAt: row.viewed_at,
      acceptedAt: row.accepted_at,
      rejectedAt: row.rejected_at,
      rejectionReason: row.rejection_reason,
      expiredAt: row.expired_at,
      jobId: row.job_id,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMessageRow(row: any): QuoteMessage {
    return {
      id: row.id,
      quoteId: row.quote_id,
      senderId: row.sender_id,
      senderType: row.sender_type,
      message: row.message,
      attachments: row.attachments,
      readAt: row.read_at,
      createdAt: row.created_at,
    };
  }
}

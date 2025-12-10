/**
 * Support Ticket Service
 * ======================
 *
 * Handles customer support ticket creation and tracking.
 */

import { Pool } from 'pg';
import * as crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'general' | 'billing' | 'service' | 'complaint' | 'feedback' | 'other';

export interface SupportTicket {
  id: string;
  customerId: string;
  orgId: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  relatedJobId?: string;
  relatedInvoiceId?: string;
  messages: TicketMessage[];
  assignedToId?: string;
  assignedToName?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorType: 'customer' | 'staff';
  authorId: string;
  authorName: string;
  content: string;
  attachments?: string[];
  createdAt: Date;
}

export interface CreateTicketRequest {
  customerId: string;
  orgId: string;
  subject: string;
  category: TicketCategory;
  message: string;
  relatedJobId?: string;
  relatedInvoiceId?: string;
  attachments?: string[];
}

export interface AddMessageRequest {
  ticketId: string;
  customerId: string;
  orgId: string;
  content: string;
  attachments?: string[];
}

export interface TicketListParams {
  customerId: string;
  orgId: string;
  status?: TicketStatus[];
  limit?: number;
  offset?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class SupportTicketService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Generate unique ticket number
   */
  private async generateTicketNumber(orgId: string): Promise<string> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM support_tickets WHERE org_id = $1`,
      [orgId]
    );
    const count = parseInt(result.rows[0].count, 10) + 1;
    const year = new Date().getFullYear().toString().slice(-2);
    return `TKT-${year}${count.toString().padStart(6, '0')}`;
  }

  /**
   * Create a new support ticket
   */
  async createTicket(request: CreateTicketRequest): Promise<SupportTicket> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const ticketId = crypto.randomUUID();
      const ticketNumber = await this.generateTicketNumber(request.orgId);

      // Determine priority based on category
      let priority: TicketPriority = 'medium';
      if (request.category === 'complaint') priority = 'high';
      if (request.category === 'billing') priority = 'medium';

      // Create ticket
      await client.query(
        `INSERT INTO support_tickets (
          id, customer_id, org_id, ticket_number, subject, category,
          priority, status, related_job_id, related_invoice_id,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9, NOW(), NOW())`,
        [
          ticketId,
          request.customerId,
          request.orgId,
          ticketNumber,
          request.subject,
          request.category,
          priority,
          request.relatedJobId,
          request.relatedInvoiceId,
        ]
      );

      // Get customer name
      const customerResult = await client.query(
        `SELECT full_name FROM customers WHERE id = $1`,
        [request.customerId]
      );
      const customerName = customerResult.rows[0]?.full_name || 'Customer';

      // Add initial message
      const messageId = crypto.randomUUID();
      await client.query(
        `INSERT INTO ticket_messages (
          id, ticket_id, author_type, author_id, author_name, content, attachments, created_at
        ) VALUES ($1, $2, 'customer', $3, $4, $5, $6, NOW())`,
        [
          messageId,
          ticketId,
          request.customerId,
          customerName,
          request.message,
          request.attachments ? JSON.stringify(request.attachments) : null,
        ]
      );

      await client.query('COMMIT');

      console.log(`[SupportTicket] Created ticket ${ticketNumber} for customer ${request.customerId.slice(0, 8)}...`);

      return (await this.getTicketById(ticketId, request.customerId, request.orgId))!;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Add message to ticket
   */
  async addMessage(request: AddMessageRequest): Promise<TicketMessage> {
    // Verify ticket belongs to customer
    const ticket = await this.getTicketById(request.ticketId, request.customerId, request.orgId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status === 'closed') {
      throw new Error('Cannot add messages to closed tickets');
    }

    // Get customer name
    const customerResult = await this.pool.query(
      `SELECT full_name FROM customers WHERE id = $1`,
      [request.customerId]
    );
    const customerName = customerResult.rows[0]?.full_name || 'Customer';

    const messageId = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO ticket_messages (
        id, ticket_id, author_type, author_id, author_name, content, attachments, created_at
      ) VALUES ($1, $2, 'customer', $3, $4, $5, $6, NOW())`,
      [
        messageId,
        request.ticketId,
        request.customerId,
        customerName,
        request.content,
        request.attachments ? JSON.stringify(request.attachments) : null,
      ]
    );

    // Update ticket status if it was waiting for customer
    if (ticket.status === 'waiting_customer') {
      await this.pool.query(
        `UPDATE support_tickets SET status = 'in_progress', updated_at = NOW()
         WHERE id = $1`,
        [request.ticketId]
      );
    } else {
      await this.pool.query(
        `UPDATE support_tickets SET updated_at = NOW() WHERE id = $1`,
        [request.ticketId]
      );
    }

    console.log(`[SupportTicket] Added message to ticket ${ticket.ticketNumber}`);

    const result = await this.pool.query(
      `SELECT * FROM ticket_messages WHERE id = $1`,
      [messageId]
    );

    return this.mapRowToMessage(result.rows[0]);
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(
    ticketId: string,
    customerId: string,
    orgId: string
  ): Promise<SupportTicket | null> {
    const result = await this.pool.query(
      `SELECT t.*, u.full_name as assigned_to_name
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.assigned_to_id
       WHERE t.id = $1 AND t.customer_id = $2 AND t.org_id = $3`,
      [ticketId, customerId, orgId]
    );

    if (!result.rows[0]) return null;

    // Get messages
    const messagesResult = await this.pool.query(
      `SELECT * FROM ticket_messages
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [ticketId]
    );

    return {
      ...this.mapRowToTicket(result.rows[0]),
      messages: messagesResult.rows.map(row => this.mapRowToMessage(row)),
    };
  }

  /**
   * Get tickets for customer
   */
  async getTickets(params: TicketListParams): Promise<{
    tickets: SupportTicket[];
    total: number;
  }> {
    const { customerId, orgId, status, limit = 20, offset = 0 } = params;

    let whereClause = 'WHERE t.customer_id = $1 AND t.org_id = $2';
    const queryParams: any[] = [customerId, orgId];

    if (status && status.length > 0) {
      whereClause += ` AND t.status = ANY($${queryParams.length + 1})`;
      queryParams.push(status);
    }

    // Get count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM support_tickets t ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get tickets
    queryParams.push(limit, offset);
    const result = await this.pool.query(
      `SELECT t.*, u.full_name as assigned_to_name
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.assigned_to_id
       ${whereClause}
       ORDER BY t.updated_at DESC
       LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams
    );

    // Get messages for each ticket
    const tickets = await Promise.all(
      result.rows.map(async row => {
        const messagesResult = await this.pool.query(
          `SELECT * FROM ticket_messages
           WHERE ticket_id = $1
           ORDER BY created_at ASC
           LIMIT 1`,  // Only get first message for list view
          [row.id]
        );

        return {
          ...this.mapRowToTicket(row),
          messages: messagesResult.rows.map(r => this.mapRowToMessage(r)),
        };
      })
    );

    return { tickets, total };
  }

  /**
   * Get open tickets count
   */
  async getOpenTicketsCount(customerId: string, orgId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM support_tickets
       WHERE customer_id = $1 AND org_id = $2
         AND status IN ('open', 'in_progress', 'waiting_customer')`,
      [customerId, orgId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Map database row to SupportTicket
   */
  private mapRowToTicket(row: any): SupportTicket {
    return {
      id: row.id,
      customerId: row.customer_id,
      orgId: row.org_id,
      ticketNumber: row.ticket_number,
      subject: row.subject,
      category: row.category,
      priority: row.priority,
      status: row.status,
      relatedJobId: row.related_job_id,
      relatedInvoiceId: row.related_invoice_id,
      messages: [],
      assignedToId: row.assigned_to_id,
      assignedToName: row.assigned_to_name,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
    };
  }

  /**
   * Map database row to TicketMessage
   */
  private mapRowToMessage(row: any): TicketMessage {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      authorType: row.author_type,
      authorId: row.author_id,
      authorName: row.author_name,
      content: row.content,
      attachments: row.attachments || [],
      createdAt: new Date(row.created_at),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: SupportTicketService | null = null;

export function getSupportTicketService(pool?: Pool): SupportTicketService {
  if (!instance && pool) {
    instance = new SupportTicketService(pool);
  }
  if (!instance) {
    throw new Error('SupportTicketService not initialized');
  }
  return instance;
}

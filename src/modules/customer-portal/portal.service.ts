/**
 * Portal Service
 * ==============
 *
 * Main service for customer portal dashboard and profile management.
 */

import { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CustomerProfile {
  id: string;
  orgId: string;
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface CustomerDashboard {
  profile: CustomerProfile;
  upcomingJobs: Array<{
    id: string;
    description: string;
    scheduledAt: Date;
    status: string;
    technicianName?: string;
  }>;
  recentInvoices: Array<{
    id: string;
    invoiceNumber?: number;
    total: number;
    status: string;
    issuedAt?: Date;
  }>;
  unpaidBalance: number;
  openTickets: number;
  unratedJobs: number;
  stats: {
    totalJobs: number;
    completedJobs: number;
    totalSpent: number;
  };
}

export interface UpdateProfileRequest {
  fullName?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class PortalService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get customer profile
   */
  async getProfile(customerId: string, orgId: string): Promise<CustomerProfile | null> {
    const result = await this.pool.query(
      `SELECT id, org_id, full_name, phone, email, address, city, province,
              postal_code, created_at, last_login_at
       FROM customers
       WHERE id = $1 AND org_id = $2 AND is_active = true`,
      [customerId, orgId]
    );

    if (!result.rows[0]) return null;

    return this.mapRowToProfile(result.rows[0]);
  }

  /**
   * Update customer profile
   */
  async updateProfile(
    customerId: string,
    orgId: string,
    updates: UpdateProfileRequest
  ): Promise<CustomerProfile> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.fullName !== undefined) {
      updateFields.push(`full_name = $${paramIndex++}`);
      values.push(updates.fullName);
    }
    if (updates.address !== undefined) {
      updateFields.push(`address = $${paramIndex++}`);
      values.push(updates.address);
    }
    if (updates.city !== undefined) {
      updateFields.push(`city = $${paramIndex++}`);
      values.push(updates.city);
    }
    if (updates.province !== undefined) {
      updateFields.push(`province = $${paramIndex++}`);
      values.push(updates.province);
    }
    if (updates.postalCode !== undefined) {
      updateFields.push(`postal_code = $${paramIndex++}`);
      values.push(updates.postalCode);
    }

    if (updateFields.length === 0) {
      const profile = await this.getProfile(customerId, orgId);
      if (!profile) throw new Error('Customer not found');
      return profile;
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(customerId, orgId);

    await this.pool.query(
      `UPDATE customers SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex++} AND org_id = $${paramIndex}`,
      values
    );

    const profile = await this.getProfile(customerId, orgId);
    if (!profile) throw new Error('Customer not found');
    return profile;
  }

  /**
   * Get customer dashboard data
   */
  async getDashboard(customerId: string, orgId: string): Promise<CustomerDashboard | null> {
    const profile = await this.getProfile(customerId, orgId);
    if (!profile) return null;

    // Get upcoming jobs
    const upcomingJobsResult = await this.pool.query(
      `SELECT j.id, j.description, j.scheduled_at, j.status, u.full_name as technician_name
       FROM jobs j
       LEFT JOIN users u ON u.id = j.assigned_to
       WHERE j.customer_id = $1 AND j.org_id = $2
         AND j.status IN ('pending', 'scheduled', 'en_camino', 'working')
         AND (j.scheduled_at IS NULL OR j.scheduled_at >= NOW())
       ORDER BY j.scheduled_at ASC
       LIMIT 5`,
      [customerId, orgId]
    );

    // Get recent invoices
    const recentInvoicesResult = await this.pool.query(
      `SELECT id, invoice_number, total, status, issued_at
       FROM invoices
       WHERE customer_id = $1 AND org_id = $2
         AND status IN ('issued', 'sent', 'paid')
       ORDER BY COALESCE(issued_at, created_at) DESC
       LIMIT 5`,
      [customerId, orgId]
    );

    // Get unpaid balance
    const balanceResult = await this.pool.query(
      `SELECT COALESCE(SUM(total), 0) as unpaid_balance
       FROM invoices
       WHERE customer_id = $1 AND org_id = $2
         AND status IN ('issued', 'sent')`,
      [customerId, orgId]
    );

    // Get open tickets count
    const ticketsResult = await this.pool.query(
      `SELECT COUNT(*) as open_tickets
       FROM support_tickets
       WHERE customer_id = $1 AND org_id = $2
         AND status IN ('open', 'in_progress', 'waiting_customer')`,
      [customerId, orgId]
    );

    // Get unrated jobs count
    const unratedResult = await this.pool.query(
      `SELECT COUNT(*) as unrated_jobs
       FROM jobs j
       LEFT JOIN job_feedback f ON f.job_id = j.id
       WHERE j.customer_id = $1 AND j.org_id = $2
         AND j.status = 'completed'
         AND f.id IS NULL
         AND j.completed_at > NOW() - INTERVAL '30 days'`,
      [customerId, orgId]
    );

    // Get stats
    const statsResult = await this.pool.query(
      `SELECT
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
        COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0) as total_spent
       FROM jobs
       WHERE customer_id = $1 AND org_id = $2`,
      [customerId, orgId]
    );

    return {
      profile,
      upcomingJobs: upcomingJobsResult.rows.map(row => ({
        id: row.id,
        description: row.description,
        scheduledAt: new Date(row.scheduled_at),
        status: row.status,
        technicianName: row.technician_name,
      })),
      recentInvoices: recentInvoicesResult.rows.map(row => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        total: parseFloat(row.total),
        status: row.status,
        issuedAt: row.issued_at ? new Date(row.issued_at) : undefined,
      })),
      unpaidBalance: parseFloat(balanceResult.rows[0].unpaid_balance),
      openTickets: parseInt(ticketsResult.rows[0].open_tickets, 10),
      unratedJobs: parseInt(unratedResult.rows[0].unrated_jobs, 10),
      stats: {
        totalJobs: parseInt(statsResult.rows[0].total_jobs, 10),
        completedJobs: parseInt(statsResult.rows[0].completed_jobs, 10),
        totalSpent: parseFloat(statsResult.rows[0].total_spent),
      },
    };
  }

  /**
   * Get organization public info for portal
   */
  async getOrganizationInfo(orgId: string): Promise<{
    name: string;
    logo?: string;
    phone?: string;
    email?: string;
    address?: string;
  } | null> {
    const result = await this.pool.query(
      `SELECT name, logo, phone, email, address
       FROM organizations
       WHERE id = $1 AND is_active = true`,
      [orgId]
    );

    if (!result.rows[0]) return null;

    return {
      name: result.rows[0].name,
      logo: result.rows[0].logo,
      phone: result.rows[0].phone,
      email: result.rows[0].email,
      address: result.rows[0].address,
    };
  }

  /**
   * Map database row to CustomerProfile
   */
  private mapRowToProfile(row: any): CustomerProfile {
    return {
      id: row.id,
      orgId: row.org_id,
      fullName: row.full_name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      city: row.city,
      province: row.province,
      postalCode: row.postal_code,
      createdAt: new Date(row.created_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: PortalService | null = null;

export function getPortalService(pool?: Pool): PortalService {
  if (!instance && pool) {
    instance = new PortalService(pool);
  }
  if (!instance) {
    throw new Error('PortalService not initialized');
  }
  return instance;
}

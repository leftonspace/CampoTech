/**
 * Booking Service
 * ===============
 *
 * Handles customer self-service job booking requests.
 */

import { Pool, PoolClient } from 'pg';
import * as crypto from 'crypto';
import {
  BookingRulesEngine,
  getBookingRulesEngine,
  BookingValidationResult,
} from './booking-rules';
import { AvailabilityService, getAvailabilityService } from './availability.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BookingRequest {
  customerId: string;
  orgId: string;
  serviceTypeId: string;
  requestedDateTime: Date;
  address: string;
  city?: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  notes?: string;
  preferredTechnicianId?: string;
}

export interface Booking {
  id: string;
  customerId: string;
  orgId: string;
  jobId?: string;
  serviceTypeId: string;
  serviceTypeName: string;
  requestedDateTime: Date;
  confirmedDateTime?: Date;
  address: string;
  city?: string;
  province?: string;
  postalCode?: string;
  description?: string;
  notes?: string;
  status: BookingStatus;
  estimatedPrice?: number;
  depositAmount?: number;
  depositPaid: boolean;
  cancellationReason?: string;
  cancelledAt?: Date;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type BookingStatus =
  | 'pending'       // Waiting for confirmation
  | 'confirmed'     // Confirmed and scheduled
  | 'deposit_required'  // Awaiting deposit payment
  | 'cancelled'     // Cancelled by customer or staff
  | 'completed'     // Job completed
  | 'expired';      // Booking expired without confirmation

export interface BookingResult {
  success: boolean;
  booking?: Booking;
  validation?: BookingValidationResult;
  error?: string;
}

export interface BookingListParams {
  customerId: string;
  orgId: string;
  status?: BookingStatus[];
  limit?: number;
  offset?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class BookingService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Create a new booking request
   */
  async createBooking(request: BookingRequest): Promise<BookingResult> {
    const rulesEngine = getBookingRulesEngine(request.orgId);
    const availabilityService = getAvailabilityService(this.pool);

    // Get customer's pending bookings count
    const pendingResult = await this.pool.query(
      `SELECT COUNT(*) FROM customer_bookings
       WHERE customer_id = $1 AND status IN ('pending', 'deposit_required')`,
      [request.customerId]
    );
    const pendingBookingsCount = parseInt(pendingResult.rows[0].count, 10);

    // Validate booking
    const validation = rulesEngine.validateBooking({
      serviceType: request.serviceTypeId,
      requestedDateTime: request.requestedDateTime,
      customerId: request.customerId,
      pendingBookingsCount,
    });

    if (!validation.valid) {
      return { success: false, validation };
    }

    // Check slot availability
    const services = await availabilityService.getAvailableServices(request.orgId);
    const service = services.find(s => s.id === request.serviceTypeId);

    if (!service) {
      return {
        success: false,
        error: 'Service type not found or not available for online booking',
      };
    }

    const slotAvailable = await availabilityService.checkSlotAvailability(
      request.orgId,
      request.requestedDateTime,
      service.estimatedDurationMinutes
    );

    if (!slotAvailable.available) {
      return {
        success: false,
        error: slotAvailable.reason || 'Time slot not available',
      };
    }

    // Calculate deposit if required
    const rules = rulesEngine.getRules();
    const depositAmount = rulesEngine.calculateDeposit(service.basePrice);

    // Create booking
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const bookingId = crypto.randomUUID();
      const status: BookingStatus = depositAmount > 0 ? 'deposit_required' : 'pending';

      await client.query(
        `INSERT INTO customer_bookings (
          id, customer_id, org_id, service_type_id, service_type_name,
          requested_date_time, address, city, province, postal_code,
          latitude, longitude, description, notes,
          status, estimated_price, deposit_amount, deposit_paid,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())`,
        [
          bookingId,
          request.customerId,
          request.orgId,
          request.serviceTypeId,
          service.name,
          request.requestedDateTime,
          request.address,
          request.city,
          request.province,
          request.postalCode,
          request.latitude,
          request.longitude,
          request.description,
          request.notes,
          status,
          service.basePrice,
          depositAmount,
          false,
        ]
      );

      await client.query('COMMIT');

      const booking = await this.getBookingById(bookingId, request.orgId);

      console.log(`[Booking] Created booking ${bookingId} for customer ${request.customerId.slice(0, 8)}...`);

      return {
        success: true,
        booking: booking!,
        validation,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId: string, orgId: string): Promise<Booking | null> {
    const result = await this.pool.query(
      `SELECT * FROM customer_bookings WHERE id = $1 AND org_id = $2`,
      [bookingId, orgId]
    );

    if (!result.rows[0]) return null;

    return this.mapRowToBooking(result.rows[0]);
  }

  /**
   * Get bookings for customer
   */
  async getCustomerBookings(params: BookingListParams): Promise<{
    bookings: Booking[];
    total: number;
  }> {
    const { customerId, orgId, status, limit = 20, offset = 0 } = params;

    let whereClause = 'WHERE customer_id = $1 AND org_id = $2';
    const queryParams: any[] = [customerId, orgId];

    if (status && status.length > 0) {
      whereClause += ` AND status = ANY($${queryParams.length + 1})`;
      queryParams.push(status);
    }

    // Get count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM customer_bookings ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get bookings
    queryParams.push(limit, offset);
    const result = await this.pool.query(
      `SELECT * FROM customer_bookings ${whereClause}
       ORDER BY requested_date_time DESC
       LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams
    );

    return {
      bookings: result.rows.map(row => this.mapRowToBooking(row)),
      total,
    };
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(
    bookingId: string,
    customerId: string,
    orgId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    const booking = await this.getBookingById(bookingId, orgId);

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (booking.customerId !== customerId) {
      return { success: false, error: 'You can only cancel your own bookings' };
    }

    if (!['pending', 'deposit_required', 'confirmed'].includes(booking.status)) {
      return { success: false, error: 'This booking cannot be cancelled' };
    }

    // Check if within cancellation window (24 hours before)
    const hoursUntilBooking = (booking.requestedDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilBooking < 24 && booking.status === 'confirmed') {
      return {
        success: false,
        error: 'Bookings can only be cancelled more than 24 hours in advance',
      };
    }

    await this.pool.query(
      `UPDATE customer_bookings
       SET status = 'cancelled', cancellation_reason = $3, cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND org_id = $2`,
      [bookingId, orgId, reason]
    );

    console.log(`[Booking] Booking ${bookingId} cancelled by customer`);

    return { success: true };
  }

  /**
   * Confirm a booking (internal use - creates a job)
   */
  async confirmBooking(
    bookingId: string,
    orgId: string,
    technicianId?: string,
    confirmedDateTime?: Date
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    const booking = await this.getBookingById(bookingId, orgId);

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (booking.status !== 'pending') {
      return { success: false, error: 'Only pending bookings can be confirmed' };
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create job from booking
      const jobId = crypto.randomUUID();
      const scheduledDateTime = confirmedDateTime || booking.requestedDateTime;

      await client.query(
        `INSERT INTO jobs (
          id, org_id, customer_id, assigned_to, scheduled_at,
          status, description, address, city, province, postal_code,
          latitude, longitude, line_items, subtotal, tax_amount, total,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8, $9, $10, $11, $12, '[]', 0, 0, 0, NOW(), NOW())`,
        [
          jobId,
          orgId,
          booking.customerId,
          technicianId,
          scheduledDateTime,
          booking.description || booking.serviceTypeName,
          booking.address,
          booking.city,
          booking.province,
          booking.postalCode,
          null, // latitude
          null, // longitude
        ]
      );

      // Update booking
      await client.query(
        `UPDATE customer_bookings
         SET status = 'confirmed', job_id = $3, confirmed_at = NOW(),
             confirmed_date_time = $4, updated_at = NOW()
         WHERE id = $1 AND org_id = $2`,
        [bookingId, orgId, jobId, scheduledDateTime]
      );

      await client.query('COMMIT');

      console.log(`[Booking] Booking ${bookingId} confirmed, job ${jobId} created`);

      return { success: true, jobId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Record deposit payment
   */
  async recordDepositPayment(
    bookingId: string,
    orgId: string,
    paymentId: string
  ): Promise<{ success: boolean; error?: string }> {
    const booking = await this.getBookingById(bookingId, orgId);

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (booking.status !== 'deposit_required') {
      return { success: false, error: 'Booking does not require deposit' };
    }

    await this.pool.query(
      `UPDATE customer_bookings
       SET deposit_paid = true, status = 'pending', updated_at = NOW()
       WHERE id = $1 AND org_id = $2`,
      [bookingId, orgId]
    );

    console.log(`[Booking] Deposit recorded for booking ${bookingId}`);

    return { success: true };
  }

  /**
   * Expire old pending bookings
   */
  async expirePendingBookings(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE customer_bookings
       SET status = 'expired', updated_at = NOW()
       WHERE status IN ('pending', 'deposit_required')
         AND requested_date_time < NOW() - INTERVAL '1 hour'
       RETURNING id`
    );

    if ((result.rowCount ?? 0) > 0) {
      console.log(`[Booking] Expired ${result.rowCount} pending bookings`);
    }

    return result.rowCount || 0;
  }

  /**
   * Get upcoming bookings for notifications
   */
  async getUpcomingBookings(
    hoursAhead: number
  ): Promise<Array<Booking & { customerPhone: string; customerEmail: string }>> {
    const result = await this.pool.query(
      `SELECT b.*, c.phone as customer_phone, c.email as customer_email
       FROM customer_bookings b
       JOIN customers c ON c.id = b.customer_id
       WHERE b.status = 'confirmed'
         AND b.confirmed_date_time BETWEEN NOW() AND NOW() + INTERVAL '${hoursAhead} hours'
         AND b.reminder_sent = false`,
      []
    );

    return result.rows.map(row => ({
      ...this.mapRowToBooking(row),
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email,
    }));
  }

  /**
   * Map database row to Booking object
   */
  private mapRowToBooking(row: any): Booking {
    return {
      id: row.id,
      customerId: row.customer_id,
      orgId: row.org_id,
      jobId: row.job_id,
      serviceTypeId: row.service_type_id,
      serviceTypeName: row.service_type_name,
      requestedDateTime: new Date(row.requested_date_time),
      confirmedDateTime: row.confirmed_date_time ? new Date(row.confirmed_date_time) : undefined,
      address: row.address,
      city: row.city,
      province: row.province,
      postalCode: row.postal_code,
      description: row.description,
      notes: row.notes,
      status: row.status,
      estimatedPrice: row.estimated_price ? parseFloat(row.estimated_price) : undefined,
      depositAmount: row.deposit_amount ? parseFloat(row.deposit_amount) : undefined,
      depositPaid: row.deposit_paid,
      cancellationReason: row.cancellation_reason,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: BookingService | null = null;

export function getBookingService(pool?: Pool): BookingService {
  if (!instance && pool) {
    instance = new BookingService(pool);
  }
  if (!instance) {
    throw new Error('BookingService not initialized');
  }
  return instance;
}

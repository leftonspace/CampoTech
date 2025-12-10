/**
 * Availability Service
 * ====================
 *
 * Manages availability checking for customer booking.
 */

import { Pool } from 'pg';
import {
  BookingRulesEngine,
  TimeSlot,
  getBookingRulesEngine,
} from './booking-rules';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AvailabilityRequest {
  orgId: string;
  serviceTypeId?: string;
  locationId?: string;
  startDate: Date;
  endDate: Date;
  durationMinutes?: number;
}

export interface DayAvailability {
  date: string;          // ISO date string
  isOpen: boolean;
  slots: TimeSlot[];
  availableSlots: number;
  totalSlots: number;
}

export interface TechnicianAvailability {
  technicianId: string;
  technicianName: string;
  availableSlots: TimeSlot[];
}

export interface ServiceTypeInfo {
  id: string;
  name: string;
  description: string;
  estimatedDurationMinutes: number;
  basePrice: number;
  category: string;
  isAvailableOnline: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class AvailabilityService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get available services for online booking
   */
  async getAvailableServices(orgId: string): Promise<ServiceTypeInfo[]> {
    const result = await this.pool.query(
      `SELECT
        id, name, description, category, product_code,
        unit_price as base_price, is_active
       FROM price_book_items
       WHERE org_id = $1
         AND is_active = true
         AND category IN ('service', 'repair', 'installation', 'maintenance')
       ORDER BY category, name`,
      [orgId]
    );

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      estimatedDurationMinutes: this.estimateDuration(row.category),
      basePrice: parseFloat(row.base_price),
      category: row.category,
      isAvailableOnline: true,
    }));
  }

  /**
   * Estimate duration based on service category
   */
  private estimateDuration(category: string): number {
    const durations: Record<string, number> = {
      inspection: 60,
      maintenance: 90,
      repair: 120,
      installation: 180,
      service: 120,
    };
    return durations[category] || 120;
  }

  /**
   * Get availability for a date range
   */
  async getAvailability(request: AvailabilityRequest): Promise<DayAvailability[]> {
    const rulesEngine = getBookingRulesEngine(request.orgId);
    const availability: DayAvailability[] = [];

    // Get existing bookings in date range
    const existingBookings = await this.getExistingBookings(
      request.orgId,
      request.startDate,
      request.endDate,
      request.locationId
    );

    // Generate availability for each day
    const currentDate = new Date(request.startDate);
    currentDate.setHours(0, 0, 0, 0);

    const endDate = new Date(request.endDate);
    endDate.setHours(23, 59, 59, 999);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Get bookings for this specific day
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayBookings = existingBookings.filter(
        booking => booking.start >= dayStart && booking.start <= dayEnd
      );

      // Generate time slots
      const slots = rulesEngine.generateTimeSlots(currentDate, dayBookings);

      // Filter available slots
      const availableSlots = slots.filter(s => s.available);

      availability.push({
        date: dateStr,
        isOpen: slots.length > 0,
        slots,
        availableSlots: availableSlots.length,
        totalSlots: slots.length,
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availability;
  }

  /**
   * Get existing bookings in date range
   */
  private async getExistingBookings(
    orgId: string,
    startDate: Date,
    endDate: Date,
    locationId?: string
  ): Promise<Array<{ start: Date; end: Date }>> {
    let query = `
      SELECT scheduled_at as start,
             scheduled_at + (COALESCE(estimated_duration, 120) * INTERVAL '1 minute') as end
      FROM jobs
      WHERE org_id = $1
        AND scheduled_at >= $2
        AND scheduled_at <= $3
        AND status NOT IN ('cancelled', 'completed')
    `;
    const params: any[] = [orgId, startDate, endDate];

    if (locationId) {
      query += ` AND location_id = $${params.length + 1}`;
      params.push(locationId);
    }

    const result = await this.pool.query(query, params);

    return result.rows.map(row => ({
      start: new Date(row.start),
      end: new Date(row.end),
    }));
  }

  /**
   * Check if a specific slot is available
   */
  async checkSlotAvailability(
    orgId: string,
    start: Date,
    durationMinutes: number,
    locationId?: string
  ): Promise<{ available: boolean; reason?: string }> {
    const rulesEngine = getBookingRulesEngine(orgId);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // Validate against business rules
    const validation = rulesEngine.validateBusinessHours(start);
    if (!validation.valid) {
      return { available: false, reason: validation.message };
    }

    // Check existing bookings
    const existingBookings = await this.getExistingBookings(
      orgId,
      new Date(start.getTime() - 24 * 60 * 60 * 1000), // Day before
      new Date(start.getTime() + 24 * 60 * 60 * 1000), // Day after
      locationId
    );

    const isAvailable = rulesEngine.isSlotAvailable(start, end, existingBookings);

    if (!isAvailable) {
      return { available: false, reason: 'This time slot is fully booked' };
    }

    return { available: true };
  }

  /**
   * Get available technicians for a slot
   */
  async getAvailableTechnicians(
    orgId: string,
    start: Date,
    durationMinutes: number,
    locationId?: string,
    requiredSkills?: string[]
  ): Promise<TechnicianAvailability[]> {
    // Get all active technicians
    let techQuery = `
      SELECT id, full_name
      FROM users
      WHERE org_id = $1
        AND role = 'technician'
        AND is_active = true
    `;
    const techParams: any[] = [orgId];

    const techniciansResult = await this.pool.query(techQuery, techParams);

    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // Check each technician's availability
    const availableTechnicians: TechnicianAvailability[] = [];

    for (const tech of techniciansResult.rows) {
      // Get technician's existing jobs
      const jobsResult = await this.pool.query(
        `SELECT scheduled_at as start,
                scheduled_at + (COALESCE(estimated_duration, 120) * INTERVAL '1 minute') as end
         FROM jobs
         WHERE assigned_to = $1
           AND scheduled_at::date = $2::date
           AND status NOT IN ('cancelled', 'completed')`,
        [tech.id, start]
      );

      const techJobs = jobsResult.rows.map(row => ({
        start: new Date(row.start),
        end: new Date(row.end),
      }));

      // Check if slot overlaps with existing jobs
      const hasConflict = techJobs.some(job =>
        job.start < end && job.end > start
      );

      if (!hasConflict) {
        availableTechnicians.push({
          technicianId: tech.id,
          technicianName: tech.full_name,
          availableSlots: [{ start, end, available: true }],
        });
      }
    }

    return availableTechnicians;
  }

  /**
   * Get next available slot
   */
  async getNextAvailableSlot(
    orgId: string,
    startFrom: Date,
    durationMinutes: number,
    locationId?: string
  ): Promise<TimeSlot | null> {
    // Search next 14 days
    const searchEndDate = new Date(startFrom);
    searchEndDate.setDate(searchEndDate.getDate() + 14);

    const availability = await this.getAvailability({
      orgId,
      startDate: startFrom,
      endDate: searchEndDate,
      locationId,
      durationMinutes,
    });

    for (const day of availability) {
      for (const slot of day.slots) {
        if (slot.available && slot.start >= startFrom) {
          return slot;
        }
      }
    }

    return null;
  }

  /**
   * Get capacity utilization for analytics
   */
  async getCapacityUtilization(
    orgId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSlots: number;
    bookedSlots: number;
    utilizationPercent: number;
    byDay: Array<{ date: string; utilization: number }>;
  }> {
    const availability = await this.getAvailability({
      orgId,
      startDate,
      endDate,
    });

    let totalSlots = 0;
    let bookedSlots = 0;
    const byDay: Array<{ date: string; utilization: number }> = [];

    for (const day of availability) {
      totalSlots += day.totalSlots;
      bookedSlots += day.totalSlots - day.availableSlots;

      const dayUtilization = day.totalSlots > 0
        ? ((day.totalSlots - day.availableSlots) / day.totalSlots) * 100
        : 0;

      byDay.push({
        date: day.date,
        utilization: Math.round(dayUtilization),
      });
    }

    return {
      totalSlots,
      bookedSlots,
      utilizationPercent: totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0,
      byDay,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: AvailabilityService | null = null;

export function getAvailabilityService(pool?: Pool): AvailabilityService {
  if (!instance && pool) {
    instance = new AvailabilityService(pool);
  }
  if (!instance) {
    throw new Error('AvailabilityService not initialized');
  }
  return instance;
}

/**
 * Booking Rules Engine
 * ====================
 *
 * Business rules for customer self-service booking.
 * Controls what services can be booked, when, and where.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BookingRules {
  // Service rules
  allowedServiceTypes: string[];
  minLeadTimeHours: number;          // Minimum hours before booking
  maxAdvanceBookingDays: number;     // Maximum days in advance

  // Time rules
  businessHours: BusinessHours;
  blockedDates: string[];            // ISO dates that cannot be booked

  // Location rules
  allowedZones: string[];            // Geographic zones/areas
  maxDistanceKm?: number;            // Maximum distance from HQ

  // Capacity rules
  maxBookingsPerSlot: number;        // Concurrent bookings limit
  slotDurationMinutes: number;       // Default slot duration
  bufferMinutes: number;             // Buffer between slots

  // Customer rules
  requirePhoneVerification: boolean;
  requireEmailVerification: boolean;
  maxPendingBookings: number;        // Max pending bookings per customer

  // Payment rules
  requireDeposit: boolean;
  depositPercentage: number;
  allowedPaymentMethods: string[];
}

export interface BusinessHours {
  monday: DayHours | null;
  tuesday: DayHours | null;
  wednesday: DayHours | null;
  thursday: DayHours | null;
  friday: DayHours | null;
  saturday: DayHours | null;
  sunday: DayHours | null;
}

export interface DayHours {
  open: string;   // HH:mm format
  close: string;  // HH:mm format
  breaks?: { start: string; end: string }[];
}

export interface BookingValidationResult {
  valid: boolean;
  errors: BookingValidationError[];
  warnings: string[];
}

export interface BookingValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT RULES
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_BOOKING_RULES: BookingRules = {
  allowedServiceTypes: ['repair', 'installation', 'maintenance', 'inspection'],
  minLeadTimeHours: 24,
  maxAdvanceBookingDays: 30,

  businessHours: {
    monday: { open: '08:00', close: '18:00' },
    tuesday: { open: '08:00', close: '18:00' },
    wednesday: { open: '08:00', close: '18:00' },
    thursday: { open: '08:00', close: '18:00' },
    friday: { open: '08:00', close: '18:00' },
    saturday: { open: '09:00', close: '13:00' },
    sunday: null,
  },
  blockedDates: [],

  allowedZones: [],

  maxBookingsPerSlot: 3,
  slotDurationMinutes: 120,
  bufferMinutes: 30,

  requirePhoneVerification: false,
  requireEmailVerification: false,
  maxPendingBookings: 3,

  requireDeposit: false,
  depositPercentage: 0,
  allowedPaymentMethods: ['mercadopago', 'cash', 'transfer'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKING RULES ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class BookingRulesEngine {
  private rules: BookingRules;
  private timezone: string;

  constructor(rules: Partial<BookingRules> = {}, timezone = 'America/Argentina/Buenos_Aires') {
    this.rules = { ...DEFAULT_BOOKING_RULES, ...rules };
    this.timezone = timezone;
  }

  /**
   * Update rules
   */
  updateRules(rules: Partial<BookingRules>): void {
    this.rules = { ...this.rules, ...rules };
  }

  /**
   * Get current rules
   */
  getRules(): BookingRules {
    return { ...this.rules };
  }

  /**
   * Validate a booking request
   */
  validateBooking(request: {
    serviceType: string;
    requestedDateTime: Date;
    zone?: string;
    customerId: string;
    pendingBookingsCount: number;
    customerHasVerifiedPhone?: boolean;
    customerHasVerifiedEmail?: boolean;
  }): BookingValidationResult {
    const errors: BookingValidationError[] = [];
    const warnings: string[] = [];

    // Validate service type
    if (!this.rules.allowedServiceTypes.includes(request.serviceType)) {
      errors.push({
        code: 'INVALID_SERVICE_TYPE',
        message: `Service type "${request.serviceType}" is not available for online booking`,
        field: 'serviceType',
      });
    }

    // Validate lead time
    const now = new Date();
    const hoursUntilBooking = (request.requestedDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking < this.rules.minLeadTimeHours) {
      errors.push({
        code: 'INSUFFICIENT_LEAD_TIME',
        message: `Bookings require at least ${this.rules.minLeadTimeHours} hours advance notice`,
        field: 'requestedDateTime',
      });
    }

    // Validate advance booking limit
    const daysInAdvance = hoursUntilBooking / 24;
    if (daysInAdvance > this.rules.maxAdvanceBookingDays) {
      errors.push({
        code: 'TOO_FAR_IN_ADVANCE',
        message: `Bookings can only be made up to ${this.rules.maxAdvanceBookingDays} days in advance`,
        field: 'requestedDateTime',
      });
    }

    // Validate business hours
    const businessHoursValidation = this.validateBusinessHours(request.requestedDateTime);
    if (!businessHoursValidation.valid) {
      errors.push({
        code: 'OUTSIDE_BUSINESS_HOURS',
        message: businessHoursValidation.message!,
        field: 'requestedDateTime',
      });
    }

    // Validate blocked dates
    const dateStr = request.requestedDateTime.toISOString().split('T')[0];
    if (this.rules.blockedDates.includes(dateStr)) {
      errors.push({
        code: 'DATE_BLOCKED',
        message: 'This date is not available for bookings',
        field: 'requestedDateTime',
      });
    }

    // Validate zone
    if (request.zone && this.rules.allowedZones.length > 0) {
      if (!this.rules.allowedZones.includes(request.zone)) {
        errors.push({
          code: 'ZONE_NOT_SERVICED',
          message: 'This area is not currently serviced',
          field: 'zone',
        });
      }
    }

    // Validate pending bookings count
    if (request.pendingBookingsCount >= this.rules.maxPendingBookings) {
      errors.push({
        code: 'MAX_PENDING_BOOKINGS',
        message: `You can only have ${this.rules.maxPendingBookings} pending bookings at a time`,
      });
    }

    // Validate verification requirements
    if (this.rules.requirePhoneVerification && !request.customerHasVerifiedPhone) {
      errors.push({
        code: 'PHONE_VERIFICATION_REQUIRED',
        message: 'Phone verification is required to make a booking',
      });
    }

    if (this.rules.requireEmailVerification && !request.customerHasVerifiedEmail) {
      errors.push({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Email verification is required to make a booking',
      });
    }

    // Add warnings
    if (daysInAdvance > 14) {
      warnings.push('Bookings made more than 2 weeks in advance may be subject to rescheduling');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate business hours
   */
  validateBusinessHours(dateTime: Date): { valid: boolean; message?: string } {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const dayName = dayNames[dateTime.getDay()];
    const dayHours = this.rules.businessHours[dayName];

    if (!dayHours) {
      return {
        valid: false,
        message: `We are closed on ${dayName}s`,
      };
    }

    const timeStr = dateTime.toTimeString().slice(0, 5); // HH:mm

    if (timeStr < dayHours.open || timeStr >= dayHours.close) {
      return {
        valid: false,
        message: `Bookings on ${dayName}s are available from ${dayHours.open} to ${dayHours.close}`,
      };
    }

    // Check breaks
    if (dayHours.breaks) {
      for (const breakTime of dayHours.breaks) {
        if (timeStr >= breakTime.start && timeStr < breakTime.end) {
          return {
            valid: false,
            message: `This time falls during a break period (${breakTime.start} - ${breakTime.end})`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Generate available time slots for a date
   */
  generateTimeSlots(date: Date, existingBookings: { start: Date; end: Date }[]): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const dayName = dayNames[date.getDay()];
    const dayHours = this.rules.businessHours[dayName];

    if (!dayHours) {
      return slots;
    }

    // Parse business hours
    const [openHour, openMin] = dayHours.open.split(':').map(Number);
    const [closeHour, closeMin] = dayHours.close.split(':').map(Number);

    // Generate slots
    const slotStart = new Date(date);
    slotStart.setHours(openHour, openMin, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(closeHour, closeMin, 0, 0);

    while (slotStart.getTime() + this.rules.slotDurationMinutes * 60 * 1000 <= dayEnd.getTime()) {
      const slotEnd = new Date(slotStart.getTime() + this.rules.slotDurationMinutes * 60 * 1000);

      // Check if slot overlaps with existing bookings
      const overlappingBookings = existingBookings.filter(booking =>
        booking.start < slotEnd && booking.end > slotStart
      );

      const available = overlappingBookings.length < this.rules.maxBookingsPerSlot;

      slots.push({
        start: new Date(slotStart),
        end: slotEnd,
        available,
        reason: available ? undefined : 'Fully booked',
      });

      // Move to next slot (with buffer)
      slotStart.setMinutes(slotStart.getMinutes() + this.rules.slotDurationMinutes + this.rules.bufferMinutes);
    }

    return slots;
  }

  /**
   * Check if a specific slot is available
   */
  isSlotAvailable(
    start: Date,
    end: Date,
    existingBookings: { start: Date; end: Date }[]
  ): boolean {
    const overlappingBookings = existingBookings.filter(booking =>
      booking.start < end && booking.end > start
    );

    return overlappingBookings.length < this.rules.maxBookingsPerSlot;
  }

  /**
   * Get deposit amount
   */
  calculateDeposit(totalAmount: number): number {
    if (!this.rules.requireDeposit) {
      return 0;
    }
    return Math.round(totalAmount * (this.rules.depositPercentage / 100));
  }

  /**
   * Check if payment method is allowed
   */
  isPaymentMethodAllowed(method: string): boolean {
    return this.rules.allowedPaymentMethods.includes(method);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

const rulesCache = new Map<string, BookingRulesEngine>();

export function getBookingRulesEngine(
  orgId: string,
  rules?: Partial<BookingRules>,
  timezone?: string
): BookingRulesEngine {
  if (!rulesCache.has(orgId)) {
    rulesCache.set(orgId, new BookingRulesEngine(rules, timezone));
  }
  return rulesCache.get(orgId)!;
}

export function updateBookingRulesEngine(
  orgId: string,
  rules: Partial<BookingRules>
): void {
  const engine = rulesCache.get(orgId);
  if (engine) {
    engine.updateRules(rules);
  } else {
    rulesCache.set(orgId, new BookingRulesEngine(rules));
  }
}

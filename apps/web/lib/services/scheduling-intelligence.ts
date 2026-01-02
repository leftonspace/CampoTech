/**
 * Scheduling Intelligence Service
 * ================================
 *
 * Provides intelligent scheduling data for the WhatsApp AI responder.
 * Allows the AI to make informed decisions about:
 * - Employee availability at specific times
 * - Workload distribution across technicians
 * - Distance-based optimal technician selection
 * - Available time slots for booking
 *
 * This service is designed to be called by the AI responder to provide
 * context-aware responses about scheduling and booking.
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TechnicianAvailability {
  id: string;
  name: string;
  specialty: string | null;
  isAvailable: boolean;
  scheduleHours: { start: string; end: string } | null;
  currentJobCount: number;
  maxDailyJobs: number;
  workloadLevel: 'low' | 'medium' | 'high' | 'full';
  distanceKm?: number;
  etaMinutes?: number;
}

export interface TimeSlot {
  start: string; // HH:MM format
  end: string;   // HH:MM format
  availableTechnicians: number;
  bestTechnician?: {
    id: string;
    name: string;
    specialty: string | null;
  };
  confidence: 'high' | 'medium' | 'low';
}

export interface SchedulingContext {
  date: string;
  requestedTime?: string;
  serviceType?: string;
  customerAddress?: {
    lat: number;
    lng: number;
  };
  organizationId: string;
}

export interface SchedulingIntelligenceResult {
  /** Available time slots for the requested date */
  availableSlots: TimeSlot[];
  /** List of technicians with their availability status */
  technicians: TechnicianAvailability[];
  /** Best recommended slot based on availability and workload */
  bestSlot: TimeSlot | null;
  /** Whether the requested time (if any) has conflicts */
  hasConflict: boolean;
  /** Description of the conflict if any */
  conflictReason?: string;
  /** Alternative suggestions if requested time is unavailable */
  alternativeSuggestions: string[];
  /** Summary text for the AI to include in responses */
  summary: string;
  /** Business hours for the day */
  businessHours: { open: string; close: string } | null;
  /** Whether the requested date is a working day */
  isWorkingDay: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateETA(distanceKm: number): number {
  const avgSpeedKmh = 25; // Conservative urban speed
  return Math.ceil((distanceKm / avgSpeedKmh) * 60);
}

function getWorkloadLevel(jobCount: number, maxJobs: number): 'low' | 'medium' | 'high' | 'full' {
  const ratio = jobCount / maxJobs;
  if (ratio >= 1) return 'full';
  if (ratio >= 0.75) return 'high';
  if (ratio >= 0.5) return 'medium';
  return 'low';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class SchedulingIntelligenceService {
  private maxJobsPerTechnician = 5; // Default max jobs per day
  private slotDurationMinutes = 60; // Default slot duration

  /**
   * Get comprehensive scheduling intelligence for a date
   */
  async getSchedulingContext(context: SchedulingContext): Promise<SchedulingIntelligenceResult> {
    const { date, requestedTime, serviceType, customerAddress, organizationId } = context;

    // Parse the date
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return this.createErrorResult('Fecha inválida');
    }

    const dayOfWeek = targetDate.getDay();
    const dayName = DAY_NAMES[dayOfWeek];

    // Get organization's business hours for this day
    const orgConfig = await prisma.aIConfiguration.findUnique({
      where: { organizationId },
      select: { businessHours: true },
    });

    const businessHours = orgConfig?.businessHours as Record<string, { open: string; close: string } | null> | null;
    const dayHours = businessHours?.[dayName.toLowerCase()] || businessHours?.[dayName] || null;

    if (!dayHours) {
      return {
        availableSlots: [],
        technicians: [],
        bestSlot: null,
        hasConflict: true,
        conflictReason: `No trabajamos los ${dayName}s`,
        alternativeSuggestions: this.getNextWorkingDays(targetDate, businessHours),
        summary: `Lo siento, no trabajamos los ${dayName}s. ¿Te gustaría agendar para otro día?`,
        businessHours: null,
        isWorkingDay: false,
      };
    }

    // Get technicians with their schedules
    const technicians = await this.getTechniciansAvailability(
      organizationId,
      targetDate,
      dayOfWeek,
      customerAddress
    );

    // Check if we have any available technicians
    const availableTechnicians = technicians.filter(t => t.isAvailable && t.workloadLevel !== 'full');

    if (availableTechnicians.length === 0) {
      return {
        availableSlots: [],
        technicians,
        bestSlot: null,
        hasConflict: true,
        conflictReason: 'No hay técnicos disponibles para esta fecha',
        alternativeSuggestions: this.getNextWorkingDays(targetDate, businessHours),
        summary: `Lamentablemente no tenemos disponibilidad para el ${dayName} ${this.formatDate(targetDate)}. ¿Te gustaría ver opciones para los próximos días?`,
        businessHours: dayHours,
        isWorkingDay: true,
      };
    }

    // Generate available time slots
    const availableSlots = await this.generateTimeSlots(
      organizationId,
      targetDate,
      dayHours,
      technicians,
      serviceType
    );

    // Check for conflicts with requested time
    let hasConflict = false;
    let conflictReason: string | undefined;
    let alternativeSuggestions: string[] = [];

    if (requestedTime) {
      const requestedMinutes = timeToMinutes(requestedTime);
      const openMinutes = timeToMinutes(dayHours.open);
      const closeMinutes = timeToMinutes(dayHours.close);

      if (requestedMinutes < openMinutes || requestedMinutes >= closeMinutes) {
        hasConflict = true;
        conflictReason = `El horario ${requestedTime} está fuera de nuestro horario de atención (${dayHours.open} - ${dayHours.close})`;
        alternativeSuggestions = availableSlots.slice(0, 3).map(s => s.start);
      } else {
        // Check if any technician is available at this time
        const slotAtTime = availableSlots.find(s =>
          timeToMinutes(s.start) <= requestedMinutes &&
          timeToMinutes(s.end) > requestedMinutes
        );

        if (!slotAtTime || slotAtTime.availableTechnicians === 0) {
          hasConflict = true;
          conflictReason = `No hay técnicos disponibles a las ${requestedTime}`;
          alternativeSuggestions = availableSlots
            .filter(s => s.availableTechnicians > 0)
            .slice(0, 3)
            .map(s => s.start);
        }
      }
    }

    // Find the best slot (most availability, best workload distribution)
    const bestSlot = this.findBestSlot(availableSlots);

    // Generate summary
    const summary = this.generateSummary(
      targetDate,
      dayName,
      availableSlots,
      technicians,
      hasConflict,
      conflictReason,
      alternativeSuggestions,
      bestSlot
    );

    return {
      availableSlots,
      technicians,
      bestSlot,
      hasConflict,
      conflictReason,
      alternativeSuggestions,
      summary,
      businessHours: dayHours,
      isWorkingDay: true,
    };
  }

  /**
   * Get availability for all technicians on a specific date
   */
  private async getTechniciansAvailability(
    organizationId: string,
    targetDate: Date,
    dayOfWeek: number,
    customerAddress?: { lat: number; lng: number }
  ): Promise<TechnicianAvailability[]> {
    // Get all active technicians
    const employees = await prisma.user.findMany({
      where: {
        organizationId,
        role: 'TECHNICIAN',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        specialty: true,
      },
    });

    // Get schedules for this day
    const schedules = await prisma.employeeSchedule.findMany({
      where: {
        organizationId,
        dayOfWeek,
        isAvailable: true,
      },
    });
    type ScheduleType = { userId: string; startTime: string; endTime: string };
    const scheduleMap = new Map<string, ScheduleType>(
      schedules.map((s: ScheduleType) => [s.userId, s])
    );

    // Get exceptions for this date
    const exceptions = await prisma.scheduleException.findMany({
      where: {
        organizationId,
        date: targetDate,
      },
    });
    type ExceptionType = { userId: string; isAvailable: boolean; startTime: string | null; endTime: string | null };
    const exceptionMap = new Map<string, ExceptionType>(
      exceptions.map((e: ExceptionType) => [e.userId, e])
    );

    // Get job counts for this date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const jobCounts = await prisma.jobAssignment.groupBy({
      by: ['technicianId'],
      where: {
        job: {
          organizationId,
          scheduledDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
      },
      _count: { id: true },
    });
    type JobCountType = { technicianId: string; _count: { id: number } };
    const jobCountMap = new Map<string, number>(
      jobCounts.map((j: JobCountType) => [j.technicianId, j._count.id])
    );

    // Get current locations if customer address is provided
    const locationMap = new Map<string, { lat: number; lng: number }>();
    if (customerAddress) {
      const locations = await prisma.technicianLocation.findMany({
        where: { organizationId },
        select: {
          technicianId: true,
          latitude: true,
          longitude: true,
        },
      });
      type LocationType = { technicianId: string; latitude: unknown; longitude: unknown };
      locations.forEach((loc: LocationType) => {
        locationMap.set(loc.technicianId, {
          lat: Number(loc.latitude),
          lng: Number(loc.longitude),
        });
      });
    }

    // Build availability result
    type EmployeeType = { id: string; name: string; specialty: string | null };
    return employees.map((emp: EmployeeType) => {
      const schedule = scheduleMap.get(emp.id);
      const exception = exceptionMap.get(emp.id);
      const jobCount = jobCountMap.get(emp.id) || 0;
      const location = locationMap.get(emp.id);

      // Determine availability
      let isAvailable = false;
      let scheduleHours: { start: string; end: string } | null = null;

      if (exception) {
        // Exception overrides regular schedule
        if (exception.isAvailable && exception.startTime && exception.endTime) {
          isAvailable = true;
          scheduleHours = { start: exception.startTime, end: exception.endTime };
        }
      } else if (schedule) {
        isAvailable = true;
        scheduleHours = { start: schedule.startTime, end: schedule.endTime };
      }

      // Calculate distance if customer address is provided
      let distanceKm: number | undefined;
      let etaMinutes: number | undefined;
      if (customerAddress && location) {
        distanceKm = calculateDistance(
          location.lat,
          location.lng,
          customerAddress.lat,
          customerAddress.lng
        );
        etaMinutes = estimateETA(distanceKm);
      }

      const workloadLevel = getWorkloadLevel(jobCount, this.maxJobsPerTechnician);

      return {
        id: emp.id,
        name: emp.name,
        specialty: emp.specialty,
        isAvailable,
        scheduleHours,
        currentJobCount: jobCount,
        maxDailyJobs: this.maxJobsPerTechnician,
        workloadLevel,
        distanceKm: distanceKm ? Math.round(distanceKm * 10) / 10 : undefined,
        etaMinutes,
      };
    });
  }

  /**
   * Generate available time slots for a date
   */
  private async generateTimeSlots(
    organizationId: string,
    targetDate: Date,
    businessHours: { open: string; close: string },
    technicians: TechnicianAvailability[],
    serviceType?: string
  ): Promise<TimeSlot[]> {
    const slots: TimeSlot[] = [];
    const openMinutes = timeToMinutes(businessHours.open);
    const closeMinutes = timeToMinutes(businessHours.close);

    // Get existing jobs to check for conflicts
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingJobs = await prisma.jobAssignment.findMany({
      where: {
        job: {
          organizationId,
          scheduledDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
      },
      include: {
        job: {
          select: {
            scheduledTimeSlot: true,
            estimatedDuration: true,
          },
        },
      },
    });

    // Build a map of busy times per technician
    const busyTimesMap = new Map<string, Array<{ start: number; end: number }>>();
    type AssignmentType = {
      technicianId: string;
      job: {
        scheduledTimeSlot: { start?: string; end?: string } | null;
        estimatedDuration: number | null;
      };
    };
    existingJobs.forEach((assignment: AssignmentType) => {
      const timeSlot = assignment.job.scheduledTimeSlot;
      if (!timeSlot?.start) return;

      const jobStart = timeToMinutes(timeSlot.start);
      const jobEnd = timeSlot.end
        ? timeToMinutes(timeSlot.end)
        : jobStart + (assignment.job.estimatedDuration || 60);

      const busy = busyTimesMap.get(assignment.technicianId) || [];
      busy.push({ start: jobStart, end: jobEnd });
      busyTimesMap.set(assignment.technicianId, busy);
    });

    // Generate slots
    for (let slotStart = openMinutes; slotStart < closeMinutes; slotStart += this.slotDurationMinutes) {
      const slotEnd = Math.min(slotStart + this.slotDurationMinutes, closeMinutes);

      // Find technicians available for this slot
      const availableForSlot = technicians.filter(tech => {
        if (!tech.isAvailable || tech.workloadLevel === 'full') return false;

        // Check schedule hours
        if (tech.scheduleHours) {
          const schedStart = timeToMinutes(tech.scheduleHours.start);
          const schedEnd = timeToMinutes(tech.scheduleHours.end);
          if (slotStart < schedStart || slotEnd > schedEnd) return false;
        }

        // Check for job conflicts
        const busyTimes = busyTimesMap.get(tech.id) || [];
        const hasConflict = busyTimes.some(busy =>
          !(slotEnd <= busy.start || slotStart >= busy.end)
        );

        return !hasConflict;
      });

      // Find the best technician for this slot (lowest workload, matching specialty)
      let bestTechnician: TechnicianAvailability | undefined;
      if (availableForSlot.length > 0) {
        bestTechnician = availableForSlot.sort((a, b) => {
          // Prefer matching specialty
          if (serviceType) {
            const aMatch = a.specialty?.toLowerCase().includes(serviceType.toLowerCase()) ? 1 : 0;
            const bMatch = b.specialty?.toLowerCase().includes(serviceType.toLowerCase()) ? 1 : 0;
            if (aMatch !== bMatch) return bMatch - aMatch;
          }
          // Then sort by workload (lower is better)
          return a.currentJobCount - b.currentJobCount;
        })[0];
      }

      slots.push({
        start: minutesToTime(slotStart),
        end: minutesToTime(slotEnd),
        availableTechnicians: availableForSlot.length,
        bestTechnician: bestTechnician ? {
          id: bestTechnician.id,
          name: bestTechnician.name,
          specialty: bestTechnician.specialty,
        } : undefined,
        confidence: availableForSlot.length >= 2 ? 'high' : availableForSlot.length === 1 ? 'medium' : 'low',
      });
    }

    return slots;
  }

  /**
   * Find the best slot based on availability and workload
   */
  private findBestSlot(slots: TimeSlot[]): TimeSlot | null {
    // Filter slots with availability
    const availableSlots = slots.filter(s => s.availableTechnicians > 0);
    if (availableSlots.length === 0) return null;

    // Sort by: confidence (high first), then by available technicians, then by earlier time
    return availableSlots.sort((a, b) => {
      const confOrder = { high: 0, medium: 1, low: 2 };
      const confDiff = confOrder[a.confidence] - confOrder[b.confidence];
      if (confDiff !== 0) return confDiff;

      const availDiff = b.availableTechnicians - a.availableTechnicians;
      if (availDiff !== 0) return availDiff;

      return timeToMinutes(a.start) - timeToMinutes(b.start);
    })[0];
  }

  /**
   * Get next working days as suggestions
   */
  private getNextWorkingDays(
    fromDate: Date,
    businessHours: Record<string, { open: string; close: string } | null> | null
  ): string[] {
    const suggestions: string[] = [];
    const date = new Date(fromDate);

    for (let i = 0; i < 14 && suggestions.length < 3; i++) {
      date.setDate(date.getDate() + 1);
      const dayName = DAY_NAMES[date.getDay()];
      const hasHours = businessHours?.[dayName.toLowerCase()] || businessHours?.[dayName];

      if (hasHours) {
        suggestions.push(`${dayName} ${this.formatDate(date)}`);
      }
    }

    return suggestions;
  }

  /**
   * Format date in Spanish
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
    });
  }

  /**
   * Generate a summary for the AI to use
   */
  private generateSummary(
    date: Date,
    dayName: string,
    slots: TimeSlot[],
    technicians: TechnicianAvailability[],
    hasConflict: boolean,
    conflictReason?: string,
    alternatives?: string[],
    bestSlot?: TimeSlot | null
  ): string {
    const dateStr = this.formatDate(date);
    const availableSlots = slots.filter(s => s.availableTechnicians > 0);
    const availableTechs = technicians.filter(t => t.isAvailable && t.workloadLevel !== 'full');

    if (hasConflict && conflictReason) {
      if (alternatives && alternatives.length > 0) {
        return `${conflictReason}. Tenemos disponibilidad a las: ${alternatives.join(', ')}.`;
      }
      return conflictReason;
    }

    if (availableSlots.length === 0) {
      return `No hay horarios disponibles para el ${dayName} ${dateStr}.`;
    }

    const slotsText = availableSlots.length <= 3
      ? availableSlots.map(s => s.start).join(', ')
      : `${availableSlots.slice(0, 3).map(s => s.start).join(', ')} y más`;

    let summary = `Para el ${dayName} ${dateStr} tenemos: ${availableTechs.length} técnico(s) disponible(s). `;
    summary += `Horarios con disponibilidad: ${slotsText}. `;

    if (bestSlot) {
      summary += `Te recomiendo las ${bestSlot.start}`;
      if (bestSlot.bestTechnician?.specialty) {
        summary += ` con ${bestSlot.bestTechnician.name} (especialista en ${bestSlot.bestTechnician.specialty})`;
      }
      summary += '.';
    }

    return summary;
  }

  /**
   * Create an error result
   */
  private createErrorResult(error: string): SchedulingIntelligenceResult {
    return {
      availableSlots: [],
      technicians: [],
      bestSlot: null,
      hasConflict: true,
      conflictReason: error,
      alternativeSuggestions: [],
      summary: error,
      businessHours: null,
      isWorkingDay: false,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

let serviceInstance: SchedulingIntelligenceService | null = null;

export function getSchedulingIntelligenceService(): SchedulingIntelligenceService {
  if (!serviceInstance) {
    serviceInstance = new SchedulingIntelligenceService();
  }
  return serviceInstance;
}

/**
 * Quick helper to get scheduling context for AI responses
 */
export async function getSchedulingContextForAI(
  organizationId: string,
  date: string,
  requestedTime?: string,
  serviceType?: string
): Promise<SchedulingIntelligenceResult> {
  const service = getSchedulingIntelligenceService();
  return service.getSchedulingContext({
    organizationId,
    date,
    requestedTime,
    serviceType,
  });
}

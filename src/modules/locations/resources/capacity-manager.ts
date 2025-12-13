/**
 * Capacity Manager
 * ================
 *
 * Manages location capacity planning, availability forecasting,
 * and workload distribution across locations.
 */

import { PrismaClient, JobStatus } from '@prisma/client';
import { CoverageCalculator } from '../coverage-calculator';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LocationCapacity {
  locationId: string;
  locationName: string;
  date: Date;
  maxJobsPerDay: number;
  scheduledJobs: number;
  availableSlots: number;
  utilizationRate: number; // 0-1
  techniciansAvailable: number;
  techniciansTotal: number;
  jobsPerTechnician: number;
  isOverCapacity: boolean;
  timeSlots: TimeSlotCapacity[];
}

export interface TimeSlotCapacity {
  start: string; // "08:00"
  end: string;   // "10:00"
  maxJobs: number;
  scheduledJobs: number;
  availableSlots: number;
  techniciansAvailable: number;
}

export interface CapacityForecast {
  locationId: string;
  locationName: string;
  forecastDays: CapacityForecastDay[];
  summary: {
    averageUtilization: number;
    peakUtilizationDate: Date;
    peakUtilizationRate: number;
    lowUtilizationDates: Date[];
    recommendedActions: string[];
  };
}

export interface CapacityForecastDay {
  date: Date;
  dayOfWeek: string;
  scheduledJobs: number;
  estimatedCapacity: number;
  utilizationRate: number;
  isWeekend: boolean;
  isHoliday: boolean;
  techniciansExpected: number;
}

export interface OrganizationCapacitySummary {
  organizationId: string;
  date: Date;
  totalCapacity: number;
  totalScheduled: number;
  totalAvailable: number;
  overallUtilization: number;
  locationBreakdown: LocationCapacity[];
  bottlenecks: CapacityBottleneck[];
  recommendations: string[];
}

export interface CapacityBottleneck {
  locationId: string;
  locationName: string;
  type: BottleneckType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  affectedDates: Date[];
  suggestedAction: string;
}

export type BottleneckType =
  | 'OVER_CAPACITY'        // Too many jobs scheduled
  | 'NO_TECHNICIANS'       // No technicians assigned
  | 'SKILL_GAP'           // Missing required specialty
  | 'UNEVEN_DISTRIBUTION'; // Jobs bunched in certain times

export interface CapacityAdjustment {
  locationId: string;
  date: Date;
  adjustmentType: 'INCREASE' | 'DECREASE' | 'OVERRIDE';
  originalCapacity: number;
  newCapacity: number;
  reason: string;
  adjustedById: string;
}

export interface WorkloadDistribution {
  organizationId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  locations: {
    locationId: string;
    locationName: string;
    totalJobs: number;
    completedJobs: number;
    averageJobsPerDay: number;
    peakDays: Date[];
    lowDays: Date[];
    efficiency: number; // completed / total
  }[];
  imbalanceScore: number;
  transferRecommendations: {
    fromLocationId: string;
    toLocationId: string;
    jobCount: number;
    reason: string;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_TIME_SLOTS = [
  { start: '08:00', end: '10:00' },
  { start: '10:00', end: '12:00' },
  { start: '12:00', end: '14:00' },
  { start: '14:00', end: '16:00' },
  { start: '16:00', end: '18:00' },
];

const DEFAULT_JOBS_PER_TECHNICIAN = 4;
const MAX_UTILIZATION_THRESHOLD = 0.9;
const LOW_UTILIZATION_THRESHOLD = 0.3;

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class CapacityError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'CapacityError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPACITY MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class CapacityManager {
  private prisma: PrismaClient;
  private coverageCalculator: CoverageCalculator;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.coverageCalculator = new CoverageCalculator();
  }

  /**
   * Get capacity for a specific location and date
   */
  async getLocationCapacity(
    organizationId: string,
    locationId: string,
    date: Date
  ): Promise<LocationCapacity> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId, isActive: true },
      include: {
        settings: true,
        technicians: {
          where: { isActive: true },
        },
      },
    });

    if (!location) {
      throw new CapacityError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    // Get scheduled jobs for this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const scheduledJobs = await this.prisma.job.count({
      where: {
        locationId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { notIn: [JobStatus.CANCELLED, JobStatus.COMPLETED] },
      },
    });

    // Get all scheduled jobs with time slots for detailed analysis
    const jobsWithSlots = await this.prisma.job.findMany({
      where: {
        locationId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { notIn: [JobStatus.CANCELLED, JobStatus.COMPLETED] },
      },
      select: {
        scheduledTimeSlot: true,
      },
    });

    // Calculate capacity based on settings or defaults
    const settings = location.settings;
    const maxJobsPerDay = (settings?.maxJobsPerDay as number) ||
      location.technicians.length * DEFAULT_JOBS_PER_TECHNICIAN;

    const availableSlots = Math.max(0, maxJobsPerDay - scheduledJobs);
    const utilizationRate = maxJobsPerDay > 0 ? scheduledJobs / maxJobsPerDay : 0;

    // Calculate time slot capacity
    const timeSlots = await this.calculateTimeSlotCapacity(
      location.technicians.length,
      jobsWithSlots,
      settings
    );

    return {
      locationId: location.id,
      locationName: location.name,
      date,
      maxJobsPerDay,
      scheduledJobs,
      availableSlots,
      utilizationRate,
      techniciansAvailable: location.technicians.length,
      techniciansTotal: location.technicians.length,
      jobsPerTechnician: location.technicians.length > 0
        ? scheduledJobs / location.technicians.length
        : 0,
      isOverCapacity: scheduledJobs > maxJobsPerDay,
      timeSlots,
    };
  }

  /**
   * Get capacity forecast for a location
   */
  async getCapacityForecast(
    organizationId: string,
    locationId: string,
    days: number = 14
  ): Promise<CapacityForecast> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
    });

    if (!location) {
      throw new CapacityError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    const forecastDays: CapacityForecastDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalUtilization = 0;
    let peakUtilization = 0;
    let peakDate = today;
    const lowUtilizationDates: Date[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const capacity = await this.getLocationCapacity(organizationId, locationId, date);

      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      forecastDays.push({
        date,
        dayOfWeek,
        scheduledJobs: capacity.scheduledJobs,
        estimatedCapacity: capacity.maxJobsPerDay,
        utilizationRate: capacity.utilizationRate,
        isWeekend,
        isHoliday: false, // Would need holiday calendar integration
        techniciansExpected: capacity.techniciansAvailable,
      });

      totalUtilization += capacity.utilizationRate;

      if (capacity.utilizationRate > peakUtilization) {
        peakUtilization = capacity.utilizationRate;
        peakDate = date;
      }

      if (capacity.utilizationRate < LOW_UTILIZATION_THRESHOLD && !isWeekend) {
        lowUtilizationDates.push(date);
      }
    }

    const averageUtilization = totalUtilization / days;
    const recommendations: string[] = [];

    if (averageUtilization > MAX_UTILIZATION_THRESHOLD) {
      recommendations.push('Consider adding more technicians to this location');
      recommendations.push('Look at redistributing jobs to nearby locations');
    }

    if (lowUtilizationDates.length > days * 0.3) {
      recommendations.push('Many days have low utilization - consider promotional campaigns');
    }

    if (peakUtilization > 1) {
      recommendations.push(`${peakDate.toLocaleDateString()} is over capacity - reschedule or add resources`);
    }

    return {
      locationId,
      locationName: location.name,
      forecastDays,
      summary: {
        averageUtilization,
        peakUtilizationDate: peakDate,
        peakUtilizationRate: peakUtilization,
        lowUtilizationDates,
        recommendedActions: recommendations,
      },
    };
  }

  /**
   * Get organization-wide capacity summary
   */
  async getOrganizationCapacity(
    organizationId: string,
    date: Date
  ): Promise<OrganizationCapacitySummary> {
    const locations = await this.prisma.location.findMany({
      where: { organizationId, isActive: true },
    });

    const locationCapacities: LocationCapacity[] = [];
    let totalCapacity = 0;
    let totalScheduled = 0;

    for (const location of locations as typeof locations) {
      const capacity = await this.getLocationCapacity(organizationId, location.id, date);
      locationCapacities.push(capacity);
      totalCapacity += capacity.maxJobsPerDay;
      totalScheduled += capacity.scheduledJobs;
    }

    const overallUtilization = totalCapacity > 0 ? totalScheduled / totalCapacity : 0;

    // Identify bottlenecks
    const bottlenecks = await this.identifyBottlenecks(locationCapacities, date);

    // Generate recommendations
    const recommendations = this.generateCapacityRecommendations(
      locationCapacities,
      overallUtilization
    );

    return {
      organizationId,
      date,
      totalCapacity,
      totalScheduled,
      totalAvailable: totalCapacity - totalScheduled,
      overallUtilization,
      locationBreakdown: locationCapacities,
      bottlenecks,
      recommendations,
    };
  }

  /**
   * Get workload distribution analysis
   */
  async getWorkloadDistribution(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WorkloadDistribution> {
    const locations = await this.prisma.location.findMany({
      where: { organizationId, isActive: true },
    });

    const locationStats: WorkloadDistribution['locations'] = [];
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    for (const location of locations as typeof locations) {
      const jobs = await this.prisma.job.findMany({
        where: {
          locationId: location.id,
          scheduledDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          status: true,
          scheduledDate: true,
        },
      });

      const totalJobs = jobs.length;
      const completedJobs = jobs.filter(
        (j: typeof jobs[number]) => j.status === JobStatus.COMPLETED
      ).length;

      // Count jobs per day
      const jobsByDay = new Map<string, number>();
      for (const job of jobs as typeof jobs) {
        if (job.scheduledDate) {
          const dayKey = job.scheduledDate.toISOString().split('T')[0];
          jobsByDay.set(dayKey, (jobsByDay.get(dayKey) || 0) + 1);
        }
      }

      const dailyCounts = Array.from(jobsByDay.entries());
      const avgJobsPerDay = totalJobs / daysDiff;

      // Find peak and low days
      const sortedDays = dailyCounts.sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
      const peakDays = sortedDays.slice(0, 3).map(([day]: [string, number]) => new Date(day));
      const lowDays = sortedDays.slice(-3).map(([day]: [string, number]) => new Date(day));

      locationStats.push({
        locationId: location.id,
        locationName: location.name,
        totalJobs,
        completedJobs,
        averageJobsPerDay: avgJobsPerDay,
        peakDays,
        lowDays,
        efficiency: totalJobs > 0 ? completedJobs / totalJobs : 1,
      });
    }

    // Calculate imbalance score
    const avgJobs = locationStats.reduce((sum: number, l: typeof locationStats[number]) => sum + l.totalJobs, 0) / locationStats.length;
    const variance = locationStats.reduce(
      (sum: number, l: typeof locationStats[number]) => sum + Math.pow(l.totalJobs - avgJobs, 2),
      0
    ) / locationStats.length;
    const imbalanceScore = Math.sqrt(variance) / (avgJobs || 1);

    // Generate transfer recommendations
    const transferRecommendations = this.generateTransferRecommendations(locationStats);

    return {
      organizationId,
      period: { startDate, endDate },
      locations: locationStats,
      imbalanceScore,
      transferRecommendations,
    };
  }

  /**
   * Check if a time slot is available at a location
   */
  async isTimeSlotAvailable(
    organizationId: string,
    locationId: string,
    date: Date,
    timeSlot: { start: string; end: string }
  ): Promise<{ available: boolean; reason?: string }> {
    const capacity = await this.getLocationCapacity(organizationId, locationId, date);

    // Find the matching time slot
    const slot = capacity.timeSlots.find(
      (s) => s.start === timeSlot.start && s.end === timeSlot.end
    );

    if (!slot) {
      return { available: true }; // No slot defined, assume available
    }

    if (slot.availableSlots <= 0) {
      return {
        available: false,
        reason: `Time slot ${timeSlot.start}-${timeSlot.end} is fully booked`,
      };
    }

    if (slot.techniciansAvailable <= 0) {
      return {
        available: false,
        reason: 'No technicians available for this time slot',
      };
    }

    return { available: true };
  }

  /**
   * Find best available slot for a job
   */
  async findBestAvailableSlot(
    organizationId: string,
    locationId: string,
    preferredDate: Date,
    searchDays: number = 7
  ): Promise<{ date: Date; timeSlot: { start: string; end: string } } | null> {
    for (let i = 0; i < searchDays; i++) {
      const date = new Date(preferredDate);
      date.setDate(date.getDate() + i);

      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) {
        continue;
      }

      const capacity = await this.getLocationCapacity(organizationId, locationId, date);

      // Find first available slot
      for (const slot of capacity.timeSlots) {
        if (slot.availableSlots > 0 && slot.techniciansAvailable > 0) {
          return {
            date,
            timeSlot: { start: slot.start, end: slot.end },
          };
        }
      }
    }

    return null;
  }

  /**
   * Get available slots for a date range
   */
  async getAvailableSlots(
    organizationId: string,
    locationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: Date; slots: TimeSlotCapacity[] }[]> {
    const results: { date: Date; slots: TimeSlotCapacity[] }[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const capacity = await this.getLocationCapacity(organizationId, locationId, current);
      const availableSlots = capacity.timeSlots.filter((s) => s.availableSlots > 0);

      if (availableSlots.length > 0) {
        results.push({
          date: new Date(current),
          slots: availableSlots,
        });
      }

      current.setDate(current.getDate() + 1);
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private async calculateTimeSlotCapacity(
    technicianCount: number,
    jobs: { scheduledTimeSlot: any }[],
    settings: any
  ): Promise<TimeSlotCapacity[]> {
    const slots = DEFAULT_TIME_SLOTS;
    const maxJobsPerSlot = Math.max(1, Math.ceil(technicianCount * 0.8));

    return slots.map((slot: typeof slots[number]) => {
      const scheduledInSlot = jobs.filter((job: typeof jobs[number]) => {
        const timeSlot = job.scheduledTimeSlot as { start?: string; end?: string } | null;
        return timeSlot?.start === slot.start;
      }).length;

      return {
        start: slot.start,
        end: slot.end,
        maxJobs: maxJobsPerSlot,
        scheduledJobs: scheduledInSlot,
        availableSlots: Math.max(0, maxJobsPerSlot - scheduledInSlot),
        techniciansAvailable: Math.max(0, technicianCount - scheduledInSlot),
      };
    });
  }

  private async identifyBottlenecks(
    capacities: LocationCapacity[],
    date: Date
  ): Promise<CapacityBottleneck[]> {
    const bottlenecks: CapacityBottleneck[] = [];

    for (const capacity of capacities as typeof capacities) {
      // Over capacity
      if (capacity.isOverCapacity) {
        bottlenecks.push({
          locationId: capacity.locationId,
          locationName: capacity.locationName,
          type: 'OVER_CAPACITY',
          severity: capacity.utilizationRate > 1.5 ? 'CRITICAL' : 'HIGH',
          description: `${capacity.scheduledJobs} jobs scheduled against capacity of ${capacity.maxJobsPerDay}`,
          affectedDates: [date],
          suggestedAction: 'Redistribute jobs to other locations or add resources',
        });
      }

      // No technicians
      if (capacity.techniciansTotal === 0) {
        bottlenecks.push({
          locationId: capacity.locationId,
          locationName: capacity.locationName,
          type: 'NO_TECHNICIANS',
          severity: capacity.scheduledJobs > 0 ? 'CRITICAL' : 'MEDIUM',
          description: 'No technicians assigned to this location',
          affectedDates: [date],
          suggestedAction: 'Assign technicians or share from other locations',
        });
      }

      // Uneven time slot distribution
      const slotVariance = this.calculateSlotVariance(capacity.timeSlots);
      if (slotVariance > 0.5) {
        bottlenecks.push({
          locationId: capacity.locationId,
          locationName: capacity.locationName,
          type: 'UNEVEN_DISTRIBUTION',
          severity: 'LOW',
          description: 'Jobs are unevenly distributed across time slots',
          affectedDates: [date],
          suggestedAction: 'Consider redistributing scheduled times',
        });
      }
    }

    return bottlenecks;
  }

  private calculateSlotVariance(slots: TimeSlotCapacity[]): number {
    if (slots.length === 0) return 0;

    const avg = slots.reduce((sum: number, s: typeof slots[number]) => sum + s.scheduledJobs, 0) / slots.length;
    const variance =
      slots.reduce((sum: number, s: typeof slots[number]) => sum + Math.pow(s.scheduledJobs - avg, 2), 0) /
      slots.length;

    return Math.sqrt(variance) / (avg || 1);
  }

  private generateCapacityRecommendations(
    capacities: LocationCapacity[],
    overallUtilization: number
  ): string[] {
    const recommendations: string[] = [];

    if (overallUtilization > MAX_UTILIZATION_THRESHOLD) {
      recommendations.push('Organization is near capacity - consider hiring or expanding');
    }

    if (overallUtilization < LOW_UTILIZATION_THRESHOLD) {
      recommendations.push('Low overall utilization - review marketing or consolidate resources');
    }

    const overCapacity = capacities.filter((c: typeof capacities[number]) => c.isOverCapacity);
    const underUtilized = capacities.filter((c: typeof capacities[number]) => c.utilizationRate < 0.3);

    if (overCapacity.length > 0 && underUtilized.length > 0) {
      recommendations.push(
        `Consider moving jobs from ${overCapacity[0].locationName} to ${underUtilized[0].locationName}`
      );
    }

    return recommendations;
  }

  private generateTransferRecommendations(
    locationStats: WorkloadDistribution['locations']
  ): WorkloadDistribution['transferRecommendations'] {
    const recommendations: WorkloadDistribution['transferRecommendations'] = [];

    // Sort by average jobs per day
    const sorted = [...locationStats].sort(
      (a: typeof locationStats[number], b: typeof locationStats[number]) => b.averageJobsPerDay - a.averageJobsPerDay
    );

    const overloaded = sorted.filter((l: typeof sorted[number]) => l.averageJobsPerDay > sorted[0].averageJobsPerDay * 0.8);
    const underloaded = sorted.filter((l: typeof sorted[number]) => l.averageJobsPerDay < sorted[0].averageJobsPerDay * 0.3);

    for (const from of overloaded as typeof overloaded) {
      for (const to of underloaded as typeof underloaded) {
        const transferCount = Math.floor(
          (from.averageJobsPerDay - to.averageJobsPerDay) / 2
        );

        if (transferCount > 0) {
          recommendations.push({
            fromLocationId: from.locationId,
            toLocationId: to.locationId,
            jobCount: transferCount,
            reason: `Balance workload: ${from.locationName} is overloaded, ${to.locationName} has capacity`,
          });
        }
      }
    }

    return recommendations;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let capacityManager: CapacityManager | null = null;

export function getCapacityManager(prisma?: PrismaClient): CapacityManager {
  if (!capacityManager && prisma) {
    capacityManager = new CapacityManager(prisma);
  }
  if (!capacityManager) {
    throw new Error('CapacityManager not initialized');
  }
  return capacityManager;
}

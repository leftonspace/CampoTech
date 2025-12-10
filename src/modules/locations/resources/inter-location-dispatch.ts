/**
 * Inter-Location Dispatch Service
 * ================================
 *
 * Handles cross-location job dispatch, including:
 * - Finding available technicians across locations
 * - Calculating travel times between locations
 * - Managing job transfers between locations
 * - Optimizing dispatch across the organization
 */

import { PrismaClient, JobStatus, TransferType, TransferStatus } from '@prisma/client';
import { CoverageCalculator } from '../coverage-calculator';
import { Coordinates } from '../location.types';
import { CapacityManager } from './capacity-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DispatchCandidate {
  technicianId: string;
  technicianName: string;
  specialty: string | null;
  skillLevel: string | null;
  homeLocationId: string;
  homeLocationName: string;
  currentLocationId: string;
  currentLocationName: string;
  distanceToJob: number; // km
  estimatedTravelTime: number; // minutes
  currentWorkload: number;
  todayJobCount: number;
  isFromHomeLocation: boolean;
  score: number; // 0-100, higher is better
}

export interface DispatchRecommendation {
  jobId: string;
  recommendedTechnician: DispatchCandidate;
  alternativeTechnicians: DispatchCandidate[];
  requiresTransfer: boolean;
  transferDetails?: {
    fromLocationId: string;
    toLocationId: string;
    estimatedTravelTime: number;
    additionalCost?: number;
  };
  reasoning: string;
}

export interface CrossLocationDispatch {
  id: string;
  jobId: string;
  technicianId: string;
  fromLocationId: string;
  toLocationId: string;
  status: 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED';
  estimatedTravelTime: number;
  actualTravelTime?: number;
  dispatchedAt?: Date;
  arrivedAt?: Date;
  completedAt?: Date;
  notes?: string;
}

export interface TravelTimeMatrix {
  organizationId: string;
  locations: {
    id: string;
    name: string;
    coordinates: Coordinates | null;
  }[];
  travelTimes: {
    fromLocationId: string;
    toLocationId: string;
    distanceKm: number;
    estimatedMinutes: number;
  }[];
}

export interface DispatchOptimizationResult {
  organizationId: string;
  date: Date;
  currentAssignments: {
    jobId: string;
    technicianId: string;
    locationId: string;
  }[];
  optimizedAssignments: {
    jobId: string;
    technicianId: string;
    locationId: string;
    changeReason?: string;
  }[];
  improvements: {
    totalTravelTimeSaved: number; // minutes
    jobsReassigned: number;
    crossLocationDispatchesReduced: number;
  };
}

export interface AvailabilityWindow {
  technicianId: string;
  technicianName: string;
  locationId: string;
  locationName: string;
  date: Date;
  availableFrom: string; // "08:00"
  availableUntil: string; // "18:00"
  bookedSlots: { start: string; end: string }[];
  freeSlots: { start: string; end: string }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const AVERAGE_SPEED_KMH = 30;
const MAX_REASONABLE_TRAVEL_KM = 50;
const DISPATCH_SCORING_WEIGHTS = {
  distance: 0.35,
  workload: 0.25,
  skill: 0.20,
  homeLocation: 0.20,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class DispatchError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'DispatchError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTER-LOCATION DISPATCH SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class InterLocationDispatchService {
  private prisma: PrismaClient;
  private coverageCalculator: CoverageCalculator;
  private capacityManager: CapacityManager;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.coverageCalculator = new CoverageCalculator();
    this.capacityManager = new CapacityManager(prisma);
  }

  /**
   * Find available technicians for a job across all locations
   */
  async findAvailableTechnicians(
    organizationId: string,
    jobId: string,
    options?: {
      maxDistance?: number;
      requiredSpecialty?: string;
      preferHomeLocation?: boolean;
      date?: Date;
    }
  ): Promise<DispatchCandidate[]> {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, organizationId },
      include: {
        customer: true,
        location: true,
      },
    });

    if (!job) {
      throw new DispatchError('JOB_NOT_FOUND', 'Job not found', 404);
    }

    const jobDate = options?.date || job.scheduledDate || new Date();
    const startOfDay = new Date(jobDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(jobDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all active technicians
    const technicians = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: 'TECHNICIAN',
        isActive: true,
        ...(options?.requiredSpecialty && { specialty: options.requiredSpecialty }),
      },
      include: {
        homeLocation: true,
        assignedJobs: {
          where: {
            status: { notIn: [JobStatus.COMPLETED, JobStatus.CANCELLED] },
          },
        },
      },
    });

    // Get job location coordinates
    let jobCoordinates: Coordinates | null = null;
    if (job.location?.coordinates) {
      jobCoordinates = job.location.coordinates as Coordinates;
    }

    const candidates: DispatchCandidate[] = [];

    for (const tech of technicians) {
      // Count today's jobs
      const todayJobs = await this.prisma.job.count({
        where: {
          technicianId: tech.id,
          scheduledDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: { notIn: [JobStatus.CANCELLED] },
        },
      });

      // Calculate distance if coordinates available
      let distance = 0;
      let travelTime = 0;

      if (jobCoordinates && tech.homeLocation?.coordinates) {
        const techCoords = tech.homeLocation.coordinates as Coordinates;
        distance = this.coverageCalculator.calculateDistance(techCoords, jobCoordinates);
        travelTime = this.coverageCalculator.estimateTravelTime(distance);
      }

      // Skip if too far
      if (options?.maxDistance && distance > options.maxDistance) {
        continue;
      }

      // Calculate score
      const score = this.calculateDispatchScore(
        distance,
        tech.assignedJobs.length,
        todayJobs,
        tech.homeLocationId === job.locationId,
        tech.specialty === options?.requiredSpecialty
      );

      // Determine current location (check if on loan)
      const activeTransfer = await this.prisma.interLocationTransfer.findFirst({
        where: {
          referenceId: tech.id,
          transferType: TransferType.TECHNICIAN_LOAN,
          status: TransferStatus.APPROVED,
        },
        include: {
          toLocation: true,
        },
      });

      candidates.push({
        technicianId: tech.id,
        technicianName: tech.name,
        specialty: tech.specialty,
        skillLevel: tech.skillLevel,
        homeLocationId: tech.homeLocationId || '',
        homeLocationName: tech.homeLocation?.name || 'Unassigned',
        currentLocationId: activeTransfer?.toLocationId || tech.homeLocationId || '',
        currentLocationName: activeTransfer?.toLocation.name || tech.homeLocation?.name || 'Unassigned',
        distanceToJob: Math.round(distance * 10) / 10,
        estimatedTravelTime: travelTime,
        currentWorkload: tech.assignedJobs.length,
        todayJobCount: todayJobs,
        isFromHomeLocation: !activeTransfer && tech.homeLocationId === job.locationId,
        score,
      });
    }

    // Sort by score descending
    return candidates.sort((a, b) => b.score - a.score);
  }

  /**
   * Get dispatch recommendation for a job
   */
  async getDispatchRecommendation(
    organizationId: string,
    jobId: string
  ): Promise<DispatchRecommendation> {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, organizationId },
    });

    if (!job) {
      throw new DispatchError('JOB_NOT_FOUND', 'Job not found', 404);
    }

    // Find candidates with specialty preference
    const candidates = await this.findAvailableTechnicians(organizationId, jobId, {
      maxDistance: MAX_REASONABLE_TRAVEL_KM,
      preferHomeLocation: true,
    });

    if (candidates.length === 0) {
      throw new DispatchError(
        'NO_TECHNICIANS_AVAILABLE',
        'No technicians available for this job'
      );
    }

    const recommended = candidates[0];
    const alternatives = candidates.slice(1, 4); // Top 3 alternatives

    const requiresTransfer = !recommended.isFromHomeLocation;

    let reasoning = '';
    if (recommended.isFromHomeLocation) {
      reasoning = `${recommended.technicianName} is from the job's home location with ${recommended.currentWorkload} active jobs`;
    } else if (recommended.distanceToJob < 10) {
      reasoning = `${recommended.technicianName} is nearby (${recommended.distanceToJob}km) with good availability`;
    } else {
      reasoning = `${recommended.technicianName} is the best available option with score ${recommended.score}`;
    }

    const recommendation: DispatchRecommendation = {
      jobId,
      recommendedTechnician: recommended,
      alternativeTechnicians: alternatives,
      requiresTransfer,
      reasoning,
    };

    if (requiresTransfer) {
      recommendation.transferDetails = {
        fromLocationId: recommended.currentLocationId,
        toLocationId: job.locationId || '',
        estimatedTravelTime: recommended.estimatedTravelTime,
      };
    }

    return recommendation;
  }

  /**
   * Create a cross-location dispatch
   */
  async createCrossLocationDispatch(
    organizationId: string,
    jobId: string,
    technicianId: string,
    fromLocationId: string,
    toLocationId: string,
    requestedById: string
  ): Promise<CrossLocationDispatch> {
    // Validate job
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, organizationId },
    });

    if (!job) {
      throw new DispatchError('JOB_NOT_FOUND', 'Job not found', 404);
    }

    // Validate technician
    const technician = await this.prisma.user.findFirst({
      where: { id: technicianId, organizationId },
    });

    if (!technician) {
      throw new DispatchError('TECHNICIAN_NOT_FOUND', 'Technician not found', 404);
    }

    // Validate locations
    const [fromLocation, toLocation] = await Promise.all([
      this.prisma.location.findFirst({ where: { id: fromLocationId, organizationId } }),
      this.prisma.location.findFirst({ where: { id: toLocationId, organizationId } }),
    ]);

    if (!fromLocation || !toLocation) {
      throw new DispatchError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    // Calculate travel time
    let estimatedTravelTime = 30; // Default 30 minutes
    if (fromLocation.coordinates && toLocation.coordinates) {
      const fromCoords = fromLocation.coordinates as Coordinates;
      const toCoords = toLocation.coordinates as Coordinates;
      const distance = this.coverageCalculator.calculateDistance(fromCoords, toCoords);
      estimatedTravelTime = this.coverageCalculator.estimateTravelTime(distance);
    }

    // Create transfer record
    const transfer = await this.prisma.interLocationTransfer.create({
      data: {
        organizationId,
        fromLocationId,
        toLocationId,
        transferType: TransferType.JOB_ASSIGNMENT,
        referenceId: jobId,
        reason: `Cross-location dispatch for job ${job.jobNumber}`,
        notes: `Technician: ${technician.name}, Estimated travel: ${estimatedTravelTime} min`,
        status: TransferStatus.PENDING,
        requestedById,
      },
    });

    // Update job assignment
    await this.prisma.job.update({
      where: { id: jobId },
      data: { technicianId },
    });

    return {
      id: transfer.id,
      jobId,
      technicianId,
      fromLocationId,
      toLocationId,
      status: 'PENDING',
      estimatedTravelTime,
    };
  }

  /**
   * Update dispatch status
   */
  async updateDispatchStatus(
    dispatchId: string,
    status: CrossLocationDispatch['status'],
    userId: string,
    notes?: string
  ): Promise<CrossLocationDispatch> {
    const transfer = await this.prisma.interLocationTransfer.findUnique({
      where: { id: dispatchId },
    });

    if (!transfer) {
      throw new DispatchError('DISPATCH_NOT_FOUND', 'Dispatch not found', 404);
    }

    const updateData: any = { notes };

    switch (status) {
      case 'APPROVED':
        updateData.status = TransferStatus.APPROVED;
        updateData.approvedById = userId;
        updateData.approvedAt = new Date();
        break;
      case 'COMPLETED':
        updateData.status = TransferStatus.COMPLETED;
        updateData.completedAt = new Date();
        break;
      case 'CANCELLED':
        updateData.status = TransferStatus.REJECTED;
        break;
    }

    const updated = await this.prisma.interLocationTransfer.update({
      where: { id: dispatchId },
      data: updateData,
    });

    return {
      id: updated.id,
      jobId: updated.referenceId || '',
      technicianId: '', // Would need to track separately
      fromLocationId: updated.fromLocationId,
      toLocationId: updated.toLocationId,
      status,
      estimatedTravelTime: 0, // Parse from notes
      completedAt: updated.completedAt || undefined,
    };
  }

  /**
   * Get travel time matrix between all locations
   */
  async getTravelTimeMatrix(organizationId: string): Promise<TravelTimeMatrix> {
    const locations = await this.prisma.location.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        coordinates: true,
      },
    });

    const travelTimes: TravelTimeMatrix['travelTimes'] = [];

    for (const from of locations) {
      for (const to of locations) {
        if (from.id === to.id) continue;

        let distance = 0;
        let estimatedMinutes = 30; // Default

        if (from.coordinates && to.coordinates) {
          const fromCoords = from.coordinates as Coordinates;
          const toCoords = to.coordinates as Coordinates;
          distance = this.coverageCalculator.calculateDistance(fromCoords, toCoords);
          estimatedMinutes = this.coverageCalculator.estimateTravelTime(distance);
        }

        travelTimes.push({
          fromLocationId: from.id,
          toLocationId: to.id,
          distanceKm: Math.round(distance * 10) / 10,
          estimatedMinutes,
        });
      }
    }

    return {
      organizationId,
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        coordinates: l.coordinates as Coordinates | null,
      })),
      travelTimes,
    };
  }

  /**
   * Get technician availability windows
   */
  async getTechnicianAvailability(
    organizationId: string,
    technicianId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AvailabilityWindow[]> {
    const technician = await this.prisma.user.findFirst({
      where: { id: technicianId, organizationId },
      include: { homeLocation: true },
    });

    if (!technician) {
      throw new DispatchError('TECHNICIAN_NOT_FOUND', 'Technician not found', 404);
    }

    const windows: AvailabilityWindow[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      // Skip weekends
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        const dayStart = new Date(current);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(current);
        dayEnd.setHours(23, 59, 59, 999);

        // Get jobs for this day
        const jobs = await this.prisma.job.findMany({
          where: {
            technicianId,
            scheduledDate: {
              gte: dayStart,
              lte: dayEnd,
            },
            status: { notIn: [JobStatus.CANCELLED] },
          },
          select: {
            scheduledTimeSlot: true,
          },
        });

        const bookedSlots = jobs
          .filter((j) => j.scheduledTimeSlot)
          .map((j) => {
            const slot = j.scheduledTimeSlot as { start: string; end: string };
            return { start: slot.start, end: slot.end };
          });

        // Calculate free slots (simplified)
        const freeSlots = this.calculateFreeSlots(bookedSlots);

        windows.push({
          technicianId: technician.id,
          technicianName: technician.name,
          locationId: technician.homeLocationId || '',
          locationName: technician.homeLocation?.name || 'Unassigned',
          date: new Date(current),
          availableFrom: '08:00',
          availableUntil: '18:00',
          bookedSlots,
          freeSlots,
        });
      }

      current.setDate(current.getDate() + 1);
    }

    return windows;
  }

  /**
   * Get pending cross-location dispatches
   */
  async getPendingDispatches(organizationId: string): Promise<CrossLocationDispatch[]> {
    const transfers = await this.prisma.interLocationTransfer.findMany({
      where: {
        organizationId,
        transferType: TransferType.JOB_ASSIGNMENT,
        status: { in: [TransferStatus.PENDING, TransferStatus.APPROVED] },
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
      orderBy: { requestedAt: 'desc' },
    });

    return transfers.map((t) => ({
      id: t.id,
      jobId: t.referenceId || '',
      technicianId: '', // Would need to track
      fromLocationId: t.fromLocationId,
      toLocationId: t.toLocationId,
      status: t.status === TransferStatus.APPROVED ? 'APPROVED' : 'PENDING',
      estimatedTravelTime: 0,
      dispatchedAt: t.approvedAt || undefined,
    }));
  }

  /**
   * Optimize dispatches for a date
   */
  async optimizeDispatches(
    organizationId: string,
    date: Date
  ): Promise<DispatchOptimizationResult> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all scheduled jobs
    const jobs = await this.prisma.job.findMany({
      where: {
        organizationId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { notIn: [JobStatus.CANCELLED, JobStatus.COMPLETED] },
      },
      include: {
        technician: {
          include: { homeLocation: true },
        },
        location: true,
      },
    });

    const currentAssignments = jobs
      .filter((j) => j.technicianId)
      .map((j) => ({
        jobId: j.id,
        technicianId: j.technicianId!,
        locationId: j.locationId || '',
      }));

    // Simple optimization: identify cross-location assignments that could be local
    const optimizedAssignments: DispatchOptimizationResult['optimizedAssignments'] = [];
    let totalTravelTimeSaved = 0;
    let jobsReassigned = 0;

    for (const job of jobs) {
      if (!job.technician || !job.location) continue;

      // Check if technician is from a different location
      if (job.technician.homeLocationId !== job.locationId) {
        // Look for a local technician
        const localTech = await this.prisma.user.findFirst({
          where: {
            organizationId,
            homeLocationId: job.locationId,
            role: 'TECHNICIAN',
            isActive: true,
            // Similar specialty preferred
            ...(job.technician.specialty && { specialty: job.technician.specialty }),
          },
        });

        if (localTech) {
          // Check workload
          const localWorkload = await this.prisma.job.count({
            where: {
              technicianId: localTech.id,
              scheduledDate: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          });

          const currentWorkload = await this.prisma.job.count({
            where: {
              technicianId: job.technicianId!,
              scheduledDate: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          });

          // If local tech has lower workload, suggest reassignment
          if (localWorkload < currentWorkload) {
            optimizedAssignments.push({
              jobId: job.id,
              technicianId: localTech.id,
              locationId: job.locationId!,
              changeReason: 'Local technician with lower workload available',
            });
            totalTravelTimeSaved += 30; // Estimated savings
            jobsReassigned++;
          }
        }
      }
    }

    return {
      organizationId,
      date,
      currentAssignments,
      optimizedAssignments,
      improvements: {
        totalTravelTimeSaved,
        jobsReassigned,
        crossLocationDispatchesReduced: jobsReassigned,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private calculateDispatchScore(
    distance: number,
    currentWorkload: number,
    todayJobs: number,
    isHomeLocation: boolean,
    hasRequiredSkill: boolean
  ): number {
    // Distance score (0-100, closer is better)
    const distanceScore = Math.max(0, 100 - distance * 2);

    // Workload score (0-100, lower workload is better)
    const workloadScore = Math.max(0, 100 - (currentWorkload * 10 + todayJobs * 15));

    // Home location bonus
    const homeBonus = isHomeLocation ? 100 : 0;

    // Skill bonus
    const skillBonus = hasRequiredSkill ? 100 : 50;

    // Weighted score
    const score =
      distanceScore * DISPATCH_SCORING_WEIGHTS.distance +
      workloadScore * DISPATCH_SCORING_WEIGHTS.workload +
      homeBonus * DISPATCH_SCORING_WEIGHTS.homeLocation +
      skillBonus * DISPATCH_SCORING_WEIGHTS.skill;

    return Math.round(score);
  }

  private calculateFreeSlots(
    bookedSlots: { start: string; end: string }[]
  ): { start: string; end: string }[] {
    const workingHours = [
      { start: '08:00', end: '10:00' },
      { start: '10:00', end: '12:00' },
      { start: '12:00', end: '14:00' },
      { start: '14:00', end: '16:00' },
      { start: '16:00', end: '18:00' },
    ];

    return workingHours.filter((slot) => {
      return !bookedSlots.some(
        (booked) => booked.start === slot.start && booked.end === slot.end
      );
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let dispatchService: InterLocationDispatchService | null = null;

export function getInterLocationDispatchService(
  prisma?: PrismaClient
): InterLocationDispatchService {
  if (!dispatchService && prisma) {
    dispatchService = new InterLocationDispatchService(prisma);
  }
  if (!dispatchService) {
    throw new Error('InterLocationDispatchService not initialized');
  }
  return dispatchService;
}

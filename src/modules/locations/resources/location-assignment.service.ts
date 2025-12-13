/**
 * Location Assignment Service
 * ===========================
 *
 * Manages technician home location assignments and location-based team organization.
 * Handles technician-to-location relationships and workload distribution.
 */

import { PrismaClient, UserRole } from '@prisma/client';
import { CoverageCalculator } from '../coverage-calculator';
import { Coordinates } from '../location.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TechnicianAssignment {
  userId: string;
  userName: string;
  specialty: string | null;
  skillLevel: string | null;
  homeLocationId: string | null;
  homeLocationName: string | null;
  isActive: boolean;
  currentJobCount: number;
  todayJobCount: number;
}

export interface LocationTeam {
  locationId: string;
  locationName: string;
  locationCode: string;
  technicians: TechnicianAssignment[];
  totalTechnicians: number;
  activeTechnicians: number;
  techniciansBySpecialty: Record<string, number>;
  techniciansBySkillLevel: Record<string, number>;
}

export interface AssignmentRecommendation {
  technicianId: string;
  technicianName: string;
  recommendedLocationId: string;
  recommendedLocationName: string;
  reason: AssignmentReason;
  score: number;
  details: {
    currentWorkload: number;
    averageDistanceToJobs: number;
    locationCapacity: number;
    teamBalance: number;
  };
}

export type AssignmentReason =
  | 'WORKLOAD_BALANCE'      // Even out workload across locations
  | 'PROXIMITY'             // Technician is closer to this location's service area
  | 'SPECIALTY_NEEDED'      // Location needs this specialty
  | 'CAPACITY_AVAILABLE'    // Location has capacity for more technicians
  | 'CURRENT_ASSIGNMENT';   // Already optimally assigned

export interface BulkAssignmentResult {
  success: boolean;
  assigned: number;
  failed: number;
  assignments: {
    userId: string;
    locationId: string;
    success: boolean;
    error?: string;
  }[];
}

export interface TeamBalanceReport {
  organizationId: string;
  locations: {
    locationId: string;
    locationName: string;
    technicianCount: number;
    activeJobCount: number;
    ratio: number; // jobs per technician
  }[];
  imbalanceScore: number; // 0 = perfectly balanced, higher = more imbalanced
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class AssignmentError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'AssignmentError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION ASSIGNMENT SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class LocationAssignmentService {
  private prisma: PrismaClient;
  private coverageCalculator: CoverageCalculator;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.coverageCalculator = new CoverageCalculator();
  }

  /**
   * Assign a technician to their home location
   */
  async assignTechnicianToLocation(
    organizationId: string,
    userId: string,
    locationId: string
  ): Promise<TechnicianAssignment> {
    // Verify technician exists and belongs to organization
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        role: { in: [UserRole.TECHNICIAN, UserRole.ADMIN] },
      },
    });

    if (!user) {
      throw new AssignmentError(
        'TECHNICIAN_NOT_FOUND',
        'Technician not found or not authorized',
        404
      );
    }

    // Verify location exists and belongs to organization
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
        isActive: true,
      },
    });

    if (!location) {
      throw new AssignmentError(
        'LOCATION_NOT_FOUND',
        'Location not found or inactive',
        404
      );
    }

    // Update the technician's home location
    await this.prisma.user.update({
      where: { id: userId },
      data: { homeLocationId: locationId },
    });

    return this.getTechnicianAssignment(organizationId, userId);
  }

  /**
   * Remove technician from their home location
   */
  async unassignTechnician(
    organizationId: string,
    userId: string
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
    });

    if (!user) {
      throw new AssignmentError(
        'TECHNICIAN_NOT_FOUND',
        'Technician not found',
        404
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { homeLocationId: null },
    });
  }

  /**
   * Get a single technician's assignment details
   */
  async getTechnicianAssignment(
    organizationId: string,
    userId: string
  ): Promise<TechnicianAssignment> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
      include: {
        homeLocation: true,
        assignedJobs: {
          where: {
            status: { in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS'] },
          },
        },
      },
    });

    if (!user) {
      throw new AssignmentError(
        'TECHNICIAN_NOT_FOUND',
        'Technician not found',
        404
      );
    }

    const todayJobs = await this.prisma.job.count({
      where: {
        technicianId: userId,
        scheduledDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return {
      userId: user.id,
      userName: user.name,
      specialty: user.specialty,
      skillLevel: user.skillLevel,
      homeLocationId: user.homeLocationId,
      homeLocationName: user.homeLocation?.name || null,
      isActive: user.isActive,
      currentJobCount: user.assignedJobs.length,
      todayJobCount: todayJobs,
    };
  }

  /**
   * Get all technicians for an organization with their assignments
   */
  async getAllTechnicianAssignments(
    organizationId: string,
    options?: {
      locationId?: string;
      specialty?: string;
      onlyUnassigned?: boolean;
      onlyActive?: boolean;
    }
  ): Promise<TechnicianAssignment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {
      organizationId,
      role: { in: [UserRole.TECHNICIAN, UserRole.ADMIN] },
    };

    if (options?.locationId) {
      where.homeLocationId = options.locationId;
    }

    if (options?.specialty) {
      where.specialty = options.specialty;
    }

    if (options?.onlyUnassigned) {
      where.homeLocationId = null;
    }

    if (options?.onlyActive) {
      where.isActive = true;
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        homeLocation: true,
        assignedJobs: {
          where: {
            status: { in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS'] },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const assignments: TechnicianAssignment[] = [];

    for (const user of users) {
      const todayJobs = await this.prisma.job.count({
        where: {
          technicianId: user.id,
          scheduledDate: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      assignments.push({
        userId: user.id,
        userName: user.name,
        specialty: user.specialty,
        skillLevel: user.skillLevel,
        homeLocationId: user.homeLocationId,
        homeLocationName: user.homeLocation?.name || null,
        isActive: user.isActive,
        currentJobCount: user.assignedJobs.length,
        todayJobCount: todayJobs,
      });
    }

    return assignments;
  }

  /**
   * Get team for a specific location
   */
  async getLocationTeam(
    organizationId: string,
    locationId: string
  ): Promise<LocationTeam> {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
      },
    });

    if (!location) {
      throw new AssignmentError(
        'LOCATION_NOT_FOUND',
        'Location not found',
        404
      );
    }

    const technicians = await this.getAllTechnicianAssignments(organizationId, {
      locationId,
    });

    const techniciansBySpecialty: Record<string, number> = {};
    const techniciansBySkillLevel: Record<string, number> = {};
    let activeTechnicians = 0;

    for (const tech of technicians) {
      if (tech.isActive) {
        activeTechnicians++;
      }

      if (tech.specialty) {
        techniciansBySpecialty[tech.specialty] =
          (techniciansBySpecialty[tech.specialty] || 0) + 1;
      }

      if (tech.skillLevel) {
        techniciansBySkillLevel[tech.skillLevel] =
          (techniciansBySkillLevel[tech.skillLevel] || 0) + 1;
      }
    }

    return {
      locationId: location.id,
      locationName: location.name,
      locationCode: location.code,
      technicians,
      totalTechnicians: technicians.length,
      activeTechnicians,
      techniciansBySpecialty,
      techniciansBySkillLevel,
    };
  }

  /**
   * Get teams for all locations in organization
   */
  async getAllLocationTeams(organizationId: string): Promise<LocationTeam[]> {
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      orderBy: [{ isHeadquarters: 'desc' }, { name: 'asc' }],
    });

    const teams: LocationTeam[] = [];

    for (const location of locations) {
      const team = await this.getLocationTeam(organizationId, location.id);
      teams.push(team);
    }

    // Also get unassigned technicians
    const unassigned = await this.getAllTechnicianAssignments(organizationId, {
      onlyUnassigned: true,
    });

    if (unassigned.length > 0) {
      teams.push({
        locationId: 'unassigned',
        locationName: 'Unassigned',
        locationCode: 'UNASSIGNED',
        technicians: unassigned,
        totalTechnicians: unassigned.length,
        activeTechnicians: unassigned.filter((t: typeof unassigned[number]) => t.isActive).length,
        techniciansBySpecialty: {},
        techniciansBySkillLevel: {},
      });
    }

    return teams;
  }

  /**
   * Bulk assign technicians to locations
   */
  async bulkAssignTechnicians(
    organizationId: string,
    assignments: { userId: string; locationId: string }[]
  ): Promise<BulkAssignmentResult> {
    const results: BulkAssignmentResult['assignments'] = [];
    let assigned = 0;
    let failed = 0;

    for (const assignment of assignments) {
      try {
        await this.assignTechnicianToLocation(
          organizationId,
          assignment.userId,
          assignment.locationId
        );
        results.push({
          userId: assignment.userId,
          locationId: assignment.locationId,
          success: true,
        });
        assigned++;
      } catch (error) {
        results.push({
          userId: assignment.userId,
          locationId: assignment.locationId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }
    }

    return {
      success: failed === 0,
      assigned,
      failed,
      assignments: results,
    };
  }

  /**
   * Get assignment recommendations for unassigned technicians
   */
  async getAssignmentRecommendations(
    organizationId: string
  ): Promise<AssignmentRecommendation[]> {
    // Get unassigned technicians
    const unassignedTechnicians = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: { in: [UserRole.TECHNICIAN, UserRole.ADMIN] },
        homeLocationId: null,
        isActive: true,
      },
      include: {
        assignedJobs: {
          where: {
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
          include: {
            customer: true,
          },
        },
      },
    });

    // Get all active locations with their team sizes
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        technicians: {
          where: { isActive: true },
        },
        jobs: {
          where: {
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        },
      },
    });

    const recommendations: AssignmentRecommendation[] = [];

    for (const technician of unassignedTechnicians) {
      let bestLocation = locations[0];
      let bestScore = 0;
      let bestReason: AssignmentReason = 'CAPACITY_AVAILABLE';

      for (const location of locations) {
        let score = 0;
        let reason: AssignmentReason = 'CAPACITY_AVAILABLE';

        // Score based on team balance (fewer technicians = higher score)
        const teamBalanceScore = Math.max(0, 1 - location.technicians.length / 10);
        score += teamBalanceScore * 0.3;

        // Score based on workload (more jobs = higher need)
        const workloadScore = Math.min(1, location.jobs.length / 20);
        score += workloadScore * 0.3;
        if (workloadScore > 0.5) {
          reason = 'WORKLOAD_BALANCE';
        }

        // Check if location needs this specialty
        if (technician.specialty) {
          const hasSpecialty = location.technicians.some(
            (t: typeof location.technicians[number]) => t.specialty === technician.specialty
          );
          if (!hasSpecialty) {
            score += 0.3;
            reason = 'SPECIALTY_NEEDED';
          }
        }

        // Score based on proximity to recent jobs
        if (
          location.coordinates &&
          technician.assignedJobs.length > 0
        ) {
          const locationCoords = location.coordinates as Coordinates;
          let totalDistance = 0;

          for (const job of technician.assignedJobs) {
            if (job.customer) {
              // Use customer address or default coordinates
              totalDistance += 5; // Placeholder distance
            }
          }

          const avgDistance = totalDistance / technician.assignedJobs.length;
          const proximityScore = Math.max(0, 1 - avgDistance / 50);
          score += proximityScore * 0.1;

          if (proximityScore > 0.7) {
            reason = 'PROXIMITY';
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestLocation = location;
          bestReason = reason;
        }
      }

      if (bestLocation) {
        recommendations.push({
          technicianId: technician.id,
          technicianName: technician.name,
          recommendedLocationId: bestLocation.id,
          recommendedLocationName: bestLocation.name,
          reason: bestReason,
          score: Math.round(bestScore * 100),
          details: {
            currentWorkload: technician.assignedJobs.length,
            averageDistanceToJobs: 0, // Would need customer coordinates
            locationCapacity: bestLocation.technicians.length,
            teamBalance: locations.length > 0
              ? bestLocation.technicians.length / (locations.reduce((sum: number, l: typeof locations[number]) => sum + l.technicians.length, 0) / locations.length)
              : 1,
          },
        });
      }
    }

    // Sort by score descending
    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * Get team balance report across all locations
   */
  async getTeamBalanceReport(organizationId: string): Promise<TeamBalanceReport> {
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        technicians: {
          where: { isActive: true },
        },
        jobs: {
          where: {
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        },
      },
    });

    const locationStats = locations.map((location: typeof locations[number]) => ({
      locationId: location.id,
      locationName: location.name,
      technicianCount: location.technicians.length,
      activeJobCount: location.jobs.length,
      ratio: location.technicians.length > 0
        ? location.jobs.length / location.technicians.length
        : location.jobs.length > 0 ? Infinity : 0,
    }));

    // Calculate imbalance score (standard deviation of ratios)
    const ratios = locationStats.map((s: typeof locationStats[number]) => s.ratio).filter((r: number) => r !== Infinity);
    const avgRatio = ratios.length > 0
      ? ratios.reduce((sum: number, r: typeof ratios[number]) => sum + r, 0) / ratios.length
      : 0;
    const variance = ratios.length > 0
      ? ratios.reduce((sum: number, r: typeof ratios[number]) => sum + Math.pow(r - avgRatio, 2), 0) / ratios.length
      : 0;
    const imbalanceScore = Math.sqrt(variance);

    // Generate recommendations
    const recommendations: string[] = [];

    // Check for locations with no technicians
    const noTechLocations = locationStats.filter((s: typeof locationStats[number]) => s.technicianCount === 0 && s.activeJobCount > 0);
    for (const loc of noTechLocations) {
      recommendations.push(
        `${loc.locationName} has ${loc.activeJobCount} active jobs but no assigned technicians`
      );
    }

    // Check for overloaded locations
    const overloaded = locationStats.filter((s: typeof locationStats[number]) => s.ratio > avgRatio * 1.5);
    for (const loc of overloaded) {
      recommendations.push(
        `${loc.locationName} is overloaded (${loc.activeJobCount} jobs / ${loc.technicianCount} technicians)`
      );
    }

    // Check for underutilized locations
    const underutilized = locationStats.filter((s: typeof locationStats[number]) => s.ratio < avgRatio * 0.5 && s.technicianCount > 1);
    for (const loc of underutilized) {
      recommendations.push(
        `${loc.locationName} may have excess capacity (${loc.technicianCount} technicians, ${loc.activeJobCount} jobs)`
      );
    }

    return {
      organizationId,
      locations: locationStats,
      imbalanceScore: Math.round(imbalanceScore * 100) / 100,
      recommendations,
    };
  }

  /**
   * Check if a technician can be assigned to a location
   */
  async validateAssignment(
    organizationId: string,
    userId: string,
    locationId: string
  ): Promise<{ valid: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    // Check user exists
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
      include: {
        assignedJobs: {
          where: {
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
          include: {
            location: true,
          },
        },
      },
    });

    if (!user) {
      return { valid: false, warnings: ['Technician not found'] };
    }

    // Check location exists
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
      },
    });

    if (!location) {
      return { valid: false, warnings: ['Location not found'] };
    }

    // Check for active jobs at different locations
    const jobsAtOtherLocations = user.assignedJobs.filter(
      (job: typeof user.assignedJobs[number]) => job.locationId && job.locationId !== locationId
    );

    if (jobsAtOtherLocations.length > 0) {
      warnings.push(
        `Technician has ${jobsAtOtherLocations.length} active jobs at other locations`
      );
    }

    return { valid: true, warnings };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let assignmentService: LocationAssignmentService | null = null;

export function getLocationAssignmentService(
  prisma?: PrismaClient
): LocationAssignmentService {
  if (!assignmentService && prisma) {
    assignmentService = new LocationAssignmentService(prisma);
  }
  if (!assignmentService) {
    throw new Error('LocationAssignmentService not initialized');
  }
  return assignmentService;
}

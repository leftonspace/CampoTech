/**
 * Dispatch Availability API
 *
 * Returns real-time technician availability data for AI-assisted dispatch decisions.
 * This endpoint provides all the information needed to make optimal assignment choices.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TechnicianAvailability {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  specialty: string | null;
  skillLevel: string | null;
  currentStatus: 'disponible' | 'en_camino' | 'trabajando' | 'sin_conexion';
  currentLocation: {
    lat: number;
    lng: number;
    accuracy: number | null;
    lastUpdated: string;
  } | null;
  todaysSchedule: {
    totalJobs: number;
    completed: number;
    inProgress: number;
    remaining: number;
    nextAvailableSlot: string | null;
    estimatedFinishTime: string | null;
  };
  currentJob: {
    id: string;
    jobNumber: string;
    customerName: string;
    address: string;
    status: string;
    startedAt: string | null;
    estimatedDuration: number | null;
  } | null;
  distanceToTarget: number | null; // km
  etaMinutes: number | null;
  historicalPerformance: {
    averageJobDuration: number | null; // minutes
    averageRating: number | null;
    completionRate: number | null;
    jobsCompletedThisMonth: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// Haversine formula to calculate distance between two coordinates
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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

// Estimate ETA based on distance (assuming average speed of 30 km/h in urban areas)
function estimateETA(distanceKm: number): number {
  const avgSpeedKmh = 30;
  return Math.round((distanceKm / avgSpeedKmh) * 60);
}

// Determine technician status based on location data and current job
function determineTechnicianStatus(
  location: { isOnline: boolean; lastSeen: Date } | null,
  currentJobStatus: string | null
): 'disponible' | 'en_camino' | 'trabajando' | 'sin_conexion' {
  if (!location || !location.isOnline) return 'sin_conexion';

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (location.lastSeen < fiveMinutesAgo) return 'sin_conexion';

  if (currentJobStatus === 'IN_PROGRESS') return 'trabajando';
  if (currentJobStatus === 'EN_ROUTE') return 'en_camino';

  return 'disponible';
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only owners and dispatchers can access dispatch data
    const userRole = session.role?.toUpperCase();
    if (userRole !== 'OWNER' && userRole !== 'DISPATCHER') {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetLat = searchParams.get('targetLat')
      ? parseFloat(searchParams.get('targetLat')!)
      : null;
    const targetLng = searchParams.get('targetLng')
      ? parseFloat(searchParams.get('targetLng')!)
      : null;
    const serviceType = searchParams.get('serviceType');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Fetch all active technicians with their data
    const technicians = await prisma.user.findMany({
      where: {
        organizationId: session.organizationId,
        role: 'TECHNICIAN',
        isActive: true,
      },
      include: {
        currentLocation: true,
        assignedJobs: {
          where: {
            scheduledDate: {
              gte: today,
              lt: tomorrow,
            },
          },
          include: {
            customer: {
              select: { name: true },
            },
          },
          orderBy: { scheduledDate: 'asc' },
        },
      },
    });

    // Fetch historical performance data for all technicians
    const technicianIds = technicians.map((t: { id: string }) => t.id);

    // Get job completion stats for this month
    const monthlyStats = await prisma.job.groupBy({
      by: ['technicianId'],
      where: {
        technicianId: { in: technicianIds },
        completedAt: { gte: startOfMonth },
        status: 'COMPLETED',
      },
      _count: { id: true },
      _avg: { actualDuration: true },
    });

    // Get average ratings from reviews
    const ratingsData = await prisma.review.groupBy({
      by: ['technicianId'],
      where: {
        technicianId: { in: technicianIds },
        rating: { not: null },
      },
      _avg: { rating: true },
      _count: { id: true },
    });

    // Map stats by technician ID
    type StatsEntry = { count: number; avgDuration: number | null };
    type RatingsEntry = { avgRating: number | null; count: number };

    const statsMap = new Map<string | null, StatsEntry>(
      monthlyStats.map((s: { technicianId: string | null; _count: { id: number }; _avg: { actualDuration: number | null } }) => [
        s.technicianId,
        { count: s._count.id, avgDuration: s._avg.actualDuration },
      ])
    );
    const ratingsMap = new Map<string | null, RatingsEntry>(
      ratingsData.map((r: { technicianId: string | null; _avg: { rating: number | null }; _count: { id: number } }) => [
        r.technicianId,
        { avgRating: r._avg.rating, count: r._count.id },
      ])
    );

    // Build availability data for each technician
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const availability: TechnicianAvailability[] = technicians.map((tech: any) => {
      const todaysJobs = tech.assignedJobs;
      const completedJobs = todaysJobs.filter((j: { status: string }) => j.status === 'COMPLETED');
      const inProgressJobs = todaysJobs.filter(
        (j: { status: string }) => j.status === 'IN_PROGRESS' || j.status === 'EN_ROUTE'
      );
      const remainingJobs = todaysJobs.filter(
        (j: { status: string }) =>
          j.status === 'PENDING' ||
          j.status === 'ASSIGNED' ||
          j.status === 'EN_ROUTE' ||
          j.status === 'IN_PROGRESS'
      );

      const currentJob = inProgressJobs[0] || null;
      const currentJobStatus = currentJob?.status || null;

      const status = determineTechnicianStatus(
        tech.currentLocation,
        currentJobStatus
      );

      // Calculate distance to target if provided
      let distanceToTarget: number | null = null;
      let etaMinutes: number | null = null;

      if (
        targetLat !== null &&
        targetLng !== null &&
        tech.currentLocation?.latitude &&
        tech.currentLocation?.longitude
      ) {
        distanceToTarget = calculateDistance(
          Number(tech.currentLocation.latitude),
          Number(tech.currentLocation.longitude),
          targetLat,
          targetLng
        );
        etaMinutes = estimateETA(distanceToTarget);
      }

      // Estimate next available slot
      let nextAvailableSlot: string | null = null;
      let estimatedFinishTime: string | null = null;

      if (currentJob && currentJob.startedAt && currentJob.estimatedDuration) {
        const finish = new Date(currentJob.startedAt);
        finish.setMinutes(finish.getMinutes() + currentJob.estimatedDuration);
        estimatedFinishTime = finish.toISOString();
        nextAvailableSlot = finish.toISOString();
      } else if (status === 'disponible') {
        nextAvailableSlot = new Date().toISOString();
      }

      const monthlyData = statsMap.get(tech.id);
      const ratingData = ratingsMap.get(tech.id);

      return {
        id: tech.id,
        name: tech.name,
        phone: tech.phone,
        avatar: tech.avatar,
        specialty: tech.specialty,
        skillLevel: tech.skillLevel,
        currentStatus: status,
        currentLocation: tech.currentLocation
          ? {
              lat: Number(tech.currentLocation.latitude),
              lng: Number(tech.currentLocation.longitude),
              accuracy: tech.currentLocation.accuracy
                ? Number(tech.currentLocation.accuracy)
                : null,
              lastUpdated: tech.currentLocation.lastSeen.toISOString(),
            }
          : null,
        todaysSchedule: {
          totalJobs: todaysJobs.length,
          completed: completedJobs.length,
          inProgress: inProgressJobs.length,
          remaining: remainingJobs.length,
          nextAvailableSlot,
          estimatedFinishTime,
        },
        currentJob: currentJob
          ? {
              id: currentJob.id,
              jobNumber: currentJob.jobNumber,
              customerName: currentJob.customer.name,
              address:
                typeof currentJob.customer === 'object'
                  ? 'Ver detalles'
                  : 'Sin dirección',
              status: currentJob.status,
              startedAt: currentJob.startedAt?.toISOString() || null,
              estimatedDuration: currentJob.estimatedDuration,
            }
          : null,
        distanceToTarget: distanceToTarget
          ? Math.round(distanceToTarget * 10) / 10
          : null,
        etaMinutes,
        historicalPerformance: {
          averageJobDuration: monthlyData?.avgDuration || null,
          averageRating: ratingData?.avgRating || null,
          completionRate: null, // Would need more complex calculation
          jobsCompletedThisMonth: monthlyData?.count || 0,
        },
      };
    });

    // Sort by availability (disponible first, then by distance if target provided)
    availability.sort((a, b) => {
      // Status priority: disponible > en_camino > trabajando > sin_conexion
      const statusPriority = {
        disponible: 0,
        en_camino: 1,
        trabajando: 2,
        sin_conexion: 3,
      };
      const statusDiff =
        statusPriority[a.currentStatus] - statusPriority[b.currentStatus];
      if (statusDiff !== 0) return statusDiff;

      // If same status and target provided, sort by distance
      if (
        a.distanceToTarget !== null &&
        b.distanceToTarget !== null
      ) {
        return a.distanceToTarget - b.distanceToTarget;
      }

      // Otherwise sort by remaining jobs (fewer is better)
      return a.todaysSchedule.remaining - b.todaysSchedule.remaining;
    });

    return NextResponse.json({
      success: true,
      data: {
        technicians: availability,
        summary: {
          total: availability.length,
          disponible: availability.filter((t) => t.currentStatus === 'disponible')
            .length,
          en_camino: availability.filter((t) => t.currentStatus === 'en_camino')
            .length,
          trabajando: availability.filter((t) => t.currentStatus === 'trabajando')
            .length,
          sin_conexion: availability.filter(
            (t) => t.currentStatus === 'sin_conexion'
          ).length,
        },
        targetLocation:
          targetLat && targetLng ? { lat: targetLat, lng: targetLng } : null,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Dispatch availability error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching availability data' },
      { status: 500 }
    );
  }
}

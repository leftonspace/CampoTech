/**
 * Map Data API Route
 * GET /api/map/data
 *
 * Returns all map data layers: customers, technicians, and today's jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface CustomerLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  jobCount: number;
  lastJobDate: string | null;
  hasActiveJob: boolean;
}

interface TechnicianLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'en_linea' | 'en_camino' | 'trabajando' | 'sin_conexion';
  currentJobId: string | null;
  currentJobNumber: string | null;
  lastUpdated: string | null;
  avatarUrl: string | null;
  specialty: string | null;
  phone: string;
  currentCustomerName: string | null;
  etaMinutes: number | null;
  heading: number | null;
  nextJob: {
    id: string;
    jobNumber: string;
    customerName: string;
    scheduledTime: string | null;
  } | null;
}

interface TodayJob {
  id: string;
  jobNumber: string;
  lat: number;
  lng: number;
  status: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  technicianId: string | null;
  technicianName: string | null;
  scheduledTime: string | null;
  arrivedAt: string | null;
  address: string;
  description: string;
  serviceType: string;
}

interface MapDataResponse {
  success: boolean;
  data: {
    customers: CustomerLocation[];
    technicians: TechnicianLocation[];
    todayJobs: TodayJob[];
    stats: {
      totalCustomers: number;
      customersWithLocation: number;
      totalTechnicians: number;
      techniciansOnline: number;
      techniciansEnRoute: number;
      techniciansWorking: number;
      techniciansOffline: number;
      todayJobsTotal: number;
      todayJobsPending: number;
      todayJobsInProgress: number;
      todayJobsCompleted: number;
    };
    zones: { id: string; name: string }[];
    updatedAt: string;
  };
  error?: string;
}

function parseAddress(address: unknown): { formatted: string; lat: number | null; lng: number | null } {
  if (!address || typeof address !== 'object') {
    return { formatted: '', lat: null, lng: null };
  }

  const addr = address as {
    street?: string;
    number?: string;
    floor?: string;
    apartment?: string;
    city?: string;
    coordinates?: { lat?: number; lng?: number };
  };

  const parts = [];
  if (addr.street) {
    let streetLine = addr.street;
    if (addr.number) streetLine += ` ${addr.number}`;
    if (addr.floor) streetLine += `, Piso ${addr.floor}`;
    if (addr.apartment) streetLine += `, Depto ${addr.apartment}`;
    parts.push(streetLine);
  }
  if (addr.city) parts.push(addr.city);

  return {
    formatted: parts.join(', ') || '',
    lat: addr.coordinates?.lat ?? null,
    lng: addr.coordinates?.lng ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only admins, owners, and dispatchers can view map data
    if (!['ADMIN', 'OWNER', 'DISPATCHER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver datos del mapa' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const layers = searchParams.get('layers')?.split(',') || ['customers', 'technicians', 'jobs'];
    const dateParam = searchParams.get('date');
    const technicianIdFilter = searchParams.get('technicianId');

    // Determine today's date range
    const today = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Online threshold (5 minutes ago)
    const onlineThreshold = new Date(Date.now() - 5 * 60 * 1000);

    let customers: CustomerLocation[] = [];
    let technicians: TechnicianLocation[] = [];
    let todayJobs: TodayJob[] = [];

    // Fetch customers with locations
    if (layers.includes('customers')) {
      const customersData = await prisma.customer.findMany({
        where: {
          organizationId: session.organizationId,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          jobs: {
            select: {
              id: true,
              status: true,
              completedAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      customers = customersData
        .map((customer) => {
          const { formatted, lat, lng } = parseAddress(customer.address);

          if (lat === null || lng === null) return null;

          const lastCompletedJob = customer.jobs.find((j) => j.status === 'COMPLETED');
          const hasActiveJob = customer.jobs.some((j) =>
            ['PENDING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'].includes(j.status)
          );

          return {
            id: customer.id,
            name: customer.name,
            lat,
            lng,
            address: formatted,
            phone: customer.phone,
            jobCount: customer.jobs.length,
            lastJobDate: lastCompletedJob?.completedAt?.toISOString() || null,
            hasActiveJob,
          };
        })
        .filter((c): c is CustomerLocation => c !== null);
    }

    // Fetch technicians with their current locations
    if (layers.includes('technicians')) {
      const techniciansData = await prisma.user.findMany({
        where: {
          organizationId: session.organizationId,
          role: 'TECHNICIAN',
          isActive: true,
          ...(technicianIdFilter ? { id: technicianIdFilter } : {}),
        },
        select: {
          id: true,
          name: true,
          phone: true,
          avatar: true,
          specialty: true,
          currentLocation: true,
          homeLocation: {
            select: {
              coordinates: true,
              address: true,
            },
          },
          assignedJobs: {
            where: {
              status: {
                in: ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'],
              },
              scheduledDate: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
            orderBy: { scheduledDate: 'asc' },
            take: 2, // Get current + next
            select: {
              id: true,
              jobNumber: true,
              status: true,
              scheduledTimeSlot: true,
              customer: {
                select: {
                  name: true,
                },
              },
            },
          },
          trackingSessions: {
            where: {
              status: 'ACTIVE',
            },
            take: 1,
            select: {
              etaMinutes: true,
              currentHeading: true,
            },
          },
        },
      });

      technicians = techniciansData
        .map((tech) => {
          const location = tech.currentLocation;
          const isOnline = location && location.lastSeen > onlineThreshold;

          // Determine position: current location, home location, or null
          let lat: number | null = null;
          let lng: number | null = null;
          let lastUpdated: string | null = null;

          if (location) {
            lat = Number(location.latitude);
            lng = Number(location.longitude);
            lastUpdated = location.lastSeen?.toISOString() || null;
          } else if (tech.homeLocation?.coordinates) {
            const coords = tech.homeLocation.coordinates as { lat?: number; lng?: number };
            lat = coords.lat ?? null;
            lng = coords.lng ?? null;
          }

          if (lat === null || lng === null) return null;

          // Current job is one that's IN_PROGRESS or EN_ROUTE
          const currentJob = tech.assignedJobs.find(j =>
            ['IN_PROGRESS', 'EN_ROUTE'].includes(j.status)
          ) || null;

          // Next job is the first ASSIGNED job
          const nextJob = tech.assignedJobs.find(j => j.status === 'ASSIGNED') || null;
          const activeSession = tech.trackingSessions[0] || null;

          // Determine status
          let status: TechnicianLocation['status'] = 'sin_conexion';
          if (isOnline) {
            if (currentJob?.status === 'IN_PROGRESS') {
              status = 'trabajando';
            } else if (currentJob?.status === 'EN_ROUTE') {
              status = 'en_camino';
            } else {
              status = 'en_linea';
            }
          }

          // Get scheduled time from next job
          const nextJobTimeSlot = nextJob?.scheduledTimeSlot as { start?: string } | null;

          return {
            id: tech.id,
            name: tech.name,
            lat,
            lng,
            status,
            currentJobId: currentJob?.id || null,
            currentJobNumber: currentJob?.jobNumber || null,
            lastUpdated,
            avatarUrl: tech.avatar,
            specialty: tech.specialty,
            phone: tech.phone,
            currentCustomerName: currentJob?.customer?.name || null,
            etaMinutes: activeSession?.etaMinutes || null,
            heading: activeSession?.currentHeading ? Number(activeSession.currentHeading) : null,
            nextJob: nextJob ? {
              id: nextJob.id,
              jobNumber: nextJob.jobNumber,
              customerName: nextJob.customer?.name || '',
              scheduledTime: nextJobTimeSlot?.start || null,
            } : null,
          };
        })
        .filter((t): t is TechnicianLocation => t !== null);
    }

    // Fetch today's jobs
    if (layers.includes('jobs')) {
      const jobsData = await prisma.job.findMany({
        where: {
          organizationId: session.organizationId,
          scheduledDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          ...(technicianIdFilter ? { technicianId: technicianIdFilter } : {}),
        },
        select: {
          id: true,
          jobNumber: true,
          status: true,
          description: true,
          serviceType: true,
          scheduledDate: true,
          scheduledTimeSlot: true,
          technicianId: true,
          technician: {
            select: {
              name: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              address: true,
            },
          },
          trackingSessions: {
            where: {
              status: 'ARRIVED',
            },
            take: 1,
            select: {
              arrivedAt: true,
            },
          },
        },
        orderBy: { scheduledDate: 'asc' },
      });

      todayJobs = jobsData
        .map((job) => {
          const { formatted, lat, lng } = parseAddress(job.customer.address);

          if (lat === null || lng === null) return null;

          const timeSlot = job.scheduledTimeSlot as { start?: string } | null;
          const arrivedSession = job.trackingSessions[0];

          return {
            id: job.id,
            jobNumber: job.jobNumber,
            lat,
            lng,
            status: job.status,
            customerId: job.customer.id,
            customerName: job.customer.name,
            customerPhone: job.customer.phone,
            technicianId: job.technicianId,
            technicianName: job.technician?.name || null,
            scheduledTime: timeSlot?.start || null,
            arrivedAt: arrivedSession?.arrivedAt?.toISOString() || null,
            address: formatted,
            description: job.description,
            serviceType: job.serviceType,
          };
        })
        .filter((j): j is TodayJob => j !== null);
    }

    // Calculate stats
    const allCustomers = await prisma.customer.count({
      where: { organizationId: session.organizationId },
    });

    const stats = {
      totalCustomers: allCustomers,
      customersWithLocation: customers.length,
      totalTechnicians: technicians.length,
      techniciansOnline: technicians.filter((t) => t.status === 'en_linea').length,
      techniciansEnRoute: technicians.filter((t) => t.status === 'en_camino').length,
      techniciansWorking: technicians.filter((t) => t.status === 'trabajando').length,
      techniciansOffline: technicians.filter((t) => t.status === 'sin_conexion').length,
      todayJobsTotal: todayJobs.length,
      todayJobsPending: todayJobs.filter((j) => ['PENDING', 'ASSIGNED'].includes(j.status)).length,
      todayJobsInProgress: todayJobs.filter((j) => ['EN_ROUTE', 'IN_PROGRESS'].includes(j.status)).length,
      todayJobsCompleted: todayJobs.filter((j) => j.status === 'COMPLETED').length,
    };

    // Fetch zones for filter dropdown
    let zones: { id: string; name: string }[] = [];
    try {
      const zonesData = await prisma.zone.findMany({
        where: { organizationId: session.organizationId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      zones = zonesData;
    } catch {
      // Zone table might not exist
    }

    const response: MapDataResponse = {
      success: true,
      data: {
        customers,
        technicians,
        todayJobs,
        stats,
        zones,
        updatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get map data error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo datos del mapa' },
      { status: 500 }
    );
  }
}

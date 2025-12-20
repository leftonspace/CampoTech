/**
 * Tracking Token API Route
 * =========================
 *
 * Public endpoint for customers to view real-time tracking data.
 * Returns technician location, ETA, and job details for a valid tracking token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ token: string }>;
}

interface TrackingData {
  technicianName: string;
  technicianPhoto?: string;
  technicianRating?: number;
  currentPosition?: { lat: number; lng: number };
  destination: { lat: number; lng: number; address: string };
  etaMinutes?: number;
  movementMode: string;
  status: string;
  jobDescription: string;
  jobReference: string;
  organizationName: string;
  organizationLogo?: string;
  organizationPhone?: string;
  ratingToken?: string;
  completedAt?: string;
  invoiceUrl?: string;
  reportUrl?: string;
}

/**
 * GET /api/tracking/[token]
 * Public endpoint for customers to view tracking data
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 400 }
      );
    }

    // Find the tracking token and related data
    const trackingToken = await prisma.trackingToken.findUnique({
      where: { token },
      include: {
        session: {
          include: {
            technician: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            job: {
              select: {
                id: true,
                title: true,
                serviceType: true,
                address: true,
                latitude: true,
                longitude: true,
                status: true,
                completedAt: true,
                invoices: {
                  where: { status: 'PAID' },
                  select: { pdfUrl: true },
                  take: 1,
                },
              },
            },
            organization: {
              select: {
                name: true,
                logo: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    // Validate token exists and is not expired
    if (!trackingToken) {
      return NextResponse.json(
        { success: false, error: 'Token inválido o sesión expirada' },
        { status: 404 }
      );
    }

    if (new Date() > trackingToken.expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Este enlace de seguimiento ha expirado' },
        { status: 410 }
      );
    }

    const session = trackingToken.session;

    // If no session, try to find job directly
    if (!session) {
      // Attempt to find the job directly via jobId on token
      const job = await prisma.job.findUnique({
        where: { id: trackingToken.jobId },
        include: {
          organization: {
            select: { name: true, logo: true, phone: true },
          },
          assignedTo: {
            select: { id: true, name: true, avatar: true },
          },
        },
      });

      if (!job) {
        return NextResponse.json(
          { success: false, error: 'Trabajo no encontrado' },
          { status: 404 }
        );
      }

      // Return basic tracking data without live position
      const trackingData: TrackingData = {
        technicianName: job.assignedTo?.name || 'Técnico asignado',
        technicianPhoto: job.assignedTo?.avatar || undefined,
        destination: {
          lat: job.latitude ? Number(job.latitude) : -34.6037,
          lng: job.longitude ? Number(job.longitude) : -58.3816,
          address: job.address || '',
        },
        movementMode: 'driving',
        status: mapJobStatusToTracking(job.status),
        jobDescription: job.title || job.serviceType || 'Servicio técnico',
        jobReference: job.id.slice(-8).toUpperCase(),
        organizationName: job.organization.name,
        organizationLogo: job.organization.logo || undefined,
        organizationPhone: job.organization.phone || undefined,
      };

      // Update access count
      await prisma.trackingToken.update({
        where: { id: trackingToken.id },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: trackingData,
      });
    }

    // Build full tracking data from session
    const job = session.job;
    const technician = session.technician;
    const organization = session.organization;

    // Get technician average rating if available
    let technicianRating: number | undefined;
    const ratings = await prisma.customerRating.aggregate({
      where: { technicianId: technician.id },
      _avg: { rating: true },
    });
    if (ratings._avg.rating) {
      technicianRating = Number(ratings._avg.rating);
    }

    // Map session status to tracking status
    const status = mapSessionStatusToTracking(session.status);

    const trackingData: TrackingData = {
      technicianName: technician.name,
      technicianPhoto: technician.avatar || undefined,
      technicianRating,
      currentPosition: session.currentLat && session.currentLng
        ? {
            lat: Number(session.currentLat),
            lng: Number(session.currentLng),
          }
        : undefined,
      destination: {
        lat: job.latitude ? Number(job.latitude) : Number(session.destinationLat) || -34.6037,
        lng: job.longitude ? Number(job.longitude) : Number(session.destinationLng) || -58.3816,
        address: job.address || session.destinationAddress || '',
      },
      etaMinutes: session.etaMinutes || undefined,
      movementMode: session.movementMode || 'driving',
      status,
      jobDescription: job.title || job.serviceType || 'Servicio técnico',
      jobReference: job.id.slice(-8).toUpperCase(),
      organizationName: organization.name,
      organizationLogo: organization.logo || undefined,
      organizationPhone: organization.phone || undefined,
      completedAt: job.completedAt?.toISOString() || session.completedAt?.toISOString() || undefined,
      invoiceUrl: job.invoices?.[0]?.pdfUrl || undefined,
    };

    // Update access count
    await prisma.trackingToken.update({
      where: { id: trackingToken.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: trackingData,
    });
  } catch (error) {
    console.error('Tracking view error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo datos de seguimiento' },
      { status: 500 }
    );
  }
}

/**
 * Map job status to tracking display status
 */
function mapJobStatusToTracking(jobStatus: string): string {
  switch (jobStatus.toLowerCase()) {
    case 'in_progress':
    case 'en_route':
      return 'active';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'active';
  }
}

/**
 * Map session status to tracking display status
 */
function mapSessionStatusToTracking(sessionStatus: string): string {
  switch (sessionStatus) {
    case 'ACTIVE':
      return 'active';
    case 'ARRIVED':
      return 'arrived';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'active';
  }
}

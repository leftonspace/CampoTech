/**
 * Tracking Service
 * ================
 *
 * Phase 9.9: Customer Live Tracking System
 * Manages technician location tracking for customer visibility.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { sendNotification } from '../notifications/notification.service';
import { sendTemplateMessage, buildTemplateWithParams } from '../../integrations/whatsapp/messages/template.sender';
import { getWhatsAppConfig } from '../../integrations/whatsapp/whatsapp.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PositionUpdate {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

export interface TrackingSession {
  id: string;
  jobId: string;
  technicianId: string;
  status: 'active' | 'arrived' | 'completed' | 'cancelled';
  currentLat?: number;
  currentLng?: number;
  etaMinutes?: number;
  movementMode: 'driving' | 'walking' | 'stationary';
  startedAt: Date;
}

export interface CustomerTrackingView {
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
  routePolyline?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TOKEN_EXPIRY_HOURS = 4;
const POSITION_UPDATE_INTERVAL_MS = 30000; // 30 seconds
const ETA_REFRESH_INTERVAL_MS = 120000; // 2 minutes

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create tracking session when job status changes to EN_ROUTE
 */
export async function createTrackingSession(
  jobId: string,
  technicianId: string,
  organizationId: string
): Promise<{ sessionId: string; token: string }> {
  // Get job details for destination
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      customer: {
        select: { phone: true, name: true },
      },
    },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  // Parse destination from job address
  const destination = parseAddress(job.address as any);

  // Create tracking session
  const session = await db.trackingSession.create({
    data: {
      jobId,
      technicianId,
      organizationId,
      destinationLat: destination?.lat,
      destinationLng: destination?.lng,
      destinationAddress: formatAddress(job.address as any),
      status: 'ACTIVE',
      startedAt: new Date(),
    },
  });

  // Generate tracking token
  const token = await generateTrackingToken(jobId, session.id);

  // Send WhatsApp notification to customer with tracking link
  if (job.customer?.phone) {
    await sendTrackingNotification(organizationId, job, token);
  }

  log.info('Tracking session created', { sessionId: session.id, jobId, technicianId });

  return { sessionId: session.id, token };
}

/**
 * Update technician position
 */
export async function updatePosition(
  sessionId: string,
  position: PositionUpdate
): Promise<void> {
  const { lat, lng, speed, heading, accuracy } = position;

  // Detect movement mode
  const movementMode = detectMovementMode(speed || 0);

  // Update session
  await db.trackingSession.update({
    where: { id: sessionId },
    data: {
      currentLat: lat,
      currentLng: lng,
      currentSpeed: speed,
      currentHeading: heading,
      movementMode,
      lastPositionAt: new Date(),
      positionUpdateCount: { increment: 1 },
    },
  });

  // Record location history
  await db.trackingLocationHistory.create({
    data: {
      sessionId,
      lat,
      lng,
      speed,
      heading,
      accuracy,
      movementMode,
    },
  });

  // Check if arrived (within 100 meters of destination)
  await checkArrival(sessionId, lat, lng);
}

/**
 * Mark session as arrived
 */
export async function markArrived(sessionId: string): Promise<void> {
  await db.trackingSession.update({
    where: { id: sessionId },
    data: {
      status: 'ARRIVED',
      arrivedAt: new Date(),
    },
  });

  log.info('Tracking session marked as arrived', { sessionId });
}

/**
 * Complete tracking session
 */
export async function completeSession(jobId: string): Promise<void> {
  await db.trackingSession.updateMany({
    where: { jobId, status: { in: ['ACTIVE', 'ARRIVED'] } },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });
}

/**
 * Cancel tracking session
 */
export async function cancelSession(jobId: string): Promise<void> {
  await db.trackingSession.updateMany({
    where: { jobId, status: 'ACTIVE' },
    data: {
      status: 'CANCELLED',
      completedAt: new Date(),
    },
  });

  // Invalidate tokens
  await db.trackingToken.updateMany({
    where: { jobId },
    data: { expiresAt: new Date() },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate secure tracking token
 */
async function generateTrackingToken(jobId: string, sessionId: string): Promise<string> {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.trackingToken.create({
    data: {
      token,
      jobId,
      sessionId,
      expiresAt,
    },
  });

  return token;
}

/**
 * Validate tracking token and return session info
 */
export async function validateToken(token: string): Promise<{
  valid: boolean;
  sessionId?: string;
  jobId?: string;
  error?: string;
}> {
  const tokenRecord = await db.trackingToken.findUnique({
    where: { token },
  });

  if (!tokenRecord) {
    return { valid: false, error: 'Token no encontrado' };
  }

  if (tokenRecord.expiresAt < new Date()) {
    return { valid: false, error: 'Token expirado' };
  }

  // Update access count
  await db.trackingToken.update({
    where: { id: tokenRecord.id },
    data: {
      accessCount: { increment: 1 },
      lastAccessedAt: new Date(),
    },
  });

  return {
    valid: true,
    sessionId: tokenRecord.sessionId || undefined,
    jobId: tokenRecord.jobId,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER VIEW
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get tracking data for customer view
 */
export async function getCustomerTrackingView(token: string): Promise<CustomerTrackingView | null> {
  const validation = await validateToken(token);
  if (!validation.valid || !validation.jobId) {
    return null;
  }

  const session = await db.trackingSession.findFirst({
    where: { jobId: validation.jobId },
    include: {
      job: {
        include: {
          technician: {
            select: {
              name: true,
              avatar: true,
            },
          },
          organization: {
            select: {
              businessName: true,
              logo: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!session) {
    return null;
  }

  return {
    technicianName: session.job.technician?.name || 'Técnico',
    technicianPhoto: session.job.technician?.avatar || undefined,
    technicianRating: undefined, // Rating is on Review model, not User
    currentPosition:
      session.currentLat && session.currentLng
        ? { lat: Number(session.currentLat), lng: Number(session.currentLng) }
        : undefined,
    destination: {
      lat: Number(session.destinationLat) || 0,
      lng: Number(session.destinationLng) || 0,
      address: session.destinationAddress || '',
    },
    etaMinutes: session.etaMinutes || undefined,
    movementMode: session.movementMode || 'driving',
    status: session.status,
    jobDescription: session.job.description || 'Servicio técnico',
    jobReference: `#JOB-${session.job.id.slice(0, 8).toUpperCase()}`,
    organizationName: session.job.organization.businessName,
    organizationLogo: session.job.organization.logo || undefined,
    routePolyline: session.routePolyline || undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETA CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate ETA using basic distance calculation
 * (Can be enhanced with Google Maps/Mapbox for traffic-aware ETA)
 */
export async function calculateETA(sessionId: string): Promise<number | null> {
  const session = await db.trackingSession.findUnique({
    where: { id: sessionId },
  });

  if (
    !session ||
    !session.currentLat ||
    !session.currentLng ||
    !session.destinationLat ||
    !session.destinationLng
  ) {
    return null;
  }

  // Calculate distance using Haversine formula
  const distance = haversineDistance(
    Number(session.currentLat),
    Number(session.currentLng),
    Number(session.destinationLat),
    Number(session.destinationLng)
  );

  // Estimate speed based on movement mode
  const speedKmh =
    session.movementMode === 'walking'
      ? 5
      : session.movementMode === 'stationary'
        ? 0
        : 30; // Conservative driving speed for urban areas

  if (speedKmh === 0) {
    return null;
  }

  const etaMinutes = Math.ceil((distance / speedKmh) * 60);

  // Update session with ETA
  await db.trackingSession.update({
    where: { id: sessionId },
    data: {
      etaMinutes,
      etaUpdatedAt: new Date(),
    },
  });

  return etaMinutes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function detectMovementMode(speed: number): 'walking' | 'driving' | 'stationary' {
  if (speed < 1) return 'stationary';
  if (speed <= 7) return 'walking';
  return 'driving';
}

async function checkArrival(sessionId: string, lat: number, lng: number): Promise<void> {
  const session = await db.trackingSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || !session.destinationLat || !session.destinationLng) {
    return;
  }

  const distance = haversineDistance(
    lat,
    lng,
    Number(session.destinationLat),
    Number(session.destinationLng)
  );

  // Consider arrived if within 100 meters
  if (distance <= 0.1 && session.status === 'ACTIVE') {
    await markArrived(sessionId);
  }
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function generateSecureToken(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function parseAddress(address: any): { lat?: number; lng?: number } | null {
  if (!address) return null;

  // If address has coordinates
  if (address.lat && address.lng) {
    return { lat: address.lat, lng: address.lng };
  }

  // In production, use geocoding service
  return null;
}

function formatAddress(address: any): string {
  if (!address) return '';
  if (typeof address === 'string') return address;

  const parts = [];
  if (address.street) parts.push(address.street);
  if (address.number) parts.push(address.number);
  if (address.city) parts.push(address.city);
  if (address.province) parts.push(address.province);

  return parts.join(', ');
}

async function sendTrackingNotification(
  organizationId: string,
  job: any,
  token: string
): Promise<void> {
  try {
    const config = await getWhatsAppConfig(organizationId);
    if (!config) return;

    const technician = await db.user.findUnique({
      where: { id: job.technicianId },
      select: { name: true },
    });

    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com.ar'}/track/${token}`;

    const template = buildTemplateWithParams('technician_en_route_tracking', [
      technician?.name || 'Nuestro técnico',
      '15', // Initial ETA estimate
      token,
    ]);
    await sendTemplateMessage(config, job.customer.phone, template);

    log.info('Tracking notification sent', { jobId: job.id, phone: job.customer.phone });
  } catch (error) {
    log.error('Failed to send tracking notification', {
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Tracking Service
 * ================
 *
 * Main service for real-time job tracking.
 * Coordinates WebSocket, ETA calculation, and database updates.
 */

import { Pool } from 'pg';
import {
  GeoLocation,
  JobTrackingState,
  ETAResult,
  TrackingRepository,
  TechnicianLocation,
} from './tracking.types';
import { ETAService, initializeETAService } from './eta.service';
import {
  TrackingWebSocketServer,
  initializeTrackingWebSocketServer,
  getTrackingWebSocketServer,
} from './tracking-websocket';

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class TrackingService {
  private pool: Pool;
  private etaService: ETAService;
  private wsServer: TrackingWebSocketServer | null = null;

  constructor(pool: Pool, etaService: ETAService) {
    this.pool = pool;
    this.etaService = etaService;
  }

  /**
   * Initialize WebSocket server
   */
  initializeWebSocket(port: number, jwtSecret: string): void {
    this.wsServer = initializeTrackingWebSocketServer({
      port,
      jwtSecret,
      etaService: this.etaService,
    });
  }

  /**
   * Get tracking state for a job (for REST API)
   */
  async getJobTrackingState(jobId: string, customerId: string): Promise<JobTrackingState | null> {
    // Verify customer has access to job
    const accessQuery = `
      SELECT j.id, j.status, j.address, j.latitude, j.longitude,
             j.assigned_technician_id,
             u.name as technician_name, u.phone as technician_phone
      FROM jobs j
      LEFT JOIN users u ON j.assigned_technician_id = u.id
      WHERE j.id = $1 AND j.customer_id = $2
    `;
    const accessResult = await this.pool.query(accessQuery, [jobId, customerId]);

    if (accessResult.rows.length === 0) {
      return null;
    }

    const job = accessResult.rows[0];

    // Get status history
    const historyQuery = `
      SELECT status, created_at as timestamp, notes as note
      FROM job_status_history
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const historyResult = await this.pool.query(historyQuery, [jobId]);

    // Get latest technician location if applicable
    let technicianLocation: TechnicianLocation | undefined;
    if (job.assigned_technician_id) {
      const locationQuery = `
        SELECT latitude, longitude, accuracy, heading, speed, updated_at
        FROM technician_locations
        WHERE user_id = $1
          AND updated_at > NOW() - INTERVAL '10 minutes'
        ORDER BY updated_at DESC
        LIMIT 1
      `;
      const locationResult = await this.pool.query(locationQuery, [job.assigned_technician_id]);

      if (locationResult.rows.length > 0) {
        const loc = locationResult.rows[0];
        technicianLocation = {
          technicianId: job.assigned_technician_id,
          lat: parseFloat(loc.latitude),
          lng: parseFloat(loc.longitude),
          accuracy: loc.accuracy,
          heading: loc.heading,
          speed: loc.speed,
          timestamp: loc.updated_at,
          status: 'active',
        };
      }
    }

    // Calculate ETA if technician location available
    let eta: ETAResult | undefined;
    if (technicianLocation && job.latitude && job.longitude) {
      try {
        eta = await this.etaService.getETA(
          { lat: technicianLocation.lat, lng: technicianLocation.lng, timestamp: new Date() },
          { lat: parseFloat(job.latitude), lng: parseFloat(job.longitude), timestamp: new Date() }
        );
      } catch (error) {
        console.error('[TrackingService] ETA calculation failed:', error);
      }
    }

    return {
      jobId,
      status: job.status,
      technicianId: job.assigned_technician_id,
      technicianLocation,
      eta,
      customerLocation: {
        jobId,
        address: job.address,
        lat: job.latitude ? parseFloat(job.latitude) : 0,
        lng: job.longitude ? parseFloat(job.longitude) : 0,
      },
      statusHistory: historyResult.rows.map((row: any) => ({
        status: row.status,
        timestamp: row.timestamp,
        note: row.note,
      })),
      subscribedCustomers: new Set(),
      lastUpdate: new Date(),
    };
  }

  /**
   * Update technician location (from mobile app)
   */
  async updateTechnicianLocation(
    technicianId: string,
    location: GeoLocation,
    activeJobId?: string
  ): Promise<void> {
    // Store in database
    await this.pool.query(
      `
      INSERT INTO technician_locations (user_id, latitude, longitude, accuracy, heading, speed, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        accuracy = EXCLUDED.accuracy,
        heading = EXCLUDED.heading,
        speed = EXCLUDED.speed,
        updated_at = NOW()
      `,
      [
        technicianId,
        location.lat,
        location.lng,
        location.accuracy || null,
        location.heading || null,
        location.speed || null,
      ]
    );

    // If WebSocket server is running, broadcast update
    if (this.wsServer) {
      // The WebSocket handles broadcasting internally
      // This is called when location comes from REST API instead of WS
    }
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: string,
    updatedBy: string,
    note?: string
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Update job status
      await client.query(
        `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, jobId]
      );

      // Add to status history
      await client.query(
        `
        INSERT INTO job_status_history (job_id, status, changed_by_id, notes, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        `,
        [jobId, status, updatedBy, note || null]
      );

      await client.query('COMMIT');

      // Broadcast via WebSocket if available
      if (this.wsServer) {
        // WebSocket server handles this
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get customer's active trackable jobs
   */
  async getCustomerActiveJobs(customerId: string): Promise<Array<{
    id: string;
    serviceType: string;
    status: string;
    address: string;
    technicianName?: string;
    scheduledDate?: string;
  }>> {
    const query = `
      SELECT j.id, st.name as service_type, j.status, j.address,
             u.name as technician_name, j.scheduled_date_time
      FROM jobs j
      LEFT JOIN service_types st ON j.service_type_id = st.id
      LEFT JOIN users u ON j.assigned_technician_id = u.id
      WHERE j.customer_id = $1
        AND j.status IN ('scheduled', 'confirmed', 'en_route', 'in_progress', 'arrived')
      ORDER BY j.scheduled_date_time ASC
    `;
    const result = await this.pool.query(query, [customerId]);

    return result.rows.map((row) => ({
      id: row.id,
      serviceType: row.service_type,
      status: row.status,
      address: row.address,
      technicianName: row.technician_name,
      scheduledDate: row.scheduled_date_time,
    }));
  }

  /**
   * Check if technician has arrived at job location
   */
  async checkArrival(jobId: string): Promise<boolean> {
    const query = `
      SELECT j.latitude as job_lat, j.longitude as job_lng,
             tl.latitude as tech_lat, tl.longitude as tech_lng
      FROM jobs j
      JOIN technician_locations tl ON j.assigned_technician_id = tl.user_id
      WHERE j.id = $1
        AND tl.updated_at > NOW() - INTERVAL '5 minutes'
    `;
    const result = await this.pool.query(query, [jobId]);

    if (result.rows.length === 0) return false;

    const { job_lat, job_lng, tech_lat, tech_lng } = result.rows[0];

    return this.etaService.hasArrived(
      { lat: parseFloat(tech_lat), lng: parseFloat(tech_lng), timestamp: new Date() },
      { lat: parseFloat(job_lat), lng: parseFloat(job_lng), timestamp: new Date() }
    );
  }

  /**
   * Get WebSocket server stats
   */
  getStats(): { connected: number; customers: number; technicians: number } | null {
    if (!this.wsServer) return null;
    const counts = this.wsServer.getClientsCount();
    return {
      connected: counts.total,
      customers: counts.customers,
      technicians: counts.technicians,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let trackingServiceInstance: TrackingService | null = null;

export function getTrackingService(): TrackingService {
  if (!trackingServiceInstance) {
    throw new Error('TrackingService not initialized');
  }
  return trackingServiceInstance;
}

export function initializeTrackingService(
  pool: Pool,
  config?: {
    googleMapsApiKey?: string;
    osrmUrl?: string;
    wsPort?: number;
    jwtSecret?: string;
  }
): TrackingService {
  // Initialize ETA service
  const etaService = initializeETAService({
    googleMapsApiKey: config?.googleMapsApiKey,
    osrmUrl: config?.osrmUrl,
  });

  trackingServiceInstance = new TrackingService(pool, etaService);

  // Initialize WebSocket if configured
  if (config?.wsPort && config?.jwtSecret) {
    trackingServiceInstance.initializeWebSocket(config.wsPort, config.jwtSecret);
  }

  console.log('[TrackingService] Initialized');
  return trackingServiceInstance;
}

export function resetTrackingService(): void {
  trackingServiceInstance = null;
}

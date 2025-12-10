/**
 * Real-Time Tracking Types
 * ========================
 *
 * Type definitions for the real-time job tracking system.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
}

export interface TechnicianLocation extends GeoLocation {
  technicianId: string;
  jobId?: string;
  status: 'active' | 'idle' | 'offline';
}

export interface JobLocation {
  jobId: string;
  address: string;
  lat: number;
  lng: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETA TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ETAResult {
  durationMinutes: number;
  durationText: string;
  distanceMeters: number;
  distanceText: string;
  calculatedAt: Date;
  source: 'google_maps' | 'osrm' | 'estimate';
}

export interface ETARequest {
  origin: GeoLocation;
  destination: GeoLocation;
  travelMode?: 'driving' | 'walking';
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export type TrackingEventType =
  | 'location_update'
  | 'eta_update'
  | 'status_update'
  | 'arrival_detected'
  | 'job_started'
  | 'job_completed'
  | 'message';

export interface TrackingEvent {
  type: TrackingEventType;
  jobId: string;
  timestamp: Date;
  data: Record<string, any>;
}

export interface LocationUpdateEvent extends TrackingEvent {
  type: 'location_update';
  data: {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
  };
}

export interface ETAUpdateEvent extends TrackingEvent {
  type: 'eta_update';
  data: {
    minutes: number;
    distance: string;
    updatedAt: string;
  };
}

export interface StatusUpdateEvent extends TrackingEvent {
  type: 'status_update';
  data: {
    status: string;
    previousStatus: string;
    note?: string;
    updatedBy?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type WSClientType = 'customer' | 'technician' | 'dashboard';

export interface WSClient {
  id: string;
  type: WSClientType;
  userId: string;
  orgId: string;
  subscribedJobs: Set<string>;
  socket: any; // WebSocket instance
  connectedAt: Date;
  lastPing?: Date;
}

export interface WSMessage {
  type: string;
  payload: any;
  timestamp: string;
}

export interface WSAuthPayload {
  token: string;
  clientType: WSClientType;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING STATE
// ═══════════════════════════════════════════════════════════════════════════════

export interface JobTrackingState {
  jobId: string;
  status: string;
  technicianId?: string;
  technicianLocation?: TechnicianLocation;
  eta?: ETAResult;
  customerLocation: JobLocation;
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    note?: string;
  }>;
  subscribedCustomers: Set<string>;
  lastUpdate: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ETAProvider {
  calculateETA(request: ETARequest): Promise<ETAResult>;
}

export interface LocationBroadcaster {
  broadcastLocationUpdate(technicianId: string, location: GeoLocation): Promise<void>;
  broadcastETAUpdate(jobId: string, eta: ETAResult): Promise<void>;
  broadcastStatusUpdate(jobId: string, status: string, note?: string): Promise<void>;
}

export interface TrackingRepository {
  getJobTrackingState(jobId: string): Promise<JobTrackingState | null>;
  updateTechnicianLocation(technicianId: string, location: GeoLocation): Promise<void>;
  updateJobStatus(jobId: string, status: string, note?: string): Promise<void>;
  getActiveJobsForTechnician(technicianId: string): Promise<string[]>;
  getCustomerActiveJobs(customerId: string): Promise<string[]>;
}

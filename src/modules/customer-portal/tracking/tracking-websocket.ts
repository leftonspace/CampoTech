/**
 * Tracking WebSocket Server
 * =========================
 *
 * Real-time WebSocket server for job tracking.
 * Handles customer and technician connections.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import * as jwt from 'jsonwebtoken';
import {
  WSClient,
  WSClientType,
  WSMessage,
  TrackingEvent,
  GeoLocation,
  JobTrackingState,
} from './tracking.types';
import { ETAService, getETAService } from './eta.service';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const PING_INTERVAL_MS = 30000; // 30 seconds
const LOCATION_UPDATE_THROTTLE_MS = 5000; // 5 seconds
const MAX_CLIENTS_PER_JOB = 50;

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING WEBSOCKET SERVER
// ═══════════════════════════════════════════════════════════════════════════════

export class TrackingWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WSClient> = new Map();
  private jobSubscriptions: Map<string, Set<string>> = new Map(); // jobId -> Set<clientId>
  private technicianJobs: Map<string, Set<string>> = new Map(); // technicianId -> Set<jobId>
  private jobStates: Map<string, JobTrackingState> = new Map();
  private lastLocationUpdate: Map<string, number> = new Map(); // technicianId -> timestamp

  private jwtSecret: string;
  private etaService: ETAService;
  private pingInterval?: NodeJS.Timeout;

  constructor(options: {
    port: number;
    jwtSecret: string;
    etaService?: ETAService;
  }) {
    this.jwtSecret = options.jwtSecret;
    this.etaService = options.etaService || getETAService();

    this.wss = new WebSocketServer({
      port: options.port,
      path: '/tracking',
    });

    this.setupServer();
    this.startPingInterval();

    console.log(`[Tracking WS] Server started on port ${options.port}`);
  }

  private setupServer(): void {
    this.wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
      this.handleConnection(socket, request);
    });

    this.wss.on('error', (error: Error) => {
      console.error('[Tracking WS] Server error:', error);
    });
  }

  private async handleConnection(socket: WebSocket, request: IncomingMessage): Promise<void> {
    const clientId = this.generateClientId();

    // Extract job ID from URL path if present
    const urlPath = request.url || '';
    const jobIdMatch = urlPath.match(/\/tracking\/([a-f0-9-]+)/i);
    const requestedJobId = jobIdMatch?.[1];

    // Set up initial message handler for authentication
    socket.once('message', async (data: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;

        if (message.type !== 'auth') {
          socket.send(JSON.stringify({
            type: 'error',
            payload: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
          }));
          socket.close();
          return;
        }

        // Verify JWT token
        const authPayload = await this.verifyAuth(message.payload.token);

        if (!authPayload) {
          socket.send(JSON.stringify({
            type: 'error',
            payload: { code: 'AUTH_FAILED', message: 'Invalid token' },
          }));
          socket.close();
          return;
        }

        // Create client
        const client: WSClient = {
          id: clientId,
          type: authPayload.type,
          userId: authPayload.userId,
          orgId: authPayload.orgId,
          subscribedJobs: new Set(),
          socket,
          connectedAt: new Date(),
        };

        this.clients.set(clientId, client);

        // Auto-subscribe to requested job
        if (requestedJobId && authPayload.type === 'customer') {
          await this.subscribeToJob(clientId, requestedJobId);
        }

        // Send auth success
        socket.send(JSON.stringify({
          type: 'auth_success',
          payload: {
            clientId,
            subscribedJobs: Array.from(client.subscribedJobs),
          },
        }));

        // Set up message handlers
        this.setupClientHandlers(client);

        console.log(`[Tracking WS] Client ${clientId} connected (${authPayload.type})`);
      } catch (error) {
        console.error('[Tracking WS] Connection error:', error);
        socket.send(JSON.stringify({
          type: 'error',
          payload: { code: 'CONNECTION_ERROR', message: 'Connection failed' },
        }));
        socket.close();
      }
    });

    // Close connection if no auth message within 10 seconds
    setTimeout(() => {
      if (!this.clients.has(clientId)) {
        socket.close();
      }
    }, 10000);
  }

  private async verifyAuth(token: string): Promise<{
    type: WSClientType;
    userId: string;
    orgId: string;
  } | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;

      // Support both customer and staff tokens
      if (decoded.type === 'customer') {
        return {
          type: 'customer',
          userId: decoded.customerId,
          orgId: decoded.orgId,
        };
      } else if (decoded.userId) {
        // Staff token (technician or dashboard)
        return {
          type: decoded.role === 'technician' ? 'technician' : 'dashboard',
          userId: decoded.userId,
          orgId: decoded.orgId,
        };
      }

      return null;
    } catch (error) {
      console.error('[Tracking WS] Auth verification failed:', error);
      return null;
    }
  }

  private setupClientHandlers(client: WSClient): void {
    const socket = client.socket;

    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      this.handleClientMessage(client, data.toString());
    });

    socket.on('close', () => {
      this.handleClientDisconnect(client);
    });

    socket.on('error', (error: Error) => {
      console.error(`[Tracking WS] Client ${client.id} error:`, error);
      this.handleClientDisconnect(client);
    });

    socket.on('pong', () => {
      client.lastPing = new Date();
    });
  }

  private async handleClientMessage(client: WSClient, data: string): Promise<void> {
    try {
      const message = JSON.parse(data) as WSMessage;

      switch (message.type) {
        case 'subscribe':
          await this.subscribeToJob(client.id, message.payload.jobId);
          break;

        case 'unsubscribe':
          this.unsubscribeFromJob(client.id, message.payload.jobId);
          break;

        case 'location_update':
          if (client.type === 'technician') {
            await this.handleTechnicianLocation(client, message.payload);
          }
          break;

        case 'status_update':
          if (client.type === 'technician' || client.type === 'dashboard') {
            await this.handleStatusUpdate(client, message.payload);
          }
          break;

        case 'ping':
          client.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        default:
          console.warn(`[Tracking WS] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('[Tracking WS] Message handling error:', error);
    }
  }

  private async subscribeToJob(clientId: string, jobId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Check subscription limit
    const currentSubs = this.jobSubscriptions.get(jobId);
    if (currentSubs && currentSubs.size >= MAX_CLIENTS_PER_JOB) {
      client.socket.send(JSON.stringify({
        type: 'error',
        payload: { code: 'MAX_SUBSCRIBERS', message: 'Too many subscribers for this job' },
      }));
      return;
    }

    // Add subscription
    client.subscribedJobs.add(jobId);

    if (!this.jobSubscriptions.has(jobId)) {
      this.jobSubscriptions.set(jobId, new Set());
    }
    this.jobSubscriptions.get(jobId)!.add(clientId);

    // Send current state
    const state = this.jobStates.get(jobId);
    if (state) {
      client.socket.send(JSON.stringify({
        type: 'state_sync',
        payload: {
          jobId,
          status: state.status,
          technicianLocation: state.technicianLocation,
          eta: state.eta,
          statusHistory: state.statusHistory.slice(0, 10),
        },
      }));
    }

    console.log(`[Tracking WS] Client ${clientId} subscribed to job ${jobId}`);
  }

  private unsubscribeFromJob(clientId: string, jobId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscribedJobs.delete(jobId);
    this.jobSubscriptions.get(jobId)?.delete(clientId);

    console.log(`[Tracking WS] Client ${clientId} unsubscribed from job ${jobId}`);
  }

  private async handleTechnicianLocation(
    client: WSClient,
    payload: { lat: number; lng: number; heading?: number; speed?: number; jobId?: string }
  ): Promise<void> {
    const technicianId = client.userId;

    // Throttle updates
    const lastUpdate = this.lastLocationUpdate.get(technicianId) || 0;
    if (Date.now() - lastUpdate < LOCATION_UPDATE_THROTTLE_MS) {
      return;
    }
    this.lastLocationUpdate.set(technicianId, Date.now());

    const location: GeoLocation = {
      lat: payload.lat,
      lng: payload.lng,
      heading: payload.heading,
      speed: payload.speed,
      timestamp: new Date(),
    };

    // Get technician's active jobs
    const activeJobs = this.technicianJobs.get(technicianId) || new Set();
    if (payload.jobId) {
      activeJobs.add(payload.jobId);
      this.technicianJobs.set(technicianId, activeJobs);
    }

    // Update and broadcast to each job's subscribers
    for (const jobId of activeJobs as Set<string>) {
      await this.updateJobLocation(jobId, technicianId, location);
    }
  }

  private async updateJobLocation(
    jobId: string,
    technicianId: string,
    location: GeoLocation
  ): Promise<void> {
    // Get or create job state
    let state = this.jobStates.get(jobId);
    if (!state) {
      // Initialize minimal state - should be loaded from DB in production
      state = {
        jobId,
        status: 'en_route',
        technicianId,
        statusHistory: [],
        customerLocation: { jobId, address: '', lat: 0, lng: 0 },
        subscribedCustomers: new Set(),
        lastUpdate: new Date(),
      };
      this.jobStates.set(jobId, state);
    }

    // Update technician location
    state.technicianLocation = {
      ...location,
      technicianId,
      status: 'active',
    };
    state.lastUpdate = new Date();

    // Calculate new ETA if we have customer location
    if (state.customerLocation.lat && state.customerLocation.lng) {
      try {
        const eta = await this.etaService.getETA(location, {
          lat: state.customerLocation.lat,
          lng: state.customerLocation.lng,
          timestamp: new Date(),
        });
        state.eta = eta;

        // Check for arrival
        if (this.etaService.hasArrived(location, state.customerLocation)) {
          this.broadcastToJob(jobId, {
            type: 'arrival_detected',
            payload: { timestamp: new Date().toISOString() },
          });
        }
      } catch (error) {
        console.error('[Tracking WS] ETA calculation failed:', error);
      }
    }

    // Broadcast location update
    this.broadcastToJob(jobId, {
      type: 'location_update',
      payload: {
        lat: location.lat,
        lng: location.lng,
        heading: location.heading,
        speed: location.speed,
        timestamp: location.timestamp.toISOString(),
      },
    });

    // Broadcast ETA update if available
    if (state.eta) {
      this.broadcastToJob(jobId, {
        type: 'eta_update',
        payload: {
          minutes: state.eta.durationMinutes,
          distance: state.eta.distanceText,
          updatedAt: state.eta.calculatedAt.toISOString(),
        },
      });
    }
  }

  private async handleStatusUpdate(
    client: WSClient,
    payload: { jobId: string; status: string; note?: string }
  ): Promise<void> {
    const { jobId, status, note } = payload;

    let state = this.jobStates.get(jobId);
    if (!state) {
      state = {
        jobId,
        status,
        statusHistory: [],
        customerLocation: { jobId, address: '', lat: 0, lng: 0 },
        subscribedCustomers: new Set(),
        lastUpdate: new Date(),
      };
      this.jobStates.set(jobId, state);
    }

    const previousStatus = state.status;
    state.status = status;
    state.statusHistory.unshift({
      status,
      timestamp: new Date(),
      note,
    });
    state.lastUpdate = new Date();

    // Broadcast status update
    this.broadcastToJob(jobId, {
      type: 'status_update',
      payload: {
        status,
        previousStatus,
        note,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`[Tracking WS] Job ${jobId} status updated: ${previousStatus} -> ${status}`);
  }

  private broadcastToJob(jobId: string, message: { type: string; payload: any }): void {
    const subscribers = this.jobSubscriptions.get(jobId);
    if (!subscribers || subscribers.size === 0) return;

    const messageStr = JSON.stringify({
      ...message,
      timestamp: new Date().toISOString(),
    });

    for (const clientId of subscribers as Set<string>) {
      const client = this.clients.get(clientId);
      if (client && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(messageStr);
      }
    }
  }

  private handleClientDisconnect(client: WSClient): void {
    // Remove from all subscriptions
    for (const jobId of client.subscribedJobs as Set<string>) {
      this.jobSubscriptions.get(jobId)?.delete(client.id);
    }

    // Clean up empty subscription sets
    for (const [jobId, subs] of this.jobSubscriptions.entries() as IterableIterator<[string, Set<string>]>) {
      if (subs.size === 0) {
        this.jobSubscriptions.delete(jobId);
      }
    }

    // Remove technician jobs if applicable
    if (client.type === 'technician') {
      this.technicianJobs.delete(client.userId);
      this.lastLocationUpdate.delete(client.userId);
    }

    // Remove client
    this.clients.delete(client.id);

    console.log(`[Tracking WS] Client ${client.id} disconnected`);
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();

      for (const [clientId, client] of this.clients.entries() as IterableIterator<[string, WSClient]>) {
        // Check for stale connections
        if (client.lastPing) {
          const timeSinceLastPing = now - client.lastPing.getTime();
          if (timeSinceLastPing > PING_INTERVAL_MS * 2) {
            console.log(`[Tracking WS] Client ${clientId} timed out`);
            client.socket.terminate();
            this.handleClientDisconnect(client);
            continue;
          }
        }

        // Send ping
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.ping();
        }
      }
    }, PING_INTERVAL_MS);
  }

  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set initial job state (called from external service)
   */
  setJobState(state: JobTrackingState): void {
    this.jobStates.set(state.jobId, state);
  }

  /**
   * Get current clients count
   */
  getClientsCount(): { total: number; customers: number; technicians: number } {
    let customers = 0;
    let technicians = 0;

    for (const client of this.clients.values() as IterableIterator<WSClient>) {
      if (client.type === 'customer') customers++;
      if (client.type === 'technician') technicians++;
    }

    return { total: this.clients.size, customers, technicians };
  }

  /**
   * Shutdown server
   */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all client connections
    for (const client of this.clients.values() as IterableIterator<WSClient>) {
      client.socket.close();
    }

    this.wss.close();
    console.log('[Tracking WS] Server shutdown');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let wsServerInstance: TrackingWebSocketServer | null = null;

export function getTrackingWebSocketServer(): TrackingWebSocketServer {
  if (!wsServerInstance) {
    throw new Error('Tracking WebSocket Server not initialized');
  }
  return wsServerInstance;
}

export function initializeTrackingWebSocketServer(options: {
  port: number;
  jwtSecret: string;
  etaService?: ETAService;
}): TrackingWebSocketServer {
  if (wsServerInstance) {
    console.warn('[Tracking WS] Server already initialized');
    return wsServerInstance;
  }

  wsServerInstance = new TrackingWebSocketServer(options);
  return wsServerInstance;
}

export function shutdownTrackingWebSocketServer(): void {
  if (wsServerInstance) {
    wsServerInstance.shutdown();
    wsServerInstance = null;
  }
}

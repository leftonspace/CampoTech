/**
 * Real-Time Tracking Module
 * =========================
 *
 * Complete real-time job tracking system with WebSocket support.
 *
 * Features:
 * - Live technician location updates
 * - ETA calculation (Google Maps, OSRM, or simple estimation)
 * - WebSocket server for real-time updates
 * - Status change broadcasting
 * - Arrival detection
 *
 * Usage:
 * ```typescript
 * import { initializeTrackingService, createTrackingRoutes } from './tracking';
 *
 * // Initialize tracking service
 * initializeTrackingService(pool, {
 *   googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
 *   wsPort: 3001,
 *   jwtSecret: process.env.JWT_SECRET,
 * });
 *
 * // Mount REST routes
 * app.use('/customer/tracking', createTrackingRoutes(pool));
 * app.use('/technician/tracking', createTechnicianTrackingRoutes(pool));
 * ```
 */

// Types
export * from './tracking.types';

// ETA Service
export {
  ETAService,
  GoogleMapsETAProvider,
  OSRMETAProvider,
  SimpleETAProvider,
  getETAService,
  initializeETAService,
  resetETAService,
} from './eta.service';

// WebSocket Server
export {
  TrackingWebSocketServer,
  getTrackingWebSocketServer,
  initializeTrackingWebSocketServer,
  shutdownTrackingWebSocketServer,
} from './tracking-websocket';

// Tracking Service
export {
  TrackingService,
  getTrackingService,
  initializeTrackingService,
  resetTrackingService,
} from './tracking.service';

// Routes
export {
  createTrackingRoutes,
  createTechnicianTrackingRoutes,
} from './tracking.routes';

// Notification Preferences
export {
  getNotificationPreferences,
  updateNotificationPreferences,
  updateSinglePreference,
  registerPushToken,
  unregisterPushToken,
  shouldNotify,
  getNotifiableCustomers,
  setWhatsAppOptIn,
  getDefaultPreferences,
} from './notification-preferences';

export type {
  NotificationChannel,
  NotificationEventType,
  NotificationPreference,
  CustomerNotificationPreferences,
} from './notification-preferences';

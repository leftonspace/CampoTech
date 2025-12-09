/**
 * Background Location Tracking Service
 * =====================================
 *
 * Phase 9.9: Customer Live Tracking System
 * Handles background location updates for technician tracking.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const LOCATION_TASK_NAME = 'CAMPOTECH_BACKGROUND_LOCATION';
const ACTIVE_SESSION_KEY = '@tracking_session';
const LOCATION_QUEUE_KEY = '@location_queue';

// Update intervals (in milliseconds)
const FOREGROUND_UPDATE_INTERVAL = 5000; // 5 seconds
const BACKGROUND_UPDATE_INTERVAL = 15000; // 15 seconds
const DISTANCE_INTERVAL = 10; // 10 meters minimum movement

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrackingSession {
  sessionId: string;
  jobId: string;
  startedAt: string;
  status: 'active' | 'paused' | 'completed';
}

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

interface QueuedLocation extends LocationUpdate {
  sessionId: string;
  queuedAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK DEFINITION (Background)
// ═══════════════════════════════════════════════════════════════════════════════

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };

    for (const location of locations) {
      await processLocationUpdate({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        speed: location.coords.speed,
        heading: location.coords.heading,
        timestamp: location.timestamp,
      });
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class BackgroundTrackingService {
  private isTracking = false;
  private foregroundSubscription: Location.LocationSubscription | null = null;
  private currentSession: TrackingSession | null = null;

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // Request foreground permission first
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.warn('Foreground location permission denied');
        return false;
      }

      // Request background permission
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission denied');
        // Can still work in foreground-only mode
      }

      return true;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }

  /**
   * Check if location permissions are granted
   */
  async hasPermissions(): Promise<{ foreground: boolean; background: boolean }> {
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();

    return {
      foreground: foreground.status === 'granted',
      background: background.status === 'granted',
    };
  }

  /**
   * Start tracking for a job
   */
  async startTracking(jobId: string): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      // Check permissions
      const permissions = await this.hasPermissions();
      if (!permissions.foreground) {
        const granted = await this.requestPermissions();
        if (!granted) {
          return { success: false, error: 'Permisos de ubicación no concedidos' };
        }
      }

      // Call API to start tracking session
      const response = await api.tracking.start(jobId);
      if (!response.success) {
        return { success: false, error: response.error?.message || 'Error iniciando rastreo' };
      }

      const sessionId = response.data.sessionId;

      // Store session
      this.currentSession = {
        sessionId,
        jobId,
        startedAt: new Date().toISOString(),
        status: 'active',
      };
      await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(this.currentSession));

      // Start location updates
      await this.startLocationUpdates();

      // Send initial location
      await this.sendCurrentLocation();

      this.isTracking = true;

      return { success: true, sessionId };
    } catch (error) {
      console.error('Start tracking error:', error);
      return { success: false, error: 'Error iniciando rastreo' };
    }
  }

  /**
   * Stop tracking
   */
  async stopTracking(): Promise<void> {
    try {
      // Stop location updates
      await this.stopLocationUpdates();

      // Clear session
      if (this.currentSession) {
        this.currentSession.status = 'completed';
        await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
        this.currentSession = null;
      }

      // Process any queued locations
      await this.flushLocationQueue();

      this.isTracking = false;
    } catch (error) {
      console.error('Stop tracking error:', error);
    }
  }

  /**
   * Check if currently tracking
   */
  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Get current session
   */
  getCurrentSession(): TrackingSession | null {
    return this.currentSession;
  }

  /**
   * Resume tracking after app restart
   */
  async resumeIfNeeded(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
      if (!stored) return false;

      const session = JSON.parse(stored) as TrackingSession;
      if (session.status !== 'active') return false;

      // Check if session is still valid on server
      const response = await api.tracking.getSession(session.sessionId);
      if (!response.success || response.data?.status !== 'active') {
        await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
        return false;
      }

      this.currentSession = session;
      await this.startLocationUpdates();
      this.isTracking = true;

      return true;
    } catch (error) {
      console.error('Resume tracking error:', error);
      return false;
    }
  }

  /**
   * Get current location once
   */
  async getCurrentLocation(): Promise<LocationUpdate | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        speed: location.coords.speed,
        heading: location.coords.heading,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('Get current location error:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private async startLocationUpdates(): Promise<void> {
    const permissions = await this.hasPermissions();

    // Start foreground updates
    this.foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: FOREGROUND_UPDATE_INTERVAL,
        distanceInterval: DISTANCE_INTERVAL,
      },
      (location) => {
        this.handleLocationUpdate({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || 0,
          speed: location.coords.speed,
          heading: location.coords.heading,
          timestamp: location.timestamp,
        });
      }
    );

    // Start background updates if permission granted
    if (permissions.background) {
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (!isTaskRegistered) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: BACKGROUND_UPDATE_INTERVAL,
          distanceInterval: DISTANCE_INTERVAL,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'CampoTech - Rastreo activo',
            notificationBody: 'Tu ubicación se está compartiendo con el cliente',
            notificationColor: '#16a34a',
          },
        });
      }
    }
  }

  private async stopLocationUpdates(): Promise<void> {
    // Stop foreground subscription
    if (this.foregroundSubscription) {
      this.foregroundSubscription.remove();
      this.foregroundSubscription = null;
    }

    // Stop background task
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isTaskRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  }

  private async handleLocationUpdate(location: LocationUpdate): Promise<void> {
    await processLocationUpdate(location);
  }

  private async sendCurrentLocation(): Promise<void> {
    const location = await this.getCurrentLocation();
    if (location) {
      await processLocationUpdate(location);
    }
  }

  private async flushLocationQueue(): Promise<void> {
    try {
      const queueStr = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
      if (!queueStr) return;

      const queue = JSON.parse(queueStr) as QueuedLocation[];
      await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);

      // Send all queued locations
      for (const loc of queue) {
        try {
          await api.tracking.updateLocation(loc.sessionId, {
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy,
            speed: loc.speed,
            heading: loc.heading,
            timestamp: new Date(loc.timestamp).toISOString(),
          });
        } catch {
          // Ignore individual failures
        }
      }
    } catch (error) {
      console.error('Flush queue error:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION PROCESSING (Used by both foreground and background)
// ═══════════════════════════════════════════════════════════════════════════════

async function processLocationUpdate(location: LocationUpdate): Promise<void> {
  try {
    // Get active session
    const sessionStr = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    if (!sessionStr) return;

    const session = JSON.parse(sessionStr) as TrackingSession;
    if (session.status !== 'active') return;

    // Try to send to server
    try {
      await api.tracking.updateLocation(session.sessionId, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        timestamp: new Date(location.timestamp).toISOString(),
      });
    } catch {
      // Queue for later if offline
      await queueLocation(session.sessionId, location);
    }
  } catch (error) {
    console.error('Process location error:', error);
  }
}

async function queueLocation(sessionId: string, location: LocationUpdate): Promise<void> {
  try {
    const queueStr = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
    const queue: QueuedLocation[] = queueStr ? JSON.parse(queueStr) : [];

    queue.push({
      ...location,
      sessionId,
      queuedAt: Date.now(),
    });

    // Keep only last 100 locations
    const trimmed = queue.slice(-100);
    await AsyncStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Queue location error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const backgroundTracking = new BackgroundTrackingService();
export default backgroundTracking;

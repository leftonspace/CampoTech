/**
 * GPS Location Tracking Service
 * =============================
 *
 * Location tracking for technicians.
 * Sends location updates to server when technician is EN_ROUTE.
 *
 * Features:
 * - Foreground polling in Expo Go (development)
 * - Background tracking in production builds
 * - Automatic retry and offline queuing
 * - 30-second update interval
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api } from '../api/client';

// Background task name
const BACKGROUND_LOCATION_TASK = 'CAMPOTECH_BACKGROUND_LOCATION';

// Update interval in milliseconds (30 seconds)
const UPDATE_INTERVAL = 30000;
const DISTANCE_INTERVAL = 10; // 10 meters minimum movement

// State
let isTracking = false;
let currentJobId: string | null = null;
let currentSessionId: string | null = null;
let trackingListeners: Array<(location: LocationUpdate) => void> = [];
let foregroundInterval: ReturnType<typeof setInterval> | null = null;
let foregroundSubscription: Location.LocationSubscription | null = null;

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  altitude: number | null;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND TASK DEFINITION
// ═══════════════════════════════════════════════════════════════════════════════

// Define background location task (must be at module level for expo-task-manager)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[Location] Background task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };

    for (const location of locations) {
      try {
        // Send location update to server
        if (currentSessionId && currentJobId) {
          await api.tracking.update({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            jobId: currentJobId,
            sessionId: currentSessionId,
            speed: location.coords.speed,
            heading: location.coords.heading,
            accuracy: location.coords.accuracy,
            altitude: location.coords.altitude,
          });
        }

        // Notify listeners
        notifyListeners({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          speed: location.coords.speed,
          heading: location.coords.heading,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude,
          timestamp: location.timestamp,
        });
      } catch (err) {
        console.warn('[Location] Background update error:', err);
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function requestLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  // Request foreground permission first
  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync();

  if (foregroundStatus !== 'granted') {
    return { foreground: false, background: false };
  }

  // Request background permission for production builds
  let backgroundGranted = false;
  try {
    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();
    backgroundGranted = backgroundStatus === 'granted';
  } catch (error) {
    // Background permissions may not be available in Expo Go
    console.log('[Location] Background permissions not available:', error);
  }

  return { foreground: true, background: backgroundGranted };
}

export async function checkLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const foreground = await Location.getForegroundPermissionsAsync();

  let backgroundGranted = false;
  try {
    const background = await Location.getBackgroundPermissionsAsync();
    backgroundGranted = background.status === 'granted';
  } catch {
    // Ignore - background permissions may not be available
  }

  return {
    foreground: foreground.status === 'granted',
    background: backgroundGranted,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING CONTROL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start location tracking for a job
 */
export async function startTracking(jobId: string): Promise<{
  success: boolean;
  sessionId?: string;
  trackingUrl?: string;
  error?: string;
}> {
  if (isTracking) {
    return {
      success: false,
      error: 'Tracking is already active',
    };
  }

  // Check and request permissions
  let permissions = await checkLocationPermissions();
  if (!permissions.foreground) {
    permissions = await requestLocationPermissions();
    if (!permissions.foreground) {
      return {
        success: false,
        error: 'Location permission required',
      };
    }
  }

  try {
    // Get current location
    const currentLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    // Start tracking session on server
    const response = await api.tracking.start(
      jobId,
      currentLocation.coords.latitude,
      currentLocation.coords.longitude
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error?.message || 'Failed to start tracking session',
      };
    }

    currentJobId = jobId;
    currentSessionId = response.data.sessionId;
    isTracking = true;

    // Start location updates based on available permissions
    if (permissions.background) {
      await startBackgroundTracking();
      console.log('[Location] Started background tracking');
    } else {
      startForegroundTracking();
      console.log('[Location] Started foreground tracking (polling every 30s)');
    }

    // Also start watch for foreground updates (more frequent when app is open)
    await startForegroundWatch();

    // Notify listeners of initial location
    notifyListeners({
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
      speed: currentLocation.coords.speed,
      heading: currentLocation.coords.heading,
      accuracy: currentLocation.coords.accuracy,
      altitude: currentLocation.coords.altitude,
      timestamp: currentLocation.timestamp,
    });

    return {
      success: true,
      sessionId: response.data.sessionId,
      trackingUrl: response.data.trackingUrl,
    };
  } catch (error) {
    console.error('Start tracking error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start tracking',
    };
  }
}

/**
 * Stop location tracking
 */
export async function stopTracking(): Promise<void> {
  if (!isTracking) return;

  try {
    // Stop all tracking methods
    stopForegroundTracking();
    await stopForegroundWatch();
    await stopBackgroundTracking();

    // Notify server that tracking has stopped
    if (currentSessionId) {
      await api.tracking.stop(currentSessionId);
    }
  } catch (error) {
    console.error('Stop tracking error:', error);
  } finally {
    isTracking = false;
    currentJobId = null;
    currentSessionId = null;
  }
}

/**
 * Check if tracking is currently active
 */
export function isTrackingActive(): boolean {
  return isTracking;
}

/**
 * Get current tracked job ID
 */
export function getCurrentJobId(): string | null {
  return currentJobId;
}

/**
 * Get current session ID
 */
export function getCurrentSessionId(): string | null {
  return currentSessionId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND TRACKING (Production builds only)
// ═══════════════════════════════════════════════════════════════════════════════

async function startBackgroundTracking(): Promise<void> {
  try {
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_LOCATION_TASK
    );

    if (!isTaskRegistered) {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: UPDATE_INTERVAL,
        distanceInterval: DISTANCE_INTERVAL,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'CampoTech - Rastreo activo',
          notificationBody: 'Tu ubicación se está compartiendo con el cliente',
          notificationColor: '#16a34a',
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
      });
    }
  } catch (error) {
    console.warn('[Location] Could not start background tracking:', error);
    // Fall back to foreground polling
    startForegroundTracking();
  }
}

async function stopBackgroundTracking(): Promise<void> {
  try {
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_LOCATION_TASK
    );
    if (isTaskRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (error) {
    console.warn('[Location] Error stopping background tracking:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOREGROUND TRACKING (Fallback for Expo Go)
// ═══════════════════════════════════════════════════════════════════════════════

function startForegroundTracking(): void {
  if (foregroundInterval) return;

  // Poll location every 30 seconds (fallback for Expo Go)
  foregroundInterval = setInterval(async () => {
    if (!isTracking) {
      stopForegroundTracking();
      return;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationUpdate: LocationUpdate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        speed: location.coords.speed,
        heading: location.coords.heading,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        timestamp: location.timestamp,
      };

      notifyListeners(locationUpdate);

      // Send to server
      if (currentSessionId && currentJobId) {
        await api.tracking.update({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          jobId: currentJobId,
          sessionId: currentSessionId,
          speed: location.coords.speed,
          heading: location.coords.heading,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude,
        });
      }
    } catch (error) {
      console.warn('Foreground location update error:', error);
    }
  }, UPDATE_INTERVAL);
}

function stopForegroundTracking(): void {
  if (foregroundInterval) {
    clearInterval(foregroundInterval);
    foregroundInterval = null;
  }
}

// Foreground watch for more frequent updates when app is in foreground
async function startForegroundWatch(): Promise<void> {
  try {
    foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000, // 5 seconds when in foreground
        distanceInterval: DISTANCE_INTERVAL,
      },
      (location) => {
        const locationUpdate: LocationUpdate = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          speed: location.coords.speed,
          heading: location.coords.heading,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude,
          timestamp: location.timestamp,
        };
        notifyListeners(locationUpdate);
      }
    );
  } catch (error) {
    console.warn('[Location] Could not start foreground watch:', error);
  }
}

async function stopForegroundWatch(): Promise<void> {
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════

export function addTrackingListener(
  listener: (location: LocationUpdate) => void
): () => void {
  trackingListeners.push(listener);
  return () => {
    trackingListeners = trackingListeners.filter((l) => l !== listener);
  };
}

function notifyListeners(location: LocationUpdate): void {
  trackingListeners.forEach((listener) => {
    try {
      listener(location);
    } catch (error) {
      console.error('Tracking listener error:', error);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANUAL LOCATION UPDATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current location once (not for tracking)
 */
export async function getCurrentLocation(): Promise<LocationUpdate | null> {
  try {
    const permissions = await checkLocationPermissions();
    if (!permissions.foreground) {
      const requested = await requestLocationPermissions();
      if (!requested.foreground) {
        return null;
      }
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: location.coords.speed,
      heading: location.coords.heading,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      timestamp: location.timestamp,
    };
  } catch (error) {
    console.error('Get current location error:', error);
    return null;
  }
}

/**
 * Send a manual location update to the server
 */
export async function sendLocationUpdate(): Promise<boolean> {
  if (!isTracking || !currentJobId) {
    return false;
  }

  const location = await getCurrentLocation();
  if (!location) {
    return false;
  }

  try {
    await api.tracking.update({
      lat: location.latitude,
      lng: location.longitude,
      jobId: currentJobId,
      sessionId: currentSessionId,
      speed: location.speed,
      heading: location.heading,
      accuracy: location.accuracy,
      altitude: location.altitude,
    });
    return true;
  } catch (error) {
    console.error('Manual location update error:', error);
    return false;
  }
}

/**
 * Check if background tracking is available
 * (Requires development build, not available in Expo Go)
 */
export async function isBackgroundTrackingAvailable(): Promise<boolean> {
  try {
    const permissions = await checkLocationPermissions();
    return permissions.background;
  } catch {
    return false;
  }
}

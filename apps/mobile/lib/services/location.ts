/**
 * GPS Location Tracking Service
 * =============================
 *
 * Background location tracking for technicians.
 * Sends location updates to server when technician is EN_ROUTE.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { api } from '../api/client';

// Background task name
const LOCATION_TASK_NAME = 'CAMPOTECH_LOCATION_TRACKING';

// Update interval in milliseconds (30 seconds)
const UPDATE_INTERVAL = 30000;

// State
let isTracking = false;
let currentJobId: string | null = null;
let currentSessionId: string | null = null;
let trackingListeners: Array<(location: LocationUpdate) => void> = [];

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

  // Request background permission for iOS
  // Note: On Android 10+, background permission is requested separately
  if (Platform.OS === 'ios') {
    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();
    return {
      foreground: true,
      background: backgroundStatus === 'granted',
    };
  }

  // On Android, request background permission
  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();

  return {
    foreground: true,
    background: backgroundStatus === 'granted',
  };
}

export async function checkLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();

  return {
    foreground: foreground.status === 'granted',
    background: background.status === 'granted',
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

  // Check permissions
  const permissions = await checkLocationPermissions();
  if (!permissions.foreground) {
    const requested = await requestLocationPermissions();
    if (!requested.foreground) {
      return {
        success: false,
        error: 'Location permission required',
      };
    }
  }

  try {
    // Get current location
    const currentLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
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

    // Start background location updates
    await startBackgroundTracking();

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
    // Stop background tracking
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

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

async function startBackgroundTracking(): Promise<void> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

  if (hasStarted) {
    // Already running, no need to start again
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 50, // Update every 50 meters
    timeInterval: UPDATE_INTERVAL, // Or every 30 seconds
    deferredUpdatesInterval: UPDATE_INTERVAL,
    foregroundService: {
      notificationTitle: 'CampoTech',
      notificationBody: 'Compartiendo ubicación con el cliente',
      notificationColor: '#16a34a',
    },
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
  });
}

async function stopBackgroundTracking(): Promise<void> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK MANAGER HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }

  if (!data || !isTracking) {
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };

  if (!locations || locations.length === 0) {
    return;
  }

  // Get the most recent location
  const location = locations[locations.length - 1];
  const { coords, timestamp } = location;

  const locationUpdate: LocationUpdate = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    speed: coords.speed,
    heading: coords.heading,
    accuracy: coords.accuracy,
    altitude: coords.altitude,
    timestamp,
  };

  // Notify listeners
  notifyListeners(locationUpdate);

  // Send to server
  try {
    await api.tracking.update({
      lat: coords.latitude,
      lng: coords.longitude,
      jobId: currentJobId,
      sessionId: currentSessionId,
      speed: coords.speed,
      heading: coords.heading,
      accuracy: coords.accuracy,
      altitude: coords.altitude,
    });
  } catch (error) {
    console.warn('Failed to send location update:', error);
    // Continue tracking even if update fails - will retry on next update
  }
});

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
      accuracy: Location.Accuracy.Balanced,
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

/**
 * Background Tracking Hook
 * ========================
 *
 * Phase 9.9: Customer Live Tracking System
 * React hook for managing background location tracking.
 */

import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { backgroundTracking, TrackingSession, LocationUpdate } from '../location/background-tracking.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface UseBackgroundTrackingResult {
  isTracking: boolean;
  session: TrackingSession | null;
  currentLocation: LocationUpdate | null;
  permissions: { foreground: boolean; background: boolean };
  isLoading: boolean;
  error: string | null;
  startTracking: (jobId: string) => Promise<boolean>;
  stopTracking: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useBackgroundTracking(): UseBackgroundTrackingResult {
  const [isTracking, setIsTracking] = useState(false);
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null);
  const [permissions, setPermissions] = useState({ foreground: false, background: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      const perms = await backgroundTracking.hasPermissions();
      setPermissions(perms);
    };
    checkPermissions();
  }, []);

  // Resume tracking on app start
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        const resumed = await backgroundTracking.resumeIfNeeded();
        if (resumed) {
          setIsTracking(true);
          setSession(backgroundTracking.getCurrentSession());
        }
      } catch (err) {
        console.error('Initialize tracking error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, []);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isTracking) {
        // Refresh location when app becomes active
        const location = await backgroundTracking.getCurrentLocation();
        if (location) {
          setCurrentLocation(location);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isTracking]);

  // Start tracking
  const startTracking = useCallback(async (jobId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await backgroundTracking.startTracking(jobId);

      if (result.success) {
        setIsTracking(true);
        setSession(backgroundTracking.getCurrentSession());

        // Get initial location
        const location = await backgroundTracking.getCurrentLocation();
        if (location) {
          setCurrentLocation(location);
        }

        return true;
      } else {
        setError(result.error || 'Error iniciando rastreo');
        return false;
      }
    } catch (err) {
      setError('Error inesperado');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Stop tracking
  const stopTracking = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await backgroundTracking.stopTracking();
      setIsTracking(false);
      setSession(null);
      setCurrentLocation(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const granted = await backgroundTracking.requestPermissions();
    const perms = await backgroundTracking.hasPermissions();
    setPermissions(perms);
    return granted;
  }, []);

  // Refresh current location
  const refreshLocation = useCallback(async (): Promise<void> => {
    const location = await backgroundTracking.getCurrentLocation();
    if (location) {
      setCurrentLocation(location);
    }
  }, []);

  return {
    isTracking,
    session,
    currentLocation,
    permissions,
    isLoading,
    error,
    startTracking,
    stopTracking,
    requestPermissions,
    refreshLocation,
  };
}

export default useBackgroundTracking;

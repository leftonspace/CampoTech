/**
 * Tracking Hook
 * =============
 *
 * React hook for GPS tracking state and controls.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  startTracking,
  stopTracking,
  isTrackingActive,
  getCurrentJobId,
  addTrackingListener,
  LocationUpdate,
} from '../services/location';

interface TrackingState {
  isTracking: boolean;
  currentJobId: string | null;
  lastLocation: LocationUpdate | null;
}

export function useTracking() {
  const [state, setState] = useState<TrackingState>({
    isTracking: isTrackingActive(),
    currentJobId: getCurrentJobId(),
    lastLocation: null,
  });

  useEffect(() => {
    // Subscribe to location updates
    const unsubscribe = addTrackingListener((location) => {
      setState((prev) => ({
        ...prev,
        lastLocation: location,
        isTracking: isTrackingActive(),
        currentJobId: getCurrentJobId(),
      }));
    });

    return unsubscribe;
  }, []);

  const start = useCallback(async (jobId: string) => {
    const result = await startTracking(jobId);
    if (result.success) {
      setState((prev) => ({
        ...prev,
        isTracking: true,
        currentJobId: jobId,
      }));
    }
    return result;
  }, []);

  const stop = useCallback(async () => {
    await stopTracking();
    setState((prev) => ({
      ...prev,
      isTracking: false,
      currentJobId: null,
    }));
  }, []);

  return {
    ...state,
    start,
    stop,
  };
}

export default useTracking;

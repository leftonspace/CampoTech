/**
 * Tracking WebSocket Client Hook
 *
 * Provides real-time updates for technician locations
 * Falls back to polling if WebSocket is not available
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TechnicianLocationUpdate {
  id: string;
  userId: string;
  name: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  movementMode: string;
  isOnline: boolean;
  currentJobId?: string;
  etaMinutes?: number;
  updatedAt: string;
}

export interface JobStatusChangeUpdate {
  jobId: string;
  jobNumber: string;
  previousStatus: string;
  newStatus: string;
  technicianId?: string;
  technicianName?: string;
  customerId: string;
  customerName: string;
  lat?: number;
  lng?: number;
  updatedAt: string;
}

export interface NewJobCreatedUpdate {
  jobId: string;
  jobNumber: string;
  status: string;
  customerId: string;
  customerName: string;
  address: string;
  lat?: number;
  lng?: number;
  scheduledTime?: string;
  createdAt: string;
}

export type TrackingMessageType =
  | 'location_update'
  | 'technician_online'
  | 'technician_offline'
  | 'job_status_changed'
  | 'new_job_created';

export interface TrackingMessage {
  type: TrackingMessageType;
  data: TechnicianLocationUpdate | { userId: string; status: string } | JobStatusChangeUpdate | NewJobCreatedUpdate;
  timestamp: string;
}

interface UseTrackingClientOptions {
  organizationId?: string;
  enabled?: boolean;
  pollingInterval?: number;
  onLocationUpdate?: (update: TechnicianLocationUpdate) => void;
  onTechnicianOnline?: (userId: string) => void;
  onTechnicianOffline?: (userId: string) => void;
  onJobStatusChanged?: (update: JobStatusChangeUpdate) => void;
  onNewJobCreated?: (update: NewJobCreatedUpdate) => void;
}

export function useTrackingClient(options: UseTrackingClientOptions = {}) {
  const {
    organizationId,
    enabled = true,
    pollingInterval = 15000,
    onLocationUpdate,
    onTechnicianOnline,
    onTechnicianOffline,
    onJobStatusChanged,
    onNewJobCreated,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (!enabled || !organizationId) return;

    // Try Server-Sent Events first
    try {
      const url = `/api/tracking/subscribe?organizationId=${organizationId}`;
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        console.log('Tracking SSE connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const message: TrackingMessage = JSON.parse(event.data);
          setLastUpdate(new Date());

          switch (message.type) {
            case 'location_update':
              onLocationUpdate?.(message.data as TechnicianLocationUpdate);
              break;
            case 'technician_online':
              onTechnicianOnline?.((message.data as { userId: string }).userId);
              break;
            case 'technician_offline':
              onTechnicianOffline?.((message.data as { userId: string }).userId);
              break;
            case 'job_status_changed':
              onJobStatusChanged?.(message.data as JobStatusChangeUpdate);
              break;
            case 'new_job_created':
              onNewJobCreated?.(message.data as NewJobCreatedUpdate);
              break;
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        eventSourceRef.current = null;
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (enabled && organizationId) {
            console.log('Attempting SSE reconnect...');
            connect();
          }
        }, 5000);
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('SSE not supported, falling back to polling');
      startPolling();
    }
  }, [enabled, organizationId, onLocationUpdate, onTechnicianOnline, onTechnicianOffline, onJobStatusChanged, onNewJobCreated]);

  // Fallback polling
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/tracking/locations');
        if (res.ok) {
          const data = await res.json();
          setLastUpdate(new Date());
          setIsConnected(true);
          setError(null);

          // Emit updates for each technician
          if (data.data?.technicians) {
            data.data.technicians.forEach((tech: any) => {
              if (tech.location) {
                onLocationUpdate?.({
                  id: tech.id,
                  userId: tech.id,
                  name: tech.name,
                  lat: tech.location.lat,
                  lng: tech.location.lng,
                  speed: tech.location.speed,
                  heading: tech.location.heading,
                  movementMode: tech.tracking?.movementMode || 'stationary',
                  isOnline: tech.isOnline,
                  currentJobId: tech.currentJob?.id,
                  etaMinutes: tech.tracking?.etaMinutes,
                  updatedAt: tech.lastSeen || new Date().toISOString(),
                });
              }
            });
          }
        } else {
          setError('Error fetching locations');
        }
      } catch (err) {
        setError('Network error');
        setIsConnected(false);
      }
    };

    poll();
    pollingRef.current = setInterval(poll, pollingInterval);
  }, [pollingInterval, onLocationUpdate]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Setup connection on mount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastUpdate,
    error,
    connect,
    disconnect,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TECHNICIAN STATUS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TechnicianStatus = 'en_linea' | 'en_camino' | 'trabajando' | 'sin_conexion';

export interface StatusUpdatePayload {
  status: TechnicianStatus;
  jobId?: string;
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION REPORTER HOOK (for mobile/technician app)
// ═══════════════════════════════════════════════════════════════════════════════

interface UseLocationReporterOptions {
  enabled?: boolean;
  interval?: number;
  stationaryInterval?: number; // Longer interval when stationary
  jobId?: string;
  includeBatteryLevel?: boolean;
}

interface LocationReport {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  altitude: number | null;
  batteryLevel?: number;
  batteryCharging?: boolean;
  timestamp: string;
  jobId?: string;
  status?: TechnicianStatus;
}

export function useLocationReporter(options: UseLocationReporterOptions = {}) {
  const {
    enabled = false,
    interval = 15000,
    stationaryInterval = 60000,
    jobId,
    includeBatteryLevel = true,
  } = options;

  const [isReporting, setIsReporting] = useState(false);
  const [lastReported, setLastReported] = useState<Date | null>(null);
  const [currentStatus, setCurrentStatus] = useState<TechnicianStatus>('sin_conexion');
  const [isMoving, setIsMoving] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  // Get battery info if available
  const getBatteryInfo = useCallback(async (): Promise<{ level?: number; charging?: boolean }> => {
    if (!includeBatteryLevel) return {};

    try {
      if ('getBattery' in navigator) {
        // @ts-expect-error - Battery API not in standard TypeScript DOM types
        const battery = await navigator.getBattery();
        return {
          level: Math.round(battery.level * 100),
          charging: battery.charging,
        };
      }
    } catch {
      // Battery API not available
    }
    return {};
  }, [includeBatteryLevel]);

  // Check if position has changed significantly (>10 meters)
  const hasPositionChanged = useCallback((lat: number, lng: number): boolean => {
    if (!lastPositionRef.current) return true;

    const R = 6371000; // Earth radius in meters
    const dLat = (lat - lastPositionRef.current.lat) * Math.PI / 180;
    const dLng = (lng - lastPositionRef.current.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lastPositionRef.current.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance > 10; // More than 10 meters
  }, []);

  const reportLocation = useCallback(
    async (position: GeolocationPosition) => {
      try {
        const batteryInfo = await getBatteryInfo();
        const speed = position.coords.speed;

        // Determine if moving based on speed (> 1 m/s = ~3.6 km/h)
        const isCurrentlyMoving = speed !== null && speed > 1;
        setIsMoving(isCurrentlyMoving);

        const report: LocationReport = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: position.coords.speed,
          heading: position.coords.heading,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          batteryLevel: batteryInfo.level,
          batteryCharging: batteryInfo.charging,
          timestamp: new Date().toISOString(),
          jobId,
          status: currentStatus,
        };

        const res = await fetch('/api/tracking/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
        });

        if (res.ok) {
          setLastReported(new Date());
          lastPositionRef.current = { lat: position.coords.latitude, lng: position.coords.longitude };
        }
      } catch (err) {
        console.error('Error reporting location:', err);
      }
    },
    [jobId, currentStatus, getBatteryInfo]
  );

  // Update technician status
  const updateStatus = useCallback(async (payload: StatusUpdatePayload) => {
    try {
      const res = await fetch('/api/tracking/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCurrentStatus(payload.status);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating status:', err);
      return false;
    }
  }, []);

  // Status update helpers
  const clockIn = useCallback(() => updateStatus({ status: 'en_linea' }), [updateStatus]);
  const clockOut = useCallback(() => updateStatus({ status: 'sin_conexion' }), [updateStatus]);
  const startTravel = useCallback((jobId: string) => updateStatus({ status: 'en_camino', jobId }), [updateStatus]);
  const arriveAtJob = useCallback((jobId: string) => updateStatus({ status: 'trabajando', jobId }), [updateStatus]);
  const finishJob = useCallback((jobId: string) => updateStatus({ status: 'en_linea', jobId }), [updateStatus]);

  const startReporting = useCallback(() => {
    if (!('geolocation' in navigator)) {
      console.error('Geolocation not supported');
      return;
    }

    setIsReporting(true);

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(
      reportLocation,
      (err) => console.error('Geolocation error:', err),
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    // Also report on interval (adjusts based on movement)
    const setupInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      const currentInterval = isMoving ? interval : stationaryInterval;
      intervalRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(reportLocation);
      }, currentInterval);
    };

    setupInterval();
  }, [interval, stationaryInterval, isMoving, reportLocation]);

  const stopReporting = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsReporting(false);
    lastPositionRef.current = null;
  }, []);

  useEffect(() => {
    if (enabled) {
      startReporting();
    } else {
      stopReporting();
    }

    return () => {
      stopReporting();
    };
  }, [enabled, startReporting, stopReporting]);

  // Adjust interval when movement state changes
  useEffect(() => {
    if (isReporting && intervalRef.current) {
      clearInterval(intervalRef.current);
      const currentInterval = isMoving ? interval : stationaryInterval;
      intervalRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(reportLocation);
      }, currentInterval);
    }
  }, [isMoving, interval, stationaryInterval, isReporting, reportLocation]);

  return {
    isReporting,
    lastReported,
    currentStatus,
    isMoving,
    startReporting,
    stopReporting,
    updateStatus,
    // Helper methods for status transitions
    clockIn,
    clockOut,
    startTravel,
    arriveAtJob,
    finishJob,
  };
}

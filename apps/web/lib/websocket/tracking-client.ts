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

export interface TrackingMessage {
  type: 'location_update' | 'technician_online' | 'technician_offline' | 'job_status_change';
  data: TechnicianLocationUpdate | { userId: string; status: string };
  timestamp: string;
}

interface UseTrackingClientOptions {
  organizationId?: string;
  enabled?: boolean;
  pollingInterval?: number;
  onLocationUpdate?: (update: TechnicianLocationUpdate) => void;
  onTechnicianOnline?: (userId: string) => void;
  onTechnicianOffline?: (userId: string) => void;
}

export function useTrackingClient(options: UseTrackingClientOptions = {}) {
  const {
    organizationId,
    enabled = true,
    pollingInterval = 15000,
    onLocationUpdate,
    onTechnicianOnline,
    onTechnicianOffline,
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
  }, [enabled, organizationId, onLocationUpdate, onTechnicianOnline, onTechnicianOffline]);

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

/**
 * Hook for sending location updates from mobile/technician app
 */
export function useLocationReporter(options: {
  enabled?: boolean;
  interval?: number;
  jobId?: string;
} = {}) {
  const { enabled = false, interval = 15000, jobId } = options;
  const [isReporting, setIsReporting] = useState(false);
  const [lastReported, setLastReported] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const reportLocation = useCallback(
    async (position: GeolocationPosition) => {
      try {
        const res = await fetch('/api/tracking/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            speed: position.coords.speed,
            heading: position.coords.heading,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            jobId,
          }),
        });

        if (res.ok) {
          setLastReported(new Date());
        }
      } catch (err) {
        console.error('Error reporting location:', err);
      }
    },
    [jobId]
  );

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

    // Also report on interval
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(reportLocation);
    }, interval);
  }, [interval, reportLocation]);

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

  return {
    isReporting,
    lastReported,
    startReporting,
    stopReporting,
  };
}

'use client';

/**
 * Tracking Map Component
 * ======================
 *
 * Phase 9.9: Customer Live Tracking System
 * Interactive map for customer live tracking using Leaflet/OpenStreetMap.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  getMapProvider,
  getTileLayerUrl,
  decodePolyline,
  calculateRoute,
  ARGENTINA_DEFAULTS,
} from './map-providers';
import {
  Position,
  animateMarker,
  PositionTracker,
  createPulseAnimation,
} from './marker-animation';

// Leaflet types (loaded dynamically)
type LeafletMap = any;
type LeafletMarker = any;
type LeafletPolyline = any;

interface TrackingMapProps {
  technicianPosition?: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number; address: string };
  status: 'active' | 'arrived' | 'completed' | 'cancelled';
  movementMode?: string;
  className?: string;
  showRoute?: boolean;
  onRouteCalculated?: (durationMinutes: number, distanceKm: number) => void;
}

export default function TrackingMap({
  technicianPosition,
  destination,
  status,
  movementMode = 'driving',
  className = '',
  showRoute = true,
  onRouteCalculated,
}: TrackingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const technicianMarkerRef = useRef<LeafletMarker | null>(null);
  const destinationMarkerRef = useRef<LeafletMarker | null>(null);
  const routeLineRef = useRef<LeafletPolyline | null>(null);
  const positionTrackerRef = useRef<PositionTracker>(new PositionTracker());
  const animationCancelRef = useRef<(() => void) | null>(null);
  const pulseAnimationRef = useRef<(() => void) | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [leafletModule, setLeafletModule] = useState<any>(null);

  // Load Leaflet dynamically (client-side only)
  useEffect(() => {
    const loadLeaflet = async () => {
      // Dynamically import Leaflet
      const L = await import('leaflet');

      // Import Leaflet CSS
      await import('leaflet/dist/leaflet.css');

      // Fix default marker icons (common Leaflet issue with bundlers)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      setLeafletModule(L);
    };

    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletModule || !mapContainer.current || mapRef.current) return;

    const L = leafletModule;
    const provider = getMapProvider();
    const tileUrl = getTileLayerUrl(provider);

    // Create map
    const map = L.map(mapContainer.current, {
      center: [
        destination.lat || ARGENTINA_DEFAULTS.center.lat,
        destination.lng || ARGENTINA_DEFAULTS.center.lng,
      ],
      zoom: 14,
      zoomControl: true,
    });

    // Add tile layer
    L.tileLayer(tileUrl, {
      attribution: provider.attributionText,
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    setIsMapReady(true);

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletModule, destination.lat, destination.lng]);

  // Create custom icons
  const createTechnicianIcon = useCallback(() => {
    if (!leafletModule) return null;

    const L = leafletModule;
    const iconHtml = `
      <div class="technician-marker" style="
        width: 44px;
        height: 44px;
        background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      ">
        <span style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));">🚐</span>
      </div>
    `;

    return L.divIcon({
      html: iconHtml,
      className: 'custom-technician-marker',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }, [leafletModule]);

  const createDestinationIcon = useCallback(() => {
    if (!leafletModule) return null;

    const L = leafletModule;
    const iconHtml = `
      <div class="destination-marker" style="
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `;

    return L.divIcon({
      html: iconHtml,
      className: 'custom-destination-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });
  }, [leafletModule]);

  // Add destination marker
  useEffect(() => {
    if (!isMapReady || !leafletModule || !destination.lat || !destination.lng) return;

    const L = leafletModule;
    const map = mapRef.current;
    if (!map) return;

    // Remove existing marker
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
    }

    // Create destination marker
    const icon = createDestinationIcon();
    if (icon) {
      const marker = L.marker([destination.lat, destination.lng], { icon })
        .addTo(map)
        .bindPopup(`<strong>Destino</strong><br/>${destination.address}`);

      destinationMarkerRef.current = marker;
    }
  }, [isMapReady, leafletModule, destination, createDestinationIcon]);

  // Update technician marker with animation
  useEffect(() => {
    if (!isMapReady || !leafletModule || status !== 'active') return;

    const L = leafletModule;
    const map = mapRef.current;
    if (!map) return;

    if (!technicianPosition) {
      // Remove marker if no position
      if (technicianMarkerRef.current) {
        technicianMarkerRef.current.remove();
        technicianMarkerRef.current = null;
      }
      return;
    }

    const newPosition: Position = {
      lat: technicianPosition.lat,
      lng: technicianPosition.lng,
    };

    // Track position for smooth animation
    positionTrackerRef.current.addPosition(newPosition);

    // Create marker if doesn't exist
    if (!technicianMarkerRef.current) {
      const icon = createTechnicianIcon();
      if (icon) {
        const marker = L.marker([newPosition.lat, newPosition.lng], { icon })
          .addTo(map)
          .bindPopup('<strong>Técnico en camino</strong>');

        technicianMarkerRef.current = marker;

        // Start pulse animation
        pulseAnimationRef.current = createPulseAnimation((scale, opacity) => {
          const element = marker.getElement();
          if (element) {
            const inner = element.querySelector('.technician-marker') as HTMLElement;
            if (inner) {
              inner.style.transform = `scale(${scale})`;
              inner.style.opacity = String(opacity + 0.3);
            }
          }
        });
      }
    } else {
      // Animate to new position
      const currentLatLng = technicianMarkerRef.current.getLatLng();
      const oldPosition: Position = {
        lat: currentLatLng.lat,
        lng: currentLatLng.lng,
      };

      // Cancel previous animation
      if (animationCancelRef.current) {
        animationCancelRef.current();
      }

      // Animate marker
      animationCancelRef.current = animateMarker(
        oldPosition,
        newPosition,
        (pos) => {
          technicianMarkerRef.current?.setLatLng([pos.lat, pos.lng]);
        },
        undefined,
        { duration: 1000, easing: 'easeOut' }
      );
    }

    // Fit bounds to show both markers
    const bounds = L.latLngBounds([
      [newPosition.lat, newPosition.lng],
      [destination.lat, destination.lng],
    ]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [
    isMapReady,
    leafletModule,
    technicianPosition,
    destination,
    status,
    createTechnicianIcon,
  ]);

  // Calculate and display route
  useEffect(() => {
    if (!isMapReady || !leafletModule || !showRoute || !technicianPosition) return;

    const L = leafletModule;
    const map = mapRef.current;
    if (!map) return;

    const fetchRoute = async () => {
      const result = await calculateRoute({
        origin: technicianPosition,
        destination: { lat: destination.lat, lng: destination.lng },
        mode: movementMode === 'walking' ? 'walking' : 'driving',
      });

      if (!result) return;

      // Decode polyline to coordinates
      const routeCoords = decodePolyline(result.polyline);

      // Remove existing route
      if (routeLineRef.current) {
        routeLineRef.current.remove();
      }

      // Draw route line
      const latLngs = routeCoords.map((c) => [c.lat, c.lng]);
      const polyline = L.polyline(latLngs, {
        color: '#3B82F6',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10',
      }).addTo(map);

      routeLineRef.current = polyline;

      // Callback with route info
      onRouteCalculated?.(result.durationMinutes, result.distanceKm);
    };

    fetchRoute();
  }, [
    isMapReady,
    leafletModule,
    showRoute,
    technicianPosition,
    destination,
    movementMode,
    onRouteCalculated,
  ]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      if (animationCancelRef.current) {
        animationCancelRef.current();
      }
      if (pulseAnimationRef.current) {
        pulseAnimationRef.current();
      }
    };
  }, []);

  // Show arrived/completed state
  useEffect(() => {
    if (!isMapReady || status === 'active') return;

    // Remove technician marker when arrived/completed
    if (technicianMarkerRef.current) {
      technicianMarkerRef.current.remove();
      technicianMarkerRef.current = null;
    }

    // Remove route line
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    // Stop pulse animation
    if (pulseAnimationRef.current) {
      pulseAnimationRef.current();
      pulseAnimationRef.current = null;
    }

    // Center on destination
    if (mapRef.current && destination.lat && destination.lng) {
      mapRef.current.setView([destination.lat, destination.lng], 15);
    }
  }, [isMapReady, status, destination]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapContainer}
        className="w-full h-full rounded-xl overflow-hidden"
        style={{ minHeight: '250px' }}
      />

      {/* Loading overlay */}
      {!isMapReady && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center rounded-xl">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-3 text-sm text-gray-600">Cargando mapa...</p>
          </div>
        </div>
      )}

      {/* Status overlay for arrived/completed */}
      {(status === 'arrived' || status === 'completed') && isMapReady && (
        <div className="absolute top-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                status === 'arrived' ? 'bg-green-500' : 'bg-gray-500'
              }`}
            >
              {status === 'arrived' ? '✓' : '✓'}
            </div>
            <span className="font-medium text-gray-900">
              {status === 'arrived' ? 'El técnico llegó' : 'Servicio completado'}
            </span>
          </div>
        </div>
      )}

      {/* Map provider attribution is handled by Leaflet */}
      <style jsx global>{`
        .custom-technician-marker,
        .custom-destination-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}

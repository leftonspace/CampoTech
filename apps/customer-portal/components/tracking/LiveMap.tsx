'use client';

/**
 * Live Map Component
 * ==================
 *
 * Real-time map displaying technician location and customer destination.
 * Uses OpenStreetMap tiles with tiered provider support (Google/Mapbox).
 */

import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Truck, Loader2 } from 'lucide-react';

interface Location {
  lat: number;
  lng: number;
}

interface LiveMapProps {
  technicianLocation?: Location & { updatedAt?: string };
  customerLocation?: Location;
  eta?: {
    minutes: number;
    distance: string;
  };
  onRefresh?: () => void;
  className?: string;
}

// Map provider configuration - matches main app pattern
const getTileUrl = () => {
  // Check for Mapbox first (most common paid option)
  if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;
  }
  // Default to OpenStreetMap (free)
  return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
};

const getAttribution = () => {
  if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
    return '&copy; <a href="https://www.mapbox.com/">Mapbox</a>';
  }
  return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
};

// Argentina defaults (Buenos Aires)
const DEFAULTS = {
  center: { lat: -34.6037, lng: -58.3816 },
  zoom: 14,
};

export default function LiveMap({
  technicianLocation,
  customerLocation,
  eta,
  onRefresh,
  className = '',
}: LiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const techMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Dynamically load Leaflet to avoid SSR issues
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadLeaflet = async () => {
      try {
        // Dynamic imports for Leaflet
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        if (!mapContainer.current || mapRef.current) return;

        // Determine initial center
        const center = customerLocation || technicianLocation || DEFAULTS.center;

        // Initialize map
        const map = L.map(mapContainer.current, {
          center: [center.lat, center.lng],
          zoom: DEFAULTS.zoom,
          zoomControl: true,
          attributionControl: true,
        });

        // Add tile layer
        L.tileLayer(getTileUrl(), {
          attribution: getAttribution(),
          maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;
        setMapLoaded(true);
        setIsLoading(false);

        // Create custom icons
        const technicianIcon = L.divIcon({
          className: 'technician-marker',
          html: `
            <div style="
              width: 44px;
              height: 44px;
              background: #16a34a;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              border: 3px solid white;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h13l4 8-4 8H3l4-8-4-8z"/>
              </svg>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        const customerIcon = L.divIcon({
          className: 'customer-marker',
          html: `
            <div style="
              width: 36px;
              height: 36px;
              background: #ef4444;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              border: 3px solid white;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        });

        // Add customer marker if available
        if (customerLocation) {
          customerMarkerRef.current = L.marker([customerLocation.lat, customerLocation.lng], {
            icon: customerIcon,
          })
            .addTo(map)
            .bindPopup('Tu ubicación');
        }

        // Add technician marker if available
        if (technicianLocation) {
          techMarkerRef.current = L.marker([technicianLocation.lat, technicianLocation.lng], {
            icon: technicianIcon,
          })
            .addTo(map)
            .bindPopup('Técnico en camino');
        }

        // Fit bounds if both markers exist
        if (technicianLocation && customerLocation) {
          const bounds = L.latLngBounds([
            [technicianLocation.lat, technicianLocation.lng],
            [customerLocation.lat, customerLocation.lng],
          ]);
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (error) {
        console.error('Error loading map:', error);
        setIsLoading(false);
      }
    };

    loadLeaflet();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update technician marker when location changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const updateMarker = async () => {
      const L = (await import('leaflet')).default;

      if (technicianLocation) {
        const technicianIcon = L.divIcon({
          className: 'technician-marker',
          html: `
            <div style="
              width: 44px;
              height: 44px;
              background: #16a34a;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              border: 3px solid white;
              animation: pulse 2s infinite;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h13l4 8-4 8H3l4-8-4-8z"/>
              </svg>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        if (techMarkerRef.current) {
          // Update existing marker position
          techMarkerRef.current.setLatLng([technicianLocation.lat, technicianLocation.lng]);
        } else {
          // Create new marker
          techMarkerRef.current = L.marker([technicianLocation.lat, technicianLocation.lng], {
            icon: technicianIcon,
          })
            .addTo(mapRef.current)
            .bindPopup('Técnico en camino');
        }

        // Optionally pan to technician location
        // mapRef.current.panTo([technicianLocation.lat, technicianLocation.lng]);
      }
    };

    updateMarker();
  }, [technicianLocation, mapLoaded]);

  return (
    <div className={`relative bg-gray-100 rounded-xl overflow-hidden ${className}`}>
      {/* Map container */}
      <div ref={mapContainer} className="h-64 w-full" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Cargando mapa...</p>
          </div>
        </div>
      )}

      {/* No location fallback */}
      {!isLoading && !technicianLocation && !customerLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center text-gray-500">
            <MapPin className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm">Esperando ubicación...</p>
          </div>
        </div>
      )}

      {/* ETA overlay */}
      {eta && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md px-4 py-2 z-[1000]">
          <p className="text-xs text-gray-500">Tiempo estimado</p>
          <p className="text-2xl font-bold text-primary-600">{eta.minutes} min</p>
          <p className="text-xs text-gray-500">{eta.distance}</p>
        </div>
      )}

      {/* Refresh button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-2 hover:bg-gray-50 z-[1000]"
          aria-label="Actualizar mapa"
        >
          <Navigation className="w-4 h-4 text-gray-600" />
        </button>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg px-3 py-2 text-xs z-[1000]">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-600">Técnico</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-600">Destino</span>
        </div>
      </div>

      {/* Pulse animation style */}
      <style jsx global>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.4);
          }
          70% {
            box-shadow: 0 0 0 15px rgba(22, 163, 74, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
          }
        }
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}

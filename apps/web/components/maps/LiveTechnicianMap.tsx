'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export interface TechnicianLocation {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  specialty: string | null;
  skillLevel?: string | null;
  isOnline: boolean;
  lastSeen?: string | null;
  location: {
    lat: number;
    lng: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  } | null;
  currentJob: {
    id?: string;
    jobNumber?: string;
    status: string;
    description?: string;
    scheduledDate?: string | null;
    customerName: string;
    address?: unknown;
  } | null;
  tracking: {
    sessionId?: string;
    status?: string;
    etaMinutes: number | null;
    movementMode: string;
  } | null;
}

interface LiveTechnicianMapProps {
  technicians: TechnicianLocation[];
  selectedTechnician: TechnicianLocation | null;
  onTechnicianSelect: (tech: TechnicianLocation) => void;
}

// Buenos Aires default center
const BUENOS_AIRES_CENTER = { lat: -34.6037, lng: -58.3816 };

type LeafletType = typeof import('leaflet');
type MapType = import('leaflet').Map;
type MarkerType = import('leaflet').Marker;

export function LiveTechnicianMap({
  technicians,
  selectedTechnician,
  onTechnicianSelect,
}: LiveTechnicianMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<MapType | null>(null);
  const markersRef = useRef<Map<string, MarkerType>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const [L, setL] = useState<LeafletType | null>(null);

  // Load Leaflet dynamically
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        const leaflet = await import('leaflet');
        // Import CSS with side effect
        await import('leaflet/dist/leaflet.css');
        setL(leaflet.default);
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
      }
    };
    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!L || !mapRef.current || leafletMapRef.current) return;

    // Create map
    const map = L.map(mapRef.current).setView(
      [BUENOS_AIRES_CENTER.lat, BUENOS_AIRES_CENTER.lng],
      12
    );

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    leafletMapRef.current = map;
    setIsLoaded(true);

    return () => {
      map.remove();
      leafletMapRef.current = null;
      markersRef.current.clear();
    };
  }, [L]);

  // Update markers when technicians change
  useEffect(() => {
    if (!L || !leafletMapRef.current || !isLoaded) return;

    const map = leafletMapRef.current;
    const currentIds = new Set(technicians.filter(t => t.location).map(t => t.id));

    // Remove markers for technicians no longer in list
    for (const [techId, marker] of Array.from(markersRef.current.entries())) {
      if (!currentIds.has(techId)) {
        marker.remove();
        markersRef.current.delete(techId);
      }
    }

    // Track bounds for auto-fit
    const bounds: [number, number][] = [];

    // Add/update markers
    for (const tech of technicians) {
      if (!tech.location) continue;

      const { lat, lng } = tech.location;
      bounds.push([lat, lng]);

      // Determine marker color based on status
      const getColor = () => {
        if (!tech.isOnline) return '#9CA3AF'; // gray - offline
        if (tech.currentJob?.status === 'IN_PROGRESS') return '#F59E0B'; // amber - working
        if (tech.currentJob?.status === 'EN_ROUTE') return '#3B82F6'; // blue - en route
        return '#10B981'; // green - available
      };

      const color = getColor();
      const isSelected = selectedTechnician?.id === tech.id;

      // Create custom icon
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            width: ${isSelected ? 32 : 24}px;
            height: ${isSelected ? 32 : 24}px;
            background-color: ${color};
            border: ${isSelected ? '3px' : '2px'} solid ${isSelected ? '#1F2937' : 'white'};
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
          ">
            <svg width="${isSelected ? 16 : 12}" height="${isSelected ? 16 : 12}" fill="white" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        `,
        iconSize: [isSelected ? 32 : 24, isSelected ? 32 : 24],
        iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12],
        popupAnchor: [0, isSelected ? -16 : -12],
      });

      let marker = markersRef.current.get(tech.id);

      if (marker) {
        // Update existing marker
        marker.setLatLng([lat, lng]);
        marker.setIcon(icon);
      } else {
        // Create new marker
        marker = L.marker([lat, lng], { icon }).addTo(map);

        // Popup content
        const popupContent = `
          <div style="min-width: 150px; padding: 4px;">
            <div style="font-weight: 600; font-size: 14px;">${tech.name}</div>
            <div style="font-size: 12px; color: #6B7280; margin-top: 4px;">
              ${tech.specialty || 'Técnico'}
            </div>
            ${
              tech.currentJob
                ? `<div style="font-size: 12px; margin-top: 8px;">
                  <strong>${tech.currentJob.jobNumber || 'Trabajo'}</strong><br/>
                  ${tech.currentJob.customerName}
                </div>`
                : '<div style="font-size: 12px; color: #10B981; margin-top: 8px;">Disponible</div>'
            }
            ${
              tech.tracking?.etaMinutes
                ? `<div style="font-size: 12px; color: #3B82F6; margin-top: 4px;">
                  ETA: ${tech.tracking.etaMinutes} min
                </div>`
                : ''
            }
          </div>
        `;
        marker.bindPopup(popupContent);

        // Click handler
        marker.on('click', () => {
          onTechnicianSelect(tech);
        });

        markersRef.current.set(tech.id, marker);
      }
    }

    // Fit bounds if we have multiple markers and no selection
    if (bounds.length > 1 && !selectedTechnician) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] });
    }
  }, [L, technicians, isLoaded, selectedTechnician, onTechnicianSelect]);

  // Center on selected technician
  useEffect(() => {
    if (!leafletMapRef.current || !selectedTechnician?.location) return;

    const marker = markersRef.current.get(selectedTechnician.id);

    leafletMapRef.current.setView(
      [selectedTechnician.location.lat, selectedTechnician.location.lng],
      15,
      { animate: true }
    );

    if (marker) {
      marker.openPopup();
    }
  }, [selectedTechnician]);

  // Loading state
  if (!L || !isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Cargando mapa...</span>
      </div>
    );
  }

  return <div ref={mapRef} className="h-full w-full" />;
}

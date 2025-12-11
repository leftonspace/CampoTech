'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface TechnicianLocation {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  specialty: string | null;
  isOnline: boolean;
  location: {
    lat: number;
    lng: number;
    heading: number | null;
  } | null;
  currentJob: {
    status: string;
    jobNumber: string;
    customerName: string;
  } | null;
  tracking: {
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

export function LiveTechnicianMap({
  technicians,
  selectedTechnician,
  onTechnicianSelect,
}: LiveTechnicianMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [useLeaflet, setUseLeaflet] = useState(false);

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        console.warn('Google Maps API key not found, falling back to Leaflet');
        setUseLeaflet(true);
        return;
      }

      try {
        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry'],
        });

        const google = await loader.load();

        if (!mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: BUENOS_AIRES_CENTER,
          zoom: 12,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            position: google.maps.ControlPosition.TOP_RIGHT,
          },
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        });

        googleMapRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();
        setIsLoaded(true);
      } catch (error) {
        console.error('Error loading Google Maps:', error);
        setUseLeaflet(true);
      }
    };

    initMap();

    return () => {
      // Cleanup markers
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current.clear();
    };
  }, []);

  // Update markers when technicians change
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    const map = googleMapRef.current;
    const existingIds = new Set(markersRef.current.keys());
    const newIds = new Set(technicians.map((t) => t.id));

    // Remove markers for technicians that are no longer in the list
    existingIds.forEach((id) => {
      if (!newIds.has(id)) {
        const marker = markersRef.current.get(id);
        if (marker) {
          marker.setMap(null);
          markersRef.current.delete(id);
        }
      }
    });

    // Update or create markers
    technicians.forEach((tech) => {
      if (!tech.location) return;

      const position = { lat: tech.location.lat, lng: tech.location.lng };
      let marker = markersRef.current.get(tech.id);

      // Determine marker color based on status
      const getMarkerColor = () => {
        if (!tech.isOnline) return '#9CA3AF'; // Gray for offline
        if (tech.currentJob?.status === 'EN_ROUTE') return '#3B82F6'; // Blue for en route
        if (tech.currentJob?.status === 'IN_PROGRESS') return '#F59E0B'; // Amber for working
        return '#10B981'; // Green for online/available
      };

      const color = getMarkerColor();
      const isSelected = selectedTechnician?.id === tech.id;

      // Create SVG marker icon
      const svgMarker = {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
        fillColor: color,
        fillOpacity: 1,
        strokeWeight: isSelected ? 3 : 1,
        strokeColor: isSelected ? '#1F2937' : '#FFFFFF',
        scale: isSelected ? 2 : 1.5,
        anchor: new google.maps.Point(12, 22),
      };

      if (marker) {
        // Update existing marker
        marker.setPosition(position);
        marker.setIcon(svgMarker);
      } else {
        // Create new marker
        marker = new google.maps.Marker({
          position,
          map,
          icon: svgMarker,
          title: tech.name,
          optimized: true,
        });

        // Add click listener
        marker.addListener('click', () => {
          onTechnicianSelect(tech);

          // Show info window
          if (infoWindowRef.current) {
            const content = `
              <div style="padding: 8px; min-width: 150px;">
                <div style="font-weight: 600; font-size: 14px;">${tech.name}</div>
                <div style="font-size: 12px; color: #6B7280; margin-top: 4px;">
                  ${tech.specialty || 'Técnico'}
                </div>
                ${
                  tech.currentJob
                    ? `<div style="font-size: 12px; margin-top: 8px;">
                    <strong>${tech.currentJob.jobNumber}</strong><br/>
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
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.open(map, marker);
          }
        });

        markersRef.current.set(tech.id, marker);
      }
    });

    // Fit bounds if there are technicians with locations
    const techsWithLocation = technicians.filter((t) => t.location);
    if (techsWithLocation.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      techsWithLocation.forEach((tech) => {
        if (tech.location) {
          bounds.extend({ lat: tech.location.lat, lng: tech.location.lng });
        }
      });

      // Only fit bounds on initial load or when many technicians
      if (techsWithLocation.length > 1 && !selectedTechnician) {
        map.fitBounds(bounds, { padding: 50 });
      }
    }
  }, [technicians, isLoaded, selectedTechnician, onTechnicianSelect]);

  // Center on selected technician
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current || !selectedTechnician?.location) return;

    googleMapRef.current.panTo({
      lat: selectedTechnician.location.lat,
      lng: selectedTechnician.location.lng,
    });
    googleMapRef.current.setZoom(15);
  }, [selectedTechnician, isLoaded]);

  // Fallback to Leaflet if Google Maps not available
  if (useLeaflet) {
    return <LeafletMap technicians={technicians} onTechnicianSelect={onTechnicianSelect} />;
  }

  return (
    <div ref={mapRef} className="h-full w-full" />
  );
}

// Simple Leaflet fallback component
function LeafletMap({
  technicians,
  onTechnicianSelect,
}: {
  technicians: TechnicianLocation[];
  onTechnicianSelect: (tech: TechnicianLocation) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    // Dynamic import of Leaflet
    const initLeaflet = async () => {
      if (!mapRef.current || leafletMapRef.current) return;

      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      const map = L.map(mapRef.current).setView(
        [BUENOS_AIRES_CENTER.lat, BUENOS_AIRES_CENTER.lng],
        12
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      leafletMapRef.current = map;
    };

    initLeaflet();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const updateMarkers = async () => {
      if (!leafletMapRef.current) return;

      const L = await import('leaflet');
      const map = leafletMapRef.current;

      // Clear existing markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();

      // Add new markers
      technicians.forEach((tech) => {
        if (!tech.location) return;

        const getColor = () => {
          if (!tech.isOnline) return '#9CA3AF';
          if (tech.currentJob?.status === 'EN_ROUTE') return '#3B82F6';
          if (tech.currentJob?.status === 'IN_PROGRESS') return '#F59E0B';
          return '#10B981';
        };

        const icon = L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="
              width: 24px;
              height: 24px;
              background: ${getColor()};
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([tech.location.lat, tech.location.lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div>
              <strong>${tech.name}</strong><br/>
              ${tech.specialty || 'Técnico'}<br/>
              ${tech.currentJob ? tech.currentJob.jobNumber : 'Disponible'}
            </div>
          `);

        marker.on('click', () => onTechnicianSelect(tech));
        markersRef.current.set(tech.id, marker);
      });
    };

    updateMarkers();
  }, [technicians, onTechnicianSelect]);

  return <div ref={mapRef} className="h-full w-full" />;
}

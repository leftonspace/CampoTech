'use client';

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Navigation,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';

interface CoordinatePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'customer' | 'job' | 'location';
  entityId: string;
  entityName: string;
  currentLat?: number;
  currentLng?: number;
  address?: string;
  onSave?: (lat: number, lng: number) => void;
}

async function saveCoordinates(
  entityType: string,
  entityId: string,
  lat: number,
  lng: number
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/geocoding/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityType, entityId, lat, lng }),
  });
  return res.json();
}

async function triggerReGeocode(
  entityType: string,
  entityId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/geocoding/re-geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityType, entityId }),
  });
  return res.json();
}

export function CoordinatePickerDialog({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  currentLat,
  currentLng,
  address,
  onSave,
}: CoordinatePickerDialogProps) {
  const [lat, setLat] = useState(currentLat?.toString() || '');
  const [lng, setLng] = useState(currentLng?.toString() || '');
  const [mapLat, setMapLat] = useState(currentLat || -34.6037);
  const [mapLng, setMapLng] = useState(currentLng || -58.3816);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const queryClient = useQueryClient();

  // Initialize map when dialog opens
  useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    // Dynamically import Leaflet
    import('leaflet').then((L) => {
      // Fix default icon issue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapRef.current!, {
        center: [mapLat, mapLng],
        zoom: 15,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Add draggable marker
      const marker = L.marker([mapLat, mapLng], {
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setMapLat(pos.lat);
        setMapLng(pos.lng);
        setLat(pos.lat.toFixed(6));
        setLng(pos.lng.toFixed(6));
      });

      // Click on map to move marker
      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        setMapLat(e.latlng.lat);
        setMapLng(e.latlng.lng);
        setLat(e.latlng.lat.toFixed(6));
        setLng(e.latlng.lng.toFixed(6));
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Resize handler
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, mapLat, mapLng]);

  // Update marker when lat/lng inputs change
  const updateMarkerFromInput = () => {
    const newLat = parseFloat(lat);
    const newLng = parseFloat(lng);

    if (!isNaN(newLat) && !isNaN(newLng) && markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
      mapInstanceRef.current.setView([newLat, newLng], 15);
      setMapLat(newLat);
      setMapLng(newLng);
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLat = position.coords.latitude;
          const newLng = position.coords.longitude;
          setLat(newLat.toFixed(6));
          setLng(newLng.toFixed(6));
          setMapLat(newLat);
          setMapLng(newLng);

          if (markerRef.current && mapInstanceRef.current) {
            markerRef.current.setLatLng([newLat, newLng]);
            mapInstanceRef.current.setView([newLat, newLng], 15);
          }
        },
        (error) => console.error('Geolocation error:', error)
      );
    }
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      const newLat = parseFloat(lat);
      const newLng = parseFloat(lng);
      return saveCoordinates(entityType, entityId, newLat, newLng);
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['map-data'] });
        onSave?.(parseFloat(lat), parseFloat(lng));
        onClose();
      }
    },
  });

  // Re-geocode mutation
  const reGeocodeMutation = useMutation({
    mutationFn: () => triggerReGeocode(entityType, entityId),
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['map-data'] });
        onClose();
      }
    },
  });

  const isValidCoords = !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
  const hasChanges = parseFloat(lat) !== currentLat || parseFloat(lng) !== currentLng;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Ajustar Ubicación
            </h3>
            <p className="text-sm text-gray-500">{entityName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Address */}
          {address && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Dirección:</span> {address}
              </p>
            </div>
          )}

          {/* Map */}
          <div
            ref={mapRef}
            className="w-full h-64 rounded-lg border border-gray-200 overflow-hidden"
            style={{ minHeight: '256px' }}
          />

          <p className="text-xs text-gray-500 text-center">
            Arrastra el marcador o haz clic en el mapa para ajustar la ubicación
          </p>

          {/* Coordinate inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitud
              </label>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                onBlur={updateMarkerFromInput}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="-34.6037"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitud
              </label>
              <input
                type="text"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                onBlur={updateMarkerFromInput}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="-58.3816"
              />
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <button
              onClick={getCurrentLocation}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              <Navigation className="h-4 w-4" />
              Mi ubicación
            </button>
            {address && (
              <button
                onClick={() => reGeocodeMutation.mutate()}
                disabled={reGeocodeMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg disabled:opacity-50"
              >
                {reGeocodeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Re-geocodificar
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
          {(saveMutation.error || reGeocodeMutation.error) && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>Error al guardar</span>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!isValidCoords || !hasChanges || saveMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatePickerDialog;

/**
 * Consumer Location Hook
 * ======================
 *
 * Phase 15: Consumer Marketplace
 * Location services for consumer app.
 */

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

interface LocationData {
  lat: number;
  lng: number;
}

interface UseConsumerLocationReturn {
  location: LocationData | null;
  neighborhood: string | null;
  city: string | null;
  province: string | null;
  isLoading: boolean;
  error: string | null;
  refreshLocation: () => Promise<void>;
}

export function useConsumerLocation(): UseConsumerLocationReturn {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [neighborhood, setNeighborhood] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>('Buenos Aires');
  const [province, setProvince] = useState<string | null>('CABA');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const result = results[0];
        setNeighborhood(result.subregion || result.district || null);
        setCity(result.city || 'Buenos Aires');
        setProvince(result.region || 'CABA');
      }
    } catch (err) {
      console.warn('Reverse geocode failed:', err);
    }
  };

  const refreshLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const hasPermission = await getLocationPermission();
      if (!hasPermission) {
        setError('Permiso de ubicacion denegado');
        // Use default Buenos Aires location
        setLocation({ lat: -34.6037, lng: -58.3816 });
        setIsLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const locationData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setLocation(locationData);
      await reverseGeocode(locationData.lat, locationData.lng);
    } catch (err) {
      console.error('Location error:', err);
      setError('No se pudo obtener la ubicacion');
      // Use default Buenos Aires location
      setLocation({ lat: -34.6037, lng: -58.3816 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  return {
    location,
    neighborhood,
    city,
    province,
    isLoading,
    error,
    refreshLocation,
  };
}

export default useConsumerLocation;

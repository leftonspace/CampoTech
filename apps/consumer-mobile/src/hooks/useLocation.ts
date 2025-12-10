/**
 * Location Hook
 * =============
 *
 * Hook for managing location services.
 * Phase 15: Consumer Marketplace
 */

import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface UseLocationResult {
  location: LocationData | null;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
  setManualLocation: (city: string, neighborhood?: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

const LOCATION_STORAGE_KEY = 'user_location';

export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [neighborhood, setNeighborhood] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSavedLocation();
  }, []);

  const loadSavedLocation = async () => {
    try {
      const saved = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setLocation(data.location);
        setCity(data.city);
        setNeighborhood(data.neighborhood);
        setAddress(data.address);
      }
    } catch (e) {
      console.error('Failed to load saved location:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveLocation = async (data: {
    location: LocationData | null;
    city: string | null;
    neighborhood: string | null;
    address: string | null;
  }) => {
    try {
      await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save location:', e);
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permiso de ubicación denegado');
        return false;
      }
      return true;
    } catch (e) {
      setError('Error al solicitar permisos');
      return false;
    }
  };

  const refreshLocation = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newLocation: LocationData = {
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
        accuracy: locationResult.coords.accuracy || undefined,
      };

      setLocation(newLocation);

      // Reverse geocode
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
      });

      if (reverseGeocode.length > 0) {
        const place = reverseGeocode[0];
        const newCity = place.city || place.subregion || 'Buenos Aires';
        const newNeighborhood = place.district || place.subregion || undefined;
        const newAddress = formatAddress(place);

        setCity(newCity);
        setNeighborhood(newNeighborhood || null);
        setAddress(newAddress);

        await saveLocation({
          location: newLocation,
          city: newCity,
          neighborhood: newNeighborhood || null,
          address: newAddress,
        });
      }
    } catch (e) {
      console.error('Location error:', e);
      setError('No se pudo obtener la ubicación');
    } finally {
      setLoading(false);
    }
  };

  const setManualLocation = (newCity: string, newNeighborhood?: string) => {
    setCity(newCity);
    setNeighborhood(newNeighborhood || null);

    saveLocation({
      location,
      city: newCity,
      neighborhood: newNeighborhood || null,
      address,
    });
  };

  return {
    location,
    city,
    neighborhood,
    address,
    loading,
    error,
    requestPermission,
    refreshLocation,
    setManualLocation,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatAddress(place: Location.LocationGeocodedAddress): string {
  const parts: string[] = [];

  if (place.street) {
    parts.push(place.street);
  }
  if (place.streetNumber) {
    parts.push(place.streetNumber);
  }
  if (place.district && !parts.includes(place.district)) {
    parts.push(place.district);
  }
  if (place.city) {
    parts.push(place.city);
  }

  return parts.join(', ') || 'Ubicación desconocida';
}

export default useLocation;

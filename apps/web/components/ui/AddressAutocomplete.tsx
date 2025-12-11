'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';

// Address structure returned by the component
export interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  fullAddress: string;
  lat?: number;
  lng?: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, parsed?: ParsedAddress) => void;
  onSelect?: (address: ParsedAddress) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  defaultCountry?: string; // ISO country code, e.g., 'AR' for Argentina
}

// Declare google types
declare global {
  interface Window {
    google: typeof google;
    initGoogleMapsCallback?: () => void;
  }
}

// Singleton to track if Google Maps is loading/loaded
let googleMapsPromise: Promise<void> | null = null;
let isGoogleMapsLoaded = false;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (isGoogleMapsLoaded && window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google?.maps?.places) {
      isGoogleMapsLoaded = true;
      resolve();
      return;
    }

    // Create callback
    const callbackName = 'initGoogleMapsCallback';
    (window as Window)[callbackName] = () => {
      isGoogleMapsLoaded = true;
      resolve();
    };

    // Create script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error('Failed to load Google Maps'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

// Parse Google Place result into our address structure
function parseGooglePlace(place: google.maps.places.PlaceResult): ParsedAddress {
  const components = place.address_components || [];

  const getComponent = (types: string[]): string => {
    const component = components.find((c) =>
      types.some((type) => c.types.includes(type))
    );
    return component?.long_name || '';
  };

  const getShortComponent = (types: string[]): string => {
    const component = components.find((c) =>
      types.some((type) => c.types.includes(type))
    );
    return component?.short_name || '';
  };

  // Build street address
  const streetNumber = getComponent(['street_number']);
  const route = getComponent(['route']);
  const street = streetNumber ? `${route} ${streetNumber}` : route;

  // Get city (locality or administrative_area_level_2 for Argentina)
  const city = getComponent(['locality', 'administrative_area_level_2', 'sublocality_level_1']);

  // Get state/province
  const state = getComponent(['administrative_area_level_1']);

  // Get postal code
  const postalCode = getComponent(['postal_code']);

  // Get country
  const country = getComponent(['country']);

  return {
    street,
    city,
    state,
    postalCode,
    country,
    fullAddress: place.formatted_address || '',
    lat: place.geometry?.location?.lat(),
    lng: place.geometry?.location?.lng(),
  };
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Buscar dirección...',
  className = '',
  disabled = false,
  required = false,
  defaultCountry = 'AR',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!apiKey) {
      setError('Google Maps API key not configured');
      setIsLoading(false);
      return;
    }

    let mounted = true;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (!mounted || !inputRef.current) return;

        // Create autocomplete instance
        const autocomplete = new window.google.maps.places.Autocomplete(
          inputRef.current,
          {
            types: ['address'],
            componentRestrictions: { country: defaultCountry.toLowerCase() },
            fields: ['address_components', 'formatted_address', 'geometry', 'name'],
          }
        );

        // Handle place selection
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();

          if (place && place.formatted_address) {
            const parsed = parseGooglePlace(place);
            onChange(parsed.fullAddress, parsed);
            onSelect?.(parsed);
          }
        });

        autocompleteRef.current = autocomplete;
        setIsLoading(false);
      })
      .catch((err) => {
        if (mounted) {
          console.error('Failed to load Google Maps:', err);
          setError('Error cargando Google Maps');
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
      // Clean up autocomplete listeners
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [apiKey, defaultCountry, onChange, onSelect]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  // If no API key, render simple input
  if (!apiKey) {
    return (
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`input pl-10 pr-10 ${className}`}
          disabled={disabled}
          required={required}
        />
        <p className="mt-1 text-xs text-amber-600">
          Autocompletado no disponible (configurar GOOGLE_MAPS_API_KEY)
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10" />

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={isLoading ? 'Cargando...' : placeholder}
        className={`input pl-10 pr-10 ${className} ${error ? 'border-red-300' : ''}`}
        disabled={disabled || isLoading}
        required={required}
        autoComplete="off"
      />

      {/* Loading indicator */}
      {isLoading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 animate-spin" />
      )}

      {/* Clear button */}
      {!isLoading && value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}

      {/* Hint */}
      {isFocused && !error && !isLoading && (
        <p className="mt-1 text-xs text-gray-500">
          Escribí la dirección y seleccioná una opción de la lista
        </p>
      )}
    </div>
  );
}

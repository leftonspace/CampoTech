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
  defaultCountry?: string;
}

// Suggestion type from new Google Places API
interface PlaceSuggestion {
  placePrediction: {
    placeId: string;
    text: {
      text: string;
    };
    structuredFormat: {
      mainText: { text: string };
      secondaryText: { text: string };
    };
  };
}

// Declare window.google for TypeScript (new API)
declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          AutocompleteSuggestion: {
            fetchAutocompleteSuggestions: (request: {
              input: string;
              includedRegionCodes?: string[];
              includedPrimaryTypes?: string[];
            }) => Promise<{ suggestions: PlaceSuggestion[] }>;
          };
          Place: {
            new (options: { id: string }): {
              fetchFields: (options: { fields: string[] }) => Promise<{
                place: {
                  displayName: string;
                  formattedAddress: string;
                  location: { lat: () => number; lng: () => number };
                  addressComponents: Array<{
                    longText: string;
                    shortText: string;
                    types: string[];
                  }>;
                };
              }>;
            };
          };
        };
      };
    };
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
    if (window.google?.maps?.places) {
      isGoogleMapsLoaded = true;
      resolve();
      return;
    }

    const callbackName = 'initGoogleMapsCallback';
    (window as any)[callbackName] = () => {
      isGoogleMapsLoaded = true;
      resolve();
    };

    const script = document.createElement('script');
    // Use the new Places API
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}&v=weekly`;
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

// Parse address components from new Places API
function parseAddressComponents(place: any): ParsedAddress {
  const components = place.addressComponents || [];

  const getComponent = (types: string[]): string => {
    const component = components.find((c: any) =>
      types.some((type: string) => c.types.includes(type))
    );
    return component?.longText || '';
  };

  const streetNumber = getComponent(['street_number']);
  const route = getComponent(['route']);
  const street = streetNumber ? `${route} ${streetNumber}` : route;
  const city = getComponent(['locality', 'administrative_area_level_2', 'sublocality_level_1']);
  const state = getComponent(['administrative_area_level_1']);
  const postalCode = getComponent(['postal_code']);
  const country = getComponent(['country']);

  let lat: number | undefined;
  let lng: number | undefined;

  if (place.location) {
    lat = typeof place.location.lat === 'function' ? place.location.lat() : place.location.lat;
    lng = typeof place.location.lng === 'function' ? place.location.lng() : place.location.lng;
  }

  return {
    street,
    city,
    state,
    postalCode,
    country,
    fullAddress: place.formattedAddress || '',
    lat,
    lng,
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
  const containerRef = useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Initialize Google Maps
  useEffect(() => {
    if (!apiKey) {
      setError('API key no configurada');
      return;
    }

    loadGoogleMaps(apiKey)
      .then(() => {
        if (window.google?.maps?.places) {
          setIsInitialized(true);
          console.log('[AddressAutocomplete] Google Maps initialized');
        }
      })
      .catch((err) => {
        console.error('Failed to load Google Maps:', err);
        setError('Error cargando Google Maps');
      });
  }, [apiKey]);

  // Fetch suggestions when value changes (using new API)
  useEffect(() => {
    if (!isInitialized || !value || value.length < 3) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);

      try {
        // Check if new API is available
        if (window.google?.maps?.places?.AutocompleteSuggestion) {
          console.log('[AddressAutocomplete] Using new AutocompleteSuggestion API');
          const response = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: value,
            includedRegionCodes: [defaultCountry.toLowerCase()],
            includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route'],
          });

          setSuggestions(response.suggestions || []);
          setIsOpen(response.suggestions && response.suggestions.length > 0);
        } else {
          console.warn('[AddressAutocomplete] New API not available');
          setError('Places API (New) no disponible');
        }
      } catch (err: any) {
        console.error('[AddressAutocomplete] Error fetching suggestions:', err);
        // Don't show error to user for normal cases like no results
        if (err?.message?.includes('ZERO_RESULTS')) {
          setSuggestions([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [value, isInitialized, defaultCountry]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = useCallback(
    async (suggestion: PlaceSuggestion) => {
      const placeId = suggestion.placePrediction.placeId;

      setIsLoading(true);

      try {
        // Use new Place class to fetch details
        if (window.google?.maps?.places?.Place) {
          const place = new window.google.maps.places.Place({ id: placeId });
          const result = await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
          });

          const parsed = parseAddressComponents(result.place);
          onChange(parsed.fullAddress, parsed);
          onSelect?.(parsed);
        } else {
          // Fallback - just use the suggestion text
          onChange(suggestion.placePrediction.text.text);
        }
      } catch (err) {
        console.error('[AddressAutocomplete] Error fetching place details:', err);
        // Fallback to suggestion text
        onChange(suggestion.placePrediction.text.text);
      } finally {
        setIsLoading(false);
        setIsOpen(false);
        setSuggestions([]);
      }
    },
    [onChange, onSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setSelectedIndex(-1);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            handleSelectSuggestion(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, suggestions, selectedIndex, handleSelectSuggestion]
  );

  const handleClear = useCallback(() => {
    onChange('');
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div ref={containerRef} className="relative">
      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10" />

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        placeholder={placeholder}
        className={`input pl-10 pr-10 ${className}`}
        disabled={disabled}
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

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.placePrediction.placeId}
              className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-blue-50' : ''
              }`}
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <div className="font-medium text-gray-900 text-sm">
                {suggestion.placePrediction.structuredFormat.mainText.text}
              </div>
              <div className="text-gray-500 text-xs">
                {suggestion.placePrediction.structuredFormat.secondaryText.text}
              </div>
            </li>
          ))}
          <li className="px-4 py-2 text-xs text-gray-400 border-t">
            Powered by Google
          </li>
        </ul>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

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

// Prediction type from Google
interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

// Declare window.google for TypeScript
declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              request: {
                input: string;
                componentRestrictions?: { country: string };
                types?: string[];
              },
              callback: (predictions: Prediction[] | null, status: string) => void
            ) => void;
          };
          PlacesService: new (attrContainer: HTMLDivElement) => {
            getDetails: (
              request: { placeId: string; fields: string[] },
              callback: (place: any, status: string) => void
            ) => void;
          };
          PlacesServiceStatus: {
            OK: string;
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

// Parse Google Place details into our address structure
function parseGooglePlace(place: any): ParsedAddress {
  const components = place.address_components || [];

  const getComponent = (types: string[]): string => {
    const component = components.find((c: any) =>
      types.some((type: string) => c.types.includes(type))
    );
    return component?.long_name || '';
  };

  const streetNumber = getComponent(['street_number']);
  const route = getComponent(['route']);
  const street = streetNumber ? `${route} ${streetNumber}` : route;
  const city = getComponent(['locality', 'administrative_area_level_2', 'sublocality_level_1']);
  const state = getComponent(['administrative_area_level_1']);
  const postalCode = getComponent(['postal_code']);
  const country = getComponent(['country']);

  return {
    street,
    city,
    state,
    postalCode,
    country,
    fullAddress: place.formatted_address || '',
    lat: place.geometry?.location?.lat?.(),
    lng: place.geometry?.location?.lng?.(),
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
  const placesServiceRef = useRef<any>(null);
  const autocompleteServiceRef = useRef<any>(null);

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Initialize Google Maps services
  useEffect(() => {
    if (!apiKey) {
      setError('API key no configurada');
      return;
    }

    loadGoogleMaps(apiKey)
      .then(() => {
        if (window.google?.maps?.places) {
          autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
          // Create a hidden div for PlacesService (required by Google)
          const div = document.createElement('div');
          placesServiceRef.current = new window.google.maps.places.PlacesService(div);
          setIsInitialized(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load Google Maps:', err);
        setError('Error cargando Google Maps');
      });
  }, [apiKey]);

  // Fetch predictions when value changes
  useEffect(() => {
    if (!isInitialized || !autocompleteServiceRef.current || !value || value.length < 3) {
      setPredictions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsLoading(true);
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: value,
          componentRestrictions: { country: defaultCountry.toLowerCase() },
          types: ['address'],
        },
        (results: Prediction[] | null, status: string) => {
          setIsLoading(false);
          if (status === window.google?.maps?.places?.PlacesServiceStatus?.OK && results) {
            setPredictions(results);
            setIsOpen(true);
          } else {
            setPredictions([]);
          }
        }
      );
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

  const handleSelectPrediction = useCallback(
    (prediction: Prediction) => {
      if (!placesServiceRef.current) return;

      setIsLoading(true);
      placesServiceRef.current.getDetails(
        {
          placeId: prediction.place_id,
          fields: ['address_components', 'formatted_address', 'geometry'],
        },
        (place: any, status: string) => {
          setIsLoading(false);
          if (status === window.google?.maps?.places?.PlacesServiceStatus?.OK && place) {
            const parsed = parseGooglePlace(place);
            onChange(parsed.fullAddress, parsed);
            onSelect?.(parsed);
          } else {
            onChange(prediction.description);
          }
          setIsOpen(false);
          setPredictions([]);
        }
      );
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
      if (!isOpen || predictions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && predictions[selectedIndex]) {
            handleSelectPrediction(predictions[selectedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, predictions, selectedIndex, handleSelectPrediction]
  );

  const handleClear = useCallback(() => {
    onChange('');
    setPredictions([]);
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
        onFocus={() => predictions.length > 0 && setIsOpen(true)}
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

      {/* Predictions dropdown */}
      {isOpen && predictions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {predictions.map((prediction, index) => (
            <li
              key={prediction.place_id}
              className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-blue-50' : ''
              }`}
              onClick={() => handleSelectPrediction(prediction)}
            >
              <div className="font-medium text-gray-900 text-sm">
                {prediction.structured_formatting.main_text}
              </div>
              <div className="text-gray-500 text-xs">
                {prediction.structured_formatting.secondary_text}
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

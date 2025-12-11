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
    (window as any)[callbackName] = () => {
      isGoogleMapsLoaded = true;
      resolve();
    };

    // Create script element - use the new API
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}&loading=async`;
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

// Parse address components from the new Places API
function parseAddressComponents(place: any): ParsedAddress {
  const addressComponents = place.addressComponents || [];

  const getComponent = (types: string[]): string => {
    const component = addressComponents.find((c: any) =>
      types.some((type) => c.types.includes(type))
    );
    return component?.longText || component?.long_name || '';
  };

  // Build street address
  const streetNumber = getComponent(['street_number']);
  const route = getComponent(['route']);
  const street = streetNumber ? `${route} ${streetNumber}` : route;

  // Get city
  const city = getComponent(['locality', 'administrative_area_level_2', 'sublocality_level_1']);

  // Get state/province
  const state = getComponent(['administrative_area_level_1']);

  // Get postal code
  const postalCode = getComponent(['postal_code']);

  // Get country
  const country = getComponent(['country']);

  // Get coordinates
  const location = place.location;
  const lat = location?.lat?.() ?? location?.lat;
  const lng = location?.lng?.() ?? location?.lng;

  return {
    street,
    city,
    state,
    postalCode,
    country,
    fullAddress: place.formattedAddress || place.formatted_address || '',
    lat: typeof lat === 'number' ? lat : undefined,
    lng: typeof lng === 'number' ? lng : undefined,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteElementRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState(value);
  const [showManualInput, setShowManualInput] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Sync manual input with value prop
  useEffect(() => {
    setManualInput(value);
  }, [value]);

  // Initialize Google Places Autocomplete Element (new API)
  useEffect(() => {
    if (!apiKey) {
      setError('Google Maps API key not configured');
      setIsLoading(false);
      setShowManualInput(true);
      return;
    }

    let mounted = true;

    loadGoogleMaps(apiKey)
      .then(async () => {
        if (!mounted || !containerRef.current || !window.google) return;

        try {
          // Check if PlaceAutocompleteElement is available (new API)
          if (window.google.maps.places.PlaceAutocompleteElement) {
            // Create the new PlaceAutocompleteElement
            const autocompleteElement = new (window.google.maps.places as any).PlaceAutocompleteElement({
              componentRestrictions: { country: [defaultCountry.toLowerCase()] },
              types: ['address'],
            });

            // Style the element
            autocompleteElement.style.width = '100%';
            autocompleteElement.style.height = '42px';

            // Handle place selection
            autocompleteElement.addEventListener('gmp-placeselect', async (event: any) => {
              const place = event.place;

              // Fetch detailed place data
              await place.fetchFields({
                fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
              });

              const parsed = parseAddressComponents(place);
              onChange(parsed.fullAddress, parsed);
              onSelect?.(parsed);
            });

            // Clear the container and append the element
            if (containerRef.current) {
              containerRef.current.innerHTML = '';
              containerRef.current.appendChild(autocompleteElement);
            }

            autocompleteElementRef.current = autocompleteElement;
            setIsLoading(false);
          } else {
            // Fallback: PlaceAutocompleteElement not available
            console.warn('PlaceAutocompleteElement not available, using manual input');
            setShowManualInput(true);
            setIsLoading(false);
          }
        } catch (err) {
          console.error('Error initializing PlaceAutocompleteElement:', err);
          setShowManualInput(true);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('Failed to load Google Maps:', err);
          setError('Error cargando Google Maps');
          setShowManualInput(true);
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [apiKey, defaultCountry, onChange, onSelect]);

  const handleManualInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setManualInput(newValue);
      onChange(newValue);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    setManualInput('');
    onChange('');
    // Also clear the autocomplete element if it exists
    if (autocompleteElementRef.current) {
      const input = autocompleteElementRef.current.querySelector('input');
      if (input) {
        input.value = '';
      }
    }
  }, [onChange]);

  // If no API key or fallback mode, render simple input
  if (!apiKey || showManualInput) {
    return (
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={manualInput}
          onChange={handleManualInputChange}
          placeholder={placeholder}
          className={`input pl-10 pr-10 ${className}`}
          disabled={disabled}
          required={required}
        />
        {manualInput && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {!apiKey && (
          <p className="mt-1 text-xs text-amber-600">
            Autocompletado no disponible (configurar GOOGLE_MAPS_API_KEY)
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Icon */}
      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />

      {/* Google Places Autocomplete Container */}
      <div
        ref={containerRef}
        className={`address-autocomplete-container ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        style={{ minHeight: '42px' }}
      >
        {isLoading && (
          <div className="input pl-10 pr-10 flex items-center text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Cargando...
          </div>
        )}
      </div>

      {/* Clear button */}
      {!isLoading && value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}

      {/* CSS for styling the Google autocomplete element */}
      <style jsx global>{`
        .address-autocomplete-container {
          position: relative;
        }

        .address-autocomplete-container gmp-place-autocomplete {
          width: 100%;
        }

        .address-autocomplete-container gmp-place-autocomplete input {
          width: 100%;
          height: 42px;
          padding: 0.5rem 2.5rem 0.5rem 2.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          line-height: 1.25rem;
          outline: none;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }

        .address-autocomplete-container gmp-place-autocomplete input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .address-autocomplete-container gmp-place-autocomplete input::placeholder {
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}

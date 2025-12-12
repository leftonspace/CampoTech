'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

interface Suggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
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

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Ingresá la dirección...',
  className = '',
  disabled = false,
  required = false,
  defaultCountry = 'AR',
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedValue = useDebounce(value, 300);

  // Fetch suggestions from Google Places API
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedValue || debouncedValue.length < 3) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(debouncedValue)}&country=${defaultCountry}`
        );
        const data = await response.json();

        if (data.success && data.predictions) {
          setSuggestions(
            data.predictions.map((p: {
              place_id: string;
              description: string;
              structured_formatting?: {
                main_text?: string;
                secondary_text?: string;
              };
            }) => ({
              placeId: p.place_id,
              description: p.description,
              mainText: p.structured_formatting?.main_text || p.description,
              secondaryText: p.structured_formatting?.secondary_text || '',
            }))
          );
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error('Error fetching address suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedValue, defaultCountry]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setSelectedIndex(-1);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [onChange]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: Suggestion) => {
      setIsLoading(true);
      setShowSuggestions(false);

      try {
        // Get place details to extract address components and coordinates
        const response = await fetch(
          `/api/places/details?placeId=${encodeURIComponent(suggestion.placeId)}`
        );
        const data = await response.json();

        if (data.success && data.result) {
          const result = data.result;
          const parsed: ParsedAddress = {
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: '',
            fullAddress: result.formatted_address || suggestion.description,
            lat: result.geometry?.location?.lat,
            lng: result.geometry?.location?.lng,
          };

          // Parse address components
          if (result.address_components) {
            for (const component of result.address_components) {
              const types = component.types as string[];
              if (types.includes('street_number')) {
                parsed.street = component.long_name + (parsed.street ? ' ' + parsed.street : '');
              } else if (types.includes('route')) {
                parsed.street = (parsed.street ? parsed.street + ' ' : '') + component.long_name;
              } else if (types.includes('locality') || types.includes('administrative_area_level_2')) {
                parsed.city = parsed.city || component.long_name;
              } else if (types.includes('administrative_area_level_1')) {
                parsed.state = component.long_name;
              } else if (types.includes('postal_code')) {
                parsed.postalCode = component.long_name;
              } else if (types.includes('country')) {
                parsed.country = component.long_name;
              }
            }
          }

          onChange(parsed.fullAddress, parsed);
          onSelect?.(parsed);
        } else {
          // Fallback: just use the description
          onChange(suggestion.description);
        }
      } catch (error) {
        console.error('Error fetching place details:', error);
        onChange(suggestion.description);
      } finally {
        setIsLoading(false);
      }
    },
    [onChange, onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            handleSelectSuggestion(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [showSuggestions, suggestions, selectedIndex, handleSelectSuggestion]
  );

  return (
    <div ref={wrapperRef} className="relative">
      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setShowSuggestions(true);
        }}
        placeholder={placeholder}
        className={`input pl-10 pr-10 ${className}`}
        disabled={disabled}
        required={required}
        autoComplete="off"
      />
      {isLoading ? (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 animate-spin" />
      ) : (
        value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.placeId}
              onClick={() => handleSelectSuggestion(suggestion)}
              className={`cursor-pointer px-4 py-3 hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-gray-100' : ''
              }`}
            >
              <div className="font-medium text-gray-900">{suggestion.mainText}</div>
              {suggestion.secondaryText && (
                <div className="text-sm text-gray-500">{suggestion.secondaryText}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

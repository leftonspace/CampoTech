'use client';

import { useCallback } from 'react';
import { MapPin, X } from 'lucide-react';

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

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Ingresá la dirección...',
  className = '',
  disabled = false,
  required = false,
}: AddressAutocompleteProps) {
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

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
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

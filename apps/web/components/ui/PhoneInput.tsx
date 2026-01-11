'use client';

import Image from 'next/image';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Country codes for phone input - Top 10 most relevant + Other
// Using ISO country codes for flag images from flagcdn.com
export const COUNTRY_CODES = [
  { code: '+54', country: 'Argentina', iso: 'ar', flag: 'ðŸ‡¦ðŸ‡·', maxDigits: 10, placeholder: '11 1234 5678' },
  { code: '+56', country: 'Chile', iso: 'cl', flag: 'ðŸ‡¨ðŸ‡±', maxDigits: 9, placeholder: '9 1234 5678' },
  { code: '+598', country: 'Uruguay', iso: 'uy', flag: 'ðŸ‡ºðŸ‡¾', maxDigits: 8, placeholder: '94 123 456' },
  { code: '+595', country: 'Paraguay', iso: 'py', flag: 'ðŸ‡µðŸ‡¾', maxDigits: 9, placeholder: '981 123 456' },
  { code: '+55', country: 'Brasil', iso: 'br', flag: 'ðŸ‡§ðŸ‡·', maxDigits: 11, placeholder: '11 91234 5678' },
  { code: '+591', country: 'Bolivia', iso: 'bo', flag: 'ðŸ‡§ðŸ‡´', maxDigits: 8, placeholder: '7 123 4567' },
  { code: '+51', country: 'Perú', iso: 'pe', flag: 'ðŸ‡µðŸ‡ª', maxDigits: 9, placeholder: '912 345 678' },
  { code: '+57', country: 'Colombia', iso: 'co', flag: 'ðŸ‡¨ðŸ‡´', maxDigits: 10, placeholder: '310 123 4567' },
  { code: '+52', country: 'México', iso: 'mx', flag: 'ðŸ‡²ðŸ‡½', maxDigits: 10, placeholder: '55 1234 5678' },
  { code: '+1', country: 'USA/Canadá', iso: 'us', flag: 'ðŸ‡ºðŸ‡¸', maxDigits: 10, placeholder: '(555) 123-4567' },
  // Other option - allows any custom country code
  { code: 'OTHER', country: 'Otro', iso: 'un', flag: '🌍', maxDigits: 15, placeholder: '123 456 7890' },
];

// Format phone number based on country code
export const formatPhoneNumber = (phone: string, countryCode: string): string => {
  const digits = phone.replace(/\D/g, '');

  switch (countryCode) {
    case '+54': // Argentina: XX XXXX XXXX
    case '+52': // México: XX XXXX XXXX
      if (digits.length <= 2) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;

    case '+56': // Chile: X XXXX XXXX
      if (digits.length <= 1) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
      return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;

    case '+598': // Uruguay: XX XXX XXX
      if (digits.length <= 2) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;

    case '+595': // Paraguay: XXX XXX XXX
    case '+51': // Perú: XXX XXX XXX
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;

    case '+55': // Brasil: XX XXXXX XXXX
      if (digits.length <= 2) return digits;
      if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7, 11)}`;

    case '+591': // Bolivia: X XXX XXXX
      if (digits.length <= 1) return digits;
      if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
      return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;

    case '+57': // Colombia: XXX XXX XXXX
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;

    case '+1': // USA/Canada: (XXX) XXX-XXXX
      if (digits.length <= 3) return digits.length > 0 ? `(${digits}` : '';
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;

    default:
      // Generic formatting for "Otro" or unknown codes: XXX XXX XXXX
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  }
};

// Parse a full phone number (with country code) into its parts
export const parsePhoneNumber = (fullPhone: string): { countryCode: string; phone: string } => {
  if (!fullPhone) return { countryCode: '+54', phone: '' };

  // Try to match known country codes (longest first to handle +598, +595, etc.)
  const sortedCodes = [...COUNTRY_CODES]
    .filter(c => c.code !== 'OTHER')
    .sort((a, b) => b.code.length - a.code.length);

  for (const country of sortedCodes) {
    if (fullPhone.startsWith(country.code)) {
      const phoneDigits = fullPhone.slice(country.code.length);
      return {
        countryCode: country.code,
        phone: formatPhoneNumber(phoneDigits, country.code),
      };
    }
  }

  // If no known code matches, try to extract a custom code
  const match = fullPhone.match(/^(\+\d{1,4})(.*)$/);
  if (match) {
    return {
      countryCode: 'OTHER',
      phone: formatPhoneNumber(match[2], 'OTHER'),
    };
  }

  // Default to Argentina
  return { countryCode: '+54', phone: formatPhoneNumber(fullPhone, '+54') };
};

// Get full phone number with country code
export const getFullPhoneNumber = (
  countryCode: string,
  customCountryCode: string,
  phone: string
): string => {
  const actualCode = countryCode === 'OTHER'
    ? (customCountryCode.startsWith('+') ? customCountryCode : `+${customCountryCode}`)
    : countryCode;
  const phoneDigits = phone.replace(/\D/g, '');
  return `${actualCode}${phoneDigits}`;
};

// Flag image component using flagcdn.com
export function FlagImage({ iso, size = 20 }: { iso: string; size?: number }) {
  // For "Otro" option, show globe emoji
  if (iso === 'un') {
    return (
      <span
        className="flex items-center justify-center rounded-sm"
        style={{ width: size, height: Math.round(size * 0.75), fontSize: size * 0.8 }}
      >
        🌍
      </span>
    );
  }

  return (
    <Image
      src={`https://flagcdn.com/w20/${iso.toLowerCase()}.png`}
      alt={`${iso} flag`}
      width={size}
      height={Math.round(size * 0.75)}
    />
  );
}

// Props for the PhoneInput component
interface PhoneInputProps {
  value: string; // Full phone number with country code (e.g., "+5491112345678")
  onChange: (fullPhone: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  id?: string;
  variant?: 'default' | 'simple'; // 'default' uses flag images, 'simple' uses emoji flags
}

export default function PhoneInput({
  value,
  onChange,
  label = 'Teléfono',
  required = false,
  disabled = false,
  className,
  error,
  id = 'phone',
  variant = 'default',
}: PhoneInputProps) {
  // Parse the initial value to get country code and phone
  const parsed = parsePhoneNumber(value);

  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [customCountryCode, setCustomCountryCode] = useState(() => {
    // If parsed to OTHER, extract the custom code from value
    if (parsed.countryCode === 'OTHER' && value) {
      const match = value.match(/^(\+\d{1,4})/);
      return match ? match[1] : '';
    }
    return '';
  });
  const [phone, setPhone] = useState(parsed.phone);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get selected country data
  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCountryPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update parent when phone changes
  useEffect(() => {
    const fullPhone = getFullPhoneNumber(countryCode, customCountryCode, phone);
    if (fullPhone !== value && (phone || countryCode !== '+54')) {
      onChange(fullPhone);
    }
  }, [countryCode, customCountryCode, phone, onChange, value]);

  // Get the actual country code (from list or custom)
  const getActualCountryCode = () => {
    if (countryCode === 'OTHER') {
      return customCountryCode.startsWith('+') ? customCountryCode : `+${customCountryCode}`;
    }
    return countryCode;
  };

  // Handle phone input change with formatting
  const handlePhoneChange = (inputValue: string) => {
    const digits = inputValue.replace(/\D/g, '').slice(0, selectedCountry.maxDigits);
    const actualCode = getActualCountryCode();
    const formatted = formatPhoneNumber(digits, actualCode);
    setPhone(formatted);
  };

  // Handle country change
  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    setPhone(''); // Clear phone when country changes
    setShowCountryPicker(false);
  };

  // Simple variant - now uses same flag images as default, just more compact
  if (variant === 'simple') {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
            {label} {required && '*'}
          </label>
        )}
        <div className={cn(
          "flex items-center h-10 rounded-md border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}>
          {/* Country Selector with Flag */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => !disabled && setShowCountryPicker(!showCountryPicker)}
              className="flex items-center gap-1.5 h-10 px-3 border-r border-input bg-muted/50 rounded-l-md hover:bg-muted transition-colors focus:outline-none"
              disabled={disabled}
            >
              <FlagImage iso={selectedCountry.iso} size={20} />
              <span className="text-sm text-foreground font-medium">
                {countryCode === 'OTHER' ? 'Otro' : countryCode}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Country Dropdown */}
            {showCountryPicker && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
                <div className="p-2 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground uppercase">Seleccionar país</span>
                </div>
                {COUNTRY_CODES.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountryChange(country.code)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors"
                  >
                    <FlagImage iso={country.iso} size={20} />
                    <span className="flex-1 text-left text-sm text-foreground">{country.country}</span>
                    <span className="text-sm text-muted-foreground">
                      {country.code === 'OTHER' ? 'Otro' : country.code}
                    </span>
                    {country.code === countryCode && (
                      <Check className="h-4 w-4 text-success" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Country Code Input (shown when "Otro" is selected) */}
          {countryCode === 'OTHER' && (
            <input
              type="text"
              value={customCountryCode}
              onChange={(e) => {
                // Only allow + and numbers
                const inputVal = e.target.value.replace(/[^+\d]/g, '');
                // Ensure + is only at the start
                const cleaned = inputVal.startsWith('+')
                  ? '+' + inputVal.slice(1).replace(/\+/g, '')
                  : inputVal.replace(/\+/g, '');
                setCustomCountryCode(cleaned);
              }}
              placeholder="+XX"
              className="w-16 h-10 px-2 text-sm text-center border-r border-input bg-transparent placeholder:text-muted-foreground focus:outline-none"
              maxLength={5}
              disabled={disabled}
            />
          )}

          {/* Phone Input */}
          <input
            id={id}
            type="tel"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder={selectedCountry.placeholder}
            className="flex-1 h-10 px-3 py-2 text-sm bg-transparent placeholder:text-muted-foreground focus:outline-none"
            required={required}
            disabled={disabled}
          />
        </div>
        {countryCode === 'OTHER' && (
          <p className="mt-1 text-xs text-muted-foreground">
            Ingresá el código de país (ej: +34 para España, +49 para Alemania)
          </p>
        )}
        {error && <p className="mt-1 text-sm text-danger-500">{error}</p>}
      </div>
    );
  }

  // Default variant with flag images and custom dropdown
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && '*'}
        </label>
      )}
      <div className={cn(
        "flex items-center h-10 rounded-md border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}>
        {/* Country Selector with Flag */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => !disabled && setShowCountryPicker(!showCountryPicker)}
            className="flex items-center gap-1.5 h-10 px-3 border-r border-input bg-muted/50 rounded-l-md hover:bg-muted transition-colors focus:outline-none"
            disabled={disabled}
          >
            <FlagImage iso={selectedCountry.iso} size={20} />
            <span className="text-sm text-foreground font-medium">
              {countryCode === 'OTHER' ? 'Otro' : countryCode}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Country Dropdown */}
          {showCountryPicker && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
              <div className="p-2 border-b border-border">
                <span className="text-xs font-medium text-muted-foreground uppercase">Seleccionar país</span>
              </div>
              {COUNTRY_CODES.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleCountryChange(country.code)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors"
                >
                  <FlagImage iso={country.iso} size={20} />
                  <span className="flex-1 text-left text-sm text-foreground">{country.country}</span>
                  <span className="text-sm text-muted-foreground">
                    {country.code === 'OTHER' ? 'Otro' : country.code}
                  </span>
                  {country.code === countryCode && (
                    <Check className="h-4 w-4 text-success" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom Country Code Input (shown when "Otro" is selected) */}
        {countryCode === 'OTHER' && (
          <input
            type="text"
            value={customCountryCode}
            onChange={(e) => {
              const raw = e.target.value;

              // Rule D: Allow empty field
              if (raw === '') {
                setCustomCountryCode('');
                return;
              }

              // Rule A: Strip non-numeric/non-plus characters
              const cleaned = raw.replace(/[^+\d]/g, '');

              // Rule B & C: Smart plus handling
              if (cleaned === '+') {
                // User typed just '+', allow it
                setCustomCountryCode('+');
              } else if (cleaned.startsWith('+')) {
                // Already has '+', remove any extra '+' after first
                setCustomCountryCode('+' + cleaned.slice(1).replace(/\+/g, ''));
              } else if (/^\d/.test(cleaned)) {
                // Starts with digit, auto-prepend '+'
                setCustomCountryCode('+' + cleaned.replace(/\+/g, ''));
              } else {
                setCustomCountryCode(cleaned);
              }
            }}
            placeholder="+XX"
            className="w-16 h-10 px-2 text-sm text-center border-r border-input bg-transparent placeholder:text-muted-foreground focus:outline-none"
            maxLength={5}
            disabled={disabled}
          />
        )}

        {/* Phone Input */}
        <input
          id={id}
          type="tel"
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder={selectedCountry.placeholder}
          className="flex-1 h-10 px-3 py-2 text-sm bg-transparent placeholder:text-muted-foreground focus:outline-none"
          required={required}
          disabled={disabled}
        />
      </div>
      {error && <p className="mt-1 text-sm text-danger-500">{error}</p>}
    </div>
  );
}

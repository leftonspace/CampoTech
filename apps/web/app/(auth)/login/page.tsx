'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { ChevronDown, Check } from 'lucide-react';

type Step = 'phone' | 'otp';

// Country codes for phone input - Top 10 most relevant + Other
// Using ISO country codes for flag images from flagcdn.com
const COUNTRY_CODES = [
  { code: '+54', country: 'Argentina', iso: 'ar', maxDigits: 10, placeholder: '11 1234 5678' },
  { code: '+56', country: 'Chile', iso: 'cl', maxDigits: 9, placeholder: '9 1234 5678' },
  { code: '+598', country: 'Uruguay', iso: 'uy', maxDigits: 8, placeholder: '94 123 456' },
  { code: '+595', country: 'Paraguay', iso: 'py', maxDigits: 9, placeholder: '981 123 456' },
  { code: '+55', country: 'Brasil', iso: 'br', maxDigits: 11, placeholder: '11 91234 5678' },
  { code: '+591', country: 'Bolivia', iso: 'bo', maxDigits: 8, placeholder: '7 123 4567' },
  { code: '+51', country: 'Perú', iso: 'pe', maxDigits: 9, placeholder: '912 345 678' },
  { code: '+57', country: 'Colombia', iso: 'co', maxDigits: 10, placeholder: '310 123 4567' },
  { code: '+52', country: 'México', iso: 'mx', maxDigits: 10, placeholder: '55 1234 5678' },
  { code: '+1', country: 'USA/Canadá', iso: 'us', maxDigits: 10, placeholder: '(555) 123-4567' },
  // Other option - allows any custom country code
  { code: 'OTHER', country: 'Otro', iso: 'un', maxDigits: 15, placeholder: '123 456 7890' },
];

// Flag image component using flagcdn.com
function FlagImage({ iso, size = 20 }: { iso: string; size?: number }) {
  // For "Otro" option, show globe emoji
  if (iso === 'un') {
    return (
      <span
        className="flex items-center justify-center rounded-sm"
        style={{ width: size, height: Math.round(size * 0.75), fontSize: size * 0.8 }}
      >
        🌍
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w${size * 2}/${iso}.png`}
      srcSet={`https://flagcdn.com/w${size * 3}/${iso}.png 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt={iso.toUpperCase()}
      className="rounded-sm object-cover"
      style={{ minWidth: size }}
    />
  );
}

// Format phone number based on country
const formatPhoneByCountry = (value: string, countryCode: string): string => {
  const digits = value.replace(/\D/g, '');

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

export default function LoginPage() {
  const [step, setStep] = useState<Step>('phone');
  const [countryCode, setCountryCode] = useState('+54'); // Default to Argentina
  const [customCountryCode, setCustomCountryCode] = useState(''); // For "Otro" option
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const { requestOtp, login } = useAuth();
  const router = useRouter();

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

  // Get the actual country code (from list or custom)
  const getActualCountryCode = () => {
    if (countryCode === 'OTHER') {
      return customCountryCode.startsWith('+') ? customCountryCode : `+${customCountryCode}`;
    }
    return countryCode;
  };

  // Handle phone input change with formatting
  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, selectedCountry.maxDigits);
    const actualCode = getActualCountryCode();
    const formatted = formatPhoneByCountry(digits, actualCode);
    setPhone(formatted);
    setError('');
  };

  // Handle country change
  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    setPhone(''); // Clear phone when country changes
    setShowCountryPicker(false);
  };

  // Get full phone number with country code
  const getFullPhone = () => {
    const phoneDigits = phone.replace(/\D/g, '');
    return `${getActualCountryCode()}${phoneDigits}`;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const fullPhone = getFullPhone();
    const result = await requestOtp(fullPhone);

    if (result.success) {
      setStep('otp');
    } else {
      setError(result.error || 'Error al enviar el código');
    }

    setIsLoading(false);
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const fullPhone = getFullPhone();
    const result = await login(fullPhone, otp);

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Código incorrecto');
    }

    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">CampoTech</h1>
            <p className="mt-2 text-gray-600">
              {step === 'phone' ? 'Ingresá tu número de teléfono' : 'Ingresá el código'}
            </p>
          </div>

          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label htmlFor="phone" className="label mb-1 block">
                  Teléfono
                </label>
                <div className="flex rounded-md border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background">
                  {/* Country Selector with Flag */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowCountryPicker(!showCountryPicker)}
                      className="flex items-center gap-1.5 h-10 px-3 border-r border-input bg-muted/50 rounded-l-md hover:bg-muted transition-colors focus:outline-none"
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
                        const value = e.target.value.replace(/[^+\d]/g, '');
                        // Ensure + is only at the start
                        const cleaned = value.startsWith('+')
                          ? '+' + value.slice(1).replace(/\+/g, '')
                          : value.replace(/\+/g, '');
                        setCustomCountryCode(cleaned);
                      }}
                      placeholder="+XX"
                      className="w-16 h-10 px-2 text-sm text-center border-r border-input bg-transparent placeholder:text-muted-foreground focus:outline-none"
                      maxLength={5}
                    />
                  )}

                  {/* Phone Input */}
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder={selectedCountry.placeholder}
                    className="flex-1 h-10 px-3 py-2 text-sm bg-transparent placeholder:text-muted-foreground focus:outline-none"
                    required
                    autoFocus
                  />
                </div>
                {countryCode === 'OTHER' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ingresá el código de país (ej: +34 para España, +49 para Alemania)
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-danger-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || !phone || (countryCode === 'OTHER' && !customCountryCode)}
                className="btn-primary w-full"
              >
                {isLoading ? 'Enviando...' : 'Continuar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div>
                <label htmlFor="otp" className="label mb-1 block">
                  Código de verificación
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="input text-center text-2xl tracking-widest"
                  required
                  autoFocus
                />
                <p className="mt-2 text-sm text-gray-500">
                  Enviamos un código a {getFullPhone()}
                </p>
              </div>

              {error && (
                <p className="text-sm text-danger-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="btn-primary w-full"
              >
                {isLoading ? 'Verificando...' : 'Ingresar'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
                className="btn-ghost w-full"
              >
                Cambiar número
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            ¿No tenés cuenta?{' '}
            <Link href="/signup" className="text-primary-600 hover:underline">
              Registrate
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

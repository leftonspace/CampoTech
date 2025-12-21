'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ChevronDown, Check } from 'lucide-react';

type Step = 'phone' | 'otp';

// Country codes for phone input with formatting
const COUNTRY_CODES = [
  { code: '+54', country: 'Argentina', flag: '🇦🇷', format: '9 11 1234-5678', maxDigits: 12, placeholder: '9 11 1234-5678' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸', format: '(xxx) xxx-xxxx', maxDigits: 10, placeholder: '(555) 123-4567' },
  { code: '+52', country: 'México', flag: '🇲🇽', format: 'xx xxxx xxxx', maxDigits: 10, placeholder: '55 1234 5678' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷', format: 'xx xxxxx-xxxx', maxDigits: 11, placeholder: '11 91234-5678' },
  { code: '+56', country: 'Chile', flag: '🇨🇱', format: 'x xxxx xxxx', maxDigits: 9, placeholder: '9 1234 5678' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴', format: 'xxx xxx xxxx', maxDigits: 10, placeholder: '310 123 4567' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪', format: 'xxx xxx xxxx', maxDigits: 10, placeholder: '412 123 4567' },
  { code: '+34', country: 'España', flag: '🇪🇸', format: 'xxx xx xx xx', maxDigits: 9, placeholder: '612 34 56 78' },
];

// Format phone number based on country
const formatPhoneByCountry = (value: string, countryCode: string): string => {
  const digits = value.replace(/\D/g, '');

  switch (countryCode) {
    case '+54': // Argentina: 9 11 1234-5678
      if (digits.length <= 1) return digits;
      if (digits.length <= 3) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
      if (digits.length <= 7) return `${digits.slice(0, 1)} ${digits.slice(1, 3)} ${digits.slice(3)}`;
      return `${digits.slice(0, 1)} ${digits.slice(1, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`;

    case '+1': // USA/Canada: (555) 123-4567
      if (digits.length <= 3) return digits.length > 0 ? `(${digits}` : '';
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;

    case '+52': // México: 55 1234 5678
      if (digits.length <= 2) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;

    case '+55': // Brasil: 11 91234-5678
      if (digits.length <= 2) return digits;
      if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;

    case '+56': // Chile: 9 1234 5678
      if (digits.length <= 1) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
      return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;

    case '+57': // Colombia: 310 123 4567
    case '+58': // Venezuela: 412 123 4567
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;

    case '+34': // España: 612 34 56 78
      if (digits.length <= 3) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
      return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;

    default:
      return digits;
  }
};

export default function LoginPage() {
  const [step, setStep] = useState<Step>('phone');
  const [countryCode, setCountryCode] = useState('+54'); // Default to Argentina
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

  // Handle phone input change with formatting
  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, selectedCountry.maxDigits);
    const formatted = formatPhoneByCountry(digits, countryCode);
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
    return `${countryCode}${phoneDigits}`;
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
                <div className="flex">
                  {/* Country Selector with Flag */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowCountryPicker(!showCountryPicker)}
                      className="flex items-center gap-1 h-full px-3 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <span className="text-xl">{selectedCountry.flag}</span>
                      <span className="text-sm text-gray-700 font-medium">{countryCode}</span>
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </button>

                    {/* Country Dropdown */}
                    {showCountryPicker && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
                        <div className="p-2 border-b border-gray-100">
                          <span className="text-xs font-medium text-gray-500 uppercase">Seleccionar país</span>
                        </div>
                        {COUNTRY_CODES.map((country) => (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => handleCountryChange(country.code)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                          >
                            <span className="text-xl">{country.flag}</span>
                            <span className="flex-1 text-left text-sm text-gray-700">{country.country}</span>
                            <span className="text-sm text-gray-500">{country.code}</span>
                            {country.code === countryCode && (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Phone Input */}
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder={selectedCountry.placeholder}
                    className="input flex-1 rounded-l-none"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-danger-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || !phone}
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

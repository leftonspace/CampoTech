'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ChevronDown, Check } from 'lucide-react';

type Step = 'info' | 'phone' | 'otp';

interface FormError {
  message: string;
  field?: string;
}

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

export default function SignupPage() {
  const [step, setStep] = useState<Step>('info');
  const [formData, setFormData] = useState({
    cuit: '',
    businessName: '',
    name: '',
    phone: '',
    email: '',
  });
  const [countryCode, setCountryCode] = useState('+54'); // Default to Argentina
  const [customCountryCode, setCustomCountryCode] = useState(''); // For "Otro" option
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<FormError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { register } = useAuth();

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
    setFormData({ ...formData, phone: formatted });
    setError(null);
  };

  // Handle country change
  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    setFormData({ ...formData, phone: '' }); // Clear phone when country changes
    setShowCountryPicker(false);
  };

  // Get full phone number with country code
  const getFullPhone = () => {
    const phoneDigits = formData.phone.replace(/\D/g, '');
    return `${getActualCountryCode()}${phoneDigits}`;
  };

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic CUIT validation (client-side)
    const cuitDigits = formData.cuit.replace(/\D/g, '');
    if (cuitDigits.length !== 11) {
      setError({ message: 'El CUIT debe tener 11 digitos', field: 'cuit' });
      return;
    }

    // Validate business name
    if (formData.businessName.trim().length < 2) {
      setError({ message: 'La razón social es muy corta', field: 'businessName' });
      return;
    }

    // Validate admin name
    if (formData.name.trim().length < 2) {
      setError({ message: 'El nombre es muy corto', field: 'name' });
      return;
    }

    setStep('phone');
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const fullPhone = getFullPhone();

      // Call registration endpoint
      const response = await api.auth.register({
        cuit: formData.cuit,
        businessName: formData.businessName,
        adminName: formData.name,
        phone: fullPhone,
        email: formData.email || undefined,
      });

      if (response.success && response.data) {
        setDevMode(!!response.data.devMode);
        setStep('otp');
      } else {
        const err = response.error as FormError;
        setError(err || { message: 'Error al enviar el código' });

        // If the error is about CUIT, go back to info step
        if (err?.field === 'cuit') {
          setStep('info');
        }
      }
    } catch (err) {
      setError({ message: 'Error de conexión. Intentá de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const fullPhone = getFullPhone();

      // Use auth context's register function - this properly sets the user state
      const result = await register(fullPhone, otp);

      if (result.success) {
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        setError({ message: result.error || 'Código incorrecto' });
      }
    } catch (err) {
      setError({ message: 'Error de conexión. Intentá de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCuit = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  };

  const getFieldError = (field: string) => {
    return error?.field === field ? error.message : null;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
            <p className="mt-2 text-gray-600">
              {step === 'info' && 'Datos de tu empresa'}
              {step === 'phone' && 'Tu número de teléfono'}
              {step === 'otp' && 'Verificá tu número'}
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8 flex justify-center gap-2">
            {['info', 'phone', 'otp'].map((s, i) => (
              <div
                key={s}
                className={`h-2 w-8 rounded-full ${
                  ['info', 'phone', 'otp'].indexOf(step) >= i
                    ? 'bg-primary-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {step === 'info' && (
            <form onSubmit={handleInfoSubmit} className="space-y-4">
              <div>
                <label htmlFor="cuit" className="label mb-1 block">
                  CUIT
                </label>
                <input
                  id="cuit"
                  type="text"
                  value={formatCuit(formData.cuit)}
                  onChange={(e) =>
                    setFormData({ ...formData, cuit: e.target.value })
                  }
                  placeholder="XX-XXXXXXXX-X"
                  className={`input ${getFieldError('cuit') ? 'border-danger-500' : ''}`}
                  required
                  autoFocus
                />
                {getFieldError('cuit') && (
                  <p className="mt-1 text-sm text-danger-500">{getFieldError('cuit')}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  CUIT de tu empresa (11 dígitos)
                </p>
              </div>

              <div>
                <label htmlFor="businessName" className="label mb-1 block">
                  Razón social
                </label>
                <input
                  id="businessName"
                  type="text"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({ ...formData, businessName: e.target.value })
                  }
                  placeholder="Tu Empresa SRL"
                  className={`input ${getFieldError('businessName') ? 'border-danger-500' : ''}`}
                  required
                />
                {getFieldError('businessName') && (
                  <p className="mt-1 text-sm text-danger-500">{getFieldError('businessName')}</p>
                )}
              </div>

              <div>
                <label htmlFor="name" className="label mb-1 block">
                  Tu nombre
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Juan Pérez"
                  className={`input ${getFieldError('name') ? 'border-danger-500' : ''}`}
                  required
                />
                {getFieldError('name') && (
                  <p className="mt-1 text-sm text-danger-500">{getFieldError('name')}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="label mb-1 block">
                  Email <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="tu@email.com"
                  className="input"
                />
              </div>

              {error && !error.field && (
                <p className="text-sm text-danger-500">{error.message}</p>
              )}

              <button type="submit" className="btn-primary w-full">
                Continuar
              </button>
            </form>
          )}

          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="mb-4 rounded-lg bg-gray-50 p-3">
                <p className="text-sm text-gray-600">
                  <strong>{formData.businessName}</strong>
                </p>
                <p className="text-xs text-gray-500">CUIT: {formatCuit(formData.cuit)}</p>
              </div>

              <div>
                <label htmlFor="phone" className="label mb-1 block">
                  Tu teléfono celular
                </label>
                <div className="flex rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2">
                  {/* Country Selector with Flag */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowCountryPicker(!showCountryPicker)}
                      className="flex items-center gap-1.5 h-10 px-3 border-r border-gray-300 bg-gray-50 rounded-l-md hover:bg-gray-100 transition-colors focus:outline-none"
                    >
                      <FlagImage iso={selectedCountry.iso} size={20} />
                      <span className="text-sm text-gray-700 font-medium">
                        {countryCode === 'OTHER' ? 'Otro' : countryCode}
                      </span>
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
                            <FlagImage iso={country.iso} size={20} />
                            <span className="flex-1 text-left text-sm text-gray-700">{country.country}</span>
                            <span className="text-sm text-gray-500">
                              {country.code === 'OTHER' ? 'Otro' : country.code}
                            </span>
                            {country.code === countryCode && (
                              <Check className="h-4 w-4 text-green-600" />
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
                      className="w-16 h-10 px-2 text-sm text-center border-r border-gray-300 bg-transparent placeholder:text-gray-400 focus:outline-none"
                      maxLength={5}
                    />
                  )}

                  {/* Phone Input */}
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder={selectedCountry.placeholder}
                    className="flex-1 h-10 px-3 py-2 text-sm bg-transparent placeholder:text-gray-400 focus:outline-none"
                    required
                    autoFocus
                  />
                </div>
                {countryCode === 'OTHER' && (
                  <p className="mt-1 text-xs text-gray-500">
                    Ingresá el código de país (ej: +34 para España, +49 para Alemania)
                  </p>
                )}
                {getFieldError('phone') && (
                  <p className="mt-1 text-sm text-danger-500">{getFieldError('phone')}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Te enviaremos un código por SMS para verificar tu número
                </p>
              </div>

              {error && !error.field && (
                <p className="text-sm text-danger-500">{error.message}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || !formData.phone || (countryCode === 'OTHER' && !customCountryCode)}
                className="btn-primary w-full"
              >
                {isLoading ? 'Enviando...' : 'Enviar código'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('info');
                  setError(null);
                }}
                className="btn-ghost w-full"
              >
                Volver
              </button>
            </form>
          )}

          {step === 'otp' && (
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
                {devMode && (
                  <p className="mt-1 text-xs text-amber-600">
                    Modo desarrollo: revisá la consola del servidor o usá 123456
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-danger-500">{error.message}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="btn-primary w-full"
              >
                {isLoading ? 'Verificando...' : 'Crear cuenta'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError(null);
                }}
                className="btn-ghost w-full"
              >
                Cambiar número
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="text-primary-600 hover:underline">
              Ingresá
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

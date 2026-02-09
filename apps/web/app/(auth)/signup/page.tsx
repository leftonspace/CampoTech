'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ChevronDown, Check, HelpCircle, X } from 'lucide-react';
import { CheckoutModal } from '@/components/checkout/CheckoutModal';


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
        {"\u{1F30D}"}</span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w20/${iso.toLowerCase()}.png`}
      alt={`${iso} flag`}
      width={size}
      height={Math.round(size * 0.75)}
      className="object-contain"
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
  const [formData, setFormData] = useState({
    cuit: '',
    businessName: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dataTransferConsent: false,
    termsAccepted: false,
  });
  const [countryCode, setCountryCode] = useState('+54'); // Default to Argentina
  const [customCountryCode, setCustomCountryCode] = useState(''); // For "Otro" option
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<FormError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [registrationTicket, setRegistrationTicket] = useState<string | null>(null);
  const [otpSentAt, setOtpSentAt] = useState<Date | null>(null); // Track when OTP was sent
  const [resendCountdown, setResendCountdown] = useState(0); // Countdown seconds for resend button

  const dropdownRef = useRef<HTMLDivElement>(null);
  const _router = useRouter();
  const searchParams = useSearchParams();
  const selectedPlan = searchParams.get('plan')?.toUpperCase() || null;
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

  // Countdown timer for resend button (60 seconds)
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Start countdown when OTP modal opens
  useEffect(() => {
    if (showOtpModal && otpSentAt) {
      const elapsed = Math.floor((Date.now() - otpSentAt.getTime()) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setResendCountdown(remaining);
    }
  }, [showOtpModal, otpSentAt]);

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

  // Get formatted phone for display (e.g., "+1 (819) 968-5685")
  const getFormattedPhoneForDisplay = () => {
    const actualCode = getActualCountryCode();
    // formData.phone is already formatted by handlePhoneChange
    return `${actualCode} ${formData.phone}`;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // CUIT validation - only if provided
    const cuitDigits = formData.cuit.replace(/\D/g, '');
    if (cuitDigits.length > 0 && cuitDigits.length !== 11) {
      setError({ message: 'El CUIT debe tener 11 dígitos', field: 'cuit' });
      return;
    }

    // Business name validation - only if provided
    if (formData.businessName.trim().length > 0 && formData.businessName.trim().length < 2) {
      setError({ message: 'La razón social es muy corta', field: 'businessName' });
      return;
    }

    // Validate first name (required)
    if (formData.firstName.trim().length < 2) {
      setError({ message: 'El nombre es muy corto', field: 'firstName' });
      return;
    }

    // Validate last name (required)
    if (formData.lastName.trim().length < 2) {
      setError({ message: 'El apellido es muy corto', field: 'lastName' });
      return;
    }

    // Validate phone (required)
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 8) {
      setError({ message: 'Ingresá un número de teléfono válido', field: 'phone' });
      return;
    }

    // If using custom country code, validate it
    if (countryCode === 'OTHER' && !customCountryCode) {
      setError({ message: 'Ingresá el código de país', field: 'phone' });
      return;
    }

    setIsLoading(true);

    try {
      const fullPhone = getFullPhone();

      // If OTP was already sent recently (within 60s), just re-show the modal
      // This prevents rate limiting when user accidentally closes the modal
      const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds
      if (otpSentAt && (Date.now() - otpSentAt.getTime()) < OTP_COOLDOWN_MS) {
        setShowOtpModal(true);
        setIsLoading(false);
        return;
      }

      // Call registration endpoint
      const response = await api.auth.register({
        cuit: formData.cuit,
        businessName: formData.businessName,
        adminName: `${formData.firstName} ${formData.lastName}`.trim(),
        phone: fullPhone,
        email: formData.email || undefined,
        selectedPlan: selectedPlan || undefined,
        // Ley 25.326 Consent Fields
        dataTransferConsent: formData.dataTransferConsent,
        termsAccepted: formData.termsAccepted,
        consentTimestamp: new Date().toISOString(),
      });

      if (response.success && response.data) {
        setDevMode(!!response.data.devMode);
        setOtpSentAt(new Date()); // Track when OTP was sent
        setShowOtpModal(true); // Show OTP modal instead of changing step
      } else {
        const err = response.error as FormError;
        setError(err || { message: 'Error al enviar el código' });
      }
    } catch {
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

      if (result.success && result.registrationTicket) {
        // Store the registration ticket — account is NOT created yet
        setRegistrationTicket(result.registrationTicket);

        if (selectedPlan) {
          // Show checkout modal for payment method selection
          setShowCheckoutModal(true);
        } else {
          // No plan selected → complete registration and go to dashboard
          await completeRegistrationAndRedirect(result.registrationTicket);
        }
      } else {
        setError({ message: result.error || 'Código incorrecto' });
      }
    } catch (_err) {
      setError({ message: 'Error de conexión. Intentá de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Complete registration and redirect to dashboard (used for "skip" and no-plan flows)
  const completeRegistrationAndRedirect = async (ticket: string) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationTicket: ticket }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        // Now the account exists — store tokens
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        // Use full page navigation (not router.push) so the auth context
        // properly hydrates from the auth-token cookie on reload.
        // router.push would hit ProtectedRoute before auth state updates.
        window.location.href = '/dashboard';
      } else {
        setError({ message: data.error?.message || 'Error al crear la cuenta' });
      }
    } catch {
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
    <>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="card p-8">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
              <p className="mt-2 text-gray-600">
                {selectedPlan
                  ? `Registrate para comenzar tu prueba gratuita de 21 días en el plan ${selectedPlan.charAt(0) + selectedPlan.slice(1).toLowerCase()}`
                  : 'Completá tus datos para comenzar'
                }
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label htmlFor="cuit" className="label mb-1 flex items-center gap-2">
                  CUIT <span className="text-gray-400">(opcional)</span>
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-50">
                      Requerido para emitir facturas electrónicas (AFIP). Podés agregarlo más tarde en configuración.
                    </div>
                  </div>
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
                  autoFocus
                />
                {getFieldError('cuit') && (
                  <p className="mt-1 text-sm text-danger-500">{getFieldError('cuit')}</p>
                )}
              </div>

              <div>
                <label htmlFor="businessName" className="label mb-1 flex items-center gap-2">
                  Razón social <span className="text-gray-400">(opcional)</span>
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-50">
                      Completá solo si tenés una sociedad (SRL, SA). Monotributistas: dejalo vacío, usamos tu nombre.
                    </div>
                  </div>
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
                />
                {getFieldError('businessName') && (
                  <p className="mt-1 text-sm text-danger-500">{getFieldError('businessName')}</p>
                )}
              </div>

              {/* Name fields side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="label mb-1 block">
                    Nombre
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    placeholder="Juan"
                    className={`input ${getFieldError('firstName') ? 'border-danger-500' : ''}`}
                    required
                  />
                  {getFieldError('firstName') && (
                    <p className="mt-1 text-sm text-danger-500">{getFieldError('firstName')}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="lastName" className="label mb-1 block">
                    Apellido
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    placeholder="Pérez"
                    className={`input ${getFieldError('lastName') ? 'border-danger-500' : ''}`}
                    required
                  />
                  {getFieldError('lastName') && (
                    <p className="mt-1 text-sm text-danger-500">{getFieldError('lastName')}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="label mb-1 block">
                  Tu teléfono celular
                </label>
                <div className={`flex rounded-md border ${getFieldError('phone') ? 'border-danger-500' : 'border-gray-300'} focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2`}>
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
                        const value = e.target.value.replace(/[^\d+]/g, '');
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
                  />
                </div>
                {getFieldError('phone') && (
                  <p className="mt-1 text-sm text-danger-500">
                    {getFieldError('phone')!.includes('iniciar sesi') ? (
                      <>
                        Ya existe un usuario con este teléfono. Intentá{' '}
                        <Link href="/login" className="text-primary-600 font-medium underline hover:text-primary-700">
                          iniciar sesión
                        </Link>.
                      </>
                    ) : (
                      getFieldError('phone')
                    )}
                  </p>
                )}
                {!getFieldError('phone') && (
                  <p className="mt-1 text-xs text-gray-500">
                    Te enviaremos un código por SMS para verificar
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="label mb-1 flex items-center gap-2">
                  Email <span className="text-gray-400">(opcional)</span>
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-50">
                      Para recibir notificaciones, copias de facturas y recuperar tu cuenta.
                    </div>
                  </div>
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

              {/* Consent Checkboxes - Required by Ley 25.326 */}
              <div className="mt-4 space-y-3 pt-4 border-t border-gray-200">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.dataTransferConsent}
                    onChange={(e) =>
                      setFormData({ ...formData, dataTransferConsent: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    required
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-900">
                    Entiendo y acepto que mis datos personales serán alojados en{' '}
                    servidores fuera de Argentina (EE.UU.) conforme a la{' '}
                    <Link href="/privacy" className="text-primary-600 hover:underline">
                      Ley 25.326
                    </Link>
                    .
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.termsAccepted}
                    onChange={(e) =>
                      setFormData({ ...formData, termsAccepted: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    required
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-900">
                    Acepto los{' '}
                    <Link href="/terms" className="text-primary-600 hover:underline">
                      Términos y Condiciones
                    </Link>{' '}
                    y la{' '}
                    <Link href="/privacy" className="text-primary-600 hover:underline">
                      Política de Privacidad
                    </Link>
                    .
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading || !formData.dataTransferConsent || !formData.termsAccepted || !formData.phone}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Enviando código...' : 'Crear cuenta'}
              </button>
            </form>

            {/* OTP Verification Modal */}
            {showOtpModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="relative w-full max-w-sm mx-4 bg-white rounded-xl shadow-2xl p-6">
                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowOtpModal(false);
                      setOtp('');
                      setError(null);
                    }}
                    className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Verificá tu número</h2>
                    <p className="mt-2 text-sm text-gray-600">
                      Enviamos un código a <strong>{getFormattedPhoneForDisplay()}</strong>
                    </p>
                  </div>

                  <form onSubmit={handleOtpSubmit} className="space-y-4">
                    <div>
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
                      {devMode && (
                        <p className="mt-2 text-xs text-amber-600 text-center">
                          Modo desarrollo: usá 123456
                        </p>
                      )}
                    </div>

                    {error && (
                      <p className="text-sm text-danger-500 text-center">{error.message}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading || otp.length !== 6}
                      className="btn-primary w-full"
                    >
                      {isLoading ? 'Verificando...' : 'Verificar'}
                    </button>

                    <button
                      type="button"
                      disabled={resendCountdown > 0}
                      onClick={async () => {
                        setError(null);
                        setOtpSentAt(null); // Clear cooldown
                        setShowOtpModal(false);
                        // Small delay then submit to request new OTP
                        setTimeout(() => {
                          const form = document.querySelector('form') as HTMLFormElement;
                          if (form) form.requestSubmit();
                        }, 100);
                      }}
                      className={`btn-ghost w-full ${resendCountdown > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-primary-600'}`}
                    >
                      {resendCountdown > 0 ? `Reenviar código (${resendCountdown}s)` : 'Reenviar código'}
                    </button>
                  </form>
                </div>
              </div>
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

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        planTier={selectedPlan || 'PROFESIONAL'}
        registrationTicket={registrationTicket}
        onSkip={() => {
          if (registrationTicket) {
            completeRegistrationAndRedirect(registrationTicket);
          }
        }}
      />
    </>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

type Step = 'phone' | 'otp';

// Country codes for phone input
const COUNTRY_CODES = [
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪' },
  { code: '+34', country: 'España', flag: '🇪🇸' },
];

export default function LoginPage() {
  const [step, setStep] = useState<Step>('phone');
  const [countryCode, setCountryCode] = useState('+54'); // Default to Argentina
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { requestOtp, login } = useAuth();
  const router = useRouter();

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
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="input w-32 px-2"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="11 1234 5678"
                    className="input flex-1"
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setTokens } from '@/lib/api-client';
import { User } from '@/types';

type Step = 'info' | 'phone' | 'otp';

interface FormError {
  message: string;
  field?: string;
}

export default function SignupPage() {
  const [step, setStep] = useState<Step>('info');
  const [formData, setFormData] = useState({
    cuit: '',
    businessName: '',
    name: '',
    phone: '',
    email: '',
  });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<FormError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [devMode, setDevMode] = useState(false);

  const router = useRouter();

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
      // Call registration endpoint
      const response = await api.auth.register({
        cuit: formData.cuit,
        businessName: formData.businessName,
        adminName: formData.name,
        phone: formData.phone,
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
      const response = await api.auth.verifyRegistration(formData.phone, otp);

      if (response.success && response.data) {
        const data = response.data as {
          accessToken: string;
          refreshToken: string;
          user: User;
        };

        // Store tokens
        setTokens(data.accessToken, data.refreshToken);

        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        setError(response.error as FormError || { message: 'Código incorrecto' });
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
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+54 11 1234-5678"
                  className={`input ${getFieldError('phone') ? 'border-danger-500' : ''}`}
                  required
                  autoFocus
                />
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
                disabled={isLoading || !formData.phone}
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
                  Enviamos un código a {formData.phone}
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

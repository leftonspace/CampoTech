'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';

type Step = 'info' | 'phone' | 'otp';

export default function SignupPage() {
  const [step, setStep] = useState<Step>('info');
  const [formData, setFormData] = useState({
    cuit: '',
    businessName: '',
    name: '',
    phone: '',
  });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic CUIT validation
    if (formData.cuit.replace(/\D/g, '').length !== 11) {
      setError('El CUIT debe tener 11 dígitos');
      return;
    }

    setStep('phone');
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // In real app, this would create the org and send OTP
    const response = await api.auth.requestOtp(formData.phone);

    if (response.success) {
      setStep('otp');
    } else {
      setError(response.error?.message || 'Error al enviar el código');
    }

    setIsLoading(false);
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const response = await api.auth.verifyOtp(formData.phone, otp);

    if (response.success) {
      router.push('/dashboard');
    } else {
      setError(response.error?.message || 'Código incorrecto');
    }

    setIsLoading(false);
  };

  const formatCuit = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
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
                  className="input"
                  required
                  autoFocus
                />
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
                  className="input"
                  required
                />
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
                  className="input"
                  required
                />
              </div>

              {error && <p className="text-sm text-danger-500">{error}</p>}

              <button type="submit" className="btn-primary w-full">
                Continuar
              </button>
            </form>
          )}

          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label htmlFor="phone" className="label mb-1 block">
                  Teléfono
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+54 11 1234-5678"
                  className="input"
                  required
                  autoFocus
                />
              </div>

              {error && <p className="text-sm text-danger-500">{error}</p>}

              <button
                type="submit"
                disabled={isLoading || !formData.phone}
                className="btn-primary w-full"
              >
                {isLoading ? 'Enviando...' : 'Enviar código'}
              </button>

              <button
                type="button"
                onClick={() => setStep('info')}
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
              </div>

              {error && <p className="text-sm text-danger-500">{error}</p>}

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
                  setError('');
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

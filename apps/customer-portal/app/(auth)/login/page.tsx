'use client';

/**
 * Login Page
 * ==========
 *
 * Customer login with magic link or OTP options.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Phone, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { useGuestOnly } from '@/lib/customer-auth';

type LoginMethod = 'email' | 'phone';

export default function LoginPage() {
  useGuestOnly();

  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('org') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '';

  const [method, setMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await customerApi.requestMagicLink(email, orgId);

    setIsLoading(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error?.message || 'Error al enviar el enlace');
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await customerApi.requestOTP(phone, orgId);

    setIsLoading(false);

    if (result.success) {
      router.push(`/verify?method=otp&phone=${encodeURIComponent(phone)}&org=${orgId}`);
    } else {
      setError(result.error?.message || 'Error al enviar el código');
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              ¡Revisa tu email!
            </h1>
            <p className="text-gray-600 mb-6">
              Te enviamos un enlace de acceso a <strong>{email}</strong>.
              Hacé clic en el enlace para ingresar.
            </p>
            <p className="text-sm text-gray-500">
              El enlace expira en 15 minutos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Portal de Clientes
          </h1>
          <p className="mt-2 text-gray-600">
            Ingresá para ver tus trabajos, facturas y más
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Method Tabs */}
          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => setMethod('email')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                method === 'email'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            <button
              type="button"
              onClick={() => setMethod('phone')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                method === 'phone'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Phone className="w-4 h-4" />
              Teléfono
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Email Form */}
          {method === 'email' && (
            <form onSubmit={handleEmailSubmit}>
              <div className="mb-4">
                <label htmlFor="email" className="label">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="input"
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="btn-primary w-full"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Enviar enlace de acceso
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>

              <p className="mt-4 text-sm text-gray-500 text-center">
                Te enviaremos un enlace para ingresar sin contraseña
              </p>
            </form>
          )}

          {/* Phone Form */}
          {method === 'phone' && (
            <form onSubmit={handlePhoneSubmit}>
              <div className="mb-4">
                <label htmlFor="phone" className="label">
                  Número de teléfono
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="11 1234-5678"
                  required
                  className="input"
                  autoComplete="tel"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !phone}
                className="btn-primary w-full"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Enviar código
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>

              <p className="mt-4 text-sm text-gray-500 text-center">
                Te enviaremos un código de 6 dígitos por SMS
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

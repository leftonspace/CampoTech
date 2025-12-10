'use client';

/**
 * Verification Page
 * =================
 *
 * Handles magic link verification and OTP entry.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { useCustomerAuth, useGuestOnly } from '@/lib/customer-auth';

export default function VerifyPage() {
  useGuestOnly();

  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useCustomerAuth();

  const method = searchParams.get('method');
  const token = searchParams.get('token');
  const phone = searchParams.get('phone');
  const orgId = searchParams.get('org') || '';

  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');

  // Handle magic link verification
  useEffect(() => {
    if (token && method !== 'otp') {
      verifyMagicLink();
    }
  }, [token]);

  const verifyMagicLink = async () => {
    if (!token) return;

    setIsLoading(true);
    const result = await customerApi.verifyMagicLink(token);
    setIsLoading(false);

    if (result.success && result.data) {
      setVerificationStatus('success');
      login(
        result.data.tokens.accessToken,
        result.data.tokens.refreshToken,
        result.data.customer
      );
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } else {
      setVerificationStatus('error');
      setError(result.error?.message || 'Error al verificar el enlace');
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !orgId) return;

    setError('');
    setIsLoading(true);

    const result = await customerApi.verifyOTP(phone, otp, orgId);

    setIsLoading(false);

    if (result.success && result.data) {
      setVerificationStatus('success');
      login(
        result.data.tokens.accessToken,
        result.data.tokens.refreshToken,
        result.data.customer
      );
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } else {
      setError(result.error?.message || 'Código incorrecto');
    }
  };

  // Magic link verification states
  if (token && method !== 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            {isLoading && (
              <>
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary-600 mb-4" />
                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                  Verificando enlace...
                </h1>
                <p className="text-gray-600">
                  Espera un momento mientras validamos tu acceso.
                </p>
              </>
            )}

            {verificationStatus === 'success' && (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                  ¡Acceso verificado!
                </h1>
                <p className="text-gray-600">
                  Redirigiendo a tu portal...
                </p>
              </>
            )}

            {verificationStatus === 'error' && (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                  Error de verificación
                </h1>
                <p className="text-gray-600 mb-6">{error}</p>
                <button
                  onClick={() => router.push('/login')}
                  className="btn-primary"
                >
                  Volver al inicio
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // OTP verification
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <button
            onClick={() => router.push('/login')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </button>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Ingresá el código
          </h1>
          <p className="text-gray-600 mb-6">
            Enviamos un código de 6 dígitos a {phone}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {verificationStatus === 'success' ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-600">Redirigiendo a tu portal...</p>
            </div>
          ) : (
            <form onSubmit={handleOTPSubmit}>
              <div className="mb-6">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="input text-center text-2xl tracking-widest font-mono"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="btn-primary w-full"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Verificar código'
                )}
              </button>

              <p className="mt-4 text-sm text-gray-500 text-center">
                ¿No recibiste el código?{' '}
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="text-primary-600 hover:text-primary-700"
                >
                  Reenviar
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

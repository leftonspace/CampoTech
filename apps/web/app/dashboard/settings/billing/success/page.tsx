'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, ArrowRight, Sparkles, PartyPopper } from 'lucide-react';

/**
 * Payment Success Page
 * ====================
 *
 * Shown after successful subscription payment.
 * Displays confirmation and next steps.
 */

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const [paymentInfo, setPaymentInfo] = useState<{
    collectionId?: string;
    externalReference?: string;
    paymentType?: string;
    status?: string;
  }>({});

  useEffect(() => {
    // Extract payment info from URL params (set by MercadoPago redirect)
    setPaymentInfo({
      collectionId: searchParams.get('collection_id') || undefined,
      externalReference: searchParams.get('external_reference') || undefined,
      paymentType: searchParams.get('payment_type') || undefined,
      status: searchParams.get('collection_status') || undefined,
    });
  }, [searchParams]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-lg w-full text-center p-8">
        {/* Success Icon */}
        <div className="relative mx-auto w-20 h-20 mb-6">
          <div className="absolute inset-0 bg-success-100 rounded-full animate-ping opacity-50" />
          <div className="relative bg-success-100 rounded-full w-20 h-20 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-success-600" />
          </div>
          <PartyPopper className="absolute -top-2 -right-2 h-8 w-8 text-amber-500" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ¡Pago exitoso!
        </h1>

        <p className="text-gray-600 mb-6">
          Tu suscripción ha sido activada correctamente. Ya podes disfrutar de
          todas las funcionalidades de tu nuevo plan.
        </p>

        {/* Payment Details */}
        {paymentInfo.collectionId && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Detalles del pago
            </h3>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">ID de pago:</dt>
                <dd className="font-mono text-gray-900">{paymentInfo.collectionId}</dd>
              </div>
              {paymentInfo.paymentType && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Método:</dt>
                  <dd className="text-gray-900">{paymentInfo.paymentType}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-primary-50 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary-600" />
            <h3 className="font-medium text-primary-900">Próximos pasos</h3>
          </div>
          <ul className="space-y-2 text-sm text-primary-800">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-200 text-primary-700 text-xs flex items-center justify-center font-medium">
                1
              </span>
              Completá la verificación de tu negocio
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-200 text-primary-700 text-xs flex items-center justify-center font-medium">
                2
              </span>
              Invitá a tu equipo
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-200 text-primary-700 text-xs flex items-center justify-center font-medium">
                3
              </span>
              Explorá las nuevas funcionalidades
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Ir al Panel
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/settings/billing"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Ver mi suscripción
          </Link>
        </div>

        {/* Receipt Notice */}
        <p className="text-xs text-gray-500 mt-6">
          Recibirás un comprobante de pago en tu email registrado.
          Si tenés alguna consulta, contactanos a{' '}
          <a href="mailto:soporte@campotech.com" className="text-primary-600 hover:underline">
            soporte@campotech.com
          </a>
        </p>
      </div>
    </div>
  );
}

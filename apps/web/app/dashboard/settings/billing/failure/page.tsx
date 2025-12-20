'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, RefreshCw, HelpCircle, MessageCircle } from 'lucide-react';

/**
 * Payment Failure Page
 * ====================
 *
 * Shown after failed or rejected payment.
 * Provides retry options and troubleshooting guidance.
 */

// Common rejection reasons and their user-friendly messages
const REJECTION_MESSAGES: Record<string, { title: string; description: string; action: string }> = {
  cc_rejected_insufficient_amount: {
    title: 'Fondos insuficientes',
    description: 'Tu tarjeta no tiene fondos suficientes para completar el pago.',
    action: 'Probá con otra tarjeta o método de pago.',
  },
  cc_rejected_bad_filled_card_number: {
    title: 'Número de tarjeta incorrecto',
    description: 'El número de tarjeta ingresado no es válido.',
    action: 'Verificá el número e intentá de nuevo.',
  },
  cc_rejected_bad_filled_date: {
    title: 'Fecha de vencimiento incorrecta',
    description: 'La fecha de vencimiento ingresada no es válida.',
    action: 'Verificá la fecha de vencimiento de tu tarjeta.',
  },
  cc_rejected_bad_filled_security_code: {
    title: 'Código de seguridad incorrecto',
    description: 'El código de seguridad (CVV) ingresado no es válido.',
    action: 'Verificá el código de seguridad (3 o 4 dígitos en tu tarjeta).',
  },
  cc_rejected_call_for_authorize: {
    title: 'Autorización requerida',
    description: 'Tu banco requiere que autorices esta compra.',
    action: 'Llamá a tu banco para autorizar el pago y volvé a intentar.',
  },
  cc_rejected_card_disabled: {
    title: 'Tarjeta deshabilitada',
    description: 'Tu tarjeta está deshabilitada para compras online.',
    action: 'Contactá a tu banco para habilitar compras online.',
  },
  cc_rejected_duplicated_payment: {
    title: 'Pago duplicado',
    description: 'Ya se procesó un pago similar recientemente.',
    action: 'Verificá tu email para confirmar si el pago anterior fue exitoso.',
  },
  cc_rejected_high_risk: {
    title: 'Pago rechazado por seguridad',
    description: 'El pago fue rechazado por medidas de seguridad.',
    action: 'Probá con otro método de pago o contactá soporte.',
  },
  cc_rejected_max_attempts: {
    title: 'Demasiados intentos',
    description: 'Excediste el número de intentos permitidos.',
    action: 'Esperá unos minutos e intentá con otra tarjeta.',
  },
  rejected_by_bank: {
    title: 'Rechazado por el banco',
    description: 'Tu banco rechazó la transacción.',
    action: 'Contactá a tu banco para más información.',
  },
  default: {
    title: 'Pago no procesado',
    description: 'No pudimos procesar tu pago en este momento.',
    action: 'Intentá de nuevo o probá con otro método de pago.',
  },
};

export default function PaymentFailurePage() {
  const searchParams = useSearchParams();
  const [paymentInfo, setPaymentInfo] = useState<{
    collectionId?: string;
    externalReference?: string;
    status?: string;
    statusDetail?: string;
  }>({});

  useEffect(() => {
    setPaymentInfo({
      collectionId: searchParams.get('collection_id') || undefined,
      externalReference: searchParams.get('external_reference') || undefined,
      status: searchParams.get('collection_status') || undefined,
      statusDetail: searchParams.get('status_detail') || undefined,
    });
  }, [searchParams]);

  // Get rejection message based on status detail
  const rejectionInfo = paymentInfo.statusDetail
    ? REJECTION_MESSAGES[paymentInfo.statusDetail] || REJECTION_MESSAGES.default
    : REJECTION_MESSAGES.default;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-lg w-full text-center p-8">
        {/* Failure Icon */}
        <div className="mx-auto w-20 h-20 mb-6 bg-danger-100 rounded-full flex items-center justify-center">
          <XCircle className="h-10 w-10 text-danger-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {rejectionInfo.title}
        </h1>

        <p className="text-gray-600 mb-2">
          {rejectionInfo.description}
        </p>

        <p className="text-sm text-primary-600 font-medium mb-6">
          {rejectionInfo.action}
        </p>

        {/* Error Details (collapsible) */}
        {paymentInfo.statusDetail && (
          <details className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
              Ver detalles técnicos
            </summary>
            <dl className="mt-2 space-y-1 text-sm">
              {paymentInfo.collectionId && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">ID de transacción:</dt>
                  <dd className="font-mono text-gray-900">{paymentInfo.collectionId}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Código de error:</dt>
                <dd className="font-mono text-gray-900">{paymentInfo.statusDetail}</dd>
              </div>
            </dl>
          </details>
        )}

        {/* Troubleshooting Tips */}
        <div className="bg-amber-50 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="h-5 w-5 text-amber-600" />
            <h3 className="font-medium text-amber-900">Sugerencias</h3>
          </div>
          <ul className="space-y-2 text-sm text-amber-800">
            <li>• Verificá que los datos de tu tarjeta sean correctos</li>
            <li>• Asegurate de tener fondos suficientes</li>
            <li>• Probá con otra tarjeta o método de pago</li>
            <li>• Si el problema persiste, contactá a tu banco</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/settings/billing"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Intentar de nuevo
          </Link>
          <a
            href="mailto:soporte@campotech.com?subject=Problema%20con%20pago"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Contactar soporte
          </a>
        </div>

        {/* Alternative Payment */}
        <p className="text-sm text-gray-500 mt-6">
          También podes pagar por transferencia bancaria.{' '}
          <Link href="/dashboard/settings/billing" className="text-primary-600 hover:underline">
            Ver opciones de pago
          </Link>
        </p>
      </div>
    </div>
  );
}

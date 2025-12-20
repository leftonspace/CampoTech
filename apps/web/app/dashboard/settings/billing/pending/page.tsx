'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, Copy, CheckCircle, MapPin, Building2, ArrowRight } from 'lucide-react';

/**
 * Payment Pending Page
 * ====================
 *
 * Shown for pending payments (cash/transfer).
 * Provides payment instructions and tracking info.
 */

export default function PaymentPendingPage() {
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{
    collectionId?: string;
    externalReference?: string;
    paymentType?: string;
  }>({});

  useEffect(() => {
    setPaymentInfo({
      collectionId: searchParams.get('collection_id') || undefined,
      externalReference: searchParams.get('external_reference') || undefined,
      paymentType: searchParams.get('payment_type') || undefined,
    });
  }, [searchParams]);

  const isCashPayment = paymentInfo.paymentType === 'ticket';
  const isTransfer = paymentInfo.paymentType === 'bank_transfer';

  const handleCopyCode = () => {
    if (paymentInfo.collectionId) {
      navigator.clipboard.writeText(paymentInfo.collectionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-lg w-full text-center p-8">
        {/* Pending Icon */}
        <div className="mx-auto w-20 h-20 mb-6 bg-amber-100 rounded-full flex items-center justify-center">
          <Clock className="h-10 w-10 text-amber-600 animate-pulse" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Pago pendiente
        </h1>

        <p className="text-gray-600 mb-6">
          {isCashPayment
            ? 'Tu pago está pendiente. Tenés hasta 3 días para completarlo.'
            : isTransfer
            ? 'Estamos esperando la confirmación de tu transferencia.'
            : 'Tu pago está siendo procesado.'}
        </p>

        {/* Payment Code */}
        {paymentInfo.collectionId && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-2">
              {isCashPayment ? 'Código de pago' : 'ID de transacción'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-xl font-bold text-gray-900">
                {paymentInfo.collectionId}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2 hover:bg-gray-200 rounded transition-colors"
                title="Copiar código"
              >
                {copied ? (
                  <CheckCircle className="h-5 w-5 text-success-500" />
                ) : (
                  <Copy className="h-5 w-5 text-gray-500" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Cash Payment Instructions */}
        {isCashPayment && (
          <div className="bg-amber-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-medium text-amber-900 mb-3 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Instrucciones para pagar
            </h3>
            <ol className="space-y-3 text-sm text-amber-800">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-medium text-xs flex-shrink-0">
                  1
                </span>
                <span>
                  Acercate a cualquier sucursal de <strong>Pago Fácil</strong> o{' '}
                  <strong>Rapipago</strong>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-medium text-xs flex-shrink-0">
                  2
                </span>
                <span>
                  Indicá que querés pagar a <strong>Mercado Pago</strong>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-medium text-xs flex-shrink-0">
                  3
                </span>
                <span>
                  Proporcioná el código de pago: <strong className="font-mono">{paymentInfo.collectionId}</strong>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-medium text-xs flex-shrink-0">
                  4
                </span>
                <span>
                  Realizá el pago y guardá el comprobante
                </span>
              </li>
            </ol>

            <div className="mt-4 pt-4 border-t border-amber-200">
              <a
                href="https://www.google.com/maps/search/pago+facil+o+rapipago"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-900 text-sm font-medium"
              >
                <MapPin className="h-4 w-4" />
                Encontrar sucursal cercana
              </a>
            </div>
          </div>
        )}

        {/* Transfer Instructions */}
        {isTransfer && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-medium text-blue-900 mb-3">
              Confirmación de transferencia
            </h3>
            <p className="text-sm text-blue-800 mb-2">
              Tu transferencia está siendo procesada. El tiempo de acreditación
              puede variar según tu banco.
            </p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Transferencias inmediatas: hasta 2 horas</li>
              <li>• Transferencias normales: hasta 48 horas hábiles</li>
            </ul>
          </div>
        )}

        {/* Status Updates */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-medium text-gray-900 mb-2">Te notificaremos</h3>
          <p className="text-sm text-gray-600">
            Cuando tu pago sea confirmado, recibirás un email y tu suscripción
            se activará automáticamente.
          </p>
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
            Ver estado del pago
          </Link>
        </div>

        {/* Support Notice */}
        <p className="text-xs text-gray-500 mt-6">
          Si ya realizaste el pago y no se refleja después de 48 horas,
          contactanos a{' '}
          <a href="mailto:soporte@campotech.com" className="text-primary-600 hover:underline">
            soporte@campotech.com
          </a>
        </p>
      </div>
    </div>
  );
}

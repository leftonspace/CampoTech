'use client';

/**
 * Direct Payment Page
 * ===================
 *
 * Allows customers to pay a specific invoice directly.
 * Supports multiple payment methods including MercadoPago.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CreditCard,
  Wallet,
  Building2,
  QrCode,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Clock,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { customerApi, Invoice } from '@/lib/customer-api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

type PaymentMethod = 'mercadopago' | 'card' | 'transfer' | 'qr';

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description: string;
  icon: any;
  available: boolean;
  processingTime: string;
}

const paymentMethods: PaymentMethodOption[] = [
  {
    id: 'mercadopago',
    name: 'MercadoPago',
    description: 'Pagar con tu cuenta o tarjeta',
    icon: Wallet,
    available: true,
    processingTime: 'Inmediato',
  },
  {
    id: 'card',
    name: 'Tarjeta de crédito/débito',
    description: 'Visa, Mastercard, American Express',
    icon: CreditCard,
    available: true,
    processingTime: 'Inmediato',
  },
  {
    id: 'transfer',
    name: 'Transferencia bancaria',
    description: 'Transferencia o depósito',
    icon: Building2,
    available: true,
    processingTime: '1-2 días hábiles',
  },
  {
    id: 'qr',
    name: 'QR / DEBIN',
    description: 'Escanear desde tu app bancaria',
    icon: QrCode,
    available: true,
    processingTime: 'Inmediato',
  },
];

export default function DirectPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = params.invoiceId as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'error'>('pending');

  // Check for return from payment gateway
  useEffect(() => {
    const status = searchParams.get('status');
    const paymentId = searchParams.get('payment_id');

    if (status === 'approved' && paymentId) {
      setPaymentStatus('success');
    } else if (status === 'failure' || status === 'rejected') {
      setPaymentStatus('error');
      setError('El pago no pudo ser procesado. Por favor, intentá nuevamente.');
    }
  }, [searchParams]);

  // Load invoice details
  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    setIsLoading(true);
    setError('');

    const result = await customerApi.getInvoice(invoiceId);

    if (result.success && result.data) {
      setInvoice(result.data);

      // Check if already paid
      if (result.data.status === 'PAID') {
        setPaymentStatus('success');
      }
    } else {
      setError(result.error?.message || 'Error al cargar la factura');
    }
    setIsLoading(false);
  };

  const handlePayment = async () => {
    if (!selectedMethod || !invoice) return;

    setIsProcessing(true);
    setError('');

    const returnUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/payments/pay/${invoiceId}`
      : undefined;

    const result = await customerApi.initiatePayment(invoiceId, selectedMethod, returnUrl);

    if (result.success && result.data) {
      if (result.data.redirectUrl) {
        // Redirect to payment gateway
        window.location.href = result.data.redirectUrl;
      } else {
        // Payment completed inline (e.g., transfer instructions)
        setPaymentStatus('success');
      }
    } else {
      setError(result.error?.message || 'Error al procesar el pago');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // Success state
  if (paymentStatus === 'success') {
    return (
      <div className="max-w-md mx-auto text-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Pago exitoso!
          </h1>
          <p className="text-gray-600 mb-6">
            Tu pago ha sido procesado correctamente. Recibirás una confirmación por email.
          </p>
          {invoice && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Factura</span>
                <span className="font-medium text-gray-900">
                  #{invoice.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-500">Monto</span>
                <span className="font-bold text-primary-600">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
            </div>
          )}
          <div className="space-y-3">
            <Link href="/invoices" className="btn-primary w-full block text-center">
              Ver mis facturas
            </Link>
            <Link href="/dashboard" className="btn-outline w-full block text-center">
              Ir al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-md mx-auto text-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Factura no encontrada
          </h1>
          <p className="text-gray-600 mb-6">
            {error || 'No pudimos encontrar la factura solicitada.'}
          </p>
          <Link href="/invoices" className="btn-primary">
            Ver mis facturas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Pagar factura</h1>
        <p className="text-gray-600">Seleccioná un método de pago</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-5 gap-6">
        {/* Payment methods */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Método de pago</h2>
            </div>
            <div className="p-4 space-y-3">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  disabled={!method.available || isProcessing}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 text-left transition-colors',
                    selectedMethod === method.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300',
                    !method.available && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center',
                        selectedMethod === method.id
                          ? 'bg-primary-100'
                          : 'bg-gray-100'
                      )}
                    >
                      <method.icon
                        className={cn(
                          'w-6 h-6',
                          selectedMethod === method.id
                            ? 'text-primary-600'
                            : 'text-gray-500'
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{method.name}</p>
                      <p className="text-sm text-gray-500">{method.description}</p>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                          selectedMethod === method.id
                            ? 'border-primary-500 bg-primary-500'
                            : 'border-gray-300'
                        )}
                      >
                        {selectedMethod === method.id && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-400 ml-16">
                    <Clock className="w-3 h-3" />
                    <span>{method.processingTime}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Security note */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <Shield className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-700">Pago seguro</p>
              <p>
                Tus datos están protegidos con encriptación SSL. No almacenamos
                información de tarjetas.
              </p>
            </div>
          </div>
        </div>

        {/* Invoice summary */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-4">
            <h2 className="font-semibold text-gray-900 mb-4">Resumen</h2>

            {/* Invoice details */}
            <div className="space-y-3 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    Factura #{invoice.invoiceNumber}
                  </p>
                  <p className="text-sm text-gray-500">
                    {invoice.invoiceType === 'A' ? 'Factura A' : 'Factura B'}
                  </p>
                </div>
              </div>

              {invoice.issuedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Fecha</span>
                  <span className="text-gray-700">
                    {formatDate(invoice.issuedAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}

              {invoice.dueDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Vencimiento</span>
                  <span className={cn(
                    'font-medium',
                    new Date(invoice.dueDate) < new Date() ? 'text-red-600' : 'text-gray-700'
                  )}>
                    {formatDate(invoice.dueDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="py-4 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total a pagar</span>
                <span className="text-2xl font-bold text-primary-600">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
            </div>

            {/* Pay button */}
            <div className="pt-4 space-y-3">
              <button
                onClick={handlePayment}
                disabled={!selectedMethod || isProcessing}
                className={cn(
                  'w-full btn-primary flex items-center justify-center gap-2',
                  (!selectedMethod || isProcessing) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    Pagar {formatCurrency(invoice.total)}
                    <ExternalLink className="w-4 h-4" />
                  </>
                )}
              </button>

              <Link
                href={`/invoices/${invoiceId}`}
                className="w-full btn-outline block text-center"
              >
                Ver detalle de factura
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

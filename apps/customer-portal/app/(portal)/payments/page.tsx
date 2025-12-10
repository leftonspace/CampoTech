'use client';

/**
 * Payments Page
 * =============
 *
 * Payment initiation page for invoices. Supports MercadoPago, transfer, and cash.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CreditCard,
  Building2,
  Banknote,
  Loader2,
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  Clock,
  FileText,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { formatCurrency, cn } from '@/lib/utils';

type PaymentMethod = 'mercadopago' | 'transfer' | 'cash';

const paymentMethods = [
  {
    id: 'mercadopago' as PaymentMethod,
    name: 'MercadoPago',
    description: 'Tarjeta de crédito/débito, QR',
    icon: CreditCard,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    id: 'transfer' as PaymentMethod,
    name: 'Transferencia',
    description: 'Transferencia bancaria',
    icon: Building2,
    color: 'bg-purple-50 text-purple-600',
  },
  {
    id: 'cash' as PaymentMethod,
    name: 'Efectivo',
    description: 'Pago al técnico',
    icon: Banknote,
    color: 'bg-green-50 text-green-600',
  },
];

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const invoiceId = searchParams.get('invoice');

  const [invoice, setInvoice] = useState<any>(null);
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<string>(invoiceId || '');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [transferInfo, setTransferInfo] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, [invoiceId]);

  const loadData = async () => {
    setIsLoading(true);

    // Load specific invoice if provided
    if (invoiceId) {
      const result = await customerApi.getInvoice(invoiceId);
      if (result.success && result.data) {
        setInvoice(result.data.invoice);
        setSelectedInvoice(invoiceId);
      }
    }

    // Load pending invoices
    const pendingResult = await customerApi.getInvoices({
      status: 'pending',
      limit: 20,
    });
    if (pendingResult.success && pendingResult.data) {
      setPendingInvoices(pendingResult.data.invoices || []);
    }

    setIsLoading(false);
  };

  const handlePayment = async () => {
    if (!selectedInvoice || !selectedMethod) return;

    setIsProcessing(true);
    setError('');

    const result = await customerApi.initiatePayment(selectedInvoice, selectedMethod);

    if (result.success && result.data) {
      if (selectedMethod === 'mercadopago' && result.data.paymentUrl) {
        setPaymentUrl(result.data.paymentUrl);
        // Redirect to MercadoPago
        window.location.href = result.data.paymentUrl;
      } else if (selectedMethod === 'transfer' && result.data.transferInfo) {
        setTransferInfo(result.data.transferInfo);
      } else if (selectedMethod === 'cash') {
        // Show confirmation
        router.push(`/payments/pending?invoice=${selectedInvoice}&method=cash`);
      }
    } else {
      setError(result.error?.message || 'Error al procesar el pago');
    }

    setIsProcessing(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentInvoice = invoice || pendingInvoices.find((i) => i.id === selectedInvoice);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // Show transfer info if provided
  if (transferInfo) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Datos para transferencia
            </h1>
            <p className="text-gray-600 mt-1">
              Realizá la transferencia con los siguientes datos
            </p>
          </div>

          <div className="space-y-4 bg-gray-50 rounded-lg p-4">
            <TransferField
              label="CBU"
              value={transferInfo.cbu}
              onCopy={() => copyToClipboard(transferInfo.cbu)}
            />
            <TransferField
              label="Alias"
              value={transferInfo.alias}
              onCopy={() => copyToClipboard(transferInfo.alias)}
            />
            <TransferField
              label="Banco"
              value={transferInfo.bank}
            />
            <TransferField
              label="Titular"
              value={transferInfo.accountHolder}
            />
            <TransferField
              label="CUIT"
              value={transferInfo.cuit}
            />
            <div className="pt-3 border-t border-gray-200">
              <TransferField
                label="Monto a transferir"
                value={formatCurrency(currentInvoice?.pendingAmount || currentInvoice?.total)}
                highlight
              />
              <TransferField
                label="Referencia"
                value={transferInfo.reference || currentInvoice?.invoiceNumber}
                onCopy={() =>
                  copyToClipboard(transferInfo.reference || currentInvoice?.invoiceNumber)
                }
              />
            </div>
          </div>

          {copied && (
            <p className="text-sm text-green-600 text-center mt-2">
              ¡Copiado al portapapeles!
            </p>
          )}

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Importante</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-700">
                  <li>Incluí la referencia en el concepto</li>
                  <li>El pago se acreditará en 24-48hs hábiles</li>
                  <li>Enviá el comprobante por WhatsApp para agilizar</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Link href="/invoices" className="btn-primary w-full">
              Volver a facturas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
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
        <p className="text-gray-600">Seleccioná la factura y método de pago</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Invoice selection */}
        {!invoiceId && pendingInvoices.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Seleccioná una factura
            </label>
            <div className="space-y-2">
              {pendingInvoices.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv.id)}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 text-left transition-colors',
                    selectedInvoice === inv.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        Factura #{inv.invoiceNumber}
                      </p>
                      <p className="text-sm text-gray-500">
                        {inv.jobServiceType || 'Servicio'}
                      </p>
                    </div>
                    <p className="font-bold text-gray-900">
                      {formatCurrency(inv.pendingAmount || inv.total)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected invoice summary */}
        {currentInvoice && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  Factura #{currentInvoice.invoiceNumber}
                </p>
                <p className="text-sm text-gray-500">
                  {currentInvoice.jobServiceType || 'Servicio'}
                </p>
              </div>
              <p className="font-bold text-xl text-gray-900">
                {formatCurrency(currentInvoice.pendingAmount || currentInvoice.total)}
              </p>
            </div>
          </div>
        )}

        {/* Payment method selection */}
        {selectedInvoice && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Método de pago
            </label>
            <div className="space-y-2">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 text-left transition-colors flex items-center gap-4',
                    selectedMethod === method.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div
                    className={cn(
                      'w-12 h-12 rounded-lg flex items-center justify-center',
                      method.color
                    )}
                  >
                    <method.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{method.name}</p>
                    <p className="text-sm text-gray-500">{method.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pay button */}
        {selectedInvoice && selectedMethod && (
          <button
            onClick={handlePayment}
            disabled={isProcessing}
            className="btn-primary w-full"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : selectedMethod === 'mercadopago' ? (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Ir a MercadoPago
              </>
            ) : selectedMethod === 'transfer' ? (
              'Ver datos de transferencia'
            ) : (
              'Confirmar pago en efectivo'
            )}
          </button>
        )}

        {/* No pending invoices */}
        {!invoiceId && pendingInvoices.length === 0 && (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              No tenés facturas pendientes de pago
            </p>
            <Link href="/invoices" className="text-primary-600 hover:text-primary-700">
              Ver todas las facturas
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function TransferField({
  label,
  value,
  onCopy,
  highlight,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p
          className={cn(
            'font-medium',
            highlight ? 'text-lg text-primary-700' : 'text-gray-900'
          )}
        >
          {value}
        </p>
      </div>
      {onCopy && (
        <button
          onClick={onCopy}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          title="Copiar"
        >
          <Copy className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

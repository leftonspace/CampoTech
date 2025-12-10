'use client';

/**
 * Invoice Detail Page
 * ===================
 *
 * Shows detailed invoice information with download and payment options.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  CreditCard,
  Printer,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInvoice();
  }, [params.id]);

  const loadInvoice = async () => {
    setIsLoading(true);
    const result = await customerApi.getInvoice(params.id as string);

    if (result.success && result.data) {
      setInvoice(result.data.invoice);
    } else {
      setError(result.error?.message || 'Error al cargar la factura');
    }
    setIsLoading(false);
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    const result = await customerApi.downloadInvoicePdf(params.id as string);

    if (result.success && result.data?.url) {
      window.open(result.data.url, '_blank');
    } else {
      setError('Error al descargar el PDF');
    }
    setIsDownloading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600 mb-4">{error || 'Factura no encontrada'}</p>
        <button onClick={() => router.push('/invoices')} className="btn-primary">
          Volver a facturas
        </button>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid';
  const isOverdue =
    invoice.status === 'overdue' ||
    (invoice.dueDate && new Date(invoice.dueDate) < new Date() && !isPaid);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/invoices')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Factura #{invoice.invoiceNumber}
            </h1>
            <p className="text-gray-500">
              Emitida el {formatDate(invoice.issueDate)}
            </p>
          </div>
          <span
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium',
              isPaid
                ? 'bg-green-100 text-green-700'
                : isOverdue
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
            )}
          >
            {isPaid ? (
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Pagada
              </span>
            ) : isOverdue ? (
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Vencida
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Pendiente
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Invoice card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        {/* Header info */}
        <div className="p-6 border-b border-gray-200">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Facturado a</p>
              <p className="font-medium text-gray-900">{invoice.customerName}</p>
              {invoice.customerEmail && (
                <p className="text-sm text-gray-600">{invoice.customerEmail}</p>
              )}
              {invoice.customerAddress && (
                <p className="text-sm text-gray-600">{invoice.customerAddress}</p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-gray-500 mb-1">De</p>
              <p className="font-medium text-gray-900">{invoice.orgName}</p>
              {invoice.orgAddress && (
                <p className="text-sm text-gray-600">{invoice.orgAddress}</p>
              )}
              {invoice.orgCuit && (
                <p className="text-sm text-gray-600">CUIT: {invoice.orgCuit}</p>
              )}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="px-6 py-4 bg-gray-50 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-gray-500">Fecha de emisión:</span>{' '}
            <span className="font-medium text-gray-900">
              {formatDate(invoice.issueDate)}
            </span>
          </div>
          {invoice.dueDate && (
            <div>
              <span className="text-gray-500">Fecha de vencimiento:</span>{' '}
              <span
                className={cn(
                  'font-medium',
                  isOverdue ? 'text-red-600' : 'text-gray-900'
                )}
              >
                {formatDate(invoice.dueDate)}
              </span>
            </div>
          )}
          {invoice.jobNumber && (
            <div>
              <span className="text-gray-500">Trabajo:</span>{' '}
              <Link
                href={`/jobs/${invoice.jobId}`}
                className="font-medium text-primary-600 hover:text-primary-700"
              >
                #{invoice.jobNumber}
              </Link>
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="p-6">
          <table className="w-full">
            <thead>
              <tr className="text-sm text-gray-500 border-b border-gray-200">
                <th className="text-left py-2 font-medium">Descripción</th>
                <th className="text-right py-2 font-medium w-20">Cant.</th>
                <th className="text-right py-2 font-medium w-28">Precio</th>
                <th className="text-right py-2 font-medium w-28">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.lineItems?.map((item: any, index: number) => (
                <tr key={index}>
                  <td className="py-3 text-gray-900">{item.description}</td>
                  <td className="py-3 text-right text-gray-600">
                    {item.quantity}
                  </td>
                  <td className="py-3 text-right text-gray-600">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="py-3 text-right font-medium text-gray-900">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-col gap-2 max-w-xs ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900">
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>
            {invoice.taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  IVA ({invoice.taxRate || 21}%)
                </span>
                <span className="text-gray-900">
                  {formatCurrency(invoice.taxAmount)}
                </span>
              </div>
            )}
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Descuento</span>
                <span className="text-green-600">
                  -{formatCurrency(invoice.discountAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-xl text-gray-900">
                {formatCurrency(invoice.total)}
              </span>
            </div>
            {!isPaid && invoice.paidAmount > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pagado</span>
                  <span className="text-green-600">
                    -{formatCurrency(invoice.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-900">Pendiente</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(invoice.pendingAmount || invoice.total - invoice.paidAmount)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Payment info */}
        {isPaid && invoice.paidAt && (
          <div className="px-6 py-4 border-t border-gray-200 bg-green-50">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span>
                Pagada el {formatDate(invoice.paidAt)} via{' '}
                {invoice.paymentMethod || 'transferencia'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {!isPaid && (
          <Link
            href={`/payments?invoice=${invoice.id}`}
            className="btn-primary flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Pagar ahora
          </Link>
        )}
        <button
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className="btn-secondary flex items-center gap-2"
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Descargar PDF
        </button>
        <button
          onClick={() => window.print()}
          className="btn-outline flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </button>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500 mb-1">Notas</p>
          <p className="text-gray-700">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}

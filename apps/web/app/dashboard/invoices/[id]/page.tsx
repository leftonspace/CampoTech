'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import {
  cn,
  formatCurrency,
  formatDate,
  formatCUIT,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  IVA_CONDITION_LABELS,
} from '@/lib/utils';
import {
  ArrowLeft,
  Download,
  Send,
  XCircle,
  FileText,
  Building,
  User,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  QrCode,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle,
  Printer,
  Share2,
} from 'lucide-react';
import { Invoice, Customer } from '@/types';

// Helper to format address object to string
function formatAddress(address: unknown): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    const addr = address as Record<string, unknown>;
    const parts = [
      addr.street,
      addr.number,
      addr.floor && `Piso ${addr.floor}`,
      addr.apartment && `Depto ${addr.apartment}`,
      addr.city,
      addr.postalCode,
    ].filter(Boolean);
    return parts.join(', ') || '';
  }
  return '';
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const invoiceId = params.id as string;

  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => api.invoices.get(invoiceId),
  });

  const sendMutation = useMutation({
    mutationFn: () => api.invoices.send(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.invoices.cancel(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      setShowCancelModal(false);
    },
  });

  const invoice = data?.data as Invoice | undefined;

  const handleSend = () => {
    if (confirm('¿Enviar factura por WhatsApp al cliente?')) {
      sendMutation.mutate();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/invoices"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Factura no encontrada</h1>
          </div>
        </div>
        <div className="card p-8 text-center">
          <p className="text-gray-500">Esta factura no existe o no tenés acceso.</p>
          <Link href="/dashboard/invoices" className="btn-primary mt-4 inline-flex">
            Volver a facturas
          </Link>
        </div>
      </div>
    );
  }

  const invoiceNumber = invoice.number
    ? `${String(invoice.puntoVenta || 1).padStart(4, '0')}-${String(invoice.number).padStart(8, '0')}`
    : 'Borrador';

  const canSend = invoice.status === 'issued';
  const canCancel = ['draft', 'issued'].includes(invoice.status);
  const isCAEPending = invoice.status === 'pending_cae';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/invoices"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Factura {invoice.invoiceType} {invoiceNumber}
            </h1>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                INVOICE_STATUS_COLORS[invoice.status]
              )}
            >
              {INVOICE_STATUS_LABELS[invoice.status]}
            </span>
          </div>
          <p className="text-gray-500">#{invoice.id.slice(0, 8)}</p>
        </div>
        <div className="flex gap-2">
          {invoice.pdfUrl && (
            <a
              href={invoice.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar PDF
            </a>
          )}
          {canSend && (
            <button
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="btn-outline"
            >
              <Send className="mr-2 h-4 w-4" />
              {sendMutation.isPending ? 'Enviando...' : 'Enviar'}
            </button>
          )}
          <button onClick={handlePrint} className="btn-outline">
            <Printer className="h-4 w-4" />
          </button>
          {canCancel && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="btn-outline text-danger-600 hover:bg-danger-50"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Anular
            </button>
          )}
        </div>
      </div>

      {/* CAE pending alert */}
      {isCAEPending && (
        <div className="flex items-center gap-3 rounded-md bg-yellow-50 p-4 text-yellow-700">
          <Clock className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Pendiente de CAE</p>
            <p className="text-sm">Esta factura está en cola de AFIP para obtener el CAE.</p>
          </div>
          <Link href="/dashboard/invoices/queue" className="ml-auto text-sm font-medium hover:underline">
            Ver cola
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice preview */}
          <div className="card overflow-hidden print:shadow-none">
            {/* Invoice header */}
            <div className="border-b bg-gray-50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">Factura {invoice.invoiceType}</h2>
                  <p className="text-gray-600">{invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Fecha de emisión</p>
                  <p className="font-medium">{formatDate(invoice.issueDate)}</p>
                  <p className="mt-2 text-sm text-gray-500">Vencimiento</p>
                  <p className="font-medium">{formatDate(invoice.dueDate)}</p>
                </div>
              </div>
            </div>

            {/* Customer info */}
            <div className="border-b p-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-medium text-gray-500">Cliente</h3>
                  {invoice.customer ? (
                    <div>
                      <p className="font-medium text-gray-900">{invoice.customer.name}</p>
                      {invoice.customer.cuit && (
                        <p className="text-sm text-gray-600">
                          CUIT: {formatCUIT(invoice.customer.cuit)}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">
                        {IVA_CONDITION_LABELS[invoice.customer.ivaCondition] || invoice.customer.ivaCondition}
                      </p>
                      {invoice.customer.address && (
                        <p className="text-sm text-gray-600">{formatAddress(invoice.customer.address)}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">Cliente no disponible</p>
                  )}
                </div>
                {invoice.cae && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-gray-500">Datos fiscales</h3>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="text-gray-500">CAE:</span>{' '}
                        <span className="font-mono font-medium">{invoice.cae}</span>
                      </p>
                      {invoice.caeExpiry && (
                        <p className="text-sm">
                          <span className="text-gray-500">Vto. CAE:</span>{' '}
                          {formatDate(invoice.caeExpiry)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Line items */}
            <div className="p-6">
              <h3 className="mb-4 text-sm font-medium text-gray-500">Detalle</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-gray-500">
                      <th className="pb-2 font-medium">Descripción</th>
                      <th className="pb-2 text-right font-medium">Cant.</th>
                      <th className="pb-2 text-right font-medium">Precio</th>
                      <th className="pb-2 text-right font-medium">IVA</th>
                      <th className="pb-2 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems?.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-3 text-gray-900">{item.description}</td>
                        <td className="py-3 text-right text-gray-600">{item.quantity}</td>
                        <td className="py-3 text-right text-gray-600">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-3 text-right text-gray-600">{item.ivaRate}%</td>
                        <td className="py-3 text-right font-medium text-gray-900">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="border-t bg-gray-50 p-6">
              <div className="flex flex-col items-end gap-2">
                <div className="flex w-48 justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex w-48 justify-between text-sm">
                  <span className="text-gray-500">IVA</span>
                  <span>{formatCurrency(invoice.totalIva)}</span>
                </div>
                <div className="flex w-48 justify-between border-t pt-2 text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </div>
              </div>
            </div>

            {/* QR code */}
            {invoice.qrCode && (
              <div className="border-t p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-white p-2 shadow-sm">
                    <img
                      src={invoice.qrCode}
                      alt="Código QR AFIP"
                      className="h-24 w-24"
                    />
                  </div>
                  <div className="text-sm text-gray-500">
                    <p className="font-medium text-gray-700">Código QR AFIP</p>
                    <p>Escaneá para verificar la factura</p>
                    <a
                      href="https://www.afip.gob.ar/fe/qr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                    >
                      Verificar en AFIP
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="border-t p-6">
                <h3 className="mb-2 text-sm font-medium text-gray-500">Observaciones</h3>
                <p className="text-gray-700">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer card */}
          {invoice.customer && (
            <div className="card p-6">
              <h2 className="mb-4 font-medium text-gray-900">Cliente</h2>
              <div className="space-y-3">
                <Link
                  href={`/dashboard/customers/${invoice.customer.id}`}
                  className="font-medium text-primary-600 hover:underline"
                >
                  {invoice.customer.name}
                </Link>
                {invoice.customer.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${invoice.customer.phone}`} className="hover:underline">
                      {invoice.customer.phone}
                    </a>
                  </div>
                )}
                {invoice.customer.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${invoice.customer.email}`} className="hover:underline">
                      {invoice.customer.email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Related job */}
          {invoice.jobId && (
            <div className="card p-6">
              <h2 className="mb-4 font-medium text-gray-900">Trabajo relacionado</h2>
              <Link
                href={`/dashboard/jobs/${invoice.jobId}`}
                className="flex items-center gap-3 rounded-md border p-3 hover:bg-gray-50"
              >
                <FileText className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-primary-600">Ver trabajo</span>
              </Link>
            </div>
          )}

          {/* Payment status */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Estado de pago</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Total</span>
                <span className="font-bold">{formatCurrency(invoice.total)}</span>
              </div>
              {invoice.status === 'paid' ? (
                <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Pagada</span>
                </div>
              ) : invoice.status === 'overdue' ? (
                <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Vencida</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md bg-yellow-50 p-3 text-yellow-700">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">Pendiente de pago</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Acciones</h2>
            <div className="space-y-2">
              {invoice.customer && (
                <Link
                  href={`/dashboard/invoices/new?customerId=${invoice.customer.id}`}
                  className="btn-outline w-full justify-center"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Nueva factura al cliente
                </Link>
              )}
              {invoice.pdfUrl && (
                <button
                  onClick={() => {
                    navigator.share?.({
                      title: `Factura ${invoice.invoiceType} ${invoiceNumber}`,
                      url: invoice.pdfUrl,
                    });
                  }}
                  className="btn-outline w-full justify-center"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Compartir
                </button>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Historial</h2>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex justify-between">
                <span>Creada</span>
                <span>{formatDate(invoice.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Actualizada</span>
                <span>{formatDate(invoice.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900">Anular factura</h3>
            <p className="mt-2 text-gray-500">
              ¿Estás seguro de anular esta factura? Esta acción no se puede deshacer.
            </p>
            {invoice.cae && (
              <p className="mt-2 text-sm text-yellow-600">
                Nota: Esta factura ya tiene CAE asignado. Se generará una nota de crédito automáticamente.
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="btn-outline"
              >
                Cancelar
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="btn-danger"
              >
                {cancelMutation.isPending ? 'Anulando...' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

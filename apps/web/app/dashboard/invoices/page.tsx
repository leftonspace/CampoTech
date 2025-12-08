'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { cn, formatCurrency, formatDate, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/lib/utils';
import { Search, ChevronRight, FileText, Download, Send, AlertCircle } from 'lucide-react';
import { Invoice } from '@/types';

export default function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { search, status: statusFilter }],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      return api.invoices.list(params);
    },
  });

  const { data: queueData } = useQuery({
    queryKey: ['invoice-queue-status'],
    queryFn: () => api.invoices.queueStatus(),
    refetchInterval: 30000,
  });

  const invoices = data?.data as Invoice[] | undefined;
  const queueStatus = queueData?.data as { pending: number; processing: number; failed: number } | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
          <p className="text-gray-500">Facturación electrónica AFIP</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/invoices/queue" className="btn-outline">
            Cola AFIP
            {queueStatus?.pending ? (
              <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                {queueStatus.pending}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      {/* Queue alert */}
      {queueStatus?.failed ? (
        <div className="flex items-center gap-3 rounded-md bg-danger-50 p-4 text-danger-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Hay {queueStatus.failed} facturas con error</p>
            <p className="text-sm">Revisá la cola de AFIP para más detalles</p>
          </div>
          <Link href="/dashboard/invoices/queue" className="ml-auto text-sm font-medium hover:underline">
            Ver cola
          </Link>
        </div>
      ) : null}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full sm:w-auto"
          >
            <option value="">Todos los estados</option>
            <option value="draft">Borrador</option>
            <option value="pending_cae">Pendiente CAE</option>
            <option value="issued">Emitida</option>
            <option value="sent">Enviada</option>
            <option value="paid">Pagada</option>
            <option value="overdue">Vencida</option>
          </select>
        </div>
      </div>

      {/* Invoices table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Factura
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                    </td>
                  </tr>
                ))
              ) : invoices?.length ? (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {invoice.invoiceType}{' '}
                        {invoice.number
                          ? `${String(invoice.puntoVenta).padStart(4, '0')}-${String(invoice.number).padStart(8, '0')}`
                          : 'Borrador'}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                      {invoice.customer?.name || '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {formatDate(invoice.issueDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          INVOICE_STATUS_COLORS[invoice.status]
                        )}
                      >
                        {INVOICE_STATUS_LABELS[invoice.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {invoice.pdfUrl && (
                          <a
                            href={invoice.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Descargar PDF"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        {invoice.status === 'issued' && (
                          <button
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Enviar por WhatsApp"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron facturas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

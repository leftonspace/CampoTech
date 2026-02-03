'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { cn, formatCurrency, formatDate, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '@/lib/utils';
import { Search, ChevronRight, CreditCard, RefreshCw, AlertTriangle } from 'lucide-react';
import { Payment } from '@/types';

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search') || '';

  const [search, setSearch] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState('');

  // Sync URL search with local state
  useEffect(() => {
    if (urlSearch !== search) {
      setSearch(urlSearch);
    }
  }, [urlSearch, search]);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', { search, status: statusFilter }],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      return api.payments.list(params);
    },
  });

  const { data: disputesData } = useQuery({
    queryKey: ['payment-disputes'],
    queryFn: () => api.payments.disputes(),
  });

  const payments = data?.data as Payment[] | undefined;
  const disputes = disputesData?.data as unknown[] | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
          <p className="text-gray-500">Gestión de cobros y pagos</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/payments/reconciliation" className="btn-outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Conciliación
          </Link>
        </div>
      </div>

      {/* Disputes alert */}
      {disputes?.length ? (
        <div className="flex items-center gap-3 rounded-md bg-warning-50 p-4 text-warning-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Hay {disputes.length} disputas pendientes</p>
            <p className="text-sm">Requieren atención inmediata</p>
          </div>
        </div>
      ) : null}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por ID de pago..."
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
            <option value="pending">Pendiente</option>
            <option value="approved">Aprobado</option>
            <option value="rejected">Rechazado</option>
            <option value="refunded">Reembolsado</option>
          </select>
        </div>
      </div>

      {/* Payments table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Factura
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Método
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Monto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Fecha
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
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                    </td>
                  </tr>
                ))
              ) : payments?.length ? (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-mono text-sm text-gray-600">
                        {payment.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/dashboard/invoices/${payment.invoiceId}`}
                        className="text-primary-600 hover:underline"
                      >
                        Ver factura
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-gray-400" />
                        <span className="capitalize">{payment.method.replace('_', ' ')}</span>
                        {payment.installments > 1 && (
                          <span className="text-xs text-gray-500">
                            ({payment.installments} cuotas)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {payment.paidAt ? formatDate(payment.paidAt) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          PAYMENT_STATUS_COLORS[payment.status]
                        )}
                      >
                        {PAYMENT_STATUS_LABELS[payment.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/payments/${payment.id}`}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron pagos
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

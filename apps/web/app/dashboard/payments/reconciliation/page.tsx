'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Link2,
  XCircle,
  Search
} from 'lucide-react';

interface ReconciliationItem {
  id: string;
  type: 'payment' | 'invoice';
  externalId?: string;
  amount: number;
  date: string;
  status: 'matched' | 'unmatched' | 'disputed';
  relatedId?: string;
  description: string;
  source: 'mercadopago' | 'manual' | 'bank';
}

interface ReconciliationSummary {
  totalPayments: number;
  matchedPayments: number;
  unmatchedPayments: number;
  totalAmount: number;
  matchedAmount: number;
  unmatchedAmount: number;
}

const STATUS_CONFIG = {
  matched: {
    label: 'Conciliado',
    icon: CheckCircle,
    color: 'text-green-600 bg-green-50',
  },
  unmatched: {
    label: 'Sin conciliar',
    icon: AlertCircle,
    color: 'text-yellow-600 bg-yellow-50',
  },
  disputed: {
    label: 'En disputa',
    icon: XCircle,
    color: 'text-red-600 bg-red-50',
  },
};

const SOURCE_LABELS: Record<string, string> = {
  mercadopago: 'MercadoPago',
  manual: 'Manual',
  bank: 'Transferencia',
};

export default function ReconciliationPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reconciliation'],
    queryFn: () => api.payments.reconciliation(),
  });

  const reconciliationData = data?.data as {
    items: ReconciliationItem[];
    summary: ReconciliationSummary;
  } | undefined;

  const items = reconciliationData?.items || [];
  const summary = reconciliationData?.summary;

  const filteredItems = items.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (search && !item.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/payments"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Conciliación de pagos</h1>
          <p className="text-gray-500">Verificá la correspondencia entre pagos y facturas</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-outline"
          disabled={isLoading}
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total pagos</p>
          <p className="text-2xl font-bold text-gray-900">
            {summary?.totalPayments ?? 0}
          </p>
          <p className="text-sm text-gray-500">
            {summary?.totalAmount ? formatCurrency(summary.totalAmount) : '$0'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Conciliados</p>
          <p className="text-2xl font-bold text-green-600">
            {summary?.matchedPayments ?? 0}
          </p>
          <p className="text-sm text-gray-500">
            {summary?.matchedAmount ? formatCurrency(summary.matchedAmount) : '$0'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Sin conciliar</p>
          <p className="text-2xl font-bold text-yellow-600">
            {summary?.unmatchedPayments ?? 0}
          </p>
          <p className="text-sm text-gray-500">
            {summary?.unmatchedAmount ? formatCurrency(summary.unmatchedAmount) : '$0'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Tasa de conciliación</p>
          <p className="text-2xl font-bold text-gray-900">
            {summary?.totalPayments
              ? Math.round((summary.matchedPayments / summary.totalPayments) * 100)
              : 0}%
          </p>
          <p className="text-sm text-gray-500">del total</p>
        </div>
      </div>

      {/* Unmatched alert */}
      {summary?.unmatchedPayments ? (
        <div className="flex items-center gap-3 rounded-md bg-warning-50 p-4 text-warning-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">
              {summary.unmatchedPayments} pago{summary.unmatchedPayments > 1 ? 's' : ''} sin conciliar
            </p>
            <p className="text-sm">
              Revisá los pagos pendientes y vinculalos con sus facturas correspondientes
            </p>
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
              placeholder="Buscar por descripción..."
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
            <option value="matched">Conciliados</option>
            <option value="unmatched">Sin conciliar</option>
            <option value="disputed">En disputa</option>
          </select>
        </div>
      </div>

      {/* Reconciliation table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Descripción
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Origen
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
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length ? (
                filteredItems.map((item) => {
                  const StatusIcon = STATUS_CONFIG[item.status].icon;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-medium text-gray-900">{item.description}</p>
                        {item.externalId && (
                          <p className="text-xs text-gray-500">ID: {item.externalId}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                        {SOURCE_LABELS[item.source] || item.source}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                        {formatDate(item.date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_CONFIG[item.status].color
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {STATUS_CONFIG[item.status].label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {item.status === 'unmatched' && (
                          <button className="btn-outline text-sm">
                            <Link2 className="mr-1 h-3 w-3" />
                            Vincular
                          </button>
                        )}
                        {item.relatedId && (
                          <Link
                            href={`/dashboard/invoices/${item.relatedId}`}
                            className="text-sm text-primary-600 hover:underline"
                          >
                            Ver factura
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <CheckCircle className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2">No hay pagos para mostrar</p>
                    <p className="text-sm">Los pagos aparecerán aquí cuando se registren</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info */}
      <div className="card p-4">
        <h3 className="font-medium text-gray-900">Sobre la conciliación</h3>
        <ul className="mt-2 space-y-1 text-sm text-gray-500">
          <li>Los pagos de MercadoPago se concilian automáticamente</li>
          <li>Los pagos manuales y transferencias requieren conciliación manual</li>
          <li>Revisá regularmente los pagos sin conciliar para mantener la contabilidad al día</li>
        </ul>
      </div>
    </div>
  );
}

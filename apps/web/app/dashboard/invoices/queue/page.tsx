'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, RefreshCw, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';

interface QueueItem {
  id: string;
  invoiceId: string;
  invoice: {
    id: string;
    invoiceType: string;
    customer: { name: string };
    total: number;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pendiente',
    icon: Clock,
    color: 'text-yellow-600 bg-yellow-50',
  },
  processing: {
    label: 'Procesando',
    icon: RefreshCw,
    color: 'text-blue-600 bg-blue-50',
  },
  completed: {
    label: 'Completado',
    icon: CheckCircle,
    color: 'text-green-600 bg-green-50',
  },
  failed: {
    label: 'Fallido',
    icon: XCircle,
    color: 'text-red-600 bg-red-50',
  },
};

export default function InvoiceQueuePage() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoice-queue'],
    queryFn: () => api.admin.queues(),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: statusData } = useQuery({
    queryKey: ['invoice-queue-status'],
    queryFn: () => api.invoices.queueStatus(),
    refetchInterval: 10000,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.admin.retryDlq(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-queue'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-queue-status'] });
    },
  });

  const queueItems = data?.data as QueueItem[] | undefined;
  const queueStatus = statusData?.data as { pending: number; processing: number; failed: number } | undefined;

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
          <h1 className="text-2xl font-bold text-gray-900">Cola AFIP</h1>
          <p className="text-gray-500">Estado de procesamiento de facturas electrónicas</p>
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

      {/* Status summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-100 p-2">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{queueStatus?.pending ?? 0}</p>
              <p className="text-sm text-gray-500">Pendientes</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{queueStatus?.processing ?? 0}</p>
              <p className="text-sm text-gray-500">Procesando</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{queueStatus?.failed ?? 0}</p>
              <p className="text-sm text-gray-500">Con error</p>
            </div>
          </div>
        </div>
      </div>

      {/* Failed items alert */}
      {queueStatus?.failed ? (
        <div className="flex items-center gap-3 rounded-md bg-danger-50 p-4 text-danger-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">
              {queueStatus.failed} factura{queueStatus.failed > 1 ? 's' : ''} con error
            </p>
            <p className="text-sm">
              Revisá los errores y reintentá el envío a AFIP
            </p>
          </div>
        </div>
      ) : null}

      {/* Queue table */}
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
                  Monto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Intentos
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Fecha
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
              ) : queueItems?.length ? (
                queueItems.map((item) => {
                  const StatusIcon = STATUS_CONFIG[item.status].icon;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link
                          href={`/dashboard/invoices/${item.invoiceId}`}
                          className="font-medium text-primary-600 hover:underline"
                        >
                          {item.invoice?.invoiceType || 'Factura'} #{item.invoiceId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                        {item.invoice?.customer?.name || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                        {item.invoice?.total ? formatCurrency(item.invoice.total) : '-'}
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
                        {item.lastError && (
                          <p className="mt-1 max-w-xs truncate text-xs text-red-600" title={item.lastError}>
                            {item.lastError}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                        {item.attempts}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {item.status === 'failed' && (
                          <button
                            onClick={() => retryMutation.mutate(item.id)}
                            disabled={retryMutation.isPending}
                            className="btn-outline text-sm"
                          >
                            <RefreshCw className={cn(
                              'mr-1 h-3 w-3',
                              retryMutation.isPending && 'animate-spin'
                            )} />
                            Reintentar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <CheckCircle className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2">No hay facturas en cola</p>
                    <p className="text-sm">Todas las facturas han sido procesadas</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info */}
      <div className="card p-4">
        <h3 className="font-medium text-gray-900">Información</h3>
        <ul className="mt-2 space-y-1 text-sm text-gray-500">
          <li>Las facturas se procesan automáticamente cada pocos segundos</li>
          <li>Si una factura falla, se reintenta hasta 3 veces</li>
          <li>Las facturas con error permanente requieren revisión manual</li>
          <li>Asegurate de tener la configuración AFIP correcta en Configuración</li>
        </ul>
      </div>
    </div>
  );
}

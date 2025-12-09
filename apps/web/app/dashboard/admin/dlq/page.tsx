'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { cn, formatDateTime } from '@/lib/utils';
import { ProtectedRoute } from '@/lib/auth-context';
import {
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Play,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckCircle,
  Clock,
  FileText,
  CreditCard,
  MessageSquare,
  Zap,
} from 'lucide-react';

interface DLQItem {
  id: string;
  queue: string;
  jobName: string;
  data: Record<string, unknown>;
  failedReason: string;
  stackTrace?: string;
  attemptsMade: number;
  maxAttempts: number;
  failedAt: string;
  originalJobId: string;
}

const QUEUE_DISPLAY_NAMES: Record<string, string> = {
  CAE: 'AFIP (CAE)',
  WHATSAPP: 'WhatsApp',
  PAYMENT: 'Pagos',
  NOTIFICATION: 'Notificaciones',
  VOICE: 'Voice AI',
};

const QUEUE_ICONS: Record<string, React.ElementType> = {
  CAE: FileText,
  WHATSAPP: MessageSquare,
  PAYMENT: CreditCard,
  NOTIFICATION: AlertTriangle,
  VOICE: Zap,
};

export default function DLQPage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'admin']}>
      <DLQContent />
    </ProtectedRoute>
  );
}

function DLQContent() {
  const queryClient = useQueryClient();
  const [queueFilter, setQueueFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState<DLQItem | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-dlq'],
    queryFn: () => api.admin.dlq(),
    refetchInterval: 30000,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.admin.retryDlq(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dlq'] });
    },
  });

  const items = (data?.data as DLQItem[]) || [];

  const filteredItems = queueFilter
    ? items.filter((item) => item.queue === queueFilter)
    : items;

  const queues = [...new Set(items.map((item) => item.queue))];

  const stats = {
    total: items.length,
    byQueue: queues.reduce((acc, queue) => {
      acc[queue] = items.filter((item) => item.queue === queue).length;
      return acc;
    }, {} as Record<string, number>),
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleRetry = (id: string) => {
    retryMutation.mutate(id);
  };

  const handleRetryAll = () => {
    if (confirm(`¿Reintentar todas las ${filteredItems.length} tareas fallidas?`)) {
      filteredItems.forEach((item) => retryMutation.mutate(item.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/admin/queues"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dead Letter Queue</h1>
            <p className="text-gray-500">Tareas fallidas que requieren atención</p>
          </div>
        </div>
        <div className="flex gap-2">
          {filteredItems.length > 0 && (
            <button
              onClick={handleRetryAll}
              disabled={retryMutation.isPending}
              className="btn-outline"
            >
              <Play className="mr-2 h-4 w-4" />
              Reintentar todas
            </button>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-outline"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats by queue */}
      {items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(stats.byQueue).map(([queue, count]) => {
            const Icon = QUEUE_ICONS[queue] || AlertTriangle;
            return (
              <button
                key={queue}
                onClick={() => setQueueFilter(queueFilter === queue ? '' : queue)}
                className={cn(
                  'card p-4 text-left transition-colors',
                  queueFilter === queue && 'ring-2 ring-primary-500'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-red-100 p-2 text-red-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">
                      {QUEUE_DISPLAY_NAMES[queue] || queue}
                    </p>
                    <p className="text-2xl font-bold text-red-600">{count}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter */}
      {queues.length > 1 && (
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value)}
              className="input w-full sm:w-auto"
            >
              <option value="">Todas las colas</option>
              {queues.map((queue) => (
                <option key={queue} value={queue}>
                  {QUEUE_DISPLAY_NAMES[queue] || queue} ({stats.byQueue[queue]})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* DLQ items list */}
      <div className="card">
        {isLoading ? (
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="divide-y">
            {filteredItems.map((item) => {
              const Icon = QUEUE_ICONS[item.queue] || AlertTriangle;
              const isExpanded = expandedItems.has(item.id);

              return (
                <div key={item.id} className="bg-white">
                  {/* Item header */}
                  <div className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-red-100 p-2 text-red-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {item.jobName}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {QUEUE_DISPLAY_NAMES[item.queue] || item.queue}
                        </span>
                      </div>
                      <p className="truncate text-sm text-red-600">
                        {item.failedReason}
                      </p>
                      <p className="text-xs text-gray-400">
                        Falló: {formatDateTime(item.failedAt)} •
                        Intentos: {item.attemptsMade}/{item.maxAttempts}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRetry(item.id)}
                        disabled={retryMutation.isPending}
                        className="btn-outline text-sm"
                        title="Reintentar"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="btn-outline text-sm"
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="rounded p-1 hover:bg-gray-100"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50 p-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Error:</p>
                          <p className="mt-1 text-sm text-red-600">{item.failedReason}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Job ID:</p>
                          <p className="mt-1 font-mono text-sm text-gray-600">
                            {item.originalJobId}
                          </p>
                        </div>
                      </div>
                      {item.stackTrace && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-700">Stack trace:</p>
                          <pre className="mt-1 max-h-32 overflow-auto rounded bg-gray-800 p-2 text-xs text-gray-200">
                            {item.stackTrace}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
            <p className="mt-4 font-medium text-gray-900">Cola de errores vacía</p>
            <p className="text-gray-500">No hay tareas fallidas pendientes</p>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-medium">Detalle de tarea fallida</h2>
              <button
                onClick={() => setSelectedItem(null)}
                className="rounded p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
              {/* Job info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-500">Nombre del job</p>
                  <p className="font-medium">{selectedItem.jobName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cola</p>
                  <p className="font-medium">
                    {QUEUE_DISPLAY_NAMES[selectedItem.queue] || selectedItem.queue}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Intentos</p>
                  <p className="font-medium">
                    {selectedItem.attemptsMade} de {selectedItem.maxAttempts}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha de fallo</p>
                  <p className="font-medium">{formatDateTime(selectedItem.failedAt)}</p>
                </div>
              </div>

              {/* Error */}
              <div>
                <p className="text-sm font-medium text-gray-700">Motivo del error</p>
                <div className="mt-1 rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {selectedItem.failedReason}
                </div>
              </div>

              {/* Data */}
              <div>
                <p className="text-sm font-medium text-gray-700">Datos del job</p>
                <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-gray-800 p-3 text-xs text-gray-200">
                  {JSON.stringify(selectedItem.data, null, 2)}
                </pre>
              </div>

              {/* Stack trace */}
              {selectedItem.stackTrace && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Stack trace</p>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-gray-800 p-3 text-xs text-gray-200">
                    {selectedItem.stackTrace}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t p-4">
              <button
                onClick={() => setSelectedItem(null)}
                className="btn-outline"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  handleRetry(selectedItem.id);
                  setSelectedItem(null);
                }}
                disabled={retryMutation.isPending}
                className="btn-primary"
              >
                <Play className="mr-2 h-4 w-4" />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { cn, formatDateTime } from '@/lib/utils';
import { ProtectedRoute } from '@/lib/auth-context';
import {
  ArrowLeft,
  Layers,
  Play,
  Pause,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
} from 'lucide-react';

interface QueueStatus {
  name: string;
  displayName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  workers: number;
}

interface QueueJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  createdAt: string;
  processedAt?: string;
  failedReason?: string;
  attemptsMade: number;
}

const QUEUE_DISPLAY_NAMES: Record<string, string> = {
  CAE: 'Cola AFIP (CAE)',
  WHATSAPP: 'Cola WhatsApp',
  PAYMENT: 'Cola Pagos',
  NOTIFICATION: 'Cola Notificaciones',
  SCHEDULED: 'Tareas Programadas',
  DLQ: 'Cola de Errores (DLQ)',
};

const QUEUE_ICONS: Record<string, React.ElementType> = {
  CAE: Activity,
  WHATSAPP: Zap,
  PAYMENT: Layers,
  NOTIFICATION: Layers,
  SCHEDULED: Clock,
  DLQ: AlertTriangle,
};

export default function QueuesPage() {
  return (
    <ProtectedRoute allowedRoles={['OWNER']}>
      <QueuesContent />
    </ProtectedRoute>
  );
}

function QueuesContent() {
  const queryClient = useQueryClient();
  const [expandedQueue, setExpandedQueue] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-queues'],
    queryFn: () => api.admin.queues(),
    refetchInterval: 10000,
  });

  const queues = (data?.data as QueueStatus[]) || [];

  // Enhance queues with display names
  const enhancedQueues = queues.map((q) => ({
    ...q,
    displayName: QUEUE_DISPLAY_NAMES[q.name] || q.name,
  }));

  const totals = {
    waiting: queues.reduce((sum, q) => sum + q.waiting, 0),
    active: queues.reduce((sum, q) => sum + q.active, 0),
    completed: queues.reduce((sum, q) => sum + q.completed, 0),
    failed: queues.reduce((sum, q) => sum + q.failed, 0),
  };

  const toggleQueue = (name: string) => {
    setExpandedQueue(expandedQueue === name ? null : name);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/admin"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de colas</h1>
            <p className="text-gray-500">Monitoreo y control de colas de trabajo</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/admin/dlq" className="btn-outline">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Ver DLQ ({totals.failed})
          </Link>
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

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Esperando</p>
              <p className="text-2xl font-bold">{totals.waiting}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-100 p-2 text-yellow-600">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En proceso</p>
              <p className="text-2xl font-bold">{totals.active}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completados</p>
              <p className="text-2xl font-bold">{totals.completed}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2 text-red-600">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Fallidos</p>
              <p className="text-2xl font-bold text-red-600">{totals.failed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Queues list */}
      <div className="space-y-4">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-gray-100" />
          ))
        ) : enhancedQueues.length > 0 ? (
          enhancedQueues.map((queue) => {
            const Icon = QUEUE_ICONS[queue.name] || Layers;
            const isExpanded = expandedQueue === queue.name;
            const hasIssues = queue.failed > 0 || queue.paused;

            return (
              <div key={queue.name} className="card overflow-hidden">
                {/* Queue header */}
                <button
                  onClick={() => toggleQueue(queue.name)}
                  className={cn(
                    'flex w-full items-center gap-4 p-4 text-left transition-colors',
                    hasIssues ? 'bg-red-50' : 'hover:bg-gray-50'
                  )}
                >
                  <div className={cn(
                    'rounded-lg p-2',
                    hasIssues ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-600'
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{queue.displayName}</h3>
                      {queue.paused && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                          Pausada
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {queue.workers} worker{queue.workers !== 1 ? 's' : ''} activo{queue.workers !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-medium text-blue-600">{queue.waiting}</p>
                      <p className="text-xs text-gray-500">esperando</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-yellow-600">{queue.active}</p>
                      <p className="text-xs text-gray-500">activos</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-green-600">{queue.completed}</p>
                      <p className="text-xs text-gray-500">completados</p>
                    </div>
                    <div className="text-center">
                      <p className={cn('font-medium', queue.failed > 0 ? 'text-red-600' : 'text-gray-400')}>
                        {queue.failed}
                      </p>
                      <p className="text-xs text-gray-500">fallidos</p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-gray-500">Tareas retrasadas:</span>{' '}
                          <span className="font-medium">{queue.delayed}</span>
                        </p>
                        <p>
                          <span className="text-gray-500">Estado:</span>{' '}
                          <span className={cn(
                            'font-medium',
                            queue.paused ? 'text-yellow-600' : 'text-green-600'
                          )}>
                            {queue.paused ? 'Pausada' : 'Activa'}
                          </span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-outline text-sm">
                          {queue.paused ? (
                            <>
                              <Play className="mr-1 h-4 w-4" />
                              Reanudar
                            </>
                          ) : (
                            <>
                              <Pause className="mr-1 h-4 w-4" />
                              Pausar
                            </>
                          )}
                        </button>
                        {queue.failed > 0 && (
                          <button className="btn-outline text-sm text-red-600 hover:bg-red-50">
                            <RefreshCw className="mr-1 h-4 w-4" />
                            Reintentar fallidos
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-xs text-gray-500">
                        <span>Capacidad utilizada</span>
                        <span>{Math.round((queue.active / Math.max(queue.workers * 10, 1)) * 100)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full bg-primary-500 transition-all"
                          style={{ width: `${Math.min((queue.active / Math.max(queue.workers * 10, 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="card p-8 text-center">
            <Layers className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No hay colas configuradas</p>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="card p-6">
        <h2 className="mb-4 font-medium text-gray-900">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar todas las fallidas
          </button>
          <button className="btn-outline">
            <Pause className="mr-2 h-4 w-4" />
            Pausar todas las colas
          </button>
          <button className="btn-outline text-red-600 hover:bg-red-50">
            <Trash2 className="mr-2 h-4 w-4" />
            Limpiar completadas
          </button>
        </div>
      </div>
    </div>
  );
}

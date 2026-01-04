'use client';

/**
 * Message Buffer Monitoring Dashboard
 * ====================================
 *
 * Phase 9.8: Message Aggregation System
 * Admin dashboard for monitoring WhatsApp message aggregation buffers.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MessageSquare,
  Clock,
  Activity,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Inbox,
  Timer,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface BufferStats {
  activeBuffers: number;
  totalMessages: number;
  avgMessagesPerBuffer: number;
  avgBufferAge: number;
  processedToday: number;
  aggregationRate: number;
}

interface ActiveBuffer {
  id: string;
  organizationId: string;
  customerPhone: string;
  customerName?: string;
  messageCount: number;
  firstMessageAt: string;
  lastMessageAt: string;
  triggerDetected: boolean;
  triggerType?: string;
  estimatedProcessAt: string;
}

interface RecentActivity {
  id: string;
  type: 'buffer_created' | 'buffer_processed' | 'trigger_detected' | 'timeout';
  customerPhone: string;
  messageCount?: number;
  processingTime?: number;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MessageBufferMonitoringPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch buffer statistics
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['buffer-stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/message-buffers/stats');
      return response.json();
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch active buffers
  const { data: buffersData, isLoading: buffersLoading, refetch: refetchBuffers } = useQuery({
    queryKey: ['active-buffers'],
    queryFn: async () => {
      const response = await fetch('/api/admin/message-buffers/active');
      return response.json();
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch recent activity
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['buffer-activity'],
    queryFn: async () => {
      const response = await fetch('/api/admin/message-buffers/activity');
      return response.json();
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const stats: BufferStats = statsData?.data || {
    activeBuffers: 0,
    totalMessages: 0,
    avgMessagesPerBuffer: 0,
    avgBufferAge: 0,
    processedToday: 0,
    aggregationRate: 0,
  };

  const activeBuffers: ActiveBuffer[] = buffersData?.data || [];
  const recentActivity: RecentActivity[] = activityData?.data || [];

  const handleRefresh = () => {
    refetchStats();
    refetchBuffers();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Monitoreo de Buffers de Mensajes
          </h1>
          <p className="text-gray-500">
            Sistema de agregación de mensajes WhatsApp (ventana de 8 segundos)
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-primary-600"
            />
            Auto-refresh (5s)
          </label>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Inbox}
          label="Buffers Activos"
          value={stats.activeBuffers}
          color="blue"
          loading={statsLoading}
        />
        <StatCard
          icon={MessageSquare}
          label="Mensajes en Buffer"
          value={stats.totalMessages}
          color="green"
          loading={statsLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Tasa de Agregación"
          value={`${(stats.aggregationRate * 100).toFixed(1)}%`}
          subtitle="mensajes/buffer"
          color="purple"
          loading={statsLoading}
        />
        <StatCard
          icon={CheckCircle}
          label="Procesados Hoy"
          value={stats.processedToday}
          color="emerald"
          loading={statsLoading}
        />
      </div>

      {/* Active Buffers Table */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="font-medium text-gray-900">
            Buffers Activos ({activeBuffers.length})
          </h2>
        </div>

        {buffersLoading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
            <p className="mt-2">Cargando buffers...</p>
          </div>
        ) : activeBuffers.length === 0 ? (
          <div className="p-8 text-center">
            <Inbox className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-gray-500">No hay buffers activos</p>
            <p className="text-sm text-gray-400">
              Los buffers aparecerán cuando los clientes envíen mensajes
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Mensajes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Edad del Buffer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Trigger
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Procesa en
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {activeBuffers.map((buffer) => (
                  <tr key={buffer.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {buffer.customerName || 'Cliente'}
                        </p>
                        <p className="text-sm text-gray-500">{buffer.customerPhone}</p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800">
                        {buffer.messageCount} msg
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {formatDistanceToNow(new Date(buffer.firstMessageAt), {
                        addSuffix: false,
                        locale: es,
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {buffer.triggerDetected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          <CheckCircle className="h-3 w-3" />
                          {buffer.triggerType || 'Detectado'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          <Clock className="h-3 w-3" />
                          Esperando
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <CountdownTimer targetTime={buffer.estimatedProcessAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="font-medium text-gray-900">Actividad Reciente</h2>
        </div>

        {activityLoading ? (
          <div className="p-4 text-center text-gray-500">Cargando...</div>
        ) : recentActivity.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Activity className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2">Sin actividad reciente</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentActivity.slice(0, 20).map((activity) => (
              <div key={activity.id} className="flex items-center gap-4 px-4 py-3">
                <ActivityIcon type={activity.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    {getActivityText(activity)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(activity.timestamp), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Info */}
      <div className="card p-4">
        <h3 className="mb-3 font-medium text-gray-900">Configuración del Sistema</h3>
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-gray-500">Ventana de Agregación</p>
            <p className="font-medium">8 segundos</p>
          </div>
          <div>
            <p className="text-gray-500">Triggers de Procesamiento</p>
            <p className="font-medium">Pregunta, Dirección, Urgencia, Horario</p>
          </div>
          <div>
            <p className="text-gray-500">Fallback</p>
            <p className="font-medium">Procesamiento inmediato si Redis no disponible</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  color: 'blue' | 'green' | 'purple' | 'emerald' | 'red';
  loading?: boolean;
}

function StatCard({ icon: Icon, label, value, subtitle, color, loading }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          {loading ? (
            <div className="h-6 w-16 animate-pulse rounded bg-gray-200" />
          ) : (
            <p className="text-xl font-semibold text-gray-900">{value}</p>
          )}
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function CountdownTimer({ targetTime }: { targetTime: string }) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const updateRemaining = () => {
      const target = new Date(targetTime).getTime();
      const now = Date.now();
      setRemaining(Math.max(0, Math.ceil((target - now) / 1000)));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
        <Timer className="h-4 w-4" />
        Procesando...
      </span>
    );
  }

  return (
    <span className={`text-sm font-medium ${remaining <= 2 ? 'text-orange-600' : 'text-gray-600'}`}>
      {remaining}s
    </span>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const config = {
    buffer_created: { icon: Inbox, color: 'bg-blue-100 text-blue-600' },
    buffer_processed: { icon: CheckCircle, color: 'bg-green-100 text-green-600' },
    trigger_detected: { icon: Activity, color: 'bg-purple-100 text-purple-600' },
    timeout: { icon: Clock, color: 'bg-orange-100 text-orange-600' },
  }[type] || { icon: MessageSquare, color: 'bg-gray-100 text-gray-600' };

  const Icon = config.icon;

  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${config.color}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

function getActivityText(activity: RecentActivity): string {
  switch (activity.type) {
    case 'buffer_created':
      return `Nuevo buffer creado para ${activity.customerPhone}`;
    case 'buffer_processed':
      return `Buffer procesado: ${activity.messageCount} mensajes agregados (${activity.processingTime}ms)`;
    case 'trigger_detected':
      return `Trigger detectado en mensaje de ${activity.customerPhone}`;
    case 'timeout':
      return `Buffer expirado para ${activity.customerPhone}`;
    default:
      return 'Actividad desconocida';
  }
}

'use client';

/**
 * Queue Metrics Dashboard (Phase 5B.2.3)
 * ======================================
 *
 * Real-time queue monitoring with Little's Law analysis.
 * Shows throughput, latency, SLA compliance, and capacity planning insights.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ProtectedRoute } from '@/lib/auth-context';
import {
  ArrowLeft,
  RefreshCw,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Gauge,
  Zap,
  BarChart3,
  Settings,
  Play,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TierMetrics {
  tier: string;
  depth: number;
  dlqDepth: number;
  throughput: number;
  avgWaitTime: number;
  avgProcessingTime: number;
  avgLatency: number;
  successRate: number;
  slaCompliance: number;
  processedLastHour: number;
  failedLastHour: number;
  littleLawDepth: number;
  healthy: boolean;
}

interface LittleLawAnalysis {
  tier: string;
  observedDepth: number;
  predictedDepth: number;
  arrivalRate: number;
  throughput: number;
  avgTimeInSystem: number;
  isStable: boolean;
  estimatedDrainTime: number;
  concurrencyRecommendation: 'increase' | 'maintain' | 'decrease';
  bottleneck: 'arrival' | 'processing' | 'none';
}

interface DashboardData {
  metrics: {
    timestamp: string;
    tiers: Record<string, TierMetrics>;
    aggregate: {
      totalDepth: number;
      totalDlqDepth: number;
      avgThroughput: number;
      avgLatency: number;
      overallSuccessRate: number;
      overallSlaCompliance: number;
      totalProcessedLastHour: number;
      totalFailedLastHour: number;
    };
    health: {
      status: 'healthy' | 'degraded' | 'critical';
      issues: string[];
    };
  };
  littleLaw: Record<string, LittleLawAnalysis>;
  workers: {
    running: boolean;
    stats: Record<string, { isRunning: boolean; activeJobs: number; processedJobs: number; failedJobs: number }>;
  };
  configuration: {
    tiers: Record<string, { name: string; slaMs: number; concurrency: number; description: string }>;
  };
  dlq: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchDashboard(historical = false): Promise<DashboardData> {
  const params = new URLSearchParams();
  if (historical) params.set('historical', 'true');

  const res = await fetch(`/api/admin/queue-dashboard?${params}`);
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

async function performOperation(action: string, tier: string): Promise<{ success: boolean; message: string; count?: number }> {
  const res = await fetch('/api/admin/queue-dashboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, tier }),
  });
  if (!res.ok) throw new Error('Operation failed');
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function HealthBadge({ status }: { status: 'healthy' | 'degraded' | 'critical' }) {
  const config = {
    healthy: { bg: 'bg-green-100', text: 'text-green-800', label: 'Saludable' },
    degraded: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Degradado' },
    critical: { bg: 'bg-red-100', text: 'text-red-800', label: 'Crítico' },
  };
  const { bg, text, label } = config[status];

  return (
    <span className={cn('rounded-full px-3 py-1 text-sm font-medium', bg, text)}>
      {label}
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={cn('rounded-full p-2', colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <span className={cn(
                'flex items-center text-sm',
                trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-400'
              )}>
                {trend === 'up' ? <TrendingUp className="h-4 w-4" /> : trend === 'down' ? <TrendingDown className="h-4 w-4" /> : null}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function TierCard({
  tier,
  metrics,
  littleLaw,
  config,
  onRetryDlq,
  onClearDlq,
}: {
  tier: string;
  metrics: TierMetrics;
  littleLaw: LittleLawAnalysis;
  config: { name: string; slaMs: number; concurrency: number; description: string };
  onRetryDlq: () => void;
  onClearDlq: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const tierLabels: Record<string, string> = {
    realtime: 'Tiempo Real',
    background: 'Background',
    batch: 'Batch',
  };

  const tierColors: Record<string, string> = {
    realtime: 'bg-purple-500',
    background: 'bg-blue-500',
    batch: 'bg-green-500',
  };

  return (
    <div className={cn('card overflow-hidden', !metrics.healthy && 'ring-2 ring-red-200')}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-gray-50',
          !metrics.healthy && 'bg-red-50'
        )}
      >
        <div className={cn('h-3 w-3 rounded-full', tierColors[tier])} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{tierLabels[tier] || tier}</h3>
            {!metrics.healthy && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <p className="text-sm text-gray-500">{config.description}</p>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="font-medium text-gray-900">{metrics.depth}</p>
            <p className="text-xs text-gray-500">en cola</p>
          </div>
          <div className="text-center">
            <p className="font-medium text-green-600">{metrics.throughput.toFixed(2)}/s</p>
            <p className="text-xs text-gray-500">throughput</p>
          </div>
          <div className="text-center">
            <p className={cn('font-medium', metrics.slaCompliance >= 95 ? 'text-green-600' : 'text-red-600')}>
              {metrics.slaCompliance.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500">SLA</p>
          </div>
          <div className="text-center">
            <p className={cn('font-medium', metrics.dlqDepth > 0 ? 'text-red-600' : 'text-gray-400')}>
              {metrics.dlqDepth}
            </p>
            <p className="text-xs text-gray-500">DLQ</p>
          </div>
        </div>

        {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t bg-gray-50 p-4 space-y-4">
          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Latencia promedio</p>
              <p className="text-lg font-semibold">{metrics.avgLatency}ms</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Tiempo de espera</p>
              <p className="text-lg font-semibold">{metrics.avgWaitTime}ms</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Tiempo de proceso</p>
              <p className="text-lg font-semibold">{metrics.avgProcessingTime}ms</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Tasa de éxito</p>
              <p className={cn('text-lg font-semibold', metrics.successRate >= 95 ? 'text-green-600' : 'text-red-600')}>
                {metrics.successRate.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Little's Law analysis */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="mb-3 flex items-center gap-2 font-medium text-gray-900">
              <BarChart3 className="h-4 w-4" />
              Análisis de Little&apos;s Law
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-gray-500">Tasa de llegada</p>
                <p className="font-medium">{littleLaw.arrivalRate.toFixed(3)}/s</p>
              </div>
              <div>
                <p className="text-gray-500">Throughput</p>
                <p className="font-medium">{littleLaw.throughput.toFixed(3)}/s</p>
              </div>
              <div>
                <p className="text-gray-500">Profundidad predicha</p>
                <p className="font-medium">{littleLaw.predictedDepth.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Estado</p>
                <p className={cn('font-medium', littleLaw.isStable ? 'text-green-600' : 'text-red-600')}>
                  {littleLaw.isStable ? 'Estable' : 'Inestable'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Cuello de botella</p>
                <p className="font-medium">
                  {littleLaw.bottleneck === 'none' ? 'Ninguno' : littleLaw.bottleneck === 'processing' ? 'Procesamiento' : 'Llegadas'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Recomendación</p>
                <p className={cn(
                  'font-medium',
                  littleLaw.concurrencyRecommendation === 'increase' ? 'text-yellow-600' :
                  littleLaw.concurrencyRecommendation === 'decrease' ? 'text-blue-600' : 'text-green-600'
                )}>
                  {littleLaw.concurrencyRecommendation === 'increase' ? 'Aumentar concurrencia' :
                   littleLaw.concurrencyRecommendation === 'decrease' ? 'Reducir concurrencia' : 'Mantener'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          {metrics.dlqDepth > 0 && (
            <div className="flex gap-2">
              <button onClick={onRetryDlq} className="btn-outline text-sm">
                <Play className="mr-1 h-4 w-4" />
                Reintentar DLQ ({metrics.dlqDepth})
              </button>
              <button onClick={onClearDlq} className="btn-outline text-sm text-red-600 hover:bg-red-50">
                <Trash2 className="mr-1 h-4 w-4" />
                Limpiar DLQ
              </button>
            </div>
          )}

          {/* SLA progress bar */}
          <div>
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>SLA: &lt;{config.slaMs}ms</span>
              <span>{metrics.slaCompliance.toFixed(1)}% cumplimiento</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className={cn('h-full transition-all', metrics.slaCompliance >= 95 ? 'bg-green-500' : metrics.slaCompliance >= 80 ? 'bg-yellow-500' : 'bg-red-500')}
                style={{ width: `${Math.min(metrics.slaCompliance, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function QueueMetricsPage() {
  return (
    <ProtectedRoute allowedRoles={['OWNER']}>
      <QueueMetricsContent />
    </ProtectedRoute>
  );
}

function QueueMetricsContent() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['queue-dashboard'],
    queryFn: () => fetchDashboard(false),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const retryDlqMutation = useMutation({
    mutationFn: (tier: string) => performOperation('retry_dlq', tier),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue-dashboard'] }),
  });

  const clearDlqMutation = useMutation({
    mutationFn: (tier: string) => performOperation('clear_dlq', tier),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue-dashboard'] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 animate-pulse rounded bg-gray-200" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-gray-100" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-32 animate-pulse bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  const { metrics, littleLaw, workers, configuration } = data || {
    metrics: {
      timestamp: new Date().toISOString(),
      tiers: {},
      aggregate: {
        totalDepth: 0,
        totalDlqDepth: 0,
        avgThroughput: 0,
        avgLatency: 0,
        overallSuccessRate: 100,
        overallSlaCompliance: 100,
        totalProcessedLastHour: 0,
        totalFailedLastHour: 0,
      },
      health: { status: 'healthy' as const, issues: [] },
    },
    littleLaw: {},
    workers: { running: false, stats: {} },
    configuration: { tiers: {} },
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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Métricas de Cola</h1>
              <HealthBadge status={metrics.health.status} />
            </div>
            <p className="text-gray-500">Monitoreo en tiempo real con análisis de Little&apos;s Law</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/admin/queues" className="btn-outline">
            <Settings className="mr-2 h-4 w-4" />
            Gestión de colas
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

      {/* Health issues */}
      {metrics.health.issues.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <h3 className="font-medium text-red-800">Problemas detectados</h3>
              <ul className="mt-1 list-inside list-disc text-sm text-red-700">
                {metrics.health.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Aggregate stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total en Cola"
          value={metrics.aggregate.totalDepth}
          subtitle={`${metrics.aggregate.totalDlqDepth} en DLQ`}
          icon={Clock}
          color="blue"
        />
        <StatCard
          title="Throughput"
          value={`${metrics.aggregate.avgThroughput.toFixed(2)}/s`}
          subtitle="trabajos por segundo"
          icon={Zap}
          color="purple"
        />
        <StatCard
          title="Latencia Promedio"
          value={`${metrics.aggregate.avgLatency}ms`}
          subtitle="espera + proceso"
          icon={Gauge}
          color="yellow"
        />
        <StatCard
          title="Cumplimiento SLA"
          value={`${metrics.aggregate.overallSlaCompliance.toFixed(1)}%`}
          subtitle={`${metrics.aggregate.overallSuccessRate.toFixed(1)}% éxito`}
          icon={metrics.aggregate.overallSlaCompliance >= 95 ? CheckCircle : XCircle}
          color={metrics.aggregate.overallSlaCompliance >= 95 ? 'green' : 'red'}
        />
      </div>

      {/* Last hour stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Procesados (última hora)</p>
              <p className="text-2xl font-bold text-green-600">{metrics.aggregate.totalProcessedLastHour}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2 text-red-600">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Fallidos (última hora)</p>
              <p className="text-2xl font-bold text-red-600">{metrics.aggregate.totalFailedLastHour}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Worker status */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('h-3 w-3 rounded-full', workers.running ? 'bg-green-500' : 'bg-red-500')} />
            <span className="font-medium">Workers: {workers.running ? 'Ejecutando' : 'Detenidos'}</span>
          </div>
          <div className="flex gap-4 text-sm text-gray-500">
            {Object.entries(workers.stats).map(([tier, stats]) => (
              <span key={tier}>
                {tier}: {stats.activeJobs} activos
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tier cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Colas por Tier</h2>
        {(['realtime', 'background', 'batch'] as const).map((tier) => {
          const tierMetrics = metrics.tiers[tier as keyof typeof metrics.tiers];
          const tierLittleLaw = littleLaw[tier as keyof typeof littleLaw];
          const tierConfig = configuration.tiers[tier as keyof typeof configuration.tiers];

          if (!tierMetrics || !tierLittleLaw || !tierConfig) return null;

          return (
            <TierCard
              key={tier}
              tier={tier}
              metrics={tierMetrics}
              littleLaw={tierLittleLaw}
              config={tierConfig}
              onRetryDlq={() => retryDlqMutation.mutate(tier)}
              onClearDlq={() => clearDlqMutation.mutate(tier)}
            />
          );
        })}
      </div>

      {/* Timestamp */}
      <p className="text-center text-xs text-gray-400">
        Última actualización: {new Date(metrics.timestamp).toLocaleString('es-AR')}
      </p>
    </div>
  );
}

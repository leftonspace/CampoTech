'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Target,
  BarChart3,
  PieChart,
  Calendar,
  MapPin,
  CheckCircle,
  XCircle,
  Eye,
  Send,
  Award,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadAnalytics {
  summary: {
    totalLeads: number;
    totalLeadsPrevMonth: number;
    leadsGrowth: number;
    viewedLeads: number;
    quotedLeads: number;
    acceptedLeads: number;
    conversionRate: number;
    conversionRatePrevMonth: number;
    avgResponseTimeHours: number;
    avgResponseTimePrevMonth: number;
    avgQuoteAmount: number;
    totalRevenue: number;
    revenueGrowth: number;
  };
  byCategory: Array<{
    category: string;
    label: string;
    leads: number;
    quoted: number;
    accepted: number;
    conversionRate: number;
  }>;
  byCity: Array<{
    city: string;
    leads: number;
    accepted: number;
  }>;
  timeline: Array<{
    date: string;
    leads: number;
    quotes: number;
    accepted: number;
  }>;
  responseTimeDistribution: {
    under1h: number;
    under2h: number;
    under4h: number;
    under24h: number;
    over24h: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Plomeria',
  electrical: 'Electricidad',
  hvac: 'Aire y Clima',
  gas: 'Gas',
  locksmith: 'Cerrajeria',
  painting: 'Pintura',
  cleaning: 'Limpieza',
  moving: 'Mudanza',
  carpentry: 'Carpinteria',
  appliance_repair: 'Electrodomesticos',
  pest_control: 'Control Plagas',
  roofing: 'Techos',
  landscaping: 'Jardineria',
  glass_repair: 'Vidrios',
  security: 'Seguridad',
  flooring: 'Pisos',
  general: 'General',
  other: 'Otro',
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LeadAnalyticsPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  // Fetch analytics
  const { data, isLoading } = useQuery({
    queryKey: ['lead-analytics', period],
    queryFn: () => apiRequest<LeadAnalytics>(`/leads/analytics?period=${period}`),
  });

  const analytics = data?.data;

  // Format percentage change
  const formatChange = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change >= 0,
    };
  };

  // Calculate funnel percentages
  const getFunnelPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="grid gap-6 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-32 bg-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="card h-96 bg-gray-100 animate-pulse" />
      </div>
    );
  }

  const summary = analytics?.summary || {
    totalLeads: 0,
    totalLeadsPrevMonth: 0,
    leadsGrowth: 0,
    viewedLeads: 0,
    quotedLeads: 0,
    acceptedLeads: 0,
    conversionRate: 0,
    conversionRatePrevMonth: 0,
    avgResponseTimeHours: 0,
    avgResponseTimePrevMonth: 0,
    avgQuoteAmount: 0,
    totalRevenue: 0,
    revenueGrowth: 0,
  };

  const leadsChange = formatChange(summary.totalLeads, summary.totalLeadsPrevMonth);
  const conversionChange = formatChange(
    summary.conversionRate,
    summary.conversionRatePrevMonth
  );
  const responseChange = formatChange(
    summary.avgResponseTimeHours,
    summary.avgResponseTimePrevMonth
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/leads"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Analiticas de Leads
            </h1>
            <p className="text-gray-500">
              Rendimiento de tu captacion de clientes
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['week', 'month', 'quarter'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                period === p
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {p === 'week' && 'Semana'}
              {p === 'month' && 'Mes'}
              {p === 'quarter' && 'Trimestre'}
            </button>
          ))}
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="rounded-full bg-blue-100 p-3 text-blue-600">
              <Target className="h-6 w-6" />
            </div>
            <div
              className={cn(
                'flex items-center gap-1 text-sm',
                leadsChange.isPositive ? 'text-green-600' : 'text-red-600'
              )}
            >
              {leadsChange.isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {leadsChange.value}%
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Total leads</p>
            <p className="text-3xl font-bold text-gray-900">
              {summary.totalLeads}
            </p>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="rounded-full bg-green-100 p-3 text-green-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div
              className={cn(
                'flex items-center gap-1 text-sm',
                conversionChange.isPositive ? 'text-green-600' : 'text-red-600'
              )}
            >
              {conversionChange.isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {conversionChange.value}%
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Tasa de conversion</p>
            <p className="text-3xl font-bold text-gray-900">
              {summary.conversionRate.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="rounded-full bg-yellow-100 p-3 text-yellow-600">
              <Clock className="h-6 w-6" />
            </div>
            <div
              className={cn(
                'flex items-center gap-1 text-sm',
                !responseChange.isPositive ? 'text-green-600' : 'text-red-600'
              )}
            >
              {!responseChange.isPositive ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              {responseChange.value}%
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Tiempo de respuesta</p>
            <p className="text-3xl font-bold text-gray-900">
              {summary.avgResponseTimeHours.toFixed(1)}h
            </p>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="rounded-full bg-purple-100 p-3 text-purple-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div
              className={cn(
                'flex items-center gap-1 text-sm',
                summary.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {summary.revenueGrowth >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {Math.abs(summary.revenueGrowth).toFixed(1)}%
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Ingresos generados</p>
            <p className="text-3xl font-bold text-gray-900">
              ${summary.totalRevenue.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Embudo de conversion
        </h2>
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4">
          {/* Received */}
          <div className="text-center">
            <div className="mx-auto w-32 h-20 bg-blue-100 rounded-t-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-700">
                {summary.totalLeads}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-900">Recibidos</p>
              <p className="text-xs text-gray-500">100%</p>
            </div>
          </div>

          <div className="text-gray-300 text-2xl">→</div>

          {/* Viewed */}
          <div className="text-center">
            <div className="mx-auto w-28 h-16 bg-cyan-100 rounded-t-lg flex items-center justify-center">
              <span className="text-xl font-bold text-cyan-700">
                {summary.viewedLeads}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-900">Vistos</p>
              <p className="text-xs text-gray-500">
                {getFunnelPercentage(summary.viewedLeads, summary.totalLeads)}%
              </p>
            </div>
          </div>

          <div className="text-gray-300 text-2xl">→</div>

          {/* Quoted */}
          <div className="text-center">
            <div className="mx-auto w-24 h-14 bg-yellow-100 rounded-t-lg flex items-center justify-center">
              <span className="text-lg font-bold text-yellow-700">
                {summary.quotedLeads}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-900">Cotizados</p>
              <p className="text-xs text-gray-500">
                {getFunnelPercentage(summary.quotedLeads, summary.totalLeads)}%
              </p>
            </div>
          </div>

          <div className="text-gray-300 text-2xl">→</div>

          {/* Accepted */}
          <div className="text-center">
            <div className="mx-auto w-20 h-12 bg-green-100 rounded-t-lg flex items-center justify-center">
              <span className="text-lg font-bold text-green-700">
                {summary.acceptedLeads}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-900">Ganados</p>
              <p className="text-xs text-gray-500">
                {getFunnelPercentage(summary.acceptedLeads, summary.totalLeads)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Category */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-gray-400" />
            Por categoria
          </h2>
          {analytics?.byCategory && analytics.byCategory.length > 0 ? (
            <div className="space-y-3">
              {analytics.byCategory.slice(0, 8).map((cat) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-gray-600 truncate">
                    {CATEGORY_LABELS[cat.category] || cat.category}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{
                          width: `${(cat.leads / (analytics.byCategory[0]?.leads || 1)) * 100}%`,
                        }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                        {cat.leads} leads
                      </span>
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm">
                    <span
                      className={cn(
                        'font-medium',
                        cat.conversionRate >= 20
                          ? 'text-green-600'
                          : cat.conversionRate >= 10
                          ? 'text-yellow-600'
                          : 'text-gray-500'
                      )}
                    >
                      {cat.conversionRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No hay datos disponibles
            </p>
          )}
        </div>

        {/* By City */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-gray-400" />
            Por ubicacion
          </h2>
          {analytics?.byCity && analytics.byCity.length > 0 ? (
            <div className="space-y-3">
              {analytics.byCity.slice(0, 8).map((city) => (
                <div key={city.city} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-gray-600 truncate">
                    {city.city}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${(city.leads / (analytics.byCity[0]?.leads || 1)) * 100}%`,
                        }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                        {city.leads} leads
                      </span>
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm font-medium text-green-600">
                    {city.accepted} ganados
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No hay datos disponibles
            </p>
          )}
        </div>

        {/* Response Time Distribution */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            Tiempo de respuesta
          </h2>
          {analytics?.responseTimeDistribution ? (
            <div className="space-y-3">
              {[
                { label: 'Menos de 1 hora', value: analytics.responseTimeDistribution.under1h, color: 'bg-green-500' },
                { label: '1-2 horas', value: analytics.responseTimeDistribution.under2h, color: 'bg-green-400' },
                { label: '2-4 horas', value: analytics.responseTimeDistribution.under4h, color: 'bg-yellow-400' },
                { label: '4-24 horas', value: analytics.responseTimeDistribution.under24h, color: 'bg-yellow-500' },
                { label: 'Mas de 24 horas', value: analytics.responseTimeDistribution.over24h, color: 'bg-red-500' },
              ].map((item) => {
                const total =
                  analytics.responseTimeDistribution.under1h +
                  analytics.responseTimeDistribution.under2h +
                  analytics.responseTimeDistribution.under4h +
                  analytics.responseTimeDistribution.under24h +
                  analytics.responseTimeDistribution.over24h;
                const percentage = total > 0 ? (item.value / total) * 100 : 0;

                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-32 text-sm text-gray-600">{item.label}</div>
                    <div className="flex-1">
                      <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', item.color)}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-right text-sm text-gray-600">
                      {percentage.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No hay datos disponibles
            </p>
          )}
          <p className="mt-4 text-xs text-gray-500">
            Tip: Responder en menos de 2 horas aumenta 3x la probabilidad de ganar
            el trabajo
          </p>
        </div>

        {/* Performance Tips */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-gray-400" />
            Recomendaciones
          </h2>
          <div className="space-y-4">
            {summary.avgResponseTimeHours > 2 && (
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <p className="text-sm font-medium text-yellow-800">
                  Mejora tu tiempo de respuesta
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Tu tiempo promedio es {summary.avgResponseTimeHours.toFixed(1)}h.
                  Intenta responder en menos de 2 horas para mejorar tu conversion.
                </p>
              </div>
            )}
            {summary.conversionRate < 15 && (
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm font-medium text-blue-800">
                  Optimiza tus cotizaciones
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Tu tasa de conversion es {summary.conversionRate.toFixed(1)}%.
                  Personaliza mas tus cotizaciones y agrega fotos de trabajos anteriores.
                </p>
              </div>
            )}
            {summary.quotedLeads < summary.viewedLeads * 0.5 && (
              <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                <p className="text-sm font-medium text-purple-800">
                  Cotiza mas leads
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  Estas cotizando solo{' '}
                  {getFunnelPercentage(summary.quotedLeads, summary.viewedLeads)}%
                  de los leads que ves. Intenta cotizar mas para aumentar tus
                  oportunidades.
                </p>
              </div>
            )}
            {summary.conversionRate >= 20 && summary.avgResponseTimeHours <= 2 && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <p className="text-sm font-medium text-green-800">
                  Excelente rendimiento!
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Tu tasa de conversion y tiempo de respuesta son muy buenos.
                  Sigue asi!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

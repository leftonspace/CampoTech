'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Calendar,
  Briefcase,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

interface AIAnalyticsData {
  summary: {
    totalConversations: number;
    aiResolved: number;
    aiResolvedPercent: number;
    transferred: number;
    transferredPercent: number;
    avgConfidence: number;
    avgResponseTimeMs: number;
  };
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  intentBreakdown: Array<{
    intent: string;
    count: number;
    percent: number;
  }>;
  dailyStats: Array<{
    date: string;
    total: number;
    resolved: number;
    transferred: number;
  }>;
  topQuestions: Array<{
    question: string;
    count: number;
  }>;
  bookingStats: {
    attempted: number;
    completed: number;
    conversionRate: number;
  };
}

const INTENT_LABELS: Record<string, string> = {
  booking: 'Reservas',
  question: 'Preguntas',
  status: 'Estado de trabajo',
  complaint: 'Quejas',
  greeting: 'Saludos',
  confirmation: 'Confirmaciones',
  cancellation: 'Cancelaciones',
  other: 'Otros',
};

const INTENT_COLORS: Record<string, string> = {
  booking: 'bg-blue-500',
  question: 'bg-purple-500',
  status: 'bg-teal-500',
  complaint: 'bg-red-500',
  greeting: 'bg-green-500',
  confirmation: 'bg-yellow-500',
  cancellation: 'bg-orange-500',
  other: 'bg-gray-500',
};

export default function AIAnalyticsPage() {
  const [data, setData] = useState<AIAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics/ai?days=${days}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Error fetching analytics');
      }
    } catch (_) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">{error || 'Error loading analytics'}</p>
        <button
          onClick={fetchAnalytics}
          className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const totalConfidence =
    data.confidenceDistribution.high +
    data.confidenceDistribution.medium +
    data.confidenceDistribution.low;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="h-7 w-7 text-teal-500" />
            Analytics de IA WhatsApp
          </h1>
          <p className="text-gray-500 mt-1">
            Rendimiento del asistente virtual en los últimos {days} días
          </p>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>

          <button
            onClick={fetchAnalytics}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* AI Resolution Rate */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Tasa de Resolución IA</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {data.summary.aiResolvedPercent}%
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.summary.aiResolved} de {data.summary.aiResolved + data.summary.transferred} interacciones
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Total Conversations */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Conversaciones Totales</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {data.summary.totalConversations}
              </p>
              <p className="text-xs text-gray-400 mt-1">Únicas en el período</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Average Confidence */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Confianza Promedio</p>
              <p className="text-3xl font-bold text-teal-600 mt-1">
                {data.summary.avgConfidence}%
              </p>
              <p className="text-xs text-gray-400 mt-1">Score de certeza IA</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-teal-600" />
            </div>
          </div>
        </div>

        {/* Booking Conversion */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Conversión Reservas</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">
                {data.bookingStats.conversionRate}%
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.bookingStats.completed} de {data.bookingStats.attempted} intentos
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence Distribution */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Distribución de Confianza</h3>

          <div className="space-y-4">
            {/* High */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Alta (80-100%)</span>
                <span className="font-medium text-green-600">
                  {data.confidenceDistribution.high} (
                  {totalConfidence > 0
                    ? Math.round((data.confidenceDistribution.high / totalConfidence) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{
                    width: `${totalConfidence > 0 ? (data.confidenceDistribution.high / totalConfidence) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Medium */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Media (50-79%)</span>
                <span className="font-medium text-yellow-600">
                  {data.confidenceDistribution.medium} (
                  {totalConfidence > 0
                    ? Math.round((data.confidenceDistribution.medium / totalConfidence) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all"
                  style={{
                    width: `${totalConfidence > 0 ? (data.confidenceDistribution.medium / totalConfidence) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Low */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Baja (0-49%)</span>
                <span className="font-medium text-red-600">
                  {data.confidenceDistribution.low} (
                  {totalConfidence > 0
                    ? Math.round((data.confidenceDistribution.low / totalConfidence) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{
                    width: `${totalConfidence > 0 ? (data.confidenceDistribution.low / totalConfidence) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Intent Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tipos de Consulta</h3>

          <div className="space-y-3">
            {data.intentBreakdown.slice(0, 6).map((item) => (
              <div key={item.intent} className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${INTENT_COLORS[item.intent] || 'bg-gray-400'}`}
                />
                <span className="flex-1 text-sm text-gray-600">
                  {INTENT_LABELS[item.intent] || item.intent}
                </span>
                <span className="text-sm font-medium text-gray-900">{item.count}</span>
                <span className="text-xs text-gray-400 w-10 text-right">{item.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Stats Chart */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-400" />
          Interacciones Diarias (últimos 7 días)
        </h3>

        <div className="h-48 flex items-end gap-2">
          {data.dailyStats.map((day) => {
            const maxTotal = Math.max(...data.dailyStats.map((d) => d.total)) || 1;
            const height = (day.total / maxTotal) * 100;
            const resolvedHeight = day.total > 0 ? (day.resolved / day.total) * height : 0;

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center" style={{ height: '160px' }}>
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className="w-full bg-gray-200 rounded-t relative overflow-hidden"
                      style={{ height: `${height}%` }}
                    >
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-green-500"
                        style={{ height: `${resolvedHeight}%` }}
                      />
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(day.date).toLocaleDateString('es-AR', { weekday: 'short' })}
                </span>
                <span className="text-xs font-medium text-gray-700">{day.total}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span className="text-gray-600">Resueltas por IA</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-200 rounded" />
            <span className="text-gray-600">Transferidas</span>
          </div>
        </div>
      </div>

      {/* Top Questions */}
      {data.topQuestions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-gray-400" />
            Preguntas Frecuentes
          </h3>

          <div className="space-y-3">
            {data.topQuestions.map((q, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600 flex-1">&quot;{q.question}...&quot;</span>
                <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                  {q.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

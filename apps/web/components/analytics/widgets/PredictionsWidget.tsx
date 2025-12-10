'use client';

/**
 * Predictions Widget Component
 * ============================
 *
 * Phase 10.5: Predictive Analytics
 * Compact widget showing key predictions for the overview dashboard.
 */

import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  DollarSign,
  ChevronRight,
  RefreshCw,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

interface PredictionsSummary {
  demand: {
    forecasts: { date: string; predictedDemand: number }[];
    accuracy: { mape: number };
  };
  revenue: {
    currentMRR: number;
    growthRate: number;
    scenarios: { name: string; nextMonth: number; sixMonths: number }[];
  };
  churn: {
    summary: {
      totalAtRisk: number;
      highRiskCount: number;
      potentialRevenueLoss: number;
    };
    topRisks: { customerName: string; riskLevel: string; riskScore: number }[];
  };
  anomalies: {
    summary: {
      totalAnomalies: number;
      criticalCount: number;
      warningCount: number;
    };
    recent: { type: string; severity: string; description: string }[];
  };
}

interface PredictionsWidgetProps {
  compact?: boolean;
  className?: string;
}

export default function PredictionsWidget({ compact = false, className = '' }: PredictionsWidgetProps) {
  const { data, isLoading, refetch, isFetching } = useQuery<PredictionsSummary>({
    queryKey: ['predictions-widget'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/predictions?type=all');
      if (!response.ok) throw new Error('Failed to fetch predictions');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      notation: 'compact',
    }).format(value);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
        <div className="text-center text-gray-500 py-8">
          No se pudieron cargar las predicciones
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-green-600" />
            <h4 className="font-medium text-gray-900">Predicciones</h4>
          </div>
          <Link href="/dashboard/analytics/predictions" className="text-xs text-green-600 hover:text-green-700">
            Ver todo
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600">7 días</p>
            <p className="text-lg font-bold text-blue-700">
              {data.demand.forecasts.slice(0, 7).reduce((s, f) => s + f.predictedDemand, 0)}
            </p>
            <p className="text-xs text-blue-500">trabajos</p>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-600">En riesgo</p>
            <p className="text-lg font-bold text-amber-700">{data.churn.summary.totalAtRisk}</p>
            <p className="text-xs text-amber-500">clientes</p>
          </div>
        </div>

        {data.anomalies.summary.criticalCount > 0 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm text-red-700">
              {data.anomalies.summary.criticalCount} anomalía(s) crítica(s)
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">Predicciones Inteligentes</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw size={16} className={`text-gray-500 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/dashboard/analytics/predictions"
            className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
          >
            Ver detalles <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Demand Forecast */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Demanda</span>
            </div>
            <p className="text-2xl font-bold text-blue-800">
              {data.demand.forecasts.slice(0, 7).reduce((s, f) => s + f.predictedDemand, 0)}
            </p>
            <p className="text-xs text-blue-600">trabajos próx. 7 días</p>
            <div className="mt-2 text-xs text-blue-500">
              Precisión: {(100 - data.demand.accuracy.mape).toFixed(0)}%
            </div>
          </div>

          {/* Revenue Growth */}
          <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={18} className="text-green-600" />
              <span className="text-sm font-medium text-green-700">Ingresos</span>
            </div>
            <p className="text-2xl font-bold text-green-800">
              {data.revenue.growthRate > 0 ? '+' : ''}{data.revenue.growthRate.toFixed(1)}%
            </p>
            <p className="text-xs text-green-600">crecimiento mensual</p>
            <div className="mt-2 text-xs text-green-500">
              MRR: {formatCurrency(data.revenue.currentMRR)}
            </div>
          </div>

          {/* Churn Risk */}
          <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Users size={18} className="text-amber-600" />
              <span className="text-sm font-medium text-amber-700">Churn</span>
            </div>
            <p className="text-2xl font-bold text-amber-800">
              {data.churn.summary.totalAtRisk}
            </p>
            <p className="text-xs text-amber-600">clientes en riesgo</p>
            <div className="mt-2 text-xs text-amber-500">
              {data.churn.summary.highRiskCount} alto riesgo
            </div>
          </div>

          {/* Anomalies */}
          <div className={`p-4 rounded-xl ${
            data.anomalies.summary.criticalCount > 0
              ? 'bg-gradient-to-br from-red-50 to-red-100'
              : 'bg-gradient-to-br from-gray-50 to-gray-100'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} className={data.anomalies.summary.criticalCount > 0 ? 'text-red-600' : 'text-gray-600'} />
              <span className={`text-sm font-medium ${data.anomalies.summary.criticalCount > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                Anomalías
              </span>
            </div>
            <p className={`text-2xl font-bold ${data.anomalies.summary.criticalCount > 0 ? 'text-red-800' : 'text-gray-800'}`}>
              {data.anomalies.summary.totalAnomalies}
            </p>
            <p className={`text-xs ${data.anomalies.summary.criticalCount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              detectadas
            </p>
            {data.anomalies.summary.criticalCount > 0 && (
              <div className="mt-2 text-xs text-red-500 font-medium">
                ⚠️ {data.anomalies.summary.criticalCount} crítica(s)
              </div>
            )}
          </div>
        </div>

        {/* Revenue Scenarios */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Proyección de Ingresos (6 meses)</h4>
          <div className="grid grid-cols-3 gap-3">
            {data.revenue.scenarios.map((scenario) => (
              <div key={scenario.name} className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-xs text-gray-500 mb-1">{scenario.name}</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(scenario.sixMonths)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Risks */}
        {data.churn.topRisks.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Clientes en Mayor Riesgo</h4>
            <div className="space-y-2">
              {data.churn.topRisks.slice(0, 3).map((risk, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-2 rounded-lg border ${
                    risk.riskLevel === 'critical' || risk.riskLevel === 'high'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <span className="text-sm font-medium text-gray-900">{risk.customerName}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-12 bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          risk.riskScore >= 70 ? 'bg-red-500' : risk.riskScore >= 50 ? 'bg-orange-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${risk.riskScore}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded uppercase ${
                      risk.riskLevel === 'critical' || risk.riskLevel === 'high'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {risk.riskLevel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Anomalies */}
        {data.anomalies.recent.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Anomalías Recientes</h4>
            <div className="space-y-2">
              {data.anomalies.recent.slice(0, 3).map((anomaly, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    anomaly.severity === 'critical'
                      ? 'bg-red-50'
                      : anomaly.severity === 'warning'
                      ? 'bg-amber-50'
                      : 'bg-blue-50'
                  }`}
                >
                  <AlertTriangle
                    size={14}
                    className={
                      anomaly.severity === 'critical'
                        ? 'text-red-500'
                        : anomaly.severity === 'warning'
                        ? 'text-amber-500'
                        : 'text-blue-500'
                    }
                  />
                  <span className="text-sm text-gray-700 flex-1 truncate">{anomaly.description}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded uppercase ${
                    anomaly.severity === 'critical'
                      ? 'bg-red-100 text-red-700'
                      : anomaly.severity === 'warning'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {anomaly.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact card for sidebar/quick view
export function PredictionsQuickCard() {
  const { data, isLoading } = useQuery<PredictionsSummary>({
    queryKey: ['predictions-widget'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/predictions?type=all');
      if (!response.ok) throw new Error('Failed to fetch predictions');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data) return null;

  const hasIssues = data.anomalies.summary.criticalCount > 0 || data.churn.summary.highRiskCount > 0;

  return (
    <Link
      href="/dashboard/analytics/predictions"
      className={`block p-3 rounded-lg border transition-colors ${
        hasIssues
          ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className={hasIssues ? 'text-amber-600' : 'text-gray-600'} />
          <span className="text-sm font-medium text-gray-900">Predicciones</span>
        </div>
        {hasIssues && (
          <span className="px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full">
            {data.anomalies.summary.criticalCount + data.churn.summary.highRiskCount}
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Demanda 7d:</span>
          <span className="ml-1 font-medium">
            {data.demand.forecasts.slice(0, 7).reduce((s, f) => s + f.predictedDemand, 0)}
          </span>
        </div>
        <div>
          <span className="text-gray-500">En riesgo:</span>
          <span className="ml-1 font-medium">{data.churn.summary.totalAtRisk}</span>
        </div>
      </div>
    </Link>
  );
}

'use client';

/**
 * Predictions Dashboard Page
 * ==========================
 *
 * Phase 10.5: Predictive Analytics
 * Displays demand forecasting, revenue projections, churn predictions, and anomaly detection.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  DollarSign,
  Calendar,
  Target,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

import KPICard, { KPIGrid } from '../../../../components/analytics/widgets/KPICard';
import AreaChart from '../../../../components/analytics/charts/AreaChart';
import BarChart from '../../../../components/analytics/charts/BarChart';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface DemandForecast {
  forecasts: {
    date: string;
    predictedDemand: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
  }[];
  accuracy: {
    mape: number;
    rmse: number;
  };
}

interface RevenueProjection {
  currentMRR: number;
  historicalGrowthRate: number;
  scenarios: {
    name: string;
    projections: {
      month: string;
      projectedRevenue: number;
    }[];
  }[];
  projectionFactors: {
    factor: string;
    impact: string;
    confidence: number;
  }[];
}

interface ChurnAnalysis {
  summary: {
    totalAtRisk: number;
    highRiskCount: number;
    mediumRiskCount: number;
    potentialRevenueLoss: number;
    churnRate: number;
  };
  trends: {
    period: string;
    churned: number;
    atRisk: number;
  }[];
  highRiskCustomers: {
    customerId: string;
    customerName: string;
    riskScore: number;
    riskLevel: string;
    recommendedActions: string[];
    potentialRevenueLoss: number;
  }[];
}

interface AnomalyData {
  anomalies: {
    id: string;
    type: string;
    severity: 'critical' | 'warning' | 'info';
    metric: string;
    expectedValue: number;
    actualValue: number;
    deviation: number;
    detectedAt: string;
    description: string;
    possibleCauses: string[];
  }[];
  summary: {
    totalAnomalies: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
  baselines: {
    metric: string;
    mean: number;
    stdDev: number;
    upperThreshold: number;
    lowerThreshold: number;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PredictionsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'demand' | 'revenue' | 'churn' | 'anomalies'>('overview');

  // Fetch all predictions
  const { data: allPredictions, isLoading: isLoadingAll, refetch, isFetching } = useQuery<{
    demand: { forecasts: { date: string; predictedDemand: number }[]; accuracy: { mape: number } };
    revenue: { currentMRR: number; growthRate: number; scenarios: { name: string; nextMonth: number; sixMonths: number }[] };
    churn: { summary: ChurnAnalysis['summary']; topRisks: { customerId: string; customerName: string; riskScore: number; riskLevel: string }[] };
    anomalies: { summary: AnomalyData['summary']; recent: { type: string; severity: string; description: string; detectedAt: string }[] };
  }>({
    queryKey: ['predictions-all'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/predictions?type=all');
      if (!response.ok) throw new Error('Failed to fetch predictions');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch detailed demand forecast
  const { data: demandData, isLoading: isLoadingDemand } = useQuery<{ forecast: DemandForecast; peakPeriods: { dayOfWeek: number; hour: number; avgDemand: number }[] }>({
    queryKey: ['predictions-demand'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/predictions?type=demand&days=30');
      if (!response.ok) throw new Error('Failed to fetch demand forecast');
      return response.json();
    },
    enabled: activeTab === 'demand',
    staleTime: 10 * 60 * 1000,
  });

  // Fetch detailed revenue projections
  const { data: revenueData, isLoading: isLoadingRevenue } = useQuery<{ projections: RevenueProjection; milestones: { targetRevenue: number; estimatedDate: string | null; probability: number }[] }>({
    queryKey: ['predictions-revenue'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/predictions?type=revenue&months=12');
      if (!response.ok) throw new Error('Failed to fetch revenue projections');
      return response.json();
    },
    enabled: activeTab === 'revenue',
    staleTime: 10 * 60 * 1000,
  });

  // Fetch detailed churn analysis
  const { data: churnData, isLoading: isLoadingChurn } = useQuery<{ summary: ChurnAnalysis['summary']; trends: ChurnAnalysis['trends']; highRiskCustomers: ChurnAnalysis['highRiskCustomers'] }>({
    queryKey: ['predictions-churn'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/predictions?type=churn&limit=20');
      if (!response.ok) throw new Error('Failed to fetch churn analysis');
      return response.json();
    },
    enabled: activeTab === 'churn',
    staleTime: 10 * 60 * 1000,
  });

  // Fetch detailed anomalies
  const { data: anomalyData, isLoading: isLoadingAnomalies } = useQuery<AnomalyData>({
    queryKey: ['predictions-anomalies'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/predictions?type=anomalies');
      if (!response.ok) throw new Error('Failed to fetch anomalies');
      return response.json();
    },
    enabled: activeTab === 'anomalies',
    staleTime: 5 * 60 * 1000,
  });

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: Activity },
    { id: 'demand', label: 'Demanda', icon: TrendingUp },
    { id: 'revenue', label: 'Ingresos', icon: DollarSign },
    { id: 'churn', label: 'Churn', icon: Users },
    { id: 'anomalies', label: 'Anomalías', icon: AlertTriangle },
  ] as const;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      notation: 'compact',
    }).format(value);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'warning': return 'text-amber-600 bg-amber-100';
      case 'info': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium': return 'text-amber-600 bg-amber-100 border-amber-200';
      case 'low': return 'text-green-600 bg-green-100 border-green-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/analytics/overview"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Predicciones Analíticas</h1>
            <p className="text-gray-600 mt-1">Pronósticos, proyecciones y detección de anomalías</p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        isLoadingAll ? (
          <LoadingSpinner />
        ) : allPredictions ? (
          <div className="space-y-6">
            {/* Summary KPIs */}
            <KPIGrid columns={4}>
              <KPICard
                title="Próxima Semana"
                value={allPredictions.demand.forecasts.slice(0, 7).reduce((s, f) => s + f.predictedDemand, 0)}
                unit="number"
                trend="stable"
                description="Trabajos pronosticados"
                icon={<TrendingUp size={24} />}
                color="blue"
              />
              <KPICard
                title="Crecimiento MRR"
                value={allPredictions.revenue.growthRate}
                unit="percentage"
                trend={allPredictions.revenue.growthRate > 0 ? 'up' : 'down'}
                description="Tasa mensual"
                icon={<DollarSign size={24} />}
                color="green"
              />
              <KPICard
                title="Clientes en Riesgo"
                value={allPredictions.churn.summary.totalAtRisk}
                unit="number"
                trend={allPredictions.churn.summary.totalAtRisk > 5 ? 'down' : 'stable'}
                description={`${allPredictions.churn.summary.highRiskCount} alto riesgo`}
                icon={<Users size={24} />}
                color="amber"
              />
              <KPICard
                title="Anomalías Activas"
                value={allPredictions.anomalies.summary.totalAnomalies}
                unit="number"
                trend={allPredictions.anomalies.summary.criticalCount > 0 ? 'down' : 'stable'}
                description={`${allPredictions.anomalies.summary.criticalCount} críticas`}
                icon={<AlertTriangle size={24} />}
                color={allPredictions.anomalies.summary.criticalCount > 0 ? 'red' : 'gray'}
              />
            </KPIGrid>

            {/* Quick Overview Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Scenarios */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Proyección de Ingresos (6 meses)</h3>
                <div className="space-y-3">
                  {allPredictions.revenue.scenarios.map((scenario) => (
                    <div key={scenario.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{scenario.name}</p>
                        <p className="text-sm text-gray-500">Próximo mes: {formatCurrency(scenario.nextMonth)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(scenario.sixMonths)}</p>
                        <p className="text-xs text-gray-500">En 6 meses</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setActiveTab('revenue')}
                  className="mt-4 flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
                >
                  Ver detalles <ChevronRight size={16} />
                </button>
              </div>

              {/* Top Churn Risks */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Clientes en Mayor Riesgo</h3>
                {allPredictions.churn.topRisks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                    <p>No hay clientes en alto riesgo</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allPredictions.churn.topRisks.map((customer) => (
                      <div
                        key={customer.customerId}
                        className={`flex items-center justify-between p-3 rounded-lg border ${getRiskColor(customer.riskLevel)}`}
                      >
                        <div>
                          <p className="font-medium">{customer.customerName}</p>
                          <p className="text-xs opacity-75">Score: {customer.riskScore}/100</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium uppercase`}>
                          {customer.riskLevel}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setActiveTab('churn')}
                  className="mt-4 flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
                >
                  Ver análisis completo <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Recent Anomalies */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Anomalías Recientes</h3>
              {allPredictions.anomalies.recent.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                  <p>No se detectaron anomalías</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allPredictions.anomalies.recent.map((anomaly, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className={`p-2 rounded-lg ${getSeverityColor(anomaly.severity)}`}>
                        <AlertCircle size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{anomaly.description}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(anomaly.detectedAt).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${getSeverityColor(anomaly.severity)}`}>
                        {anomaly.severity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setActiveTab('anomalies')}
                className="mt-4 flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
              >
                Ver todas las anomalías <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <ErrorMessage />
        )
      )}

      {activeTab === 'demand' && (
        isLoadingDemand ? (
          <LoadingSpinner />
        ) : demandData ? (
          <div className="space-y-6">
            {/* Accuracy metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Target size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Precisión del Modelo</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(100 - demandData.forecast.accuracy.mape).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Calendar size={24} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Pronóstico 7 días</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {demandData.forecast.forecasts.slice(0, 7).reduce((s, f) => s + f.predictedDemand, 0)} trabajos
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <TrendingUp size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Pronóstico 30 días</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {demandData.forecast.forecasts.reduce((s, f) => s + f.predictedDemand, 0)} trabajos
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Forecast chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pronóstico de Demanda</h3>
              <AreaChart
                data={demandData.forecast.forecasts.map((f) => ({
                  label: new Date(f.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
                  value: f.predictedDemand,
                }))}
                height={300}
                color="#3b82f6"
              />
            </div>

            {/* Peak periods */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Períodos de Mayor Demanda</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {demandData.peakPeriods.slice(0, 8).map((peak, i) => {
                  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                  return (
                    <div key={i} className="p-4 bg-gray-50 rounded-lg text-center">
                      <p className="font-medium text-gray-900">{days[peak.dayOfWeek]}</p>
                      <p className="text-sm text-gray-500">{peak.hour}:00 hrs</p>
                      <p className="text-lg font-bold text-blue-600">{peak.avgDemand.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">promedio</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <ErrorMessage />
        )
      )}

      {activeTab === 'revenue' && (
        isLoadingRevenue ? (
          <LoadingSpinner />
        ) : revenueData ? (
          <div className="space-y-6">
            {/* Revenue KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <DollarSign size={24} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">MRR Actual</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(revenueData.projections.currentMRR)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <TrendingUp size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Crecimiento Histórico</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {revenueData.projections.historicalGrowthRate.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Target size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Meta $1M</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {revenueData.milestones[0]?.estimatedDate
                        ? new Date(revenueData.milestones[0].estimatedDate).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Scenarios chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Escenarios de Proyección (12 meses)</h3>
              <div className="space-y-6">
                {revenueData.projections.scenarios.map((scenario) => (
                  <div key={scenario.name}>
                    <p className="text-sm font-medium text-gray-700 mb-2">{scenario.name}</p>
                    <BarChart
                      data={scenario.projections.map((p) => ({
                        label: new Date(p.month).toLocaleDateString('es-AR', { month: 'short' }),
                        value: p.projectedRevenue,
                      }))}
                      height={100}
                      orientation="vertical"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Projection factors */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Factores de Proyección</h3>
              <div className="space-y-3">
                {revenueData.projections.projectionFactors.map((factor, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{factor.factor}</p>
                      <p className="text-sm text-gray-500">{factor.impact}</p>
                    </div>
                    <div className="w-24">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${factor.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round(factor.confidence * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ErrorMessage />
        )
      )}

      {activeTab === 'churn' && (
        isLoadingChurn ? (
          <LoadingSpinner />
        ) : churnData ? (
          <div className="space-y-6">
            {/* Churn KPIs */}
            <KPIGrid columns={4}>
              <KPICard
                title="Clientes en Riesgo"
                value={churnData.summary.totalAtRisk}
                unit="number"
                trend={churnData.summary.totalAtRisk > 5 ? 'down' : 'stable'}
                icon={<Users size={24} />}
                color="amber"
              />
              <KPICard
                title="Alto Riesgo"
                value={churnData.summary.highRiskCount}
                unit="number"
                trend={churnData.summary.highRiskCount > 3 ? 'down' : 'stable'}
                icon={<AlertTriangle size={24} />}
                color="red"
              />
              <KPICard
                title="Pérdida Potencial"
                value={churnData.summary.potentialRevenueLoss}
                unit="currency"
                trend="down"
                icon={<DollarSign size={24} />}
                color="red"
              />
              <KPICard
                title="Tasa de Churn"
                value={churnData.summary.churnRate}
                unit="percentage"
                trend={churnData.summary.churnRate > 10 ? 'down' : 'up'}
                icon={<TrendingDown size={24} />}
                color={churnData.summary.churnRate > 10 ? 'red' : 'green'}
              />
            </KPIGrid>

            {/* Churn trends */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencia de Churn</h3>
              <AreaChart
                data={churnData.trends.map((t) => ({
                  label: t.period,
                  value: t.churned,
                }))}
                height={200}
                color="#ef4444"
              />
            </div>

            {/* High risk customers table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Clientes en Riesgo de Churn</h3>
              </div>
              {churnData.highRiskCustomers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                  <p>No hay clientes en alto riesgo</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Riesgo</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Pérdida Potencial</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones Recomendadas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {churnData.highRiskCustomers.map((customer) => (
                      <tr key={customer.customerId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{customer.customerName}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${getRiskColor(customer.riskLevel)}`}>
                            {customer.riskLevel}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${customer.riskScore >= 70 ? 'bg-red-500' : customer.riskScore >= 50 ? 'bg-orange-500' : 'bg-amber-500'}`}
                                style={{ width: `${customer.riskScore}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{customer.riskScore}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {formatCurrency(customer.potentialRevenueLoss)}
                        </td>
                        <td className="px-6 py-4">
                          <ul className="text-sm text-gray-600 space-y-1">
                            {customer.recommendedActions.slice(0, 2).map((action, i) => (
                              <li key={i} className="flex items-center gap-1">
                                <ChevronRight size={12} className="text-gray-400" />
                                {action}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <ErrorMessage />
        )
      )}

      {activeTab === 'anomalies' && (
        isLoadingAnomalies ? (
          <LoadingSpinner />
        ) : anomalyData ? (
          <div className="space-y-6">
            {/* Anomaly summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <AlertCircle size={24} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Anomalías</p>
                    <p className="text-2xl font-bold text-gray-900">{anomalyData.summary.totalAnomalies}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-red-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <AlertTriangle size={24} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Críticas</p>
                    <p className="text-2xl font-bold text-red-600">{anomalyData.summary.criticalCount}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-100 rounded-lg">
                    <AlertCircle size={24} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Advertencias</p>
                    <p className="text-2xl font-bold text-amber-600">{anomalyData.summary.warningCount}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-blue-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <AlertCircle size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Informativas</p>
                    <p className="text-2xl font-bold text-blue-600">{anomalyData.summary.infoCount}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Anomalies list */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Anomalías Detectadas</h3>
              </div>
              {anomalyData.anomalies.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                  <p>No se detectaron anomalías</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {anomalyData.anomalies.map((anomaly) => (
                    <div key={anomaly.id} className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${getSeverityColor(anomaly.severity)}`}>
                          <AlertCircle size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{anomaly.description}</h4>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${getSeverityColor(anomaly.severity)}`}>
                              {anomaly.severity}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mb-2">
                            <Clock size={14} className="inline mr-1" />
                            {new Date(anomaly.detectedAt).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {' · '}
                            Esperado: {anomaly.expectedValue.toLocaleString('es-AR')} · Actual: {anomaly.actualValue.toLocaleString('es-AR')}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {anomaly.possibleCauses.map((cause, i) => (
                              <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                {cause}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Metric baselines */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Líneas Base de Métricas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {anomalyData.baselines.map((baseline) => (
                  <div key={baseline.metric} className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900 mb-2">{baseline.metric.replace(/_/g, ' ')}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Media</p>
                        <p className="font-medium">{baseline.mean.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Desv. Est.</p>
                        <p className="font-medium">{baseline.stdDev.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Umbral Superior</p>
                        <p className="font-medium text-red-600">{baseline.upperThreshold.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Umbral Inferior</p>
                        <p className="font-medium text-blue-600">{baseline.lowerThreshold.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ErrorMessage />
        )
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
    </div>
  );
}

function ErrorMessage() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      No se pudieron cargar los datos
    </div>
  );
}

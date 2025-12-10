'use client';

/**
 * Operations Analytics Page
 * =========================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Detailed operations analytics with job metrics, SLA, and efficiency.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Download,
  RefreshCw,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';

import KPICard, { KPIGrid } from '../../../../components/analytics/widgets/KPICard';
import AreaChart from '../../../../components/analytics/charts/AreaChart';
import BarChart from '../../../../components/analytics/charts/BarChart';
import PieChart from '../../../../components/analytics/charts/PieChart';
import HeatMap, { TimeHeatMap } from '../../../../components/analytics/charts/HeatMap';
import DateRangePicker, { DateRangePreset } from '../../../../components/analytics/filters/DateRangePicker';
import ServiceTypeFilter from '../../../../components/analytics/filters/ServiceTypeFilter';

interface OperationsData {
  kpis: {
    totalJobs: { value: number; change: number };
    completedJobs: { value: number; change: number };
    completionRate: { value: number; change: number };
    avgDuration: { value: number; change: number };
    slaCompliance: { value: number; change: number };
    cancelledJobs: { value: number; change: number };
  };
  jobsTrend: { label: string; value: number }[];
  jobsByStatus: { label: string; value: number; color: string }[];
  jobsByService: { label: string; value: number }[];
  jobsByUrgency: { label: string; value: number; color: string }[];
  activityHeatmap: { day: number; hour: number; value: number }[];
  slaByUrgency: { label: string; value: number }[];
}

export default function OperationsAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRangePreset>('month');
  const [serviceType, setServiceType] = useState<string | 'all'>('all');

  const { data, isLoading, refetch, isFetching } = useQuery<OperationsData>({
    queryKey: ['analytics-operations', dateRange, serviceType],
    queryFn: async () => {
      const params = new URLSearchParams({ range: dateRange });
      if (serviceType !== 'all') params.append('serviceType', serviceType);
      const response = await fetch(`/api/analytics/operations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch operations data');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

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
            <h1 className="text-2xl font-bold text-gray-900">Analytics de Operaciones</h1>
            <p className="text-gray-600 mt-1">Análisis de trabajos, eficiencia y cumplimiento de SLA</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ServiceTypeFilter value={serviceType} onChange={(v) => setServiceType(v as string | 'all')} />
          <DateRangePicker value={dateRange} onChange={(v) => setDateRange(v as DateRangePreset)} />
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw size={20} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Download size={18} />
            Exportar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
        </div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <KPIGrid columns={3}>
            <KPICard
              title="Total Trabajos"
              value={data.kpis.totalJobs.value}
              unit="number"
              trend={data.kpis.totalJobs.change > 0 ? 'up' : data.kpis.totalJobs.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.totalJobs.change}
              icon={<Briefcase size={24} />}
              color="blue"
            />
            <KPICard
              title="Trabajos Completados"
              value={data.kpis.completedJobs.value}
              unit="number"
              trend={data.kpis.completedJobs.change > 0 ? 'up' : data.kpis.completedJobs.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.completedJobs.change}
              icon={<CheckCircle size={24} />}
              color="green"
            />
            <KPICard
              title="Tasa de Completado"
              value={data.kpis.completionRate.value}
              unit="percentage"
              trend={data.kpis.completionRate.change > 0 ? 'up' : data.kpis.completionRate.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.completionRate.change}
              icon={<CheckCircle size={24} />}
              color="green"
            />
            <KPICard
              title="Duración Promedio"
              value={data.kpis.avgDuration.value}
              unit="hours"
              trend={data.kpis.avgDuration.change < 0 ? 'up' : data.kpis.avgDuration.change > 0 ? 'down' : 'stable'}
              changePercent={Math.abs(data.kpis.avgDuration.change)}
              icon={<Clock size={24} />}
              color="amber"
              description="Menos es mejor"
            />
            <KPICard
              title="Cumplimiento SLA"
              value={data.kpis.slaCompliance.value}
              unit="percentage"
              trend={data.kpis.slaCompliance.change > 0 ? 'up' : data.kpis.slaCompliance.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.slaCompliance.change}
              icon={<AlertTriangle size={24} />}
              color="purple"
            />
            <KPICard
              title="Trabajos Cancelados"
              value={data.kpis.cancelledJobs.value}
              unit="number"
              trend={data.kpis.cancelledJobs.change < 0 ? 'up' : data.kpis.cancelledJobs.change > 0 ? 'down' : 'stable'}
              changePercent={Math.abs(data.kpis.cancelledJobs.change)}
              icon={<XCircle size={24} />}
              color="red"
              description="Menos es mejor"
            />
          </KPIGrid>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencia de Trabajos</h3>
              <AreaChart
                data={data.jobsTrend}
                height={280}
                color="#3b82f6"
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado de Trabajos</h3>
              <PieChart
                data={data.jobsByStatus}
                size={200}
                donut={true}
              />
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Trabajos por Tipo de Servicio</h3>
              <BarChart
                data={data.jobsByService}
                height={220}
                orientation="horizontal"
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Trabajos por Urgencia</h3>
              <BarChart
                data={data.jobsByUrgency}
                height={220}
                orientation="horizontal"
              />
            </div>
          </div>

          {/* Charts Row 3 - Heatmap */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mapa de Actividad</h3>
            <TimeHeatMap
              data={data.activityHeatmap}
              colorScale="blue"
              formatValue={(v) => `${v} trabajos`}
            />
          </div>

          {/* SLA Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cumplimiento SLA por Urgencia</h3>
            <BarChart
              data={data.slaByUrgency}
              height={180}
              orientation="vertical"
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No se pudieron cargar los datos
        </div>
      )}
    </div>
  );
}

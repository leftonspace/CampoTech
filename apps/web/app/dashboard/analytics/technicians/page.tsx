'use client';

/**
 * Technicians Analytics Page
 * ==========================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Technician performance leaderboard and efficiency metrics.
 */

import { useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Clock,
  Star,
  Award,
  ArrowLeft,
  Download,
  RefreshCw,
  TrendingUp,
  Target,
} from 'lucide-react';
import Link from 'next/link';

import KPICard, { KPIGrid } from '../../../../components/analytics/widgets/KPICard';
import LeaderBoard from '../../../../components/analytics/widgets/LeaderBoard';
import BarChart from '../../../../components/analytics/charts/BarChart';
import DateRangePicker, { DateRangePreset } from '../../../../components/analytics/filters/DateRangePicker';

interface TechnicianData {
  id: string;
  name: string;
  avatar?: string;
  jobsCompleted: number;
  avgRating: number;
  revenue: number;
  efficiency: number;
  slaCompliance: number;
  avgDuration: number;
  trend: 'up' | 'down' | 'stable';
}

interface TechniciansData {
  kpis: {
    totalTechnicians: { value: number; change: number };
    avgJobsPerTech: { value: number; change: number };
    avgEfficiency: { value: number; change: number };
    avgRating: { value: number; change: number };
    topPerformerJobs: { value: number; name: string };
    avgSLA: { value: number; change: number };
  };
  technicians: TechnicianData[];
  performanceByTech: { label: string; value: number }[];
  revenueByTech: { label: string; value: number }[];
  efficiencyTrend: { label: string; value: number }[];
}

export default function TechniciansAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRangePreset>('month');
  const [sortBy, setSortBy] = useState<'jobs' | 'revenue' | 'rating' | 'efficiency'>('jobs');

  const { data, isLoading, refetch, isFetching } = useQuery<TechniciansData>({
    queryKey: ['analytics-technicians', dateRange],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/technicians?range=${dateRange}`);
      if (!response.ok) throw new Error('Failed to fetch technicians data');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const sortedTechnicians = data?.technicians?.slice().sort((a, b) => {
    switch (sortBy) {
      case 'jobs':
        return b.jobsCompleted - a.jobsCompleted;
      case 'revenue':
        return b.revenue - a.revenue;
      case 'rating':
        return b.avgRating - a.avgRating;
      case 'efficiency':
        return b.efficiency - a.efficiency;
      default:
        return 0;
    }
  }) || [];

  const leaderboardItems = sortedTechnicians.map((tech) => ({
    id: tech.id,
    name: tech.name,
    avatar: tech.avatar,
    value: sortBy === 'jobs' ? tech.jobsCompleted :
      sortBy === 'revenue' ? tech.revenue :
        sortBy === 'rating' ? tech.avgRating :
          tech.efficiency,
    secondaryValue: tech.revenue,
    trend: tech.trend,
  }));

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
            <h1 className="text-2xl font-bold text-gray-900">Analytics de Técnicos</h1>
            <p className="text-gray-600 mt-1">Rendimiento y eficiencia del equipo técnico</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
              title="Técnicos Activos"
              value={data.kpis.totalTechnicians.value}
              unit="number"
              trend={data.kpis.totalTechnicians.change > 0 ? 'up' : data.kpis.totalTechnicians.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.totalTechnicians.change}
              icon={<Users size={24} />}
              color="blue"
            />
            <KPICard
              title="Trabajos/Técnico"
              value={data.kpis.avgJobsPerTech.value}
              unit="number"
              trend={data.kpis.avgJobsPerTech.change > 0 ? 'up' : data.kpis.avgJobsPerTech.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.avgJobsPerTech.change}
              icon={<Target size={24} />}
              color="green"
            />
            <KPICard
              title="Eficiencia Promedio"
              value={data.kpis.avgEfficiency.value}
              unit="percentage"
              trend={data.kpis.avgEfficiency.change > 0 ? 'up' : data.kpis.avgEfficiency.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.avgEfficiency.change}
              icon={<TrendingUp size={24} />}
              color="purple"
            />
            <KPICard
              title="Rating Promedio"
              value={data.kpis.avgRating.value}
              unit="number"
              trend={data.kpis.avgRating.change > 0 ? 'up' : data.kpis.avgRating.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.avgRating.change}
              icon={<Star size={24} />}
              color="amber"
              description="De 5 estrellas"
            />
            <KPICard
              title="Cumplimiento SLA"
              value={data.kpis.avgSLA.value}
              unit="percentage"
              trend={data.kpis.avgSLA.change > 0 ? 'up' : data.kpis.avgSLA.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.avgSLA.change}
              icon={<Clock size={24} />}
              color="green"
            />
            <KPICard
              title="Top Performer"
              value={`${data.kpis.topPerformerJobs.value} trabajos`}
              trend="up"
              icon={<Award size={24} />}
              color="amber"
              description={data.kpis.topPerformerJobs.name}
            />
          </KPIGrid>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Leaderboard */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Ranking de Técnicos</h3>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="jobs">Por Trabajos</option>
                    <option value="revenue">Por Ingresos</option>
                    <option value="rating">Por Rating</option>
                    <option value="efficiency">Por Eficiencia</option>
                  </select>
                </div>
                <LeaderBoard
                  title=""
                  items={leaderboardItems}
                  valueLabel={
                    sortBy === 'jobs' ? 'Trabajos' :
                      sortBy === 'revenue' ? 'Ingresos' :
                        sortBy === 'rating' ? 'Rating' :
                          'Eficiencia'
                  }
                  secondaryValueLabel="Ingresos generados"
                  unit={sortBy === 'revenue' ? 'currency' : sortBy === 'efficiency' ? 'percentage' : 'number'}
                  maxItems={10}
                  showTrend={true}
                />
              </div>
            </div>

            {/* Side Charts */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Trabajos por Técnico</h3>
                <BarChart
                  data={data.performanceByTech}
                  height={200}
                  orientation="horizontal"
                />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Ingresos por Técnico</h3>
                <BarChart
                  data={data.revenueByTech}
                  height={200}
                  orientation="horizontal"
                />
              </div>
            </div>
          </div>

          {/* Technician Detail Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Detalle de Rendimiento</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Técnico</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Trabajos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Eficiencia</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">SLA</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rating</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Duración Prom.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedTechnicians.map((tech) => (
                    <tr key={tech.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {tech.avatar ? (
                            <Image src={tech.avatar} alt={tech.name} width={32} height={32} className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                              <span className="text-xs font-medium text-green-700">
                                {tech.name.substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="font-medium text-gray-900">{tech.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-900">{tech.jobsCompleted}</td>
                      <td className="px-6 py-4 text-right text-gray-900">
                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', notation: 'compact' }).format(tech.revenue)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-medium ${tech.efficiency >= 80 ? 'text-green-600' : tech.efficiency >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {tech.efficiency.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-medium ${tech.slaCompliance >= 90 ? 'text-green-600' : tech.slaCompliance >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                          {tech.slaCompliance.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Star size={14} className="text-amber-400 fill-current" />
                          <span className="text-gray-900">{tech.avgRating.toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">{tech.avgDuration.toFixed(1)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

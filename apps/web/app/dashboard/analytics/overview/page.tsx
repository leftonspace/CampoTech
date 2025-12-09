'use client';

/**
 * Analytics Overview Dashboard
 * ============================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Main analytics dashboard with key metrics overview.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  Briefcase,
  Users,
  TrendingUp,
  Calendar,
  RefreshCw,
  Download,
  Settings,
} from 'lucide-react';

import KPICard, { KPIGrid } from '../../../../components/analytics/widgets/KPICard';
import AreaChart from '../../../../components/analytics/charts/AreaChart';
import BarChart from '../../../../components/analytics/charts/BarChart';
import PieChart from '../../../../components/analytics/charts/PieChart';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type DateRangePreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'ytd';

interface DashboardData {
  kpis: {
    totalRevenue: { value: number; change: number };
    totalJobs: { value: number; change: number };
    activeCustomers: { value: number; change: number };
    completionRate: { value: number; change: number };
    avgTicket: { value: number; change: number };
    collectionRate: { value: number; change: number };
  };
  revenueTrend: { label: string; value: number }[];
  jobsTrend: { label: string; value: number }[];
  revenueByService: { label: string; value: number }[];
  jobsByStatus: { label: string; value: number; color: string }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AnalyticsOverviewPage() {
  const [dateRange, setDateRange] = useState<DateRangePreset>('month');

  // Fetch dashboard data
  const { data, isLoading, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ['analytics-overview', dateRange],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/overview?range=${dateRange}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const dateRangeOptions: { value: DateRangePreset; label: string }[] = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Última semana' },
    { value: 'month', label: 'Último mes' },
    { value: 'quarter', label: 'Último trimestre' },
    { value: 'year', label: 'Último año' },
    { value: 'ytd', label: 'Este año' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Analytics</h1>
          <p className="text-gray-600 mt-1">
            Resumen de métricas clave del negocio
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={isFetching ? 'animate-spin' : ''} />
          </button>

          {/* Export Button */}
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
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
              title="Ingresos Totales"
              value={data.kpis.totalRevenue.value}
              unit="currency"
              trend={data.kpis.totalRevenue.change > 0 ? 'up' : data.kpis.totalRevenue.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.totalRevenue.change}
              icon={<DollarSign size={24} />}
              color="green"
            />

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
              title="Clientes Activos"
              value={data.kpis.activeCustomers.value}
              unit="number"
              trend={data.kpis.activeCustomers.change > 0 ? 'up' : data.kpis.activeCustomers.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.activeCustomers.change}
              icon={<Users size={24} />}
              color="purple"
            />

            <KPICard
              title="Tasa de Completado"
              value={data.kpis.completionRate.value}
              unit="percentage"
              trend={data.kpis.completionRate.change > 0 ? 'up' : data.kpis.completionRate.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.completionRate.change}
              icon={<TrendingUp size={24} />}
              color="green"
            />

            <KPICard
              title="Ticket Promedio"
              value={data.kpis.avgTicket.value}
              unit="currency"
              trend={data.kpis.avgTicket.change > 0 ? 'up' : data.kpis.avgTicket.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.avgTicket.change}
              icon={<DollarSign size={24} />}
              color="amber"
            />

            <KPICard
              title="Tasa de Cobro"
              value={data.kpis.collectionRate.value}
              unit="percentage"
              trend={data.kpis.collectionRate.change > 0 ? 'up' : data.kpis.collectionRate.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.collectionRate.change}
              icon={<DollarSign size={24} />}
              color="blue"
            />
          </KPIGrid>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Tendencia de Ingresos
              </h3>
              <AreaChart
                data={data.revenueTrend}
                height={250}
                color="#16a34a"
                formatValue={(v) =>
                  new Intl.NumberFormat('es-AR', {
                    style: 'currency',
                    currency: 'ARS',
                    notation: 'compact',
                  }).format(v)
                }
              />
            </div>

            {/* Jobs Trend */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Tendencia de Trabajos
              </h3>
              <AreaChart
                data={data.jobsTrend}
                height={250}
                color="#3b82f6"
              />
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Service */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Ingresos por Servicio
              </h3>
              <PieChart
                data={data.revenueByService}
                size={180}
                donut={true}
                formatValue={(v) =>
                  new Intl.NumberFormat('es-AR', {
                    style: 'currency',
                    currency: 'ARS',
                    notation: 'compact',
                  }).format(v)
                }
              />
            </div>

            {/* Jobs by Status */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Estado de Trabajos
              </h3>
              <BarChart
                data={data.jobsByStatus}
                height={200}
                orientation="horizontal"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Acciones Rápidas
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <QuickActionCard
                icon={<DollarSign size={20} />}
                title="Reporte de Ingresos"
                href="/dashboard/analytics/revenue"
              />
              <QuickActionCard
                icon={<Briefcase size={20} />}
                title="Reporte de Operaciones"
                href="/dashboard/analytics/operations"
              />
              <QuickActionCard
                icon={<Users size={20} />}
                title="Análisis de Clientes"
                href="/dashboard/analytics/customers"
              />
              <QuickActionCard
                icon={<Calendar size={20} />}
                title="Programar Reporte"
                href="/dashboard/analytics/reports"
              />
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

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  href: string;
}

function QuickActionCard({ icon, title, href }: QuickActionCardProps) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="p-2 bg-green-100 rounded-lg text-green-600">{icon}</div>
      <span className="font-medium text-gray-700">{title}</span>
    </a>
  );
}

'use client';

/**
 * Customers Analytics Page
 * ========================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Customer analytics with segmentation, CLV, and satisfaction metrics.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  UserMinus,
  Heart,
  ArrowLeft,
  Download,
  RefreshCw,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

import KPICard, { KPIGrid } from '../../../../components/analytics/widgets/KPICard';
import AreaChart from '../../../../components/analytics/charts/AreaChart';
import BarChart from '../../../../components/analytics/charts/BarChart';
import PieChart from '../../../../components/analytics/charts/PieChart';
import LeaderBoard from '../../../../components/analytics/widgets/LeaderBoard';
import DateRangePicker, { DateRangePreset } from '../../../../components/analytics/filters/DateRangePicker';

interface SegmentData {
  label: string;
  value: number;
  color: string;
}

interface CustomerData {
  id: string;
  name: string;
  segment: string;
  clv: number;
  totalSpent: number;
  jobCount: number;
  lastJob: string;
  churnRisk: 'low' | 'medium' | 'high';
}

interface CustomersData {
  kpis: {
    totalCustomers: { value: number; change: number };
    activeCustomers: { value: number; change: number };
    newCustomers: { value: number; change: number };
    churnedCustomers: { value: number; change: number };
    avgCLV: { value: number; change: number };
    satisfaction: { value: number; change: number };
  };
  customerGrowth: { label: string; value: number }[];
  segments: SegmentData[];
  topCustomers: { id: string; name: string; value: number; secondaryValue: number }[];
  cohortRetention: { label: string; value: number }[];
  satisfactionTrend: { label: string; value: number }[];
  churnRiskDistribution: SegmentData[];
  customersByFrequency: { label: string; value: number }[];
}

export default function CustomersAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRangePreset>('month');

  const { data, isLoading, refetch, isFetching } = useQuery<CustomersData>({
    queryKey: ['analytics-customers', dateRange],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/customers?range=${dateRange}`);
      if (!response.ok) throw new Error('Failed to fetch customers data');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const topCustomerItems = data?.topCustomers?.map((c) => ({
    id: c.id,
    name: c.name,
    value: c.value,
    secondaryValue: c.secondaryValue,
  })) || [];

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
            <h1 className="text-2xl font-bold text-gray-900">Analytics de Clientes</h1>
            <p className="text-gray-600 mt-1">Segmentación, valor y retención de clientes</p>
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
              title="Total Clientes"
              value={data.kpis.totalCustomers.value}
              unit="number"
              trend={data.kpis.totalCustomers.change > 0 ? 'up' : data.kpis.totalCustomers.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.totalCustomers.change}
              icon={<Users size={24} />}
              color="blue"
            />
            <KPICard
              title="Clientes Activos"
              value={data.kpis.activeCustomers.value}
              unit="number"
              trend={data.kpis.activeCustomers.change > 0 ? 'up' : data.kpis.activeCustomers.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.activeCustomers.change}
              icon={<Users size={24} />}
              color="green"
            />
            <KPICard
              title="Nuevos Clientes"
              value={data.kpis.newCustomers.value}
              unit="number"
              trend={data.kpis.newCustomers.change > 0 ? 'up' : data.kpis.newCustomers.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.newCustomers.change}
              icon={<UserPlus size={24} />}
              color="green"
            />
            <KPICard
              title="Clientes Perdidos"
              value={data.kpis.churnedCustomers.value}
              unit="number"
              trend={data.kpis.churnedCustomers.change < 0 ? 'up' : data.kpis.churnedCustomers.change > 0 ? 'down' : 'stable'}
              changePercent={Math.abs(data.kpis.churnedCustomers.change)}
              icon={<UserMinus size={24} />}
              color="red"
              description="Menos es mejor"
            />
            <KPICard
              title="CLV Promedio"
              value={data.kpis.avgCLV.value}
              unit="currency"
              trend={data.kpis.avgCLV.change > 0 ? 'up' : data.kpis.avgCLV.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.avgCLV.change}
              icon={<DollarSign size={24} />}
              color="amber"
              description="Valor de vida del cliente"
            />
            <KPICard
              title="Satisfacción"
              value={data.kpis.satisfaction.value}
              unit="percentage"
              trend={data.kpis.satisfaction.change > 0 ? 'up' : data.kpis.satisfaction.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.satisfaction.change}
              icon={<Heart size={24} />}
              color="purple"
            />
          </KPIGrid>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Crecimiento de Clientes</h3>
              <AreaChart
                data={data.customerGrowth}
                height={280}
                color="#3b82f6"
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Segmentación</h3>
              <PieChart
                data={data.segments}
                size={200}
                donut={true}
              />
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Clientes por CLV</h3>
              <LeaderBoard
                title=""
                items={topCustomerItems}
                valueLabel="CLV"
                secondaryValueLabel="Gasto total"
                unit="currency"
                maxItems={8}
                showTrend={false}
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Riesgo de Churn</h3>
              <PieChart
                data={data.churnRiskDistribution}
                size={180}
                donut={true}
              />
              <div className="mt-4 grid grid-cols-3 gap-2">
                {data.churnRiskDistribution.map((item) => (
                  <div key={item.label} className="text-center p-2 rounded-lg bg-gray-50">
                    <div className="text-lg font-bold" style={{ color: item.color }}>
                      {item.value}
                    </div>
                    <div className="text-xs text-gray-500">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Row 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Retención por Cohorte</h3>
              <BarChart
                data={data.cohortRetention}
                height={220}
                orientation="vertical"
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Frecuencia de Compra</h3>
              <BarChart
                data={data.customersByFrequency}
                height={220}
                orientation="horizontal"
              />
            </div>
          </div>

          {/* Satisfaction Trend */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencia de Satisfacción</h3>
            <AreaChart
              data={data.satisfactionTrend}
              height={200}
              color="#a855f7"
              formatValue={(v) => `${v}%`}
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

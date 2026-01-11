'use client';

/**
 * Revenue Analytics Page
 * ======================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Detailed revenue analytics with trends, breakdowns, and forecasts.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  TrendingUp,
  ArrowLeft,
  Download,
  RefreshCw,
  CreditCard,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import Link from 'next/link';

import KPICard, { KPIGrid } from '../../../../components/analytics/widgets/KPICard';
import AreaChart from '../../../../components/analytics/charts/AreaChart';
import BarChart from '../../../../components/analytics/charts/BarChart';
import PieChart from '../../../../components/analytics/charts/PieChart';
import { CompactLeaderBoard } from '../../../../components/analytics/widgets/LeaderBoard';
import ComparisonWidget from '../../../../components/analytics/widgets/ComparisonWidget';
import DateRangePicker, { DateRangePreset } from '../../../../components/analytics/filters/DateRangePicker';
import ServiceTypeFilter from '../../../../components/analytics/filters/ServiceTypeFilter';

interface RevenueData {
  kpis: {
    totalRevenue: { value: number; change: number };
    avgTicket: { value: number; change: number };
    invoiceCount: { value: number; change: number };
    collectionRate: { value: number; change: number };
    mrr: { value: number; change: number };
    arpu: { value: number; change: number };
  };
  revenueTrend: { label: string; value: number }[];
  revenueByService: { label: string; value: number }[];
  revenueByMonth: { label: string; value: number }[];
  topCustomers: { name: string; value: number }[];
  paymentMethods: { label: string; value: number; color: string }[];
  comparison: {
    current: number;
    previous: number;
  };
}

export default function RevenueAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRangePreset>('month');
  const [serviceType, setServiceType] = useState<string | 'all'>('all');

  const { data, isLoading, refetch, isFetching } = useQuery<RevenueData>({
    queryKey: ['analytics-revenue', dateRange, serviceType],
    queryFn: async () => {
      const params = new URLSearchParams({ range: dateRange });
      if (serviceType !== 'all') params.append('serviceType', serviceType);
      const response = await fetch(`/api/analytics/revenue?${params}`);
      if (!response.ok) throw new Error('Failed to fetch revenue data');
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
            <h1 className="text-2xl font-bold text-gray-900">Analytics de Ingresos</h1>
            <p className="text-gray-600 mt-1">Análisis detallado de facturación y cobros</p>
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
              title="Ingresos Totales"
              value={data.kpis.totalRevenue.value}
              unit="currency"
              trend={data.kpis.totalRevenue.change > 0 ? 'up' : data.kpis.totalRevenue.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.totalRevenue.change}
              icon={<DollarSign size={24} />}
              color="green"
            />
            <KPICard
              title="Ticket Promedio"
              value={data.kpis.avgTicket.value}
              unit="currency"
              trend={data.kpis.avgTicket.change > 0 ? 'up' : data.kpis.avgTicket.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.avgTicket.change}
              icon={<CreditCard size={24} />}
              color="blue"
            />
            <KPICard
              title="Facturas Emitidas"
              value={data.kpis.invoiceCount.value}
              unit="number"
              trend={data.kpis.invoiceCount.change > 0 ? 'up' : data.kpis.invoiceCount.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.invoiceCount.change}
              icon={<BarChart3 size={24} />}
              color="purple"
            />
            <KPICard
              title="Tasa de Cobro"
              value={data.kpis.collectionRate.value}
              unit="percentage"
              trend={data.kpis.collectionRate.change > 0 ? 'up' : data.kpis.collectionRate.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.collectionRate.change}
              icon={<TrendingUp size={24} />}
              color="green"
            />
            <KPICard
              title="MRR"
              value={data.kpis.mrr.value}
              unit="currency"
              trend={data.kpis.mrr.change > 0 ? 'up' : data.kpis.mrr.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.mrr.change}
              icon={<DollarSign size={24} />}
              color="amber"
              description="Ingreso mensual recurrente"
            />
            <KPICard
              title="ARPU"
              value={data.kpis.arpu.value}
              unit="currency"
              trend={data.kpis.arpu.change > 0 ? 'up' : data.kpis.arpu.change < 0 ? 'down' : 'stable'}
              changePercent={data.kpis.arpu.change}
              icon={<PieChartIcon size={24} />}
              color="blue"
              description="Ingreso promedio por cliente"
            />
          </KPIGrid>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencia de Ingresos</h3>
              <AreaChart
                data={data.revenueTrend}
                height={280}
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

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparación de Períodos</h3>
              <ComparisonWidget
                title="Ingresos"
                currentValue={data.comparison.current}
                previousValue={data.comparison.previous}
                currentLabel="Período actual"
                previousLabel="Período anterior"
                unit="currency"
              />
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ingresos por Tipo de Servicio</h3>
              <PieChart
                data={data.revenueByService}
                size={200}
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

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Métodos de Pago</h3>
              <BarChart
                data={data.paymentMethods}
                height={220}
                orientation="horizontal"
              />
            </div>
          </div>

          {/* Charts Row 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Clientes por Ingreso</h3>
              <CompactLeaderBoard
                items={data.topCustomers}
                unit="currency"
                showBars={true}
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ingresos Mensuales</h3>
              <BarChart
                data={data.revenueByMonth}
                height={220}
                orientation="vertical"
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

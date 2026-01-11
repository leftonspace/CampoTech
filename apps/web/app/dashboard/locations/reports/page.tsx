'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  Briefcase,
  DollarSign,
  MapPin,
  BarChart3,
  PieChart,
  ArrowUpDown,
} from 'lucide-react';

interface LocationReport {
  id: string;
  name: string;
  code: string;
  jobs: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    completionRate: number;
  };
  revenue: {
    total: number;
    average: number;
    trend: number;
  };
  team: {
    technicians: number;
    avgJobsPerTechnician: number;
  };
  performance: {
    avgResponseTime: number;
    avgCompletionTime: number;
    customerSatisfaction: number;
  };
}

interface CrossLocationReport {
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalJobs: number;
    totalRevenue: number;
    avgCompletionRate: number;
    totalTechnicians: number;
  };
  locations: LocationReport[];
  topPerformers: {
    byJobs: { id: string; name: string; value: number }[];
    byRevenue: { id: string; name: string; value: number }[];
    byCompletionRate: { id: string; name: string; value: number }[];
  };
}

async function fetchCrossLocationReport(params: {
  startDate: string;
  endDate: string;
}): Promise<{ success: boolean; data: CrossLocationReport }> {
  const response = await fetch(
    `/api/locations/reports?startDate=${params.startDate}&endDate=${params.endDate}`
  );
  return response.json();
}

export default function CrossLocationReportsPage() {
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [sortBy, setSortBy] = useState<'name' | 'jobs' | 'revenue' | 'completionRate'>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    if (dateRange === 'week') {
      start.setDate(end.getDate() - 7);
    } else if (dateRange === 'month') {
      start.setMonth(end.getMonth() - 1);
    } else {
      start.setMonth(end.getMonth() - 3);
    }
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  };

  const { data, isLoading } = useQuery({
    queryKey: ['cross-location-report', dateRange],
    queryFn: () => fetchCrossLocationReport(getDateRange()),
  });

  const report = data?.data;

  const sortedLocations = [...(report?.locations || [])].sort((a, b) => {
    let aValue, bValue;
    switch (sortBy) {
      case 'name':
        return sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      case 'jobs':
        aValue = a.jobs.total;
        bValue = b.jobs.total;
        break;
      case 'revenue':
        aValue = a.revenue.total;
        bValue = b.revenue.total;
        break;
      case 'completionRate':
        aValue = a.jobs.completionRate;
        bValue = b.jobs.completionRate;
        break;
      default:
        return 0;
    }
    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-lg bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/locations"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reportes multi-zona</h1>
            <p className="text-gray-500">Comparativa de rendimiento entre zonas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['week', 'month', 'quarter'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                dateRange === range
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {range === 'week' ? '7 días' : range === 'month' ? '30 días' : '90 días'}
            </button>
          ))}
          <button className="btn-secondary ml-2">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {report && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Trabajos totales</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {report.summary.totalJobs.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-blue-100 p-3">
                <Briefcase className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Ingresos totales</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  ${report.summary.totalRevenue.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-green-100 p-3">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tasa completado promedio</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {report.summary.avgCompletionRate.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg bg-purple-100 p-3">
                <PieChart className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Técnicos activos</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {report.summary.totalTechnicians}
                </p>
              </div>
              <div className="rounded-lg bg-amber-100 p-3">
                <Users className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Performers */}
      {report && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card">
            <div className="border-b p-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-500" />
                Más trabajos
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {report.topPerformers.byJobs.slice(0, 5).map((loc, idx) => (
                <div key={loc.id} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                      idx === 0
                        ? 'bg-yellow-100 text-yellow-700'
                        : idx === 1
                        ? 'bg-gray-200 text-gray-700'
                        : idx === 2
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className="flex-1 truncate text-sm text-gray-700">{loc.name}</span>
                  <span className="font-medium text-gray-900">{loc.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="border-b p-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                Mayor facturación
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {report.topPerformers.byRevenue.slice(0, 5).map((loc, idx) => (
                <div key={loc.id} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                      idx === 0
                        ? 'bg-yellow-100 text-yellow-700'
                        : idx === 1
                        ? 'bg-gray-200 text-gray-700'
                        : idx === 2
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className="flex-1 truncate text-sm text-gray-700">{loc.name}</span>
                  <span className="font-medium text-gray-900">${loc.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="border-b p-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                Mayor eficiencia
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {report.topPerformers.byCompletionRate.slice(0, 5).map((loc, idx) => (
                <div key={loc.id} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                      idx === 0
                        ? 'bg-yellow-100 text-yellow-700'
                        : idx === 1
                        ? 'bg-gray-200 text-gray-700'
                        : idx === 2
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className="flex-1 truncate text-sm text-gray-700">{loc.name}</span>
                  <span className="font-medium text-gray-900">{loc.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Table */}
      <div className="card">
        <div className="border-b p-4">
          <h2 className="font-semibold text-gray-900">Detalle por zona</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('name')}
                    className="flex items-center gap-1 text-xs font-medium uppercase text-gray-500 hover:text-gray-700"
                  >
                    Zona
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort('jobs')}
                    className="flex items-center gap-1 text-xs font-medium uppercase text-gray-500 hover:text-gray-700 ml-auto"
                  >
                    Trabajos
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort('completionRate')}
                    className="flex items-center gap-1 text-xs font-medium uppercase text-gray-500 hover:text-gray-700 ml-auto"
                  >
                    Completados
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort('revenue')}
                    className="flex items-center gap-1 text-xs font-medium uppercase text-gray-500 hover:text-gray-700 ml-auto"
                  >
                    Ingresos
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Técnicos
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Tendencia
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedLocations.map((location) => (
                <tr key={location.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/locations/${location.id}/dashboard`}
                      className="flex items-center gap-2 hover:text-primary-600"
                    >
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{location.name}</p>
                        <p className="text-xs text-gray-500">{location.code}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-medium text-gray-900">{location.jobs.total}</p>
                    <p className="text-xs text-gray-500">
                      {location.jobs.pending} pendientes
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p
                      className={cn(
                        'font-medium',
                        location.jobs.completionRate >= 90
                          ? 'text-green-600'
                          : location.jobs.completionRate >= 70
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      )}
                    >
                      {location.jobs.completionRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500">
                      {location.jobs.completed}/{location.jobs.total}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-medium text-gray-900">
                      ${location.revenue.total.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Prom: ${location.revenue.average.toLocaleString()}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-medium text-gray-900">{location.team.technicians}</p>
                    <p className="text-xs text-gray-500">
                      {location.team.avgJobsPerTechnician.toFixed(1)} trab/téc
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        location.revenue.trend >= 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      )}
                    >
                      {location.revenue.trend >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(location.revenue.trend)}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

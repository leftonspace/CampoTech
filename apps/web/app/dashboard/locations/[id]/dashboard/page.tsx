'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Calendar,
  Users,
  Briefcase,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Timer,
  DollarSign,
  BarChart3,
  Activity,
} from 'lucide-react';

interface LocationStats {
  location: {
    id: string;
    name: string;
    code: string;
  };
  today: {
    totalJobs: number;
    completedJobs: number;
    pendingJobs: number;
    inProgressJobs: number;
    cancelledJobs: number;
    revenue: number;
    averageJobTime: number;
  };
  week: {
    totalJobs: number;
    completedJobs: number;
    completionRate: number;
    revenue: number;
    trend: number;
  };
  team: {
    totalTechnicians: number;
    activeTechnicians: number;
    avgJobsPerTechnician: number;
  };
  capacity: {
    currentUtilization: number;
    maxDailyJobs: number;
    bookedToday: number;
    availableSlots: number;
  };
}

async function fetchLocationStats(locationId: string): Promise<{ success: boolean; data: LocationStats }> {
  const response = await fetch(`/api/locations/${locationId}/stats`);
  return response.json();
}

export default function LocationDashboardPage() {
  const params = useParams();
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

  const { data, isLoading } = useQuery({
    queryKey: ['location-dashboard', params.id],
    queryFn: () => fetchLocationStats(params.id as string),
    enabled: !!params.id,
    refetchInterval: 60000, // Refresh every minute
  });

  const stats = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No se encontraron datos para esta zona</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/locations/${params.id}`}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Dashboard: {stats.location.name}
            </h1>
            <p className="text-gray-500">Vista operativa de la zona</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['today', 'week', 'month'] as const).map((range) => (
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
              {range === 'today' ? 'Hoy' : range === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Trabajos hoy</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{stats.today.totalJobs}</p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3">
              <Briefcase className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-green-600">{stats.today.completedJobs} completados</span>
            <span className="text-gray-400">|</span>
            <Timer className="h-4 w-4 text-yellow-500" />
            <span className="text-yellow-600">{stats.today.pendingJobs} pendientes</span>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Técnicos activos</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {stats.team.activeTechnicians}/{stats.team.totalTechnicians}
              </p>
            </div>
            <div className="rounded-lg bg-green-100 p-3">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-500">
            Promedio: {stats.team.avgJobsPerTechnician.toFixed(1)} trabajos/técnico
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Ingresos hoy</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                ${stats.today.revenue.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-100 p-3">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-sm">
            {stats.week.trend >= 0 ? (
              <>
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-green-600">+{stats.week.trend}%</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-red-600">{stats.week.trend}%</span>
              </>
            )}
            <span className="text-gray-500">vs semana anterior</span>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Utilización</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {stats.capacity.currentUtilization}%
              </p>
            </div>
            <div className="rounded-lg bg-purple-100 p-3">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>{stats.capacity.bookedToday} agendados</span>
              <span>{stats.capacity.availableSlots} disponibles</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200">
              <div
                className={cn(
                  'h-full rounded-full',
                  stats.capacity.currentUtilization > 90
                    ? 'bg-red-500'
                    : stats.capacity.currentUtilization > 70
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                )}
                style={{ width: `${stats.capacity.currentUtilization}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Job Status Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-gray-900">Estado de trabajos</h2>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="text-gray-700">Pendientes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.today.pendingJobs}</span>
                  <div className="h-2 w-24 rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-yellow-400"
                      style={{
                        width: `${stats.today.totalJobs
                            ? (stats.today.pendingJobs / stats.today.totalJobs) * 100
                            : 0
                          }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-gray-700">En progreso</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.today.inProgressJobs}</span>
                  <div className="h-2 w-24 rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{
                        width: `${stats.today.totalJobs
                            ? (stats.today.inProgressJobs / stats.today.totalJobs) * 100
                            : 0
                          }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-gray-700">Completados</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.today.completedJobs}</span>
                  <div className="h-2 w-24 rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{
                        width: `${stats.today.totalJobs
                            ? (stats.today.completedJobs / stats.today.totalJobs) * 100
                            : 0
                          }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="text-gray-700">Cancelados</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.today.cancelledJobs}</span>
                  <div className="h-2 w-24 rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{
                        width: `${stats.today.totalJobs
                            ? (stats.today.cancelledJobs / stats.today.totalJobs) * 100
                            : 0
                          }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-gray-900">Rendimiento semanal</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Trabajos totales</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stats.week.totalJobs}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Completados</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stats.week.completedJobs}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Tasa de completado</p>
                <p className="mt-1 text-2xl font-bold text-green-600">
                  {stats.week.completionRate}%
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Ingresos</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  ${stats.week.revenue.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-blue-50 p-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-blue-700">
                  Tiempo promedio por trabajo: {stats.today.averageJobTime} min
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-4">
        <h2 className="font-semibold text-gray-900 mb-4">Acciones rápidas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={`/dashboard/jobs?locationId=${params.id}`}
            className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50"
          >
            <Briefcase className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Ver trabajos</span>
          </Link>
          <Link
            href={`/dashboard/locations/${params.id}/team`}
            className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50"
          >
            <Users className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Gestionar equipo</span>
          </Link>
          <Link
            href={`/dashboard/locations/${params.id}/zones`}
            className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50"
          >
            <Activity className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Editar zonas</span>
          </Link>
          <Link
            href={`/dashboard/locations/${params.id}/settings`}
            className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50"
          >
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Horarios y capacidad</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

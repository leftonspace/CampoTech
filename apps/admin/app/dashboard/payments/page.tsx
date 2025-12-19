'use client';

import { useState } from 'react';
import { mockRevenueData, mockRevenueByTier, mockFailedPayments } from '@/lib/mock-data';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type TimeRange = '7d' | '30d' | '90d';

export default function PaymentsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Get max revenue for chart scaling
  const maxRevenue = Math.max(...mockRevenueData.map((d) => d.revenue));
  const totalRevenue = mockRevenueData.reduce((sum, d) => sum + d.revenue, 0);
  const avgRevenue = totalRevenue / mockRevenueData.length;

  const handleExportCSV = () => {
    const headers = ['Fecha', 'Ingresos (USD)', 'Suscripciones'];
    const rows = mockRevenueData.map((d) => [d.date, d.revenue, d.subscriptions]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-${timeRange}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pagos e Ingresos</h1>
          <p className="text-slate-500 mt-1">Seguimiento de revenue y estado de pagos</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2 mb-6">
        {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            {range === '7d' ? '7 días' : range === '30d' ? '30 días' : '90 días'}
          </button>
        ))}
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500">Revenue Total (30d)</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
          <p className="text-sm text-green-600 font-medium">+12.5% vs mes anterior</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500">Promedio Diario</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(Math.round(avgRevenue))}</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">Últimos 30 días</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500">Pagos Fallidos</p>
              <p className="text-2xl font-bold text-slate-900">{mockFailedPayments.length}</p>
            </div>
          </div>
          <p className="text-sm text-red-600 font-medium">
            {formatCurrency(mockFailedPayments.reduce((sum, p) => sum + p.amount, 0))} pendiente
          </p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Ingresos Diarios</h2>
        <div className="h-64 flex items-end gap-1">
          {mockRevenueData.map((day, index) => {
            const height = (day.revenue / maxRevenue) * 100;
            return (
              <div
                key={day.date}
                className="flex-1 group relative"
              >
                <div
                  className="bg-blue-500 hover:bg-blue-600 rounded-t transition-all cursor-pointer"
                  style={{ height: `${height}%` }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                    <p className="font-medium">{formatDate(day.date)}</p>
                    <p>{formatCurrency(day.revenue)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-4 text-sm text-slate-500">
          <span>{formatDate(mockRevenueData[0].date)}</span>
          <span>{formatDate(mockRevenueData[mockRevenueData.length - 1].date)}</span>
        </div>
      </div>

      {/* Revenue by Tier & Failed Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Tier */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Ingresos por Plan</h2>
          <div className="space-y-6">
            {mockRevenueByTier.map((tier, index) => {
              const colors = ['bg-amber-500', 'bg-purple-500', 'bg-blue-500', 'bg-slate-300'];
              return (
                <div key={tier.tier}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${colors[index]}`} />
                      <span className="font-medium text-slate-700">{tier.tier}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-slate-900">{formatCurrency(tier.revenue)}</span>
                      <span className="text-sm text-slate-500 ml-2">({tier.count})</span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[index]} rounded-full transition-all`}
                      style={{ width: `${tier.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pie Chart Visual */}
          <div className="mt-8 flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {mockRevenueByTier.reduce((acc, tier, index) => {
                  const colors = ['#f59e0b', '#a855f7', '#3b82f6', '#cbd5e1'];
                  const startAngle = acc.angle;
                  const angle = (tier.percentage / 100) * 360;
                  const endAngle = startAngle + angle;

                  const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                  const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                  const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                  const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                  const largeArc = angle > 180 ? 1 : 0;

                  acc.elements.push(
                    <path
                      key={tier.tier}
                      d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                      fill={colors[index]}
                    />
                  );
                  acc.angle = endAngle;
                  return acc;
                }, { angle: 0, elements: [] as React.ReactNode[] }).elements}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">
                    {formatCurrency(mockRevenueByTier.reduce((sum, t) => sum + t.revenue, 0))}
                  </p>
                  <p className="text-xs text-slate-500">MRR Total</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Failed Payments */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Pagos Fallidos</h2>
            <span className="text-xs font-medium text-red-600 bg-red-100 px-3 py-1 rounded-full">
              {mockFailedPayments.length} pendientes
            </span>
          </div>
          <div className="space-y-4">
            {mockFailedPayments.map((payment) => (
              <div
                key={payment.id}
                className="p-4 bg-red-50 rounded-xl border border-red-100"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{payment.businessName}</p>
                    <p className="text-sm text-slate-500 mt-1">{payment.reason}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Fallido: {formatDateTime(payment.failedAt)} | Reintentos: {payment.retryCount}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600 text-lg">{formatCurrency(payment.amount)}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="flex-1 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    Reintentar Cobro
                  </button>
                  <button className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                    Contactar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {mockFailedPayments.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-green-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-500">No hay pagos fallidos</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Renewals */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mt-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Próximas Renovaciones (7 días)</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Negocio</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Plan</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Monto</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Fecha de Renovación</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">Plomería García</td>
                <td className="px-4 py-3">
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                    Profesional
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{formatCurrency(55)}</td>
                <td className="px-4 py-3 text-sm text-slate-500">20/12/2024</td>
                <td className="px-4 py-3">
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                    Tarjeta válida
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">Electricidad Martínez</td>
                <td className="px-4 py-3">
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                    Empresa
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{formatCurrency(120)}</td>
                <td className="px-4 py-3 text-sm text-slate-500">22/12/2024</td>
                <td className="px-4 py-3">
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                    Tarjeta válida
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">Gas del Sur</td>
                <td className="px-4 py-3">
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                    Inicial
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{formatCurrency(25)}</td>
                <td className="px-4 py-3 text-sm text-slate-500">25/12/2024</td>
                <td className="px-4 py-3">
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                    Tarjeta próxima a vencer
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

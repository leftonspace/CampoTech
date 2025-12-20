'use client';

/**
 * Admin Subscriptions Page
 * =========================
 *
 * Lists all subscriptions with filters, revenue metrics, and failed payments alerts.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  SubscriptionListItem,
  SubscriptionTier,
  SubscriptionStatus,
  RevenueMetrics,
} from '@/types';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TIER_LABELS: Record<SubscriptionTier, string> = {
  FREE: 'Free',
  INICIAL: 'Inicial',
  PROFESIONAL: 'Profesional',
  EMPRESA: 'Empresa',
};

const TIER_COLORS: Record<SubscriptionTier, string> = {
  FREE: 'bg-slate-100 text-slate-700',
  INICIAL: 'bg-blue-100 text-blue-700',
  PROFESIONAL: 'bg-purple-100 text-purple-700',
  EMPRESA: 'bg-amber-100 text-amber-700',
};

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  none: 'Sin suscripción',
  trialing: 'En prueba',
  active: 'Activo',
  past_due: 'Pago pendiente',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  paused: 'Pausado',
};

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  none: 'bg-slate-100 text-slate-700',
  trialing: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-700',
  expired: 'bg-red-100 text-red-700',
  paused: 'bg-yellow-100 text-yellow-700',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface FailedPaymentAlert {
  id: string;
  organizationName: string;
  amount: number;
  failureReason: string | null;
  retryCount: number;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SubscriptionsPage() {
  // State
  const [subscriptions, setSubscriptions] = useState<SubscriptionListItem[]>([]);
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [failedPayments, setFailedPayments] = useState<FailedPaymentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all');
  const [tierFilter, setTierFilter] = useState<SubscriptionTier | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Fetch data
  useEffect(() => {
    fetchSubscriptions();
    fetchFailedPayments();
  }, [statusFilter, tierFilter, searchTerm, page]);

  async function fetchSubscriptions() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        includeMetrics: page === 1 ? 'true' : 'false',
      });

      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (tierFilter !== 'all') params.set('tier', tierFilter);
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/admin/subscriptions?${params}`);
      const data = await response.json();

      if (data.success) {
        setSubscriptions(data.data.items);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
        if (data.data.metrics) {
          setMetrics(data.data.metrics);
        }
      } else {
        setError(data.error || 'Error fetching subscriptions');
      }
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  }

  async function fetchFailedPayments() {
    try {
      const response = await fetch('/api/admin/failed-payments?limit=5');
      const data = await response.json();

      if (data.success) {
        setFailedPayments(data.data.items);
      }
    } catch (err) {
      console.error('Error fetching failed payments:', err);
    }
  }

  // Export to CSV
  function handleExportCSV() {
    const headers = ['Organización', 'Email', 'CUIT', 'Plan', 'Estado', 'Precio', 'Creado'];
    const rows = subscriptions.map((s) => [
      s.organizationName,
      s.ownerEmail,
      s.cuit || '',
      TIER_LABELS[s.tier],
      STATUS_LABELS[s.status],
      s.priceUsd?.toString() || '0',
      formatDate(s.createdAt),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suscripciones</h1>
          <p className="text-slate-500 mt-1">
            Gestión de suscripciones y métricas de revenue
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Failed Payments Alert */}
      {failedPayments.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">
                {failedPayments.length} Pagos Fallidos
              </h3>
              <div className="mt-2 space-y-2">
                {failedPayments.slice(0, 3).map((fp) => (
                  <div key={fp.id} className="flex items-center justify-between text-sm">
                    <span className="text-red-700">
                      {fp.organizationName} - {formatCurrency(fp.amount)}
                    </span>
                    <span className="text-red-500 text-xs">
                      {fp.failureReason || 'Error de pago'}
                    </span>
                  </div>
                ))}
              </div>
              {failedPayments.length > 3 && (
                <p className="text-red-600 text-sm mt-2">
                  +{failedPayments.length - 3} más
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revenue Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* MRR */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-500">MRR</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(metrics.mrr)}
                </p>
              </div>
            </div>
          </div>

          {/* ARR */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-500">ARR</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(metrics.arr)}
                </p>
              </div>
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-500">Conversión Trial → Pago</p>
                <p className="text-2xl font-bold text-slate-900">
                  {metrics.trialToPayConversion}%
                </p>
              </div>
            </div>
          </div>

          {/* Churn Rate */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-500">Churn Rate</p>
                <p className="text-2xl font-bold text-slate-900">{metrics.churnRate}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Chart & By Tier */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue by Month Chart */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">
              Ingresos Mensuales (12 meses)
            </h2>
            <div className="h-48 flex items-end gap-1">
              {metrics.revenueByMonth.map((month, index) => {
                const maxRevenue = Math.max(...metrics.revenueByMonth.map((m) => m.revenue));
                const height = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;
                return (
                  <div key={month.month} className="flex-1 group relative">
                    <div
                      className="bg-blue-500 hover:bg-blue-600 rounded-t transition-all cursor-pointer min-h-[4px]"
                      style={{ height: `${height}%` }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                        <p className="font-medium">{month.month}</p>
                        <p>{formatCurrency(month.revenue)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-4 text-xs text-slate-500">
              <span>{metrics.revenueByMonth[0]?.month}</span>
              <span>{metrics.revenueByMonth[metrics.revenueByMonth.length - 1]?.month}</span>
            </div>
          </div>

          {/* Revenue by Tier */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Ingresos por Plan</h2>
            <div className="space-y-4">
              {metrics.revenueByTier.map((tier, index) => {
                const colors = ['bg-amber-500', 'bg-purple-500', 'bg-blue-500', 'bg-slate-300'];
                return (
                  <div key={tier.tier}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${colors[index]}`} />
                        <span className="font-medium text-slate-700">{tier.tier}</span>
                        <span className="text-sm text-slate-500">({tier.count})</span>
                      </div>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(tier.revenue)}/mes
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors[index]} rounded-full transition-all`}
                        style={{ width: `${tier.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre, email o CUIT..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as SubscriptionStatus | 'all');
              setPage(1);
            }}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="trialing">En prueba</option>
            <option value="past_due">Pago pendiente</option>
            <option value="cancelled">Cancelados</option>
            <option value="expired">Expirados</option>
          </select>

          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value as SubscriptionTier | 'all');
              setPage(1);
            }}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="all">Todos los planes</option>
            <option value="FREE">Free</option>
            <option value="INICIAL">Inicial</option>
            <option value="PROFESIONAL">Profesional</option>
            <option value="EMPRESA">Empresa</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500">Cargando suscripciones...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                      Organización
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                      Plan
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                      Estado
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                      Ciclo
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                      Próx. Facturación
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                      Creado
                    </th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900">{sub.organizationName}</p>
                          <p className="text-sm text-slate-500">{sub.ownerEmail}</p>
                          {sub.cuit && (
                            <p className="text-xs text-slate-400">CUIT: {sub.cuit}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                            TIER_COLORS[sub.tier]
                          }`}
                        >
                          {TIER_LABELS[sub.tier]}
                        </span>
                        {sub.priceUsd && sub.priceUsd > 0 && (
                          <p className="text-xs text-slate-500 mt-1">
                            {formatCurrency(sub.priceUsd)}/
                            {sub.billingCycle === 'MONTHLY' ? 'mes' : 'año'}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                            STATUS_COLORS[sub.status]
                          }`}
                        >
                          {STATUS_LABELS[sub.status]}
                        </span>
                        {sub.status === 'trialing' && sub.trialEndsAt && (
                          <p className="text-xs text-slate-500 mt-1">
                            Vence: {formatDate(sub.trialEndsAt)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {sub.billingCycle === 'MONTHLY' ? 'Mensual' : 'Anual'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDate(sub.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/subscriptions/${sub.id}`}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver detalles"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {subscriptions.length === 0 && (
              <div className="text-center py-12">
                <svg
                  className="w-12 h-12 text-slate-300 mx-auto mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-slate-500">No se encontraron suscripciones</p>
              </div>
            )}

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Mostrando {subscriptions.length} de {total} suscripciones
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-sm text-slate-600">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

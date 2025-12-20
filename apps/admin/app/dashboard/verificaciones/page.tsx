'use client';

/**
 * Admin Verification Dashboard
 * =============================
 *
 * Review queue for verification submissions with stats and filters.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  VerificationQueueItem,
  VerificationDashboardStats,
  VerificationCategory,
  VerificationAppliesTo,
  VerificationSubmissionStatus,
} from '@/types';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `hace ${diffDays}d`;
  if (diffHours > 0) return `hace ${diffHours}h`;
  if (diffMins > 0) return `hace ${diffMins}min`;
  return 'ahora';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<VerificationCategory, string> = {
  identity: 'Identidad',
  business: 'Negocio',
  professional: 'Profesional',
  insurance: 'Seguros',
  background: 'Antecedentes',
  financial: 'Financiero',
};

const CATEGORY_COLORS: Record<VerificationCategory, string> = {
  identity: 'bg-blue-100 text-blue-700',
  business: 'bg-purple-100 text-purple-700',
  professional: 'bg-green-100 text-green-700',
  insurance: 'bg-amber-100 text-amber-700',
  background: 'bg-slate-100 text-slate-700',
  financial: 'bg-pink-100 text-pink-700',
};

const APPLIES_TO_LABELS: Record<VerificationAppliesTo, string> = {
  organization: 'Organización',
  owner: 'Dueño',
  employee: 'Empleado',
};

const STATUS_LABELS: Record<VerificationSubmissionStatus, string> = {
  pending: 'Pendiente',
  in_review: 'En revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  expired: 'Vencido',
};

const STATUS_COLORS: Record<VerificationSubmissionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-slate-100 text-slate-700',
};

const PRIORITY_LABELS = {
  new_business: 'Nuevo negocio',
  renewal: 'Renovación',
  badge_request: 'Badge',
  normal: 'Normal',
};

const PRIORITY_COLORS = {
  new_business: 'bg-red-100 text-red-700',
  renewal: 'bg-amber-100 text-amber-700',
  badge_request: 'bg-purple-100 text-purple-700',
  normal: 'bg-slate-100 text-slate-700',
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function VerificacionesPage() {
  // State
  const [queue, setQueue] = useState<VerificationQueueItem[]>([]);
  const [stats, setStats] = useState<VerificationDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<VerificationSubmissionStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<VerificationCategory | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Active tab
  const [activeTab, setActiveTab] = useState<'queue' | 'organizations' | 'employees'>('queue');

  // Fetch data
  useEffect(() => {
    if (activeTab === 'queue') {
      fetchQueue();
    }
  }, [statusFilter, categoryFilter, priorityFilter, searchTerm, page, activeTab]);

  async function fetchQueue() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        includeStats: page === 1 ? 'true' : 'false',
      });

      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/admin/verifications?${params}`);
      const data = await response.json();

      if (data.success) {
        setQueue(data.data.items);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
        if (data.data.stats) {
          setStats(data.data.stats);
        }
      } else {
        setError(data.error || 'Error fetching queue');
      }
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Verificaciones</h1>
        <p className="text-slate-500 mt-1">
          Revisión de documentos y verificaciones de identidad
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.pendingReview}</p>
                <p className="text-xs text-slate-500">Pendientes</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.inReview}</p>
                <p className="text-xs text-slate-500">En revisión</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.approvedToday}</p>
                <p className="text-xs text-slate-500">Aprobados hoy</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.rejectedToday}</p>
                <p className="text-xs text-slate-500">Rechazados hoy</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.expiringIn7Days}</p>
                <p className="text-xs text-slate-500">Por vencer</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.totalPending}</p>
                <p className="text-xs text-slate-500">Total cola</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'queue'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Cola de Revisión
        </button>
        <button
          onClick={() => setActiveTab('organizations')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'organizations'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Organizaciones
        </button>
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'employees'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Empleados
        </button>
      </div>

      {activeTab === 'queue' && (
        <>
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
                    placeholder="Buscar por CUIT, nombre..."
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
                  setStatusFilter(e.target.value as VerificationSubmissionStatus | 'all');
                  setPage(1);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="in_review">En revisión</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value as VerificationCategory | 'all');
                  setPage(1);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">Todas las categorías</option>
                <option value="identity">Identidad</option>
                <option value="business">Negocio</option>
                <option value="professional">Profesional</option>
                <option value="insurance">Seguros</option>
                <option value="background">Antecedentes</option>
                <option value="financial">Financiero</option>
              </select>

              {/* Priority Filter */}
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">Todas las prioridades</option>
                <option value="new_business">Nuevo negocio</option>
                <option value="renewal">Renovación</option>
                <option value="badge_request">Badge</option>
              </select>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Queue Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500">Cargando cola...</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                          Enviado
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                          Organización / Persona
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                          Requisito
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                          Documento
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                          Prioridad
                        </th>
                        <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700">
                          Acción
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {queue.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-900">
                              {getTimeAgo(item.submittedAt)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDateTime(item.submittedAt)}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900">
                              {item.organizationName}
                            </p>
                            {item.userName && (
                              <p className="text-sm text-slate-500">{item.userName}</p>
                            )}
                            <span
                              className={`inline-flex mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                                CATEGORY_COLORS[item.category]
                              }`}
                            >
                              {APPLIES_TO_LABELS[item.appliesTo]}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900">
                              {item.requirementName}
                            </p>
                            <span
                              className={`inline-flex mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                                CATEGORY_COLORS[item.category]
                              }`}
                            >
                              {CATEGORY_LABELS[item.category]}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {item.documentUrl ? (
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                  <svg
                                    className="w-5 h-5 text-slate-400"
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
                                </div>
                                <span className="text-sm text-slate-500">
                                  {item.documentFilename || 'Documento'}
                                </span>
                              </div>
                            ) : item.submittedValue ? (
                              <code className="text-sm bg-slate-100 px-2 py-1 rounded">
                                {item.submittedValue}
                              </code>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                                PRIORITY_COLORS[item.priority]
                              }`}
                            >
                              {PRIORITY_LABELS[item.priority]}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <Link
                              href={`/dashboard/verificaciones/${item.id}`}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Revisar
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {queue.length === 0 && (
                  <div className="text-center py-12">
                    <svg
                      className="w-12 h-12 text-green-300 mx-auto mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-slate-500">No hay verificaciones pendientes</p>
                  </div>
                )}

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Mostrando {queue.length} de {total} verificaciones
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
        </>
      )}

      {activeTab === 'organizations' && (
        <OrganizationsComplianceView />
      )}

      {activeTab === 'employees' && (
        <EmployeesVerificationView />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZATIONS COMPLIANCE VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function OrganizationsComplianceView() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<any>(null);

  useEffect(() => {
    fetchOrganizations();
  }, [searchTerm]);

  async function fetchOrganizations() {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '50' });
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/admin/organizations?${params}`);
      const data = await response.json();

      if (data.success) {
        setOrganizations(data.data.items);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error fetching organizations');
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrgDetail(orgId: string) {
    if (expandedOrg === orgId) {
      setExpandedOrg(null);
      setExpandedData(null);
      return;
    }

    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`);
      const data = await response.json();

      if (data.success) {
        setExpandedOrg(orgId);
        setExpandedData(data.data);
      }
    } catch (err) {
      console.error('Error fetching org detail:', err);
    }
  }

  async function handleBlockUnblock(orgId: string, isBlocked: boolean) {
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isBlocked ? 'unblock' : 'block' }),
      });

      const data = await response.json();
      if (data.success) {
        fetchOrganizations();
      }
    } catch (err) {
      console.error('Error:', err);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500">Cargando organizaciones...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6">
        <div className="relative max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o CUIT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Organizations List */}
      <div className="space-y-4">
        {organizations.map((org) => (
          <div
            key={org.organizationId}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
              onClick={() => fetchOrgDetail(org.organizationId)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-600">
                    {org.organizationName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-slate-900">{org.organizationName}</p>
                  <p className="text-sm text-slate-500">
                    {org.cuit || 'Sin CUIT'} • {org.ownerEmail}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-900">
                    {org.tier2Progress.completed}/{org.tier2Progress.total}
                  </p>
                  <p className="text-xs text-slate-500">Tier 2</p>
                </div>

                <div className="text-center">
                  <p className="text-sm font-medium text-slate-900">{org.badgesEarned}</p>
                  <p className="text-xs text-slate-500">Badges</p>
                </div>

                {org.isBlocked ? (
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                    Bloqueado
                  </span>
                ) : (
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      org.verificationStatus === 'verified'
                        ? 'bg-green-100 text-green-700'
                        : org.verificationStatus === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {org.verificationStatus === 'verified'
                      ? 'Verificado'
                      : org.verificationStatus === 'pending'
                      ? 'Pendiente'
                      : 'Sin iniciar'}
                  </span>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBlockUnblock(org.organizationId, org.isBlocked);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                    org.isBlocked
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : 'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  {org.isBlocked ? 'Desbloquear' : 'Bloquear'}
                </button>

                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform ${
                    expandedOrg === org.organizationId ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded Detail */}
            {expandedOrg === org.organizationId && expandedData && (
              <div className="border-t border-slate-200 p-4 bg-slate-50">
                <h4 className="font-medium text-slate-900 mb-3">Requisitos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {expandedData.requirements.map((req: any) => (
                    <div
                      key={req.requirementId}
                      className="bg-white rounded-lg p-3 border border-slate-200"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-900">{req.name}</span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            req.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : req.status === 'pending' || req.status === 'in_review'
                              ? 'bg-yellow-100 text-yellow-700'
                              : req.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {req.status === 'approved'
                            ? 'Aprobado'
                            : req.status === 'pending'
                            ? 'Pendiente'
                            : req.status === 'in_review'
                            ? 'En revisión'
                            : req.status === 'rejected'
                            ? 'Rechazado'
                            : 'Sin enviar'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Tier {req.tier}</p>
                    </div>
                  ))}
                </div>

                {expandedData.employees.length > 0 && (
                  <>
                    <h4 className="font-medium text-slate-900 mb-3 mt-6">Empleados</h4>
                    <div className="space-y-2">
                      {expandedData.employees.map((emp: any) => (
                        <div
                          key={emp.userId}
                          className="bg-white rounded-lg p-3 border border-slate-200 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-900">{emp.name}</p>
                            <p className="text-xs text-slate-500">{emp.email} • {emp.role}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-600">
                              {emp.completedRequirements}/{emp.totalRequirements}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                emp.verificationStatus === 'verified'
                                  ? 'bg-green-100 text-green-700'
                                  : emp.verificationStatus === 'pending'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {emp.verificationStatus === 'verified'
                                ? 'Verificado'
                                : emp.verificationStatus === 'pending'
                                ? 'Pendiente'
                                : 'Sin iniciar'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEES VERIFICATION VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function EmployeesVerificationView() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEmployeeQueue();
  }, [searchTerm]);

  async function fetchEmployeeQueue() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        appliesTo: 'employee',
        limit: '50',
        includeStats: 'false',
      });
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/admin/verifications?${params}`);
      const data = await response.json();

      if (data.success) {
        setQueue(data.data.items);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500">Cargando verificaciones de empleados...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6">
        <div className="relative max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por organización o empleado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Queue */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Empleado</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Organización</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Requisito</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Estado</th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {queue.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <p className="font-medium text-slate-900">{item.userName || 'Sin nombre'}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-slate-600">{item.organizationName}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-slate-900">{item.requirementName}</p>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      STATUS_COLORS[item.status as VerificationSubmissionStatus]
                    }`}
                  >
                    {STATUS_LABELS[item.status as VerificationSubmissionStatus]}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/dashboard/verificaciones/${item.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    Revisar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {queue.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No hay verificaciones de empleados pendientes</p>
          </div>
        )}
      </div>
    </div>
  );
}

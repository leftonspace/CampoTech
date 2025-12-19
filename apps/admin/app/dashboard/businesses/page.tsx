'use client';

import { useState, useMemo } from 'react';
import { mockBusinesses } from '@/lib/mock-data';
import { Business } from '@/types';

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

type StatusFilter = 'all' | 'active' | 'suspended' | 'cancelled' | 'trial';
type PlanFilter = 'all' | 'FREE' | 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL';

const planColors: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-700',
  BASICO: 'bg-blue-100 text-blue-700',
  PROFESIONAL: 'bg-purple-100 text-purple-700',
  EMPRESARIAL: 'bg-amber-100 text-amber-700',
};

const planLabels: Record<string, string> = {
  FREE: 'Free',
  BASICO: 'Inicial',
  PROFESIONAL: 'Profesional',
  EMPRESARIAL: 'Empresa',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-700',
  trial: 'bg-blue-100 text-blue-700',
};

const statusLabels: Record<string, string> = {
  active: 'Activo',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
  trial: 'Prueba',
};

export default function BusinessesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const filteredBusinesses = useMemo(() => {
    return mockBusinesses.filter((business) => {
      const matchesSearch =
        business.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        business.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || business.status === statusFilter;
      const matchesPlan = planFilter === 'all' || business.plan === planFilter;
      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [searchTerm, statusFilter, planFilter]);

  const handleViewDetails = (business: Business) => {
    setSelectedBusiness(business);
    setShowDetailsModal(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Negocios</h1>
        <p className="text-slate-500 mt-1">Gestión de negocios registrados en CampoTech</p>
      </div>

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
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="suspended">Suspendidos</option>
            <option value="cancelled">Cancelados</option>
            <option value="trial">Prueba</option>
          </select>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="all">Todos los planes</option>
            <option value="FREE">Free</option>
            <option value="BASICO">Inicial</option>
            <option value="PROFESIONAL">Profesional</option>
            <option value="EMPRESARIAL">Empresa</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                  Negocio
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                  Plan
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                  MRR
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                  Estado
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                  Creado
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">
                  Última Actividad
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBusinesses.map((business) => (
                <tr key={business.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{business.name}</p>
                      <p className="text-sm text-slate-500">{business.ownerEmail}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                        planColors[business.plan]
                      }`}
                    >
                      {planLabels[business.plan]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-900">
                      {formatCurrency(business.mrr)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                        statusColors[business.status]
                      }`}
                    >
                      {statusLabels[business.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {formatDate(business.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {formatDateTime(business.lastActiveAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewDetails(business)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver detalles"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        className="p-2 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                        title={business.status === 'suspended' ? 'Reactivar' : 'Suspender'}
                      >
                        {business.status === 'suspended' ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBusinesses.length === 0 && (
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
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <p className="text-slate-500">No se encontraron negocios</p>
          </div>
        )}

        {/* Pagination placeholder */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Mostrando {filteredBusinesses.length} de {mockBusinesses.length} negocios
          </p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
              Anterior
            </button>
            <button className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedBusiness && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Detalles del Negocio</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedBusiness.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${planColors[selectedBusiness.plan]}`}>
                    {planLabels[selectedBusiness.plan]}
                  </span>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[selectedBusiness.status]}`}>
                    {statusLabels[selectedBusiness.status]}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500">MRR</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(selectedBusiness.mrr)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500">Usuarios</p>
                  <p className="text-xl font-bold text-slate-900">{selectedBusiness.userCount}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500">Trabajos</p>
                  <p className="text-xl font-bold text-slate-900">{selectedBusiness.jobCount}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500">Creado</p>
                  <p className="text-lg font-semibold text-slate-900">{formatDate(selectedBusiness.createdAt)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500">Email del dueño</p>
                  <p className="font-medium text-slate-900">{selectedBusiness.ownerEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Teléfono</p>
                  <p className="font-medium text-slate-900">{selectedBusiness.ownerPhone}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Última actividad</p>
                  <p className="font-medium text-slate-900">{formatDateTime(selectedBusiness.lastActiveAt)}</p>
                </div>
                {selectedBusiness.notes && (
                  <div>
                    <p className="text-sm text-slate-500">Notas</p>
                    <p className="font-medium text-amber-600">{selectedBusiness.notes}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Editar
                </button>
                <button className="py-2 px-4 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">
                  {selectedBusiness.status === 'suspended' ? 'Reactivar' : 'Suspender'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

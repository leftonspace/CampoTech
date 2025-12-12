'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Edit,
  Plus,
  Trash2,
  Eye,
  LogIn,
  LogOut,
  Download,
  Clock,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  ipAddress?: string;
}

interface AuditLogsResponse {
  success: boolean;
  data: {
    logs: AuditLog[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    filters: {
      entityTypes: string[];
      actions: string[];
    };
  };
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ACTION_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  CREATE: { label: 'Crear', icon: Plus, color: 'text-success-600 bg-success-50' },
  UPDATE: { label: 'Editar', icon: Edit, color: 'text-amber-600 bg-amber-50' },
  DELETE: { label: 'Eliminar', icon: Trash2, color: 'text-danger-600 bg-danger-50' },
  VIEW: { label: 'Ver', icon: Eye, color: 'text-gray-600 bg-gray-50' },
  LOGIN: { label: 'Iniciar sesion', icon: LogIn, color: 'text-primary-600 bg-primary-50' },
  LOGOUT: { label: 'Cerrar sesion', icon: LogOut, color: 'text-gray-600 bg-gray-50' },
  EXPORT: { label: 'Exportar', icon: Download, color: 'text-purple-600 bg-purple-50' },
};

const ENTITY_LABELS: Record<string, string> = {
  user: 'Usuario',
  customer: 'Cliente',
  job: 'Trabajo',
  invoice: 'Factura',
  vehicle: 'Vehiculo',
  organization: 'Organizacion',
  product: 'Producto',
  location: 'Sucursal',
  session: 'Sesion',
};

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchAuditLogs(params: Record<string, string>): Promise<AuditLogsResponse> {
  const token = localStorage.getItem('accessToken');
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`/api/audit-logs?${query}`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function ActionBadge({ action }: { action: string }) {
  const config = ACTION_LABELS[action] || { label: action, icon: FileText, color: 'text-gray-600 bg-gray-50' };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function DataDiff({ oldData, newData }: { oldData: Record<string, unknown> | null; newData: Record<string, unknown> | null }) {
  if (!oldData && !newData) return <span className="text-gray-400">-</span>;

  const allKeys = new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {}),
  ]);

  return (
    <div className="space-y-1 text-xs">
      {Array.from(allKeys).slice(0, 3).map((key) => {
        const old = oldData?.[key];
        const neu = newData?.[key];
        const changed = JSON.stringify(old) !== JSON.stringify(neu);

        return (
          <div key={key} className="flex items-center gap-2">
            <span className="font-medium text-gray-600">{key}:</span>
            {changed ? (
              <>
                {old !== undefined && (
                  <span className="line-through text-danger-500">{formatValue(old)}</span>
                )}
                {neu !== undefined && (
                  <span className="text-success-600">{formatValue(neu)}</span>
                )}
              </>
            ) : (
              <span className="text-gray-500">{formatValue(neu)}</span>
            )}
          </div>
        );
      })}
      {allKeys.size > 3 && (
        <span className="text-gray-400">+{allKeys.size - 3} mas</span>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 30) + '...';
  return String(value).slice(0, 50);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const params: Record<string, string> = { page: String(page) };
  if (filters.entityType) params.entityType = filters.entityType;
  if (filters.action) params.action = filters.action;
  if (filters.userId) params.userId = filters.userId;
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => fetchAuditLogs(params),
  });

  const logs = data?.data?.logs || [];
  const pagination = data?.data?.pagination;
  const availableFilters = data?.data?.filters;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-md bg-danger-50 p-4 text-danger-700">
          {data?.error || 'Error cargando registros de auditoria'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/admin"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Registros de Auditoria</h1>
          <p className="text-gray-500">Historial de cambios y accesos (Ley 25.326)</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-outline flex items-center gap-2 ${showFilters ? 'bg-gray-100' : ''}`}
        >
          <Filter className="h-4 w-4" />
          Filtros
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-4">
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <label className="text-sm font-medium text-gray-700">Tipo</label>
              <select
                value={filters.entityType}
                onChange={(e) => {
                  setFilters({ ...filters, entityType: e.target.value });
                  setPage(1);
                }}
                className="mt-1 w-full input"
              >
                <option value="">Todos</option>
                {availableFilters?.entityTypes.map((type) => (
                  <option key={type} value={type}>
                    {ENTITY_LABELS[type] || type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Accion</label>
              <select
                value={filters.action}
                onChange={(e) => {
                  setFilters({ ...filters, action: e.target.value });
                  setPage(1);
                }}
                className="mt-1 w-full input"
              >
                <option value="">Todas</option>
                {availableFilters?.actions.map((action) => (
                  <option key={action} value={action}>
                    {ACTION_LABELS[action]?.label || action}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Desde</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  setFilters({ ...filters, startDate: e.target.value });
                  setPage(1);
                }}
                className="mt-1 w-full input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Hasta</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  setFilters({ ...filters, endDate: e.target.value });
                  setPage(1);
                }}
                className="mt-1 w-full input"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({
                    entityType: '',
                    action: '',
                    userId: '',
                    startDate: '',
                    endDate: '',
                  });
                  setPage(1);
                }}
                className="btn-outline w-full"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Usuario
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Accion
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Entidad
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cambios
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No hay registros de auditoria
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4 text-gray-400" />
                        {formatDate(log.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-500" />
                        </div>
                        <span className="text-sm text-gray-900">{log.userName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm">
                        <span className="text-gray-900">
                          {ENTITY_LABELS[log.entityType] || log.entityType}
                        </span>
                        <span className="text-gray-400 ml-1 text-xs">
                          #{log.entityId.slice(0, 8)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <DataDiff oldData={log.oldData} newData={log.newData} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {log.ipAddress || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {(page - 1) * pagination.pageSize + 1} - {Math.min(page * pagination.pageSize, pagination.total)} de {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="btn-outline p-2 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
                className="btn-outline p-2 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Detalle del registro</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Fecha</label>
                  <p className="text-gray-900">{formatDate(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Usuario</label>
                  <p className="text-gray-900">{selectedLog.userName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Accion</label>
                  <p><ActionBadge action={selectedLog.action} /></p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Entidad</label>
                  <p className="text-gray-900">
                    {ENTITY_LABELS[selectedLog.entityType] || selectedLog.entityType}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">ID</label>
                  <p className="text-gray-900 font-mono text-sm">{selectedLog.entityId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">IP</label>
                  <p className="text-gray-900">{selectedLog.ipAddress || '-'}</p>
                </div>
              </div>

              {selectedLog.oldData && Object.keys(selectedLog.oldData).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Datos anteriores</label>
                  <pre className="mt-1 p-3 bg-danger-50 rounded-lg text-xs overflow-auto text-danger-800">
                    {JSON.stringify(selectedLog.oldData, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newData && Object.keys(selectedLog.newData).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Datos nuevos</label>
                  <pre className="mt-1 p-3 bg-success-50 rounded-lg text-xs overflow-auto text-success-800">
                    {JSON.stringify(selectedLog.newData, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Metadata</label>
                  <pre className="mt-1 p-3 bg-gray-50 rounded-lg text-xs overflow-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

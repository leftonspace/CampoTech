'use client';

/**
 * Bulk Employee Verification View Component
 * ==========================================
 *
 * For owners with many employees:
 * - Filter: All, Verified, Pending, Blocked
 * - Bulk action: Send reminder to all pending
 * - Export: List of employees with status
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Send,
  Download,
  Loader2,
  Filter,
  RefreshCw,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmployeeVerificationInlineBadge, type VerificationStatus } from './EmployeeVerificationBadge';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface EmployeeVerification {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  verificationStatus: VerificationStatus;
  canBeAssignedJobs: boolean;
  pendingDocuments: number;
  expiringDocuments: number;
  lastReminderSentAt?: string;
  joinedAt: string;
}

interface VerificationSummary {
  total: number;
  verified: number;
  pending: number;
  blocked: number;
  expiringDocuments: number;
}

type FilterType = 'all' | 'verified' | 'pending' | 'blocked';

// ═══════════════════════════════════════════════════════════════════════════════
// FILTER CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const FILTERS: Array<{ key: FilterType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'all', label: 'Todos', icon: Users },
  { key: 'verified', label: 'Verificados', icon: CheckCircle },
  { key: 'pending', label: 'Pendientes', icon: Clock },
  { key: 'blocked', label: 'Bloqueados', icon: XCircle },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function BulkEmployeeVerificationView({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());

  // Fetch employees with verification status
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['employees-verification', activeFilter],
    queryFn: async () => {
      const response = await fetch(
        `/api/employees/verification?filter=${activeFilter}`
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result as { data: EmployeeVerification[]; summary: VerificationSummary };
    },
  });

  // Bulk reminder mutation
  const bulkReminderMutation = useMutation({
    mutationFn: async (employeeIds: string[]) => {
      const response = await fetch('/api/employees/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_reminder', employeeIds }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-verification'] });
      setSelectedEmployees(new Set());
    },
  });

  // Single reminder mutation
  const singleReminderMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const response = await fetch('/api/employees/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_reminder', employeeId }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-verification'] });
    },
  });

  const summary = data?.summary;

  // Get pending employees for bulk action
  const pendingEmployees = useMemo(
    () => {
      const employees = data?.data || [];
      return employees.filter((e) => !e.canBeAssignedJobs);
    },
    [data?.data]
  );

  const employees = data?.data || [];

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedEmployees);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedEmployees(newSelection);
  };

  // Select all pending
  const selectAllPending = () => {
    setSelectedEmployees(new Set(pendingEmployees.map((e) => e.id)));
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Nombre', 'Teléfono', 'Email', 'Rol', 'Estado', 'Puede trabajar', 'Docs pendientes', 'Docs por vencer'];
    const rows = employees.map((e) => [
      e.name,
      e.phone,
      e.email || '',
      e.role,
      e.verificationStatus,
      e.canBeAssignedJobs ? 'Sí' : 'No',
      e.pendingDocuments.toString(),
      e.expiringDocuments.toString(),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `empleados-verificacion-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle bulk reminder
  const handleBulkReminder = () => {
    const ids = Array.from(selectedEmployees);
    if (ids.length === 0) return;

    if (confirm(`¿Enviar recordatorio a ${ids.length} empleado(s)?`)) {
      bulkReminderMutation.mutate(ids);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            label="Total empleados"
            value={summary.total}
            icon={Users}
            color="text-gray-600"
          />
          <SummaryCard
            label="Verificados"
            value={summary.verified}
            icon={CheckCircle}
            color="text-success-600"
          />
          <SummaryCard
            label="Pendientes"
            value={summary.pending}
            icon={Clock}
            color="text-amber-600"
          />
          <SummaryCard
            label="Con docs venciendo"
            value={summary.expiringDocuments}
            icon={AlertTriangle}
            color="text-danger-600"
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border rounded-lg p-4">
        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <div className="flex gap-1">
            {FILTERS.map((filter) => {
              const Icon = filter.icon;
              const count =
                filter.key === 'all'
                  ? summary?.total
                  : filter.key === 'verified'
                    ? summary?.verified
                    : filter.key === 'pending'
                      ? summary?.pending
                      : summary?.blocked;

              return (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    activeFilter === filter.key
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {filter.label}
                  {count !== undefined && (
                    <span className="text-xs opacity-70">({count})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {selectedEmployees.size > 0 && (
            <button
              onClick={handleBulkReminder}
              disabled={bulkReminderMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {bulkReminderMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar recordatorio ({selectedEmployees.size})
            </button>
          )}

          {pendingEmployees.length > 0 && selectedEmployees.size === 0 && (
            <button
              onClick={selectAllPending}
              className="flex items-center gap-2 px-3 py-1.5 text-primary-600 border border-primary-200 rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors"
            >
              <Users className="h-4 w-4" />
              Seleccionar pendientes ({pendingEmployees.length})
            </button>
          )}

          <button
            onClick={() => refetch()}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refrescar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-3 py-1.5 text-gray-600 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedEmployees.size === pendingEmployees.length && pendingEmployees.length > 0}
                    onChange={() => {
                      if (selectedEmployees.size === pendingEmployees.length) {
                        setSelectedEmployees(new Set());
                      } else {
                        selectAllPending();
                      }
                    }}
                    className="rounded text-primary-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Empleado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Contacto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Verificación
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Documentos
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-danger-600">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                    Error al cargar empleados
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No hay empleados {activeFilter !== 'all' && `con estado "${FILTERS.find(f => f.key === activeFilter)?.label}"`}
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <EmployeeRow
                    key={employee.id}
                    employee={employee}
                    isSelected={selectedEmployees.has(employee.id)}
                    onToggleSelect={() => toggleSelection(employee.id)}
                    onSendReminder={() => singleReminderMutation.mutate(employee.id)}
                    isSendingReminder={singleReminderMutation.isPending}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk reminder result */}
      {bulkReminderMutation.isSuccess && (
        <div className="bg-success-50 border border-success-200 rounded-lg p-4 text-success-700">
          <CheckCircle className="h-5 w-5 inline mr-2" />
          Recordatorios enviados: {bulkReminderMutation.data?.sent} de {bulkReminderMutation.data?.sent + bulkReminderMutation.data?.failed}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <Icon className={cn('h-8 w-8', color)} />
      </div>
    </div>
  );
}

function EmployeeRow({
  employee,
  isSelected,
  onToggleSelect,
  onSendReminder,
  isSendingReminder,
}: {
  employee: EmployeeVerification;
  isSelected: boolean;
  onToggleSelect: () => void;
  onSendReminder: () => void;
  isSendingReminder: boolean;
}) {
  const canSelectForReminder = !employee.canBeAssignedJobs;

  return (
    <tr className={cn(isSelected && 'bg-primary-50')}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          disabled={!canSelectForReminder}
          className="rounded text-primary-600 disabled:opacity-50"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium text-sm">
            {employee.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{employee.name}</p>
            <p className="text-xs text-gray-500">{employee.role}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-gray-900">{employee.phone}</p>
        {employee.email && (
          <p className="text-xs text-gray-500">{employee.email}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <EmployeeVerificationInlineBadge
          status={employee.verificationStatus}
          canBeAssignedJobs={employee.canBeAssignedJobs}
        />
      </td>
      <td className="px-4 py-3">
        <div className="text-sm">
          {employee.pendingDocuments > 0 && (
            <p className="text-amber-600">
              {employee.pendingDocuments} pendiente(s)
            </p>
          )}
          {employee.expiringDocuments > 0 && (
            <p className="text-danger-600">
              {employee.expiringDocuments} por vencer
            </p>
          )}
          {employee.pendingDocuments === 0 && employee.expiringDocuments === 0 && (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {!employee.canBeAssignedJobs && (
            <button
              onClick={onSendReminder}
              disabled={isSendingReminder}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded transition-colors disabled:opacity-50"
            >
              {isSendingReminder ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Recordar
            </button>
          )}
          <Link
            href={`/dashboard/verificacion?employee=${employee.id}`}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            Ver
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

export default BulkEmployeeVerificationView;

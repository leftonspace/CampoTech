'use client';

/**
 * Employee Compliance Table Component
 * ====================================
 *
 * Displays employee verification status with summary cards and detailed table.
 * For the "Empleados" tab in the verification dashboard.
 */

import { useState } from 'react';
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Calendar,
  Eye,
  Mail,
  Search,
  UserCheck,
  UserX,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmployeeVerification {
  userId: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  status: 'not_started' | 'partial' | 'verified' | 'suspended';
  canWork: boolean;
  pendingDocs: number;
  completedDocs: number;
  totalDocs: number;
  nextExpiry: string | null;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
  issues: string[];
}

export interface EmployeeComplianceTableProps {
  employees: EmployeeVerification[];
  onViewDetails: (userId: string) => void;
  onSendReminder: (userId: string) => void;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  not_started: {
    label: 'Sin iniciar',
    color: 'bg-gray-100 text-gray-700',
    icon: Clock,
  },
  partial: {
    label: 'Incompleto',
    color: 'bg-amber-100 text-amber-700',
    icon: AlertCircle,
  },
  verified: {
    label: 'Verificado',
    color: 'bg-success-100 text-success-700',
    icon: CheckCircle,
  },
  suspended: {
    label: 'Suspendido',
    color: 'bg-danger-100 text-danger-700',
    icon: XCircle,
  },
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  TECHNICIAN: 'Técnico',
  RECEPTIONIST: 'Recepcionista',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY CARDS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface SummaryCardsProps {
  total: number;
  verified: number;
  pending: number;
  blocked: number;
}

function SummaryCards({ total, verified, pending, blocked }: SummaryCardsProps) {
  const cards = [
    {
      label: 'Total empleados',
      value: total,
      icon: Users,
      color: 'text-gray-600 bg-gray-100',
    },
    {
      label: 'Verificados',
      value: verified,
      icon: UserCheck,
      color: 'text-success-600 bg-success-100',
    },
    {
      label: 'Pendientes',
      value: pending,
      icon: Clock,
      color: 'text-amber-600 bg-amber-100',
    },
    {
      label: 'Bloqueados',
      value: blocked,
      icon: UserX,
      color: 'text-danger-600 bg-danger-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="p-4 rounded-xl border border-gray-200 bg-white"
        >
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', card.color)}>
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: EmployeeVerification['status'] }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        config.color
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AVATAR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function Avatar({ name, avatar }: { name: string; avatar?: string | null }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium">
      {initials}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAN WORK INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

function CanWorkIndicator({ canWork }: { canWork: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center h-8 w-8 rounded-full',
        canWork ? 'bg-success-100' : 'bg-danger-100'
      )}
    >
      {canWork ? (
        <CheckCircle className="h-5 w-5 text-success-600" />
      ) : (
        <XCircle className="h-5 w-5 text-danger-600" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPIRY DISPLAY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function ExpiryDisplay({
  nextExpiry,
  daysUntilExpiry,
  isExpiringSoon,
}: {
  nextExpiry: string | null;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
}) {
  if (!nextExpiry) {
    return <span className="text-gray-400">-</span>;
  }

  const date = new Date(nextExpiry).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  });

  if (daysUntilExpiry !== null && daysUntilExpiry <= 0) {
    return (
      <span className="text-danger-600 font-medium flex items-center gap-1">
        <AlertCircle className="h-3.5 w-3.5" />
        Vencido
      </span>
    );
  }

  if (isExpiringSoon && daysUntilExpiry !== null) {
    return (
      <span className="text-amber-600 font-medium flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5" />
        {daysUntilExpiry}d
      </span>
    );
  }

  return (
    <span className="text-gray-600 flex items-center gap-1 text-sm">
      <Calendar className="h-3.5 w-3.5 text-gray-400" />
      {date}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface EmployeeRowProps {
  employee: EmployeeVerification;
  onViewDetails: (userId: string) => void;
  onSendReminder: (userId: string) => void;
}

function EmployeeRow({ employee, onViewDetails, onSendReminder }: EmployeeRowProps) {
  const hasIssues = employee.issues.length > 0 || employee.isExpiringSoon || !employee.canWork;

  return (
    <tr className={cn(hasIssues && 'bg-amber-50/50')}>
      {/* Empleado */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={employee.name} avatar={employee.avatar} />
          <div>
            <p className="font-medium text-gray-900 text-sm">{employee.name}</p>
            <p className="text-xs text-gray-500">{employee.email}</p>
          </div>
        </div>
      </td>

      {/* Rol */}
      <td className="px-4 py-3">
        <span className="text-sm text-gray-700">
          {ROLE_LABELS[employee.role] || employee.role}
        </span>
      </td>

      {/* Estado verificación */}
      <td className="px-4 py-3">
        <StatusBadge status={employee.status} />
      </td>

      {/* Docs pendientes */}
      <td className="px-4 py-3">
        {employee.pendingDocs > 0 ? (
          <span className="text-amber-600 font-medium">{employee.pendingDocs}</span>
        ) : (
          <span className="text-gray-400">0</span>
        )}
        <span className="text-gray-400 text-xs"> / {employee.totalDocs}</span>
      </td>

      {/* Próximo vencimiento */}
      <td className="px-4 py-3">
        <ExpiryDisplay
          nextExpiry={employee.nextExpiry}
          daysUntilExpiry={employee.daysUntilExpiry}
          isExpiringSoon={employee.isExpiringSoon}
        />
      </td>

      {/* Puede trabajar */}
      <td className="px-4 py-3">
        <CanWorkIndicator canWork={employee.canWork} />
      </td>

      {/* Acciones */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewDetails(employee.userId)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            Ver detalles
          </button>
          {(employee.pendingDocs > 0 || employee.isExpiringSoon) && (
            <button
              onClick={() => onSendReminder(employee.userId)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              Recordatorio
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function EmployeeComplianceTable({
  employees,
  onViewDetails,
  onSendReminder,
  className,
}: EmployeeComplianceTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'expiry'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Calculate summary stats
  const total = employees.length;
  const verified = employees.filter((e) => e.status === 'verified').length;
  const pending = employees.filter((e) => e.status === 'partial' || e.status === 'not_started').length;
  const blocked = employees.filter((e) => !e.canWork).length;

  // Filter and sort employees
  let filteredEmployees = employees.filter((employee) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !employee.name.toLowerCase().includes(query) &&
        !employee.email.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Status filter
    if (filterStatus !== 'all' && employee.status !== filterStatus) {
      return false;
    }

    return true;
  });

  // Sort
  filteredEmployees = [...filteredEmployees].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'status':
        const statusOrder = { suspended: 0, not_started: 1, partial: 2, verified: 3 };
        comparison = statusOrder[a.status] - statusOrder[b.status];
        break;
      case 'expiry':
        if (!a.nextExpiry && !b.nextExpiry) comparison = 0;
        else if (!a.nextExpiry) comparison = 1;
        else if (!b.nextExpiry) comparison = -1;
        else comparison = new Date(a.nextExpiry).getTime() - new Date(b.nextExpiry).getTime();
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (column: 'name' | 'status' | 'expiry') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ column }: { column: 'name' | 'status' | 'expiry' }) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Cards */}
      <SummaryCards
        total={total}
        verified={verified}
        pending={pending}
        blocked={blocked}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">Todos los estados</option>
          <option value="verified">Verificados</option>
          <option value="partial">Incompletos</option>
          <option value="not_started">Sin iniciar</option>
          <option value="suspended">Suspendidos</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Empleado
                    <SortIcon column="name" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Estado
                    <SortIcon column="status" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Docs pendientes
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('expiry')}
                >
                  <div className="flex items-center gap-1">
                    Próximo venc.
                    <SortIcon column="expiry" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Puede trabajar
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredEmployees.map((employee) => (
                <EmployeeRow
                  key={employee.userId}
                  employee={employee}
                  onViewDetails={onViewDetails}
                  onSendReminder={onSendReminder}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {filteredEmployees.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            {employees.length === 0 ? (
              <p>No hay empleados registrados.</p>
            ) : (
              <p>No se encontraron empleados con los filtros aplicados.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeComplianceTable;

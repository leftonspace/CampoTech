'use client';

/**
 * Requirements Table Component
 * ============================
 *
 * Displays organization verification requirements with status and actions.
 * Shows both mandatory Tier 2 requirements and optional Tier 4 badges.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  Upload,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Requirement {
  code: string;
  name: string;
  description: string;
  tier: number;
  isRequired: boolean;
  appliesTo: string;
  status: 'not_started' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  submittedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
  canUpload: boolean;
  canUpdate: boolean;
  rejectionReason: string | null;
  documentUrl?: string;
  submittedValue?: string;
}

export interface RequirementsTableProps {
  requirements: Requirement[];
  onUpload: (requirementCode: string) => void;
  onUpdate: (requirementCode: string) => void;
  onViewReason: (requirement: Requirement) => void;
  onViewDocument: (requirement: Requirement) => void;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  not_started: {
    label: 'Pendiente',
    color: 'bg-gray-100 text-gray-700',
    icon: Clock,
  },
  pending: {
    label: 'Enviado',
    color: 'bg-blue-100 text-blue-700',
    icon: Clock,
  },
  in_review: {
    label: 'En revisión',
    color: 'bg-amber-100 text-amber-700',
    icon: Eye,
  },
  approved: {
    label: 'Aprobado',
    color: 'bg-success-100 text-success-700',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rechazado',
    color: 'bg-danger-100 text-danger-700',
    icon: XCircle,
  },
  expired: {
    label: 'Vencido',
    color: 'bg-danger-100 text-danger-700',
    icon: AlertCircle,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: Requirement['status'] }) {
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
// EXPIRY DISPLAY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function ExpiryDisplay({ expiresAt, daysUntilExpiry, isExpiringSoon }: {
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
}) {
  if (!expiresAt) {
    return <span className="text-gray-400">-</span>;
  }

  const date = new Date(expiresAt).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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
        {daysUntilExpiry}d - {date}
      </span>
    );
  }

  return (
    <span className="text-gray-600 flex items-center gap-1">
      <Calendar className="h-3.5 w-3.5 text-gray-400" />
      {date}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALUE/DOCUMENT DISPLAY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function ValueDisplay({ requirement, onViewDocument }: {
  requirement: Requirement;
  onViewDocument: (requirement: Requirement) => void;
}) {
  if (requirement.status === 'not_started') {
    return <span className="text-gray-400 italic">No enviado</span>;
  }

  if (requirement.documentUrl) {
    return (
      <button
        onClick={() => onViewDocument(requirement)}
        className="text-primary-600 hover:text-primary-700 flex items-center gap-1 text-sm"
      >
        <FileText className="h-4 w-4" />
        Ver documento
        <ExternalLink className="h-3 w-3" />
      </button>
    );
  }

  if (requirement.submittedValue) {
    return (
      <span className="text-gray-700 font-mono text-sm">
        {requirement.submittedValue.length > 20
          ? `${requirement.submittedValue.substring(0, 20)}...`
          : requirement.submittedValue}
      </span>
    );
  }

  return <span className="text-gray-400">-</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIONS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function RequirementActions({
  requirement,
  onUpload,
  onUpdate,
  onViewReason,
}: {
  requirement: Requirement;
  onUpload: (code: string) => void;
  onUpdate: (code: string) => void;
  onViewReason: (requirement: Requirement) => void;
}) {
  const actions = [];

  // Upload button
  if (requirement.canUpload && requirement.status === 'not_started') {
    actions.push(
      <button
        key="upload"
        onClick={() => onUpload(requirement.code)}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
      >
        <Upload className="h-3.5 w-3.5" />
        Subir
      </button>
    );
  }

  // Update button
  if (requirement.canUpdate) {
    actions.push(
      <button
        key="update"
        onClick={() => onUpdate(requirement.code)}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Actualizar
      </button>
    );
  }

  // View rejection reason
  if (requirement.status === 'rejected' && requirement.rejectionReason) {
    actions.push(
      <button
        key="reason"
        onClick={() => onViewReason(requirement)}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-danger-600 bg-danger-50 hover:bg-danger-100 rounded-lg transition-colors"
      >
        <AlertCircle className="h-3.5 w-3.5" />
        Ver motivo
      </button>
    );
  }

  if (actions.length === 0) {
    return <span className="text-gray-400 text-xs">-</span>;
  }

  return <div className="flex items-center gap-2">{actions}</div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIREMENT ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function RequirementRow({
  requirement,
  onUpload,
  onUpdate,
  onViewReason,
  onViewDocument,
}: {
  requirement: Requirement;
  onUpload: (code: string) => void;
  onUpdate: (code: string) => void;
  onViewReason: (requirement: Requirement) => void;
  onViewDocument: (requirement: Requirement) => void;
}) {
  const needsAttention =
    requirement.status === 'rejected' ||
    requirement.status === 'expired' ||
    requirement.isExpiringSoon;

  return (
    <tr className={cn(needsAttention && 'bg-amber-50/50')}>
      {/* Requisito */}
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-gray-900 text-sm">{requirement.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{requirement.description}</p>
        </div>
      </td>

      {/* Estado */}
      <td className="px-4 py-3">
        <StatusBadge status={requirement.status} />
      </td>

      {/* Valor/Documento */}
      <td className="px-4 py-3">
        <ValueDisplay requirement={requirement} onViewDocument={onViewDocument} />
      </td>

      {/* Vencimiento */}
      <td className="px-4 py-3">
        <ExpiryDisplay
          expiresAt={requirement.expiresAt}
          daysUntilExpiry={requirement.daysUntilExpiry}
          isExpiringSoon={requirement.isExpiringSoon}
        />
      </td>

      {/* Acciones */}
      <td className="px-4 py-3">
        <RequirementActions
          requirement={requirement}
          onUpload={onUpload}
          onUpdate={onUpdate}
          onViewReason={onViewReason}
        />
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLAPSIBLE SECTION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  requirements: Requirement[];
  defaultOpen?: boolean;
  onUpload: (code: string) => void;
  onUpdate: (code: string) => void;
  onViewReason: (requirement: Requirement) => void;
  onViewDocument: (requirement: Requirement) => void;
}

function CollapsibleSection({
  title,
  subtitle,
  requirements,
  defaultOpen = true,
  onUpload,
  onUpdate,
  onViewReason,
  onViewDocument,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const completedCount = requirements.filter((r) => r.status === 'approved').length;
  const pendingCount = requirements.filter(
    (r) => r.status === 'not_started' || r.status === 'pending' || r.status === 'in_review'
  ).length;
  const issuesCount = requirements.filter(
    (r) => r.status === 'rejected' || r.status === 'expired' || r.isExpiringSoon
  ).length;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>

        {/* Progress indicators */}
        <div className="flex items-center gap-3">
          {completedCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-success-600">
              <CheckCircle className="h-4 w-4" />
              {completedCount}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-4 w-4" />
              {pendingCount}
            </span>
          )}
          {issuesCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-danger-600">
              <AlertCircle className="h-4 w-4" />
              {issuesCount}
            </span>
          )}
        </div>
      </button>

      {/* Table */}
      {isOpen && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-t border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requisito
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor/Documento
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vencimiento
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requirements.map((req) => (
                <RequirementRow
                  key={req.code}
                  requirement={req}
                  onUpload={onUpload}
                  onUpdate={onUpdate}
                  onViewReason={onViewReason}
                  onViewDocument={onViewDocument}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function RequirementsTable({
  requirements,
  onUpload,
  onUpdate,
  onViewReason,
  onViewDocument,
  className,
}: RequirementsTableProps) {
  // Separate Tier 2 (required) from Tier 4 (badges)
  const tier2Requirements = requirements.filter((r) => r.tier === 2);
  const tier4Requirements = requirements.filter((r) => r.tier === 4);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Tier 2: Mandatory Requirements */}
      {tier2Requirements.length > 0 && (
        <CollapsibleSection
          title="Requisitos Obligatorios (Tier 2)"
          subtitle="Documentación necesaria para operar"
          requirements={tier2Requirements}
          defaultOpen={true}
          onUpload={onUpload}
          onUpdate={onUpdate}
          onViewReason={onViewReason}
          onViewDocument={onViewDocument}
        />
      )}

      {/* Tier 4: Optional Badges */}
      {tier4Requirements.length > 0 && (
        <CollapsibleSection
          title="Badges Opcionales (Tier 4)"
          subtitle="Certificaciones adicionales para destacar tu negocio"
          requirements={tier4Requirements}
          defaultOpen={false}
          onUpload={onUpload}
          onUpdate={onUpdate}
          onViewReason={onViewReason}
          onViewDocument={onViewDocument}
        />
      )}

      {/* Empty state */}
      {requirements.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No hay requisitos de verificación disponibles.</p>
        </div>
      )}
    </div>
  );
}

export default RequirementsTable;

'use client';

/**
 * Employee Requirement Card Component
 * ====================================
 *
 * Card for displaying individual verification requirements for employees.
 * Shows status, current value/document, expiration, and action button.
 *
 * Features:
 * - Status badge with color coding
 * - Current value or document preview
 * - Expiration date with warning
 * - Submit/Update action button
 * - Inline upload modal support
 */

import { useState } from 'react';
import {
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Upload,
  RefreshCw,
  Calendar,
  FileText,
  ExternalLink,
  ChevronRight,
  User,
  CreditCard,
  Phone,
  Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmployeeRequirement {
  code: string;
  name: string;
  description: string;
  tier: number;
  isRequired: boolean;
  status: 'not_started' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  submittedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
  canUpload: boolean;
  canUpdate: boolean;
  rejectionReason: string | null;
  submittedValue?: string;
  documentUrl?: string;
}

export interface EmployeeRequirementCardProps {
  requirement: EmployeeRequirement;
  onSubmit: (requirementCode: string) => void;
  onUpdate: (requirementCode: string) => void;
  onViewDocument?: (requirement: EmployeeRequirement) => void;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  not_started: {
    label: 'Pendiente',
    description: 'Completá este paso para verificar tu identidad',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: Clock,
    iconColor: 'text-gray-400',
  },
  pending: {
    label: 'Enviado',
    description: 'Tu información ha sido enviada',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Clock,
    iconColor: 'text-blue-500',
  },
  in_review: {
    label: 'En revisión',
    description: 'Estamos verificando tu información',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Clock,
    iconColor: 'text-amber-500',
  },
  approved: {
    label: 'Aprobado',
    description: 'Tu verificación fue aprobada',
    color: 'bg-success-100 text-success-700 border-success-200',
    icon: CheckCircle,
    iconColor: 'text-success-500',
  },
  rejected: {
    label: 'Rechazado',
    description: 'Tu verificación fue rechazada',
    color: 'bg-danger-100 text-danger-700 border-danger-200',
    icon: XCircle,
    iconColor: 'text-danger-500',
  },
  expired: {
    label: 'Vencido',
    description: 'Tu verificación ha expirado',
    color: 'bg-danger-100 text-danger-700 border-danger-200',
    icon: AlertCircle,
    iconColor: 'text-danger-500',
  },
};

const REQUIREMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  cuil: User,
  dni_front: CreditCard,
  dni_back: CreditCard,
  identity_selfie: Camera,
  phone_verified: Phone,
  selfie: Camera,
  employee_cuil: User,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: EmployeeRequirement['status'] }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        config.color
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function ExpiryInfo({
  expiresAt,
  daysUntilExpiry,
  isExpiringSoon,
}: {
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
}) {
  if (!expiresAt) return null;

  const date = new Date(expiresAt).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (daysUntilExpiry !== null && daysUntilExpiry <= 0) {
    return (
      <span className="text-danger-600 text-xs font-medium flex items-center gap-1">
        <AlertCircle className="h-3.5 w-3.5" />
        Vencido
      </span>
    );
  }

  if (isExpiringSoon && daysUntilExpiry !== null) {
    return (
      <span className="text-amber-600 text-xs font-medium flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5" />
        Vence en {daysUntilExpiry} días
      </span>
    );
  }

  return (
    <span className="text-gray-500 text-xs flex items-center gap-1">
      <Calendar className="h-3.5 w-3.5" />
      Vence: {date}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function EmployeeRequirementCard({
  requirement,
  onSubmit,
  onUpdate,
  onViewDocument,
  className,
}: EmployeeRequirementCardProps) {
  const statusConfig = STATUS_CONFIG[requirement.status];
  const StatusIcon = statusConfig.icon;
  const RequirementIcon = REQUIREMENT_ICONS[requirement.code] || FileText;

  const needsAttention =
    requirement.status === 'rejected' ||
    requirement.status === 'expired' ||
    requirement.isExpiringSoon;

  const canTakeAction =
    requirement.canUpload ||
    requirement.canUpdate ||
    requirement.status === 'not_started';

  return (
    <div
      className={cn(
        'bg-white border rounded-xl p-4 transition-all',
        needsAttention
          ? 'border-amber-200 shadow-sm shadow-amber-100'
          : requirement.status === 'approved' && !requirement.isExpiringSoon
          ? 'border-success-200'
          : 'border-gray-200',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            requirement.status === 'approved' && !requirement.isExpiringSoon
              ? 'bg-success-100'
              : requirement.status === 'rejected' || requirement.status === 'expired'
              ? 'bg-danger-100'
              : requirement.status === 'in_review' || requirement.status === 'pending'
              ? 'bg-blue-100'
              : 'bg-gray-100'
          )}
        >
          <RequirementIcon
            className={cn(
              'h-5 w-5',
              requirement.status === 'approved' && !requirement.isExpiringSoon
                ? 'text-success-600'
                : requirement.status === 'rejected' || requirement.status === 'expired'
                ? 'text-danger-600'
                : requirement.status === 'in_review' || requirement.status === 'pending'
                ? 'text-blue-600'
                : 'text-gray-400'
            )}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-semibold text-gray-900 text-sm">{requirement.name}</h4>
            <StatusBadge status={requirement.status} />
          </div>

          <p className="text-xs text-gray-500 mb-2">{requirement.description}</p>

          {/* Submitted value or document */}
          {requirement.submittedValue && (
            <p className="text-xs text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded mb-2">
              {requirement.submittedValue}
            </p>
          )}

          {requirement.documentUrl && (
            <button
              onClick={() => onViewDocument?.(requirement)}
              className="text-primary-600 hover:text-primary-700 text-xs flex items-center gap-1 mb-2"
            >
              <FileText className="h-3.5 w-3.5" />
              Ver documento
              <ExternalLink className="h-3 w-3" />
            </button>
          )}

          {/* Rejection reason */}
          {requirement.status === 'rejected' && requirement.rejectionReason && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-2 mb-2">
              <p className="text-xs text-danger-700">
                <strong>Motivo:</strong> {requirement.rejectionReason}
              </p>
            </div>
          )}

          {/* Expiry info */}
          {requirement.status === 'approved' && (
            <ExpiryInfo
              expiresAt={requirement.expiresAt}
              daysUntilExpiry={requirement.daysUntilExpiry}
              isExpiringSoon={requirement.isExpiringSoon}
            />
          )}
        </div>
      </div>

      {/* Action button */}
      {canTakeAction && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          {requirement.status === 'not_started' && (
            <button
              onClick={() => onSubmit(requirement.code)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium text-sm hover:bg-primary-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Completar
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {(requirement.canUpdate || requirement.status === 'rejected' || requirement.status === 'expired') && (
            <button
              onClick={() => onUpdate(requirement.code)}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                requirement.status === 'rejected' || requirement.status === 'expired'
                  ? 'bg-danger-50 text-danger-700 hover:bg-danger-100'
                  : requirement.isExpiringSoon
                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              <RefreshCw className="h-4 w-4" />
              {requirement.status === 'rejected' ? 'Volver a enviar' : 'Actualizar'}
            </button>
          )}
        </div>
      )}

      {/* In review message */}
      {requirement.status === 'in_review' && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            Tu información está siendo revisada. Te notificaremos cuando esté lista.
          </p>
        </div>
      )}
    </div>
  );
}

export default EmployeeRequirementCard;

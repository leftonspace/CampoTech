'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Building,
  Car,
  Users,
  FileText,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Approval {
  id: string;
  orgId: string;
  entityType: 'organization' | 'user' | 'customer' | 'vehicle' | 'job';
  entityId: string;
  fieldName: string;
  currentValue: unknown;
  requestedValue: unknown;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

interface ApprovalsResponse {
  approvals: Approval[];
  pendingCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  organization: Building,
  user: User,
  customer: Users,
  vehicle: Car,
  job: FileText,
};

const ENTITY_LABELS: Record<string, string> = {
  organization: 'Organizacion',
  user: 'Usuario',
  customer: 'Cliente',
  vehicle: 'Vehiculo',
  job: 'Trabajo',
};

const FIELD_LABELS: Record<string, string> = {
  domicilioFiscal: 'Domicilio Fiscal',
  codigoPostal: 'Codigo Postal',
  role: 'Rol',
  puesto: 'Puesto',
  isActive: 'Estado Activo',
  direccionFiscal: 'Direccion Fiscal',
  primaryDriver: 'Conductor Principal',
  customerId: 'Cliente',
};

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchApprovals(): Promise<ApprovalsResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/approvals', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

async function processApproval(
  id: string,
  action: 'approve' | 'reject',
  rejectionReason?: string
): Promise<{ success: boolean; message?: string }> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`/api/approvals/${id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ action, rejectionReason }),
  });
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: Approval['status'] }) {
  const config = {
    pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700', icon: Clock },
    approved: { label: 'Aprobado', color: 'bg-success-100 text-success-700', icon: CheckCircle },
    rejected: { label: 'Rechazado', color: 'bg-danger-100 text-danger-700', icon: XCircle },
  };

  const { label, color, icon: Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function ApprovalCard({
  approval,
  onApprove,
  onReject,
  isProcessing,
}: {
  approval: Approval;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isProcessing: boolean;
}) {
  const Icon = ENTITY_ICONS[approval.entityType] || FileText;
  const entityLabel = ENTITY_LABELS[approval.entityType] || approval.entityType;
  const fieldLabel = FIELD_LABELS[approval.fieldName] || approval.fieldName;

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Si' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Hace menos de 1 hora';
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} dia${diffDays > 1 ? 's' : ''}`;

    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        {/* Entity Icon */}
        <div className="flex-shrink-0 p-2 rounded-lg bg-gray-100">
          <Icon className="h-6 w-6 text-gray-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900">{entityLabel}</span>
            <StatusBadge status={approval.status} />
          </div>

          <p className="text-sm text-gray-600 mb-2">
            Cambio en <span className="font-medium">{fieldLabel}</span>
          </p>

          {/* Value Change */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 text-xs">Valor actual</span>
                <p className="font-mono text-gray-900 truncate">
                  {formatValue(approval.currentValue)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Valor solicitado</span>
                <p className="font-mono text-primary-600 truncate">
                  {formatValue(approval.requestedValue)}
                </p>
              </div>
            </div>
          </div>

          {/* Reason */}
          {approval.reason && (
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-medium">Motivo:</span> {approval.reason}
            </p>
          )}

          {/* Rejection Reason */}
          {approval.status === 'rejected' && approval.rejectionReason && (
            <div className="bg-danger-50 text-danger-700 text-sm p-2 rounded mb-2">
              <span className="font-medium">Motivo de rechazo:</span> {approval.rejectionReason}
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {approval.requestedByName || 'Usuario'}
            </span>
            <span>{formatDate(approval.requestedAt)}</span>
          </div>
        </div>

        {/* Actions */}
        {approval.status === 'pending' && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onApprove(approval.id)}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-1.5 bg-success-600 text-white rounded-md text-sm font-medium hover:bg-success-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Aprobar
            </button>
            <button
              onClick={() => onReject(approval.id)}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-1.5 border border-danger-300 text-danger-600 rounded-md text-sm font-medium hover:bg-danger-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Rechazar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RejectModal({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isProcessing: boolean;
}) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-full bg-danger-100">
              <XCircle className="h-6 w-6 text-danger-600" />
            </div>
            <h3 className="text-lg font-semibold">Rechazar solicitud</h3>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Por favor ingresa el motivo del rechazo. Este mensaje será visible para el solicitante.
          </p>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo del rechazo..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[100px]"
            required
          />

          <div className="flex gap-3 mt-4">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(reason)}
              disabled={isProcessing || !reason.trim()}
              className="flex-1 px-4 py-2 bg-danger-600 text-white rounded-md hover:bg-danger-700 disabled:opacity-50"
            >
              {isProcessing ? 'Procesando...' : 'Confirmar rechazo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: fetchApprovals,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => processApproval(id, 'approve'),
    onSuccess: (response) => {
      if (response.success) {
        setSuccess('Solicitud aprobada correctamente');
        queryClient.invalidateQueries({ queryKey: ['approvals'] });
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.message || 'Error al aprobar');
      }
    },
    onError: () => setError('Error al aprobar la solicitud'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      processApproval(id, 'reject', reason),
    onSuccess: (response) => {
      if (response.success) {
        setSuccess('Solicitud rechazada');
        setRejectingId(null);
        queryClient.invalidateQueries({ queryKey: ['approvals'] });
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.message || 'Error al rechazar');
      }
    },
    onError: () => setError('Error al rechazar la solicitud'),
  });

  const approvals = data?.approvals || [];
  const pendingCount = data?.pendingCount || 0;

  const filteredApprovals = approvals.filter((a) => a.status === activeTab);

  const tabs = [
    { id: 'pending' as const, label: 'Pendientes', count: approvals.filter((a) => a.status === 'pending').length },
    { id: 'approved' as const, label: 'Aprobadas', count: approvals.filter((a) => a.status === 'approved').length },
    { id: 'rejected' as const, label: 'Rechazadas', count: approvals.filter((a) => a.status === 'rejected').length },
  ];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Aprobaciones Pendientes
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-sm bg-amber-100 text-amber-700 rounded-full">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-gray-500">Revisa y aprueba cambios que requieren tu autorizacion</p>
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="rounded-md bg-success-50 p-4 text-success-700 flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-md bg-danger-50 p-4 text-danger-700 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-danger-500 hover:text-danger-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {filteredApprovals.length === 0 ? (
        <div className="text-center py-12">
          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            {activeTab === 'pending' ? (
              <CheckCircle className="h-6 w-6 text-gray-400" />
            ) : (
              <FileText className="h-6 w-6 text-gray-400" />
            )}
          </div>
          <p className="text-gray-500">
            {activeTab === 'pending'
              ? 'No hay solicitudes pendientes'
              : `No hay solicitudes ${activeTab === 'approved' ? 'aprobadas' : 'rechazadas'}`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApprovals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onApprove={(id) => approveMutation.mutate(id)}
              onReject={(id) => setRejectingId(id)}
              isProcessing={approveMutation.isPending || rejectMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <RejectModal
        isOpen={!!rejectingId}
        onClose={() => setRejectingId(null)}
        onConfirm={(reason) => {
          if (rejectingId) {
            rejectMutation.mutate({ id: rejectingId, reason });
          }
        }}
        isProcessing={rejectMutation.isPending}
      />
    </div>
  );
}

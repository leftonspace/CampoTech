'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Clock, CheckCircle, XCircle, Plus, FileText } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ChangeRequest {
  id: string;
  entity_type: string;
  field_name: string;
  current_value: string;
  requested_value: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
  requested_by_name?: string;
  reviewed_by_name?: string;
}

interface ListResponse {
  success: boolean;
  data: ChangeRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ENTITY_LABELS: Record<string, string> = {
  organization: 'Empresa',
  user: 'Usuario',
  customer: 'Cliente',
  vehicle: 'Vehiculo',
};

const FIELD_LABELS: Record<string, string> = {
  cuit: 'CUIT',
  razonSocial: 'Razon Social',
  cuil: 'CUIL',
  dni: 'DNI',
  legalName: 'Nombre Legal',
  domicilioFiscal: 'Domicilio Fiscal',
  plateNumber: 'Patente',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Aprobado', color: 'bg-success-100 text-success-700', icon: CheckCircle },
  rejected: { label: 'Rechazado', color: 'bg-danger-100 text-danger-700', icon: XCircle },
};

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchChangeRequests(): Promise<ListResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/change-requests', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ChangeRequestListPage() {
  const { data, isLoading, error: _error } = useQuery({
    queryKey: ['change-requests'],
    queryFn: fetchChangeRequests,
  });

  const requests = data?.data || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

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
          href="/dashboard"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Mis Solicitudes de Cambio</h1>
          <p className="text-gray-500">Historial de solicitudes de modificacion de datos</p>
        </div>
        <Link href="/dashboard/support/change-request" className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nueva Solicitud
        </Link>
      </div>

      {/* Content */}
      {requests.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay solicitudes
          </h3>
          <p className="text-gray-500 mb-6">
            Todavia no has creado ninguna solicitud de cambio de datos.
          </p>
          <Link href="/dashboard/support/change-request" className="btn-primary">
            Crear solicitud
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Campo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cambio
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map((req) => {
                const status = STATUS_CONFIG[req.status];
                const StatusIcon = status.icon;

                return (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(req.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {ENTITY_LABELS[req.entity_type] || req.entity_type}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {FIELD_LABELS[req.field_name] || req.field_name}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="max-w-xs truncate">
                        {req.current_value && (
                          <span className="text-gray-400 line-through mr-2">
                            {req.current_value}
                          </span>
                        )}
                        <span className="text-primary-600">{req.requested_value}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Help Text */}
      <div className="text-center text-sm text-gray-500">
        <p>
          ¿Necesitas ayuda? Contactanos a{' '}
          <a href="mailto:soporte@campotech.com" className="text-primary-600 hover:underline">
            soporte@campotech.com
          </a>
        </p>
      </div>
    </div>
  );
}

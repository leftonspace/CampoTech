'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { cn, formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { ProtectedRoute } from '@/lib/auth-context';
import {
  ArrowLeft,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  Filter,
  Upload,
  MessageSquare,
} from 'lucide-react';

interface Dispute {
  id: string;
  paymentId: string;
  mpPaymentId: string;
  mpDisputeId: string;
  status: 'opened' | 'pending_review' | 'resolved' | 'closed';
  reason: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  resolution?: 'won' | 'lost' | 'partial';
  payment?: {
    id: string;
    invoice?: {
      id: string;
      number: number;
      customer?: {
        name: string;
      };
    };
  };
}

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  opened: 'Abierta',
  pending_review: 'En revisión',
  resolved: 'Resuelta',
  closed: 'Cerrada',
};

const DISPUTE_STATUS_COLORS: Record<string, string> = {
  opened: 'bg-red-100 text-red-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const RESOLUTION_LABELS: Record<string, string> = {
  won: 'A favor',
  lost: 'En contra',
  partial: 'Parcial',
};

export default function DisputesPage() {
  return (
    <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
      <DisputesContent />
    </ProtectedRoute>
  );
}

function DisputesContent() {
  const _queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['disputes', statusFilter],
    queryFn: () => api.payments.disputes(),
    refetchInterval: 60000,
  });

  const disputes = (data?.data as Dispute[]) || [];

  const filteredDisputes = statusFilter
    ? disputes.filter((d) => d.status === statusFilter)
    : disputes;

  const stats = {
    total: disputes.length,
    open: disputes.filter((d) => d.status === 'opened').length,
    pending: disputes.filter((d) => d.status === 'pending_review').length,
    totalAmount: disputes
      .filter((d) => d.status !== 'closed')
      .reduce((sum, d) => sum + d.amount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/payments"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Disputas y contracargos</h1>
            <p className="text-gray-500">Gestión de reclamos de MercadoPago</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-outline"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gray-100 p-2 text-gray-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total disputas</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Abiertas</p>
              <p className="text-xl font-bold text-red-600">{stats.open}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-100 p-2 text-yellow-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En revisión</p>
              <p className="text-xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-orange-100 p-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Monto en riesgo</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.totalAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert for urgent disputes */}
      {stats.open > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-red-50 p-4 text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">
              {stats.open} disputa{stats.open > 1 ? 's' : ''} requiere{stats.open > 1 ? 'n' : ''} atención
            </p>
            <p className="text-sm">Respondé antes de la fecha límite para evitar perder el reclamo.</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full sm:w-auto"
          >
            <option value="">Todos los estados</option>
            <option value="opened">Abiertas</option>
            <option value="pending_review">En revisión</option>
            <option value="resolved">Resueltas</option>
            <option value="closed">Cerradas</option>
          </select>
        </div>
      </div>

      {/* Disputes list */}
      <div className="card">
        {isLoading ? (
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredDisputes.length > 0 ? (
          <div className="divide-y">
            {filteredDisputes.map((dispute) => (
              <button
                key={dispute.id}
                onClick={() => setSelectedDispute(dispute)}
                className="flex w-full items-center gap-4 p-4 text-left hover:bg-gray-50"
              >
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  dispute.status === 'opened' ? 'bg-red-100 text-red-600' :
                    dispute.status === 'pending_review' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-gray-100 text-gray-600'
                )}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {dispute.payment?.invoice?.customer?.name || 'Cliente desconocido'}
                    </span>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      DISPUTE_STATUS_COLORS[dispute.status]
                    )}>
                      {DISPUTE_STATUS_LABELS[dispute.status]}
                    </span>
                    {dispute.resolution && (
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        dispute.resolution === 'won' ? 'bg-green-100 text-green-800' :
                          dispute.resolution === 'lost' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                      )}>
                        {RESOLUTION_LABELS[dispute.resolution]}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {dispute.reason} Í¢â‚¬Â¢ {formatCurrency(dispute.amount)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Creada: {formatDate(dispute.createdAt)}
                    {dispute.dueDate && ` Í¢â‚¬Â¢ Vence: ${formatDate(dispute.dueDate)}`}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
            <p className="mt-4 text-gray-500">No hay disputas {statusFilter ? 'con este estado' : ''}</p>
          </div>
        )}
      </div>

      {/* Dispute detail modal */}
      {selectedDispute && (
        <DisputeDetailModal
          dispute={selectedDispute}
          onClose={() => setSelectedDispute(null)}
        />
      )}
    </div>
  );
}

function DisputeDetailModal({
  dispute,
  onClose,
}: {
  dispute: Dispute;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-medium">Detalle de disputa</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <XCircle className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-4">
            <span className={cn(
              'rounded-full px-3 py-1 font-medium',
              DISPUTE_STATUS_COLORS[dispute.status]
            )}>
              {DISPUTE_STATUS_LABELS[dispute.status]}
            </span>
            {dispute.resolution && (
              <span className={cn(
                'rounded-full px-3 py-1 font-medium',
                dispute.resolution === 'won' ? 'bg-green-100 text-green-800' :
                  dispute.resolution === 'lost' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
              )}>
                Resolución: {RESOLUTION_LABELS[dispute.resolution]}
              </span>
            )}
          </div>

          {/* Details grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">Monto disputado</p>
              <p className="text-xl font-bold">{formatCurrency(dispute.amount)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Motivo</p>
              <p className="font-medium">{dispute.reason}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha de creación</p>
              <p>{formatDateTime(dispute.createdAt)}</p>
            </div>
            {dispute.dueDate && (
              <div>
                <p className="text-sm text-gray-500">Fecha límite respuesta</p>
                <p className={cn(
                  new Date(dispute.dueDate) < new Date() && dispute.status === 'opened'
                    ? 'text-red-600 font-medium'
                    : ''
                )}>
                  {formatDateTime(dispute.dueDate)}
                </p>
              </div>
            )}
          </div>

          {/* Customer and payment info */}
          {dispute.payment?.invoice && (
            <div className="rounded-lg border p-4">
              <h3 className="mb-3 font-medium text-gray-900">Información del pago</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente</span>
                  <span>{dispute.payment.invoice.customer?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Factura</span>
                  <Link
                    href={`/dashboard/invoices/${dispute.payment.invoice.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    #{dispute.payment.invoice.number}
                  </Link>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ID Pago MP</span>
                  <span className="font-mono">{dispute.mpPaymentId}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions for open disputes */}
          {dispute.status === 'opened' && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <h3 className="mb-3 font-medium text-yellow-800">Acciones requeridas</h3>
              <p className="mb-4 text-sm text-yellow-700">
                Subí evidencia para contestar la disputa antes de la fecha límite.
              </p>
              <div className="space-y-3">
                <button className="btn-primary w-full justify-center">
                  <Upload className="mr-2 h-4 w-4" />
                  Subir evidencia
                </button>
                <a
                  href={`https://www.mercadopago.com.ar/activities/${dispute.mpPaymentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline w-full justify-center"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver en MercadoPago
                </a>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label mb-2 block">Notas internas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Agregar notas sobre esta disputa..."
              className="input"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t p-4">
          <button onClick={onClose} className="btn-outline">
            Cerrar
          </button>
          {notes && (
            <button className="btn-primary">
              <MessageSquare className="mr-2 h-4 w-4" />
              Guardar notas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

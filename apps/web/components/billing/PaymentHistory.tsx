'use client';

/**
 * Payment History Component
 * =========================
 *
 * Displays a table of past subscription payments with:
 * - Date
 * - Amount
 * - Payment method icon + last 4 digits
 * - Status badge
 * - Download invoice link
 * - Retry button for failed payments
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  paymentMethod?: string;
  paymentType?: string;
  last4?: string;
  cardBrand?: string;
  billingCycle?: string;
  periodStart?: string;
  periodEnd?: string;
  paidAt?: string;
  failureReason?: string;
  invoiceUrl?: string;
  createdAt: string;
}

export interface PaymentHistoryResponse {
  success: boolean;
  data: {
    payments: Payment[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface PaymentHistoryProps {
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchPaymentHistory(page: number = 1): Promise<PaymentHistoryResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`/api/subscription/payments?page=${page}`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

async function retryPayment(paymentId: string): Promise<{ success: boolean; message?: string }> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`/api/subscription/payments/${paymentId}/retry`, {
    method: 'POST',
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  pending: {
    label: 'Pendiente',
    color: 'bg-amber-100 text-amber-700',
    icon: Clock,
  },
  processing: {
    label: 'Procesando',
    color: 'bg-blue-100 text-blue-700',
    icon: Loader2,
  },
  completed: {
    label: 'Completado',
    color: 'bg-success-100 text-success-700',
    icon: CheckCircle,
  },
  failed: {
    label: 'Fallido',
    color: 'bg-danger-100 text-danger-700',
    icon: XCircle,
  },
  refunded: {
    label: 'Reembolsado',
    color: 'bg-gray-100 text-gray-700',
    icon: RefreshCw,
  },
};

const CARD_BRAND_COLORS: Record<string, string> = {
  visa: 'bg-blue-600',
  mastercard: 'bg-red-500',
  amex: 'bg-blue-500',
  naranja: 'bg-orange-500',
  cabal: 'bg-blue-700',
  maestro: 'bg-blue-500',
};

function formatCurrency(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PaymentHistory({ className }: PaymentHistoryProps) {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['payment-history', page],
    queryFn: () => fetchPaymentHistory(page),
  });

  const retryMutation = useMutation({
    mutationFn: retryPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-xl border p-6', className)}>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data?.success) {
    return (
      <div className={cn('bg-white rounded-xl border p-6', className)}>
        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
          <AlertCircle className="h-8 w-8 mb-2" />
          <p>No se pudo cargar el historial de pagos</p>
        </div>
      </div>
    );
  }

  const { payments, pagination } = data.data;

  // Empty state
  if (payments.length === 0) {
    return (
      <div className={cn('bg-white rounded-xl border p-6', className)}>
        <div className="flex items-center gap-3 mb-4">
          <Receipt className="h-5 w-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Historial de pagos</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <CreditCard className="h-12 w-12 mb-3 text-gray-300" />
          <p className="text-sm">No hay pagos registrados</p>
          <p className="text-xs text-gray-400 mt-1">
            Los pagos aparecerán aquí cuando realices tu primera compra
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-xl border overflow-hidden', className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Receipt className="h-5 w-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Historial de pagos</h3>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Monto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Método
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payments.map((payment) => {
              const statusConfig = STATUS_CONFIG[payment.status];
              const StatusIcon = statusConfig.icon;
              const brandColor = payment.cardBrand
                ? CARD_BRAND_COLORS[payment.cardBrand.toLowerCase()] || 'bg-gray-500'
                : 'bg-gray-500';

              return (
                <tr key={payment.id} className="hover:bg-gray-50">
                  {/* Date */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(payment.paidAt || payment.createdAt)}
                    </div>
                    {payment.billingCycle && (
                      <div className="text-xs text-gray-500">
                        {payment.billingCycle === 'MONTHLY' ? 'Mensual' : 'Anual'}
                      </div>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(payment.amount, payment.currency)}
                    </div>
                  </td>

                  {/* Payment Method */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {payment.cardBrand ? (
                        <>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium text-white',
                              brandColor
                            )}
                          >
                            {payment.cardBrand}
                          </span>
                          {payment.last4 && (
                            <span className="text-sm text-gray-500">
                              •••• {payment.last4}
                            </span>
                          )}
                        </>
                      ) : payment.paymentType ? (
                        <span className="text-sm text-gray-600">
                          {payment.paymentType === 'ticket' ? 'Efectivo' :
                           payment.paymentType === 'bank_transfer' ? 'Transferencia' :
                           payment.paymentType === 'account_money' ? 'Mercado Pago' :
                           payment.paymentType}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                        statusConfig.color
                      )}
                    >
                      <StatusIcon className={cn('h-3 w-3', payment.status === 'processing' && 'animate-spin')} />
                      {statusConfig.label}
                    </span>
                    {payment.failureReason && (
                      <p className="text-xs text-danger-600 mt-1">
                        {payment.failureReason}
                      </p>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Download Invoice */}
                      {payment.invoiceUrl && (
                        <a
                          href={payment.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Descargar factura"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}

                      {/* Retry Failed Payment */}
                      {payment.status === 'failed' && (
                        <button
                          onClick={() => retryMutation.mutate(payment.id)}
                          disabled={retryMutation.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={cn('h-3 w-3', retryMutation.isPending && 'animate-spin')} />
                          Reintentar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Mostrando {(pagination.page - 1) * pagination.pageSize + 1} -{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} de{' '}
            {pagination.total} pagos
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-600">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === pagination.totalPages}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default PaymentHistory;

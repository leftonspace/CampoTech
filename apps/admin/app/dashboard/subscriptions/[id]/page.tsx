'use client';

/**
 * Admin Subscription Detail Page
 * ===============================
 *
 * Detailed view of a subscription with payment history, audit log, and admin actions.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  SubscriptionDetail,
  SubscriptionPaymentItem,
  SubscriptionEventItem,
  SubscriptionTier,
  SubscriptionStatus,
  PaymentStatus,
} from '@/types';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TIER_LABELS: Record<SubscriptionTier, string> = {
  FREE: 'Free',
  INICIAL: 'Inicial',
  PROFESIONAL: 'Profesional',
  EMPRESA: 'Empresa',
};

const TIER_COLORS: Record<SubscriptionTier, string> = {
  FREE: 'bg-slate-100 text-slate-700',
  INICIAL: 'bg-blue-100 text-blue-700',
  PROFESIONAL: 'bg-purple-100 text-purple-700',
  EMPRESA: 'bg-amber-100 text-amber-700',
};

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  none: 'Sin suscripción',
  trialing: 'En prueba',
  active: 'Activo',
  past_due: 'Pago pendiente',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  paused: 'Pausado',
};

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  none: 'bg-slate-100 text-slate-700',
  trialing: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-700',
  expired: 'bg-red-100 text-red-700',
  paused: 'bg-yellow-100 text-yellow-700',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  completed: 'Completado',
  failed: 'Fallido',
  refunded: 'Reembolsado',
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-purple-100 text-purple-700',
};

const EVENT_LABELS: Record<string, string> = {
  created: 'Creado',
  activated: 'Activado',
  trial_started: 'Trial iniciado',
  trial_ended: 'Trial terminado',
  trial_extended: 'Trial extendido',
  payment_succeeded: 'Pago exitoso',
  payment_failed: 'Pago fallido',
  payment_retry_initiated: 'Reintento de pago',
  payment_manually_resolved: 'Pago resuelto manualmente',
  upgraded: 'Plan mejorado',
  downgraded: 'Plan reducido',
  cancelled: 'Cancelado',
  reactivated: 'Reactivado',
  expired: 'Expirado',
  grace_period_started: 'Período de gracia iniciado',
  grace_period_ended: 'Período de gracia terminado',
  admin_note: 'Nota de admin',
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const subscriptionId = params.id as string;

  // State
  const [subscription, setSubscription] = useState<SubscriptionDetail | null>(null);
  const [payments, setPayments] = useState<SubscriptionPaymentItem[]>([]);
  const [events, setEvents] = useState<SubscriptionEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal states
  const [showExtendTrialModal, setShowExtendTrialModal] = useState(false);
  const [showChangeTierModal, setShowChangeTierModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);

  // Action form states
  const [extendDays, setExtendDays] = useState(7);
  const [newTier, setNewTier] = useState<SubscriptionTier>('PROFESIONAL');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [noteContent, setNoteContent] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState<'payments' | 'events'>('payments');

  // Fetch data
  useEffect(() => {
    fetchSubscription();
  }, [subscriptionId]);

  async function fetchSubscription() {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}`);
      const data = await response.json();

      if (data.success) {
        setSubscription(data.data.subscription);
        setPayments(data.data.payments);
        setEvents(data.data.events);
      } else {
        setError(data.error || 'Error fetching subscription');
      }
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  }

  async function performAction(action: string, data: Record<string, unknown> = {}) {
    try {
      setActionLoading(true);
      setActionMessage(null);

      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });

      const result = await response.json();

      if (result.success) {
        setActionMessage({ type: 'success', text: result.message });
        fetchSubscription(); // Refresh data
      } else {
        setActionMessage({ type: 'error', text: result.error || 'Error performing action' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Error connecting to server' });
    } finally {
      setActionLoading(false);
    }
  }

  // Action handlers
  function handleExtendTrial() {
    performAction('extend-trial', { days: extendDays });
    setShowExtendTrialModal(false);
  }

  function handleChangeTier() {
    performAction('change-tier', { newTier, immediate: true });
    setShowChangeTierModal(false);
  }

  function handleCancel() {
    performAction('cancel', { reason: cancelReason, immediate: cancelImmediate });
    setShowCancelModal(false);
  }

  function handleReactivate() {
    performAction('reactivate');
  }

  function handleAddNote() {
    performAction('add-note', { content: noteContent });
    setShowAddNoteModal(false);
    setNoteContent('');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Cargando suscripción...</p>
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-700">{error || 'Subscription not found'}</p>
        <Link
          href="/dashboard/subscriptions"
          className="text-blue-600 hover:underline mt-4 inline-block"
        >
          ← Volver a suscripciones
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/subscriptions"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{subscription.organizationName}</h1>
          <p className="text-slate-500 mt-1">{subscription.ownerEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${TIER_COLORS[subscription.tier]}`}>
            {TIER_LABELS[subscription.tier]}
          </span>
          <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${STATUS_COLORS[subscription.status]}`}>
            {STATUS_LABELS[subscription.status]}
          </span>
        </div>
      </div>

      {/* Action Message */}
      {actionMessage && (
        <div
          className={`mb-6 p-4 rounded-xl border ${
            actionMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Subscription Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Info */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Información de Suscripción</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500">CUIT</p>
              <p className="font-medium text-slate-900">{subscription.cuit || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Ciclo de Facturación</p>
              <p className="font-medium text-slate-900">
                {subscription.billingCycle === 'MONTHLY' ? 'Mensual' : 'Anual'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Precio</p>
              <p className="font-medium text-slate-900">
                {subscription.priceUsd
                  ? `${formatCurrency(subscription.priceUsd)}/${subscription.billingCycle === 'MONTHLY' ? 'mes' : 'año'}`
                  : 'Gratis'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Período Actual</p>
              <p className="font-medium text-slate-900">
                {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
            {subscription.trialEndsAt && (
              <div>
                <p className="text-sm text-slate-500">Fin de Trial</p>
                <p className="font-medium text-slate-900">{formatDate(subscription.trialEndsAt)}</p>
              </div>
            )}
            {subscription.gracePeriodEndsAt && (
              <div>
                <p className="text-sm text-slate-500">Fin de Gracia</p>
                <p className="font-medium text-red-600">{formatDate(subscription.gracePeriodEndsAt)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-slate-500">Usuarios</p>
              <p className="font-medium text-slate-900">{subscription.userCount}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Trabajos</p>
              <p className="font-medium text-slate-900">{subscription.jobCount}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Creado</p>
              <p className="font-medium text-slate-900">{formatDateTime(subscription.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Última Actualización</p>
              <p className="font-medium text-slate-900">{formatDateTime(subscription.updatedAt)}</p>
            </div>
            {subscription.mpSubscriptionId && (
              <div className="col-span-2">
                <p className="text-sm text-slate-500">MercadoPago ID</p>
                <p className="font-mono text-sm text-slate-700">{subscription.mpSubscriptionId}</p>
              </div>
            )}
            {subscription.cancelledAt && (
              <div className="col-span-2 bg-red-50 rounded-lg p-4 border border-red-100">
                <p className="text-sm text-red-600 font-medium">Cancelado</p>
                <p className="text-sm text-red-700">
                  {formatDateTime(subscription.cancelledAt)}
                  {subscription.cancelReason && ` - ${subscription.cancelReason}`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Acciones</h2>
          <div className="space-y-3">
            {subscription.status === 'trialing' && (
              <button
                onClick={() => setShowExtendTrialModal(true)}
                disabled={actionLoading}
                className="w-full py-2 px-4 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                Extender Trial
              </button>
            )}

            <button
              onClick={() => setShowChangeTierModal(true)}
              disabled={actionLoading}
              className="w-full py-2 px-4 bg-purple-50 text-purple-700 rounded-lg font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              Cambiar Plan
            </button>

            {subscription.status === 'cancelled' ? (
              <button
                onClick={handleReactivate}
                disabled={actionLoading}
                className="w-full py-2 px-4 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                Reactivar
              </button>
            ) : (
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading || subscription.status === 'cancelled'}
                className="w-full py-2 px-4 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                Cancelar Suscripción
              </button>
            )}

            <button
              onClick={() => setShowAddNoteModal(true)}
              disabled={actionLoading}
              className="w-full py-2 px-4 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Agregar Nota
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
              activeTab === 'payments'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Historial de Pagos ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
              activeTab === 'events'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Registro de Cambios ({events.length})
          </button>
        </div>

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="overflow-x-auto">
            {payments.length > 0 ? (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Fecha
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Monto
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Estado
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Tipo
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Período
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">
                      MP ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {formatDateTime(payment.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {formatCurrency(payment.amount)} {payment.currency}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            PAYMENT_STATUS_COLORS[payment.status]
                          }`}
                        >
                          {PAYMENT_STATUS_LABELS[payment.status]}
                        </span>
                        {payment.failureReason && (
                          <p className="text-xs text-red-500 mt-1">{payment.failureReason}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 capitalize">
                        {payment.paymentType}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">
                        {payment.mpPaymentId || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-slate-500">
                No hay pagos registrados
              </div>
            )}
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="p-6">
            {events.length > 0 ? (
              <div className="space-y-4">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg"
                  >
                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-4 h-4 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900">
                          {EVENT_LABELS[event.eventType] || event.eventType}
                        </p>
                        <span className="text-xs text-slate-500">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                      {event.actorType && (
                        <p className="text-sm text-slate-500 mt-1">
                          Por: {event.actorType}
                          {event.actorId && ` (${event.actorId})`}
                        </p>
                      )}
                      {Object.keys(event.eventData).length > 0 && (
                        <pre className="mt-2 text-xs bg-slate-100 rounded p-2 overflow-x-auto">
                          {JSON.stringify(event.eventData, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">
                No hay eventos registrados
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extend Trial Modal */}
      {showExtendTrialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Extender Trial</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Días a extender
              </label>
              <input
                type="number"
                value={extendDays}
                onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                min={1}
                max={90}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExtendTrialModal(false)}
                className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleExtendTrial}
                disabled={extendDays < 1 || extendDays > 90}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Extender
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Tier Modal */}
      {showChangeTierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Cambiar Plan</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nuevo Plan
              </label>
              <select
                value={newTier}
                onChange={(e) => setNewTier(e.target.value as SubscriptionTier)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="FREE">Free</option>
                <option value="INICIAL">Inicial ($25/mes)</option>
                <option value="PROFESIONAL">Profesional ($55/mes)</option>
                <option value="EMPRESA">Empresa ($120/mes)</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowChangeTierModal(false)}
                className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangeTier}
                disabled={newTier === subscription.tier}
                className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                Cambiar Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Cancelar Suscripción</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Motivo de cancelación
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                placeholder="Ingrese el motivo..."
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cancelImmediate}
                  onChange={(e) => setCancelImmediate(e.target.checked)}
                  className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                />
                <span className="text-sm text-slate-700">Cancelar inmediatamente</span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">
                Si no se marca, se cancelará al final del período actual
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
              >
                Volver
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
              >
                Cancelar Suscripción
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Agregar Nota</h3>
            <div className="mb-4">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                placeholder="Escriba su nota..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddNoteModal(false)}
                className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddNote}
                disabled={!noteContent.trim()}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Guardar Nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CombinedOrganizationDetail, CombinedActivityItem } from '@/types';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  none: { label: 'Sin suscripción', color: 'bg-slate-100 text-slate-700' },
  trialing: { label: 'Período de prueba', color: 'bg-blue-100 text-blue-700' },
  active: { label: 'Activa', color: 'bg-green-100 text-green-700' },
  past_due: { label: 'Pago vencido', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelada', color: 'bg-slate-100 text-slate-700' },
  expired: { label: 'Expirada', color: 'bg-slate-100 text-slate-700' },
  paused: { label: 'Pausada', color: 'bg-yellow-100 text-yellow-700' },
};

const VERIFICATION_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_started: { label: 'No iniciada', color: 'bg-slate-100 text-slate-700' },
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  verified: { label: 'Verificada', color: 'bg-green-100 text-green-700' },
  suspended: { label: 'Suspendida', color: 'bg-red-100 text-red-700' },
};

export default function CombinedOrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [organization, setOrganization] = useState<CombinedOrganizationDetail | null>(null);
  const [activity, setActivity] = useState<CombinedActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'subscription' | 'verification' | 'activity'>('overview');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchOrganization();
  }, [id]);

  async function fetchOrganization() {
    try {
      const res = await fetch(`/api/admin/organizations/${id}/combined?includeActivity=true`);
      const data = await res.json();
      if (data.success) {
        setOrganization(data.data.organization);
        setActivity(data.data.activity || []);
      } else {
        setError(data.error || 'Error loading organization');
      }
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  }

  async function handleBlockToggle() {
    if (!organization) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: organization.block.isBlocked ? 'unblock' : 'block',
          reason: organization.block.isBlocked ? undefined : 'Bloqueado por admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrganization();
      } else {
        alert(data.error || 'Error performing action');
      }
    } catch (err) {
      alert('Error connecting to server');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error || 'Organization not found'}
      </div>
    );
  }

  const subStatus = STATUS_LABELS[organization.subscription.status] || STATUS_LABELS.none;
  const verStatus = VERIFICATION_STATUS_LABELS[organization.verification.status] || VERIFICATION_STATUS_LABELS.not_started;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{organization.name}</h1>
            <p className="text-slate-500 mt-1">
              CUIT: {organization.cuit || 'No registrado'} • Creado: {formatDate(organization.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {organization.block.isBlocked && (
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                Bloqueado
              </span>
            )}
            <button
              onClick={handleBlockToggle}
              disabled={actionLoading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                organization.block.isBlocked
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {actionLoading ? 'Procesando...' : organization.block.isBlocked ? 'Desbloquear' : 'Bloquear'}
            </button>
          </div>
        </div>
      </div>

      {/* Status Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Subscription Status */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Suscripción</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${subStatus.color}`}>
              {subStatus.label}
            </span>
          </div>
          <p className="text-lg font-semibold text-slate-900">{organization.subscription.tier}</p>
          {organization.subscription.priceUsd && (
            <p className="text-sm text-slate-500">
              {formatCurrency(organization.subscription.priceUsd)}/mes
            </p>
          )}
        </div>

        {/* Verification Status */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Verificación</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${verStatus.color}`}>
              {verStatus.label}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-lg font-semibold text-slate-900">
                Nivel 2: {organization.verification.tier2Progress.completed}/{organization.verification.tier2Progress.total}
              </p>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">
                Nivel 3: {organization.verification.tier3Progress.completed}/{organization.verification.tier3Progress.total}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <span className="text-sm text-slate-500">Estadísticas</span>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <p className="text-lg font-semibold text-slate-900">{organization.stats.employeeCount}</p>
              <p className="text-xs text-slate-500">Empleados</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">{organization.stats.jobCount}</p>
              <p className="text-xs text-slate-500">Trabajos</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">{formatCurrency(organization.stats.totalPaid)}</p>
              <p className="text-xs text-slate-500">Total pagado</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">{organization.stats.totalPayments}</p>
              <p className="text-xs text-slate-500">Pagos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-6">
          {(['overview', 'subscription', 'verification', 'activity'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'overview' && 'Resumen'}
              {tab === 'subscription' && 'Suscripción'}
              {tab === 'verification' && 'Verificación'}
              {tab === 'activity' && 'Actividad'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Owner Info */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Propietario</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Nombre</p>
                <p className="text-slate-900">{organization.owner.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="text-slate-900">{organization.owner.email}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Teléfono</p>
                <p className="text-slate-900">{organization.owner.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">CUIL</p>
                <p className="text-slate-900">{organization.owner.cuil || '-'}</p>
              </div>
            </div>
          </div>

          {/* Organization Info */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Organización</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Nombre</p>
                <p className="text-slate-900">{organization.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">CUIT</p>
                <p className="text-slate-900">{organization.cuit || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Teléfono</p>
                <p className="text-slate-900">{organization.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Dirección</p>
                <p className="text-slate-900">{organization.address || '-'}</p>
              </div>
            </div>
          </div>

          {/* Block Info */}
          {organization.block.isBlocked && (
            <div className="bg-red-50 rounded-xl p-6 border border-red-200 lg:col-span-2">
              <h3 className="text-lg font-semibold text-red-900 mb-4">Bloqueo Activo</h3>
              <div className="space-y-2">
                <p><strong>Razón:</strong> {organization.block.reason || 'No especificada'}</p>
                <p><strong>Bloqueado:</strong> {formatDate(organization.block.blockedAt)}</p>
                <p><strong>Por:</strong> {organization.block.blockedBy || 'Sistema'}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'subscription' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Detalles de Suscripción</h3>
            {organization.subscription.id && (
              <Link
                href={`/dashboard/subscriptions/${organization.subscription.id}`}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Ver completo
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-slate-500">Plan</p>
              <p className="text-lg font-semibold text-slate-900">{organization.subscription.tier}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Estado</p>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${subStatus.color}`}>
                {subStatus.label}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Ciclo</p>
              <p className="text-lg font-semibold text-slate-900">
                {organization.subscription.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Precio</p>
              <p className="text-lg font-semibold text-slate-900">
                {organization.subscription.priceUsd ? formatCurrency(organization.subscription.priceUsd) : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Trial termina</p>
              <p className="text-slate-900">{formatDate(organization.subscription.trialEndsAt)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Período actual</p>
              <p className="text-slate-900">
                {formatDate(organization.subscription.currentPeriodStart)} - {formatDate(organization.subscription.currentPeriodEnd)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Cancela al final</p>
              <p className="text-slate-900">{organization.subscription.cancelAtPeriodEnd ? 'Sí' : 'No'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Período de gracia</p>
              <p className="text-slate-900">{formatDate(organization.subscription.gracePeriodEndsAt)}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'verification' && (
        <div className="space-y-6">
          {/* Requirements Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Requisitos de Verificación</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase">Requisito</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase">Nivel</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase">Enviado</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase">Vence</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {organization.verification.requirements.map((req) => (
                    <tr key={req.requirementId} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{req.name}</p>
                        <p className="text-xs text-slate-500">{req.category}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm">{req.tier}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            req.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : req.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : req.status === 'pending' || req.status === 'in_review'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {req.status === 'not_submitted' ? 'No enviado' : req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(req.submittedAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(req.expiresAt)}
                      </td>
                      <td className="px-6 py-4">
                        {req.documentUrl && (
                          <a
                            href={req.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            Ver documento
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Línea de Tiempo</h3>
          </div>
          <div className="p-6">
            {activity.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay actividad registrada</p>
            ) : (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.source === 'subscription'
                          ? 'bg-blue-100'
                          : item.source === 'verification'
                          ? 'bg-purple-100'
                          : item.source === 'payment'
                          ? 'bg-green-100'
                          : 'bg-red-100'
                      }`}
                    >
                      {item.source === 'subscription' && (
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                      {item.source === 'verification' && (
                        <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      )}
                      {item.source === 'payment' && (
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {item.source === 'block' && (
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 pb-4 border-b border-slate-100">
                      <p className="text-sm text-slate-900">{item.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">
                          {new Date(item.createdAt).toLocaleString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {item.actorName && (
                          <span className="text-xs text-slate-400">• {item.actorName}</span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            item.source === 'subscription'
                              ? 'bg-blue-50 text-blue-600'
                              : item.source === 'verification'
                              ? 'bg-purple-50 text-purple-600'
                              : item.source === 'payment'
                              ? 'bg-green-50 text-green-600'
                              : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {item.source}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

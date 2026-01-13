'use client';

/**
 * Billing Page
 * ============
 *
 * Comprehensive billing management page including:
 * - Current subscription and trial status
 * - Plan selection with monthly/yearly toggle
 * - Payment history
 * - Payment methods
 * - Cancellation with Ley 24.240 compliance
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  CreditCard,
  Users,
  Calendar,
  Car,
  Package,
  HardDrive,
  FileText,
  MessageSquare,
  Code,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  Sparkles,
  XCircle,
  Shield,
  Clock,
  Undo2,
  ChevronDown,
  ChevronUp,
  Receipt,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanSelector } from '@/components/billing/PlanSelector';
import { PaymentHistory } from '@/components/billing/PaymentHistory';
import { PaymentMethods } from '@/components/billing/PaymentMethods';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface UsageItem {
  current: number;
  limit: number | null;
  percentage: number;
  label: string;
  isMonthly?: boolean;
  isDaily?: boolean;
}

interface TierInfo {
  id: string;
  name: string;
  description: string;
  price: string;
  priceUsd?: number;
  isCurrent: boolean;
  highlights: string[];
}

interface Warning {
  limitType: string;
  label: string;
  percentage: number;
  message: string;
}

interface UsageResponse {
  tier: {
    id: string;
    name: string;
    description: string;
    priceDisplay: string;
  };
  billingPeriod: {
    current: string;
    startDate: string;
    endDate: string;
    daysRemaining: number;
  };
  usage: {
    users: UsageItem;
    customers: UsageItem;
    jobs: UsageItem;
    invoices: UsageItem;
    vehicles: UsageItem;
    products: UsageItem;
    storage: UsageItem;
    documents: UsageItem;
    whatsapp: UsageItem;
    api: UsageItem;
  };
  warnings: Warning[];
  criticalLimits: string[];
  approachingLimits: string[];
  upgradeRecommendation: {
    recommended: boolean;
    suggestedTier?: string;
    suggestedTierName?: string;
    reason?: string;
    upgradeUrl: string;
  } | null;
  availableTiers: TierInfo[];
}

interface TrialStatusResponse {
  success: boolean;
  data: {
    isTrialing: boolean;
    daysRemaining: number;
    trialEndsAt: string | null;
    hasTrialExpired?: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchUsage(): Promise<UsageResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/usage', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

interface PlansResponse {
  success: boolean;
  data?: {
    plans: Array<{
      tier: string;
      name: string;
      description: string;
      features: string[];
      monthly: { price: number; priceFormatted: string };
      yearly: { price: number; priceFormatted: string; savings: number };
    }>;
    configured: boolean;
  };
}

async function fetchPlans(): Promise<PlansResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/subscription/checkout', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

async function fetchTrialStatus(): Promise<TrialStatusResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/subscription/trial-status', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

interface CancellationEligibility {
  canCancel: boolean;
  eligibleForRefund: boolean;
  daysUntilRefundExpires: number | null;
  currentPlan: string;
  refundAmount: number | null;
  message: string;
}

interface CancellationRequest {
  id: string;
  status: string;
  refundStatus: string;
  refundAmount?: number;
  eligibleForRefund: boolean;
  requestedAt: string;
  effectiveDate?: string;
  reason: string;
}

interface CancellationStatusResponse {
  success: boolean;
  data: {
    eligibility: CancellationEligibility;
    currentRequest: CancellationRequest | null;
  };
}

async function fetchCancellationStatus(): Promise<CancellationStatusResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/subscription/cancel', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

async function requestCancellation(reason: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/subscription/cancel', {
    method: 'POST',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  return res.json();
}

async function undoCancellation(): Promise<{ success: boolean; message?: string }> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/subscription/cancel', {
    method: 'DELETE',
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function UsageBar({ percentage, color }: { percentage: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

function UsageCard({
  icon: Icon,
  label,
  current,
  limit,
  percentage,
  isMonthly,
  isDaily,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  current: number;
  limit: number | null;
  percentage: number;
  isMonthly?: boolean;
  isDaily?: boolean;
}) {
  const getColor = () => {
    if (percentage >= 100) return 'bg-danger-500';
    if (percentage >= 80) return 'bg-amber-500';
    return 'bg-primary-500';
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  return (
    <div className="p-4 rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-gray-100">
          <Icon className="h-4 w-4 text-gray-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">
            {isMonthly && 'Este mes'}
            {isDaily && 'Hoy'}
            {!isMonthly && !isDaily && 'Total'}
          </p>
        </div>
        {percentage >= 100 && (
          <AlertTriangle className="h-4 w-4 text-danger-500" />
        )}
      </div>
      <UsageBar percentage={percentage} color={getColor()} />
      <div className="flex justify-between mt-2">
        <span className="text-sm text-gray-600">{formatValue(current)}</span>
        <span className="text-sm text-gray-400">
          {limit === null ? 'ilimitado' : formatValue(limit)}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIAL STATUS BANNER
// ═══════════════════════════════════════════════════════════════════════════════

interface TrialStatusBannerProps {
  daysRemaining: number;
  trialEndsAt: string | null;
  hasTrialExpired: boolean;
}

function TrialStatusBanner({ daysRemaining, trialEndsAt, hasTrialExpired }: TrialStatusBannerProps) {
  const isUrgent = daysRemaining <= 3 && daysRemaining > 0;
  const isWarning = daysRemaining <= 7 && daysRemaining > 3;

  if (hasTrialExpired) {
    return (
      <div className="p-6 rounded-xl bg-gradient-to-r from-gray-700 to-gray-800 text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-white/10">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">Tu periodo de prueba ha terminado</h2>
            <p className="text-white/80 mt-1">
              Elegí un plan para seguir usando todas las funciones de CampoTech.
            </p>
          </div>
          <Link
            href="#planes"
            className="flex items-center gap-2 px-6 py-3 bg-white text-gray-800 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Elegir plan
            <ArrowUpRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    );
  }

  const bgClass = isUrgent
    ? 'from-red-500 to-rose-600'
    : isWarning
      ? 'from-amber-500 to-orange-500'
      : 'from-primary-600 to-purple-600';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Buenos_Aires',
    });
  };

  return (
    <div className={cn('p-6 rounded-xl bg-gradient-to-r text-white', bgClass)}>
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-full bg-white/10">
          {isUrgent ? (
            <AlertTriangle className="h-6 w-6 text-white" />
          ) : (
            <Sparkles className="h-6 w-6 text-white" />
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold">
            {isUrgent ? '¡Últimos días de prueba!' : 'Periodo de Prueba Activo'}
          </h2>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-white/80" />
              <span className="text-lg font-semibold">
                {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'} restantes
              </span>
            </div>
            {trialEndsAt && (
              <span className="text-white/70 text-sm">
                Termina el {formatDate(trialEndsAt)}
              </span>
            )}
          </div>
          <p className="text-white/80 mt-2 text-sm">
            {isUrgent
              ? 'Actualiza ahora para no perder acceso a las funciones premium.'
              : 'Explora todas las funciones. Elegí tu plan antes de que termine la prueba.'}
          </p>
        </div>
        <Link
          href="#planes"
          className="flex items-center gap-2 px-6 py-3 bg-white text-gray-800 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
        >
          {isUrgent ? 'Actualizar ahora' : 'Elegir plan'}
          <ArrowUpRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CURRENT SUBSCRIPTION DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

interface CurrentSubscriptionProps {
  tier: {
    id: string;
    name: string;
    description: string;
    priceDisplay: string;
  };
  billingPeriod: {
    current: string;
    startDate: string;
    endDate: string;
    daysRemaining: number;
  };
  isTrialing: boolean;
}

function CurrentSubscription({ tier, billingPeriod, isTrialing }: CurrentSubscriptionProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Buenos_Aires',
    });
  };

  const statusBadge = isTrialing ? (
    <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
      En prueba
    </span>
  ) : (
    <span className="px-2 py-1 text-xs font-medium bg-success-100 text-success-700 rounded-full">
      Activo
    </span>
  );

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-100">
            <CreditCard className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-gray-900">Plan actual</h2>
              {statusBadge}
            </div>
            <p className="text-2xl font-bold text-primary-600">{tier.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Próxima facturación</p>
          <p className="text-lg font-semibold text-gray-900">{tier.priceDisplay}</p>
          <p className="text-xs text-gray-400">
            {formatDate(billingPeriod.endDate)} ({billingPeriod.daysRemaining} días)
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <Link
          href="#planes"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <ArrowUpRight className="h-4 w-4" />
          Cambiar plan
        </Link>
        <Link
          href="#cancelar"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <XCircle className="h-4 w-4" />
          Cancelar suscripción
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLAPSIBLE SECTION
// ═══════════════════════════════════════════════════════════════════════════════

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  id?: string;
}

function CollapsibleSection({ title, icon, children, defaultOpen = false, id }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div id={id} className="card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <h2 className="font-medium text-gray-900">{title}</h2>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANCELLATION SECTION (Ley 24.240)
// ═══════════════════════════════════════════════════════════════════════════════

function CancellationSection() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('arrepentimiento');
  const queryClient = useQueryClient();

  const { data: cancellationData, isLoading } = useQuery({
    queryKey: ['cancellation-status'],
    queryFn: fetchCancellationStatus,
  });

  const cancelMutation = useMutation({
    mutationFn: requestCancellation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cancellation-status'] });
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      setShowConfirm(false);
    },
  });

  const undoMutation = useMutation({
    mutationFn: undoCancellation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cancellation-status'] });
      queryClient.invalidateQueries({ queryKey: ['usage'] });
    },
  });

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  const eligibility = cancellationData?.data?.eligibility;
  const currentRequest = cancellationData?.data?.currentRequest;

  // If there's an active cancellation request
  if (currentRequest && currentRequest.status !== 'completed' && currentRequest.status !== 'cancelled') {
    return (
      <div id="cancelar" className="card p-6 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-amber-100">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-amber-900">Cancelación en proceso</h2>
            <p className="text-sm text-amber-700 mt-1">
              Tu solicitud de cancelación está siendo procesada.
              {currentRequest.eligibleForRefund && currentRequest.refundAmount && (
                <> Recibirás un reembolso de ${currentRequest.refundAmount.toFixed(2)} ARS.</>
              )}
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs text-amber-600">
              <span>Estado: {currentRequest.refundStatus === 'completed' ? 'Reembolso completado' : 'Procesando'}</span>
              {currentRequest.effectiveDate && (
                <span>Efectiva: {new Date(currentRequest.effectiveDate).toLocaleDateString('es-AR', { timeZone: 'America/Buenos_Aires' })}</span>
              )}
            </div>
            {currentRequest.status === 'pending' && (
              <button
                onClick={() => undoMutation.mutate()}
                disabled={undoMutation.isPending}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
              >
                <Undo2 className="h-4 w-4" />
                {undoMutation.isPending ? 'Revirtiendo...' : 'Cancelar solicitud'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Can't cancel (FREE tier or already cancelled)
  if (!eligibility?.canCancel) {
    return (
      <div id="cancelar" className="card p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-gray-100">
            <XCircle className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <h2 className="font-medium text-gray-900">Cancelar suscripción</h2>
            <p className="text-sm text-gray-500 mt-1">
              {eligibility?.message || 'No tienes una suscripción activa para cancelar.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show cancellation option
  return (
    <div id="cancelar" className="card p-6 border-danger-200">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-full bg-danger-100">
          <XCircle className="h-5 w-5 text-danger-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Cancelar suscripción</h2>
            <Link
              href="/arrepentimiento"
              className="text-xs text-primary-600 hover:underline flex items-center gap-1"
            >
              <Shield className="h-3 w-3" />
              Ley 24.240
            </Link>
          </div>

          {/* Refund eligibility banner */}
          {eligibility.eligibleForRefund && (
            <div className="mt-3 p-3 rounded-lg bg-success-50 border border-success-200">
              <div className="flex items-center gap-2 text-success-700">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium">
                  Derecho de arrepentimiento activo
                </span>
              </div>
              <p className="text-sm text-success-600 mt-1">
                Tenés <strong>{eligibility.daysUntilRefundExpires} días</strong> para recibir un reembolso completo
                de <strong>${eligibility.refundAmount?.toFixed(2)} ARS</strong> según la Ley 24.240.
              </p>
            </div>
          )}

          {!eligibility.eligibleForRefund && (
            <p className="text-sm text-gray-600 mt-2">
              Tu suscripción se cancelará al final del período de facturación actual.
              Podrás seguir usando el servicio hasta esa fecha.
            </p>
          )}

          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-danger-600 bg-white border border-danger-300 rounded-lg hover:bg-danger-50 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Cancelar suscripción
            </button>
          ) : (
            <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
              <h3 className="font-medium text-gray-900 mb-3">¿Por qué querés cancelar?</h3>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4"
              >
                <option value="arrepentimiento">Derecho de arrepentimiento (Ley 24.240)</option>
                <option value="no_longer_needed">Ya no lo necesito</option>
                <option value="too_expensive">Es muy caro</option>
                <option value="missing_features">Le faltan funcionalidades</option>
                <option value="technical_issues">Problemas técnicos</option>
                <option value="other">Otro motivo</option>
              </select>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => cancelMutation.mutate(selectedReason)}
                  disabled={cancelMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-danger-600 rounded-lg hover:bg-danger-700 transition-colors disabled:opacity-50"
                >
                  {cancelMutation.isPending ? 'Procesando...' : 'Confirmar cancelación'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={cancelMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Volver
                </button>
              </div>

              {cancelMutation.isError && (
                <p className="mt-3 text-sm text-danger-600">
                  Error al procesar la solicitud. Por favor, intentá de nuevo.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function BillingPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['usage'],
    queryFn: fetchUsage,
  });

  const { data: trialData } = useQuery({
    queryKey: ['trial-status'],
    queryFn: fetchTrialStatus,
  });

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: fetchPlans,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !data || !data.tier) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-md bg-danger-50 p-4 text-danger-700">
          No tienes permisos para ver esta pagina o hubo un error.
        </div>
      </div>
    );
  }

  const isTrialing = trialData?.data?.isTrialing ?? false;
  const trialDaysRemaining = trialData?.data?.daysRemaining ?? 0;
  const trialEndsAt = trialData?.data?.trialEndsAt ?? null;
  const hasTrialExpired = trialData?.data?.hasTrialExpired ?? false;

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
          <h1 className="text-2xl font-bold text-gray-900">Plan y Facturación</h1>
          <p className="text-gray-500">Administra tu suscripción, pagos e historial</p>
        </div>
      </div>

      {/* Trial Status Banner */}
      {(isTrialing || hasTrialExpired) && (
        <TrialStatusBanner
          daysRemaining={trialDaysRemaining}
          trialEndsAt={trialEndsAt}
          hasTrialExpired={hasTrialExpired}
        />
      )}

      {/* Upgrade Recommendation */}
      {data.upgradeRecommendation?.recommended && !isTrialing && (
        <div className="p-4 rounded-lg bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-200">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-full bg-primary-100">
              <Sparkles className="h-5 w-5 text-primary-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">
                Te recomendamos {data.upgradeRecommendation.suggestedTierName}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {data.upgradeRecommendation.reason}
              </p>
            </div>
            <Link
              href="#planes"
              className="btn-primary flex items-center gap-2"
            >
              Ver planes
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="space-y-2">
          {data.warnings.map((warning, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg flex items-center gap-3 ${warning.percentage >= 100
                ? 'bg-danger-50 text-danger-700'
                : 'bg-amber-50 text-amber-700'
                }`}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Current Plan */}
      <CurrentSubscription
        tier={data.tier}
        billingPeriod={data.billingPeriod}
        isTrialing={isTrialing}
      />

      {/* Usage Overview */}
      <div className="card p-6">
        <h2 className="font-medium text-gray-900 mb-4">Uso del periodo</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <UsageCard icon={Users} {...data.usage.users} />
          <UsageCard icon={Users} {...data.usage.customers} />
          <UsageCard icon={Calendar} {...data.usage.jobs} />
          <UsageCard icon={FileText} {...data.usage.invoices} />
          <UsageCard icon={Car} {...data.usage.vehicles} />
          <UsageCard icon={Package} {...data.usage.products} />
          <UsageCard icon={HardDrive} {...data.usage.storage} />
          <UsageCard icon={MessageSquare} {...data.usage.whatsapp} />
          {data.usage.api.limit !== null && (
            <UsageCard icon={Code} {...data.usage.api} />
          )}
        </div>
      </div>

      {/* Plan Selection */}
      <div id="planes" className="scroll-mt-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Elegí tu plan</h2>
        <PlanSelector
          currentTier={data.tier.id}
          currentCycle="MONTHLY"
          plans={plansData?.data?.plans || []}
          isLoading={plansLoading}
        />
      </div>

      {/* Payment History */}
      <CollapsibleSection
        id="historial"
        title="Historial de pagos"
        icon={<Receipt className="h-5 w-5 text-gray-500" />}
        defaultOpen={false}
      >
        <PaymentHistory className="border-0 shadow-none" />
      </CollapsibleSection>

      {/* Payment Methods */}
      <CollapsibleSection
        id="metodos"
        title="Métodos de pago aceptados"
        icon={<Wallet className="h-5 w-5 text-gray-500" />}
        defaultOpen={false}
      >
        <PaymentMethods className="border-0 shadow-none rounded-none" />
      </CollapsibleSection>

      {/* FAQ */}
      <div className="card p-6">
        <h2 className="font-medium text-gray-900 mb-4">Preguntas frecuentes</h2>
        <div className="space-y-4">
          <details className="group">
            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
              ¿Puedo cambiar de plan en cualquier momento?
            </summary>
            <p className="mt-2 text-sm text-gray-600 pl-4">
              Sí, podes actualizar o bajar tu plan cuando quieras. Los cambios se aplican inmediatamente
              y el saldo se prorratea.
            </p>
          </details>
          <details className="group">
            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
              ¿Qué pasa si excedo los límites?
            </summary>
            <p className="mt-2 text-sm text-gray-600 pl-4">
              Recibiras una notificación cuando te acerques al límite. Si lo excedes, algunas
              funcionalidades podrían estar limitadas hasta que actualices tu plan o comience el próximo período.
            </p>
          </details>
          <details className="group">
            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
              ¿Puedo cancelar mi suscripción?
            </summary>
            <p className="mt-2 text-sm text-gray-600 pl-4">
              Sí, podes cancelar usando el <Link href="#cancelar" className="text-primary-600 hover:underline">Botón de Arrepentimiento</Link> más
              abajo. Si estás dentro de los primeros 10 días, recibirás un reembolso completo según la Ley 24.240.
            </p>
          </details>
          <details className="group">
            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
              ¿Cuánto ahorro con el pago anual?
            </summary>
            <p className="mt-2 text-sm text-gray-600 pl-4">
              Con el pago anual ahorrás 2 meses gratis (aproximadamente 17% de descuento).
              Podés cambiar entre mensual y anual cuando quieras.
            </p>
          </details>
        </div>
      </div>

      {/* Cancellation Section (Ley 24.240 - Botón de Arrepentimiento) */}
      <CancellationSection />

      {/* Contact */}
      <div className="text-center text-sm text-gray-500 py-4">
        <p>
          ¿Necesitás un plan personalizado?{' '}
          <a href="mailto:ventas@campotech.com" className="text-primary-600 hover:underline">
            Contactanos
          </a>
        </p>
      </div>
    </div>
  );
}

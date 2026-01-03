'use client';

/**
 * Blocked Page
 * ============
 *
 * Combined status page showing ALL issues preventing platform access.
 * Displays subscription status, verification status, and any compliance blocks.
 * Different layouts for soft vs hard blocks.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  XCircle,
  AlertTriangle,
  CreditCard,
  FileCheck,
  Shield,
  ArrowRight,
  Phone,
  Mail,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface BlockReason {
  code: string;
  type: 'subscription' | 'verification' | 'compliance';
  severity: 'warning' | 'soft_block' | 'hard_block';
  message: string;
  actionRequired?: string;
  actionUrl?: string;
}

interface SubscriptionStatus {
  status: string;
  tier: string;
  trialDaysRemaining: number | null;
  isTrialExpired: boolean;
  isPaid: boolean;
  isActive: boolean;
  isCancelled: boolean;
  isPastDue: boolean;
}

interface VerificationStatus {
  status: string;
  tier2Complete: boolean;
  pendingRequirements: string[];
  expiredDocuments: string[];
  hasActiveBlock: boolean;
}

interface AccessStatus {
  canAccessDashboard: boolean;
  canReceiveJobs: boolean;
  blockReasons: BlockReason[];
  subscription: SubscriptionStatus;
  verification: VerificationStatus;
  isHardBlocked: boolean;
  isSoftBlocked: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TYPE_CONFIG = {
  subscription: {
    icon: CreditCard,
    label: 'Suscripción',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  verification: {
    icon: FileCheck,
    label: 'Verificación',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  compliance: {
    icon: Shield,
    label: 'Cumplimiento',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
};

const TIER_NAMES: Record<string, string> = {
  FREE: 'Gratis',
  INICIAL: 'Inicial',
  PROFESIONAL: 'Profesional',
  EMPRESA: 'Empresa',
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function BlockedPage() {
  const router = useRouter();
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch access status
  const fetchStatus = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const response = await fetch('/api/access/status');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener estado');
      }

      setAccessStatus(data);

      // If no longer blocked, redirect to dashboard
      if (data.canAccessDashboard && !data.isHardBlocked) {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('[Blocked] Error fetching status:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Group block reasons by type
  const groupedReasons = accessStatus?.blockReasons.reduce(
    (acc, reason) => {
      if (!acc[reason.type]) acc[reason.type] = [];
      acc[reason.type].push(reason);
      return acc;
    },
    {} as Record<string, BlockReason[]>
  ) || {};

  // Get hard blocks
  const hardBlocks = accessStatus?.blockReasons.filter(
    (r) => r.severity === 'hard_block'
  ) || [];

  // Get soft blocks
  const softBlocks = accessStatus?.blockReasons.filter(
    (r) => r.severity === 'soft_block'
  ) || [];

  const isHardBlocked = hardBlocks.length > 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR STATE
  // ─────────────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            Error de Acceso
          </h1>
          <p className="mt-2 text-gray-600">{error}</p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Iniciar sesión
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NOT BLOCKED STATE
  // ─────────────────────────────────────────────────────────────────────────────

  if (!accessStatus || (accessStatus.canAccessDashboard && !isHardBlocked && softBlocks.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-success-600" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            Acceso Restaurado
          </h1>
          <p className="mt-2 text-gray-600">
            Tu cuenta ya no tiene restricciones. Podés continuar usando la plataforma.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Ir al Panel
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BLOCKED STATE
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div
          className={cn(
            'rounded-2xl overflow-hidden shadow-xl',
            isHardBlocked
              ? 'bg-gradient-to-r from-gray-800 to-gray-900'
              : 'bg-gradient-to-r from-amber-500 to-orange-500'
          )}
        >
          <div className="px-6 py-8 text-center text-white">
            <div
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center mx-auto',
                isHardBlocked ? 'bg-red-500/20' : 'bg-white/20'
              )}
            >
              {isHardBlocked ? (
                <XCircle className="h-8 w-8 text-red-400" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-white" />
              )}
            </div>
            <h1 className="mt-4 text-2xl font-bold">
              {isHardBlocked ? 'Acceso Suspendido' : 'Acceso Restringido'}
            </h1>
            <p className="mt-2 text-white/80 max-w-md mx-auto">
              {isHardBlocked
                ? 'Tu cuenta tiene restricciones que impiden el acceso a la plataforma.'
                : 'Tu cuenta tiene algunas restricciones. Podés seguir usando funciones básicas mientras las resolvés.'}
            </p>
          </div>
        </div>

        {/* Status Sections */}
        <div className="mt-6 space-y-4">
          {/* Subscription Status */}
          <StatusSection
            title="Estado de Suscripción"
            icon={CreditCard}
            status={getSubscriptionStatusLabel(accessStatus.subscription)}
            statusColor={getSubscriptionStatusColor(accessStatus.subscription)}
            reasons={groupedReasons.subscription || []}
            actionUrl="/dashboard/settings/billing"
            actionLabel="Ir a Facturación"
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Plan:</span>
                <span className="ml-2 font-medium">
                  {TIER_NAMES[accessStatus.subscription.tier] || accessStatus.subscription.tier}
                </span>
              </div>
              {accessStatus.subscription.trialDaysRemaining !== null && (
                <div>
                  <span className="text-gray-500">Días restantes:</span>
                  <span className="ml-2 font-medium">
                    {accessStatus.subscription.trialDaysRemaining}
                  </span>
                </div>
              )}
            </div>
          </StatusSection>

          {/* Verification Status */}
          <StatusSection
            title="Estado de Verificación"
            icon={FileCheck}
            status={getVerificationStatusLabel(accessStatus.verification)}
            statusColor={getVerificationStatusColor(accessStatus.verification)}
            reasons={groupedReasons.verification || []}
            actionUrl="/dashboard/settings/verification"
            actionLabel="Ir a Verificación"
          >
            <div className="text-sm">
              {accessStatus.verification.pendingRequirements.length > 0 && (
                <div className="mb-2">
                  <span className="text-gray-500">Requisitos pendientes:</span>
                  <span className="ml-2 font-medium text-amber-600">
                    {accessStatus.verification.pendingRequirements.length}
                  </span>
                </div>
              )}
              {accessStatus.verification.expiredDocuments.length > 0 && (
                <div>
                  <span className="text-gray-500">Documentos vencidos:</span>
                  <span className="ml-2 font-medium text-red-600">
                    {accessStatus.verification.expiredDocuments.length}
                  </span>
                </div>
              )}
              {accessStatus.verification.tier2Complete && accessStatus.verification.expiredDocuments.length === 0 && (
                <div className="flex items-center gap-2 text-success-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Verificación completa</span>
                </div>
              )}
            </div>
          </StatusSection>

          {/* Compliance Blocks */}
          {groupedReasons.compliance && groupedReasons.compliance.length > 0 && (
            <StatusSection
              title="Bloqueos de Cumplimiento"
              icon={Shield}
              status="Activo"
              statusColor="text-red-600"
              reasons={groupedReasons.compliance}
              actionUrl="/dashboard/support/change-request"
              actionLabel="Contactar Soporte"
            />
          )}
        </div>

        {/* Refresh Button */}
        <div className="mt-6 text-center">
          <button
            onClick={() => fetchStatus(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Actualizando...' : 'Verificar estado nuevamente'}
          </button>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-medium text-gray-900">¿Necesitás ayuda?</h3>
          <p className="mt-1 text-sm text-gray-600">
            Si creés que esto es un error o necesitás asistencia, contactanos:
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <a
              href="mailto:soporte@campotech.com.ar"
              className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              <Mail className="h-4 w-4" />
              soporte@campotech.com.ar
            </a>
            <a
              href="https://wa.me/5491112345678"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              <Phone className="h-4 w-4" />
              WhatsApp
            </a>
          </div>
        </div>

        {/* Soft Block Notice */}
        {!isHardBlocked && softBlocks.length > 0 && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Acceso limitado
                </p>
                <p className="mt-1 text-sm text-amber-700">
                  Podés acceder al panel y completar trabajos existentes, pero no podrás recibir
                  nuevos trabajos ni aparecer en el marketplace hasta resolver los problemas
                  indicados arriba.
                </p>
                <Link
                  href="/dashboard"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900"
                >
                  Continuar al Panel
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS SECTION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface StatusSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  status: string;
  statusColor: string;
  reasons: BlockReason[];
  actionUrl?: string;
  actionLabel?: string;
  children?: React.ReactNode;
}

function StatusSection({
  title,
  icon: Icon,
  status,
  statusColor,
  reasons,
  actionUrl,
  actionLabel,
  children,
}: StatusSectionProps) {
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-gray-600" />
          <h2 className="font-medium text-gray-900">{title}</h2>
        </div>
        <span className={cn('text-sm font-medium', statusColor)}>{status}</span>
      </div>

      {/* Content */}
      <div className="p-6">
        {children && <div className="mb-4">{children}</div>}

        {/* Block Reasons */}
        {reasons.length > 0 && (
          <div className="space-y-3">
            {reasons.map((reason, index) => (
              <div
                key={index}
                className={cn(
                  'p-3 rounded-lg border',
                  reason.severity === 'hard_block'
                    ? 'bg-red-50 border-red-200'
                    : reason.severity === 'soft_block'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-gray-50 border-gray-200'
                )}
              >
                <div className="flex items-start gap-2">
                  {reason.severity === 'hard_block' ? (
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  ) : reason.severity === 'soft_block' ? (
                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{reason.message}</p>
                    {reason.actionRequired && (
                      <p className="mt-1 text-xs text-gray-600">{reason.actionRequired}</p>
                    )}
                    {reason.actionUrl && (
                      <Link
                        href={reason.actionUrl}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                      >
                        Resolver
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No issues */}
        {reasons.length === 0 && (
          <div className="flex items-center gap-2 text-success-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Sin problemas</span>
          </div>
        )}

        {/* Action Button */}
        {actionUrl && reasons.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Link
              href={actionUrl}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              {actionLabel || 'Resolver'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getSubscriptionStatusLabel(sub: SubscriptionStatus): string {
  if (sub.isTrialExpired) return 'Prueba Vencida';
  if (sub.status === 'trialing') return 'En Prueba';
  if (sub.isPastDue) return 'Pago Vencido';
  if (sub.isCancelled) return 'Cancelada';
  if (sub.isActive && sub.isPaid) return 'Activa';
  if (sub.status === 'expired') return 'Vencida';
  return sub.status;
}

function getSubscriptionStatusColor(sub: SubscriptionStatus): string {
  if (sub.isTrialExpired || sub.status === 'expired') return 'text-red-600';
  if (sub.isPastDue) return 'text-amber-600';
  if (sub.isCancelled) return 'text-gray-600';
  if (sub.isActive) return 'text-success-600';
  if (sub.status === 'trialing') return 'text-blue-600';
  return 'text-gray-600';
}

function getVerificationStatusLabel(ver: VerificationStatus): string {
  if (ver.status === 'verified' && ver.expiredDocuments.length === 0) return 'Verificado';
  if (ver.status === 'suspended') return 'Suspendido';
  if (ver.expiredDocuments.length > 0) return 'Documentos Vencidos';
  if (ver.status === 'partial') return 'Incompleto';
  if (ver.status === 'pending') return 'Pendiente';
  return ver.status;
}

function getVerificationStatusColor(ver: VerificationStatus): string {
  if (ver.status === 'verified' && ver.expiredDocuments.length === 0) return 'text-success-600';
  if (ver.status === 'suspended') return 'text-red-600';
  if (ver.expiredDocuments.length > 0) return 'text-red-600';
  if (ver.status === 'partial') return 'text-amber-600';
  if (ver.status === 'pending') return 'text-amber-600';
  return 'text-gray-600';
}

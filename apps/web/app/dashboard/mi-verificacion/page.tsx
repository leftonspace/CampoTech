'use client';

/**
 * Employee Verification Portal (Mi Verificación)
 * ===============================================
 *
 * Self-service verification portal for employees (technicians).
 * Only visible to employees, not owners.
 *
 * Features:
 * - Overall verification status display
 * - Alerts for expiring/rejected documents
 * - Verification flow for new employees
 * - Requirements list for partial/complete employees
 * - Optional badges section
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  ArrowRight,
  RefreshCw,
  Briefcase,
  User,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useEmployeeVerification } from '@/hooks/useEmployeeVerification';
import {
  EmployeeRequirementCard,
  EmployeeVerificationFlow,
  EmployeeBadgesSection
} from '@/components/verification';

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BANNER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBanner({
  status,
  canBeAssignedJobs,
  progress }: {
    status: string;
    canBeAssignedJobs: boolean;
    progress: number;
  }) {
  const getStatusConfig = () => {
    if (canBeAssignedJobs) {
      return {
        icon: CheckCircle,
        iconColor: 'text-success-600',
        bgColor: 'bg-success-50 border-success-200',
        title: 'Podés recibir trabajos',
        subtitle: 'Tu verificación está completa y activa'
      };
    }

    switch (status) {
      case 'verified':
        return {
          icon: CheckCircle,
          iconColor: 'text-success-600',
          bgColor: 'bg-success-50 border-success-200',
          title: 'Verificación completa',
          subtitle: 'Tu identidad ha sido verificada'
        };
      case 'in_review':
        return {
          icon: Clock,
          iconColor: 'text-amber-600',
          bgColor: 'bg-amber-50 border-amber-200',
          title: 'Verificación en revisión',
          subtitle: 'Estamos revisando tu información'
        };
      case 'pending':
        return {
          icon: Clock,
          iconColor: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
          title: 'Verificación en proceso',
          subtitle: `${progress}% completado`
        };
      case 'suspended':
        return {
          icon: XCircle,
          iconColor: 'text-danger-600',
          bgColor: 'bg-danger-50 border-danger-200',
          title: 'Verificación suspendida',
          subtitle: 'Hay documentos que necesitan atención'
        };
      default:
        return {
          icon: AlertCircle,
          iconColor: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
          title: 'Completá tu verificación',
          subtitle: 'Verificá tu identidad para poder recibir trabajos'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={cn('border rounded-xl p-4', config.bgColor)}>
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center',
            config.bgColor.replace('border-', 'bg-').replace('-200', '-100')
          )}
        >
          <Icon className={cn('h-6 w-6', config.iconColor)} />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900">{config.title}</h2>
          <p className="text-sm text-gray-600">{config.subtitle}</p>
        </div>
        {canBeAssignedJobs && (
          <div className="flex items-center gap-2 text-success-700 bg-success-100 px-3 py-1.5 rounded-lg">
            <Briefcase className="h-4 w-4" />
            <span className="text-sm font-medium">Activo</span>
          </div>
        )}
      </div>

      {/* Progress bar for incomplete */}
      {status !== 'verified' && progress < 100 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Progreso</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                progress >= 75
                  ? 'bg-success-500'
                  : progress >= 50
                    ? 'bg-primary-500'
                    : 'bg-amber-500'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function VerificationAlerts({
  alerts,
  onAction }: {
    alerts: Array<{ code: string; name: string; status: string; reason: string }>;
    onAction: (code: string) => void;
  }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.code}
          className={cn(
            'flex items-start gap-3 p-4 rounded-lg border',
            alert.status === 'rejected' || alert.status === 'expired'
              ? 'bg-danger-50 border-danger-200'
              : 'bg-amber-50 border-amber-200'
          )}
        >
          <AlertTriangle
            className={cn(
              'h-5 w-5 flex-shrink-0 mt-0.5',
              alert.status === 'rejected' || alert.status === 'expired'
                ? 'text-danger-600'
                : 'text-amber-600'
            )}
          />
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'font-medium text-sm',
                alert.status === 'rejected' || alert.status === 'expired'
                  ? 'text-danger-900'
                  : 'text-amber-900'
              )}
            >
              {alert.name}
            </p>
            <p
              className={cn(
                'text-sm',
                alert.status === 'rejected' || alert.status === 'expired'
                  ? 'text-danger-700'
                  : 'text-amber-700'
              )}
            >
              {alert.reason}
            </p>
          </div>
          <button
            onClick={() => onAction(alert.code)}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              alert.status === 'rejected' || alert.status === 'expired'
                ? 'bg-danger-100 text-danger-700 hover:bg-danger-200'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MiVerificacionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    status,
    isLoading,
    isError,
    error,
    requirements,
    badges,
    requiresAttention,
    progress,
    isSetupComplete,
    isSetupStarted,
    canBeAssignedJobs,
    phoneVerified,
    phoneNumber,
    completedSteps,
    refetch } = useEmployeeVerification();

  const [showVerificationFlow, setShowVerificationFlow] = useState(false);
  const [_selectedRequirement, setSelectedRequirement] = useState<string | null>(null);

  // Check if user is owner - redirect to owner verification
  if (user?.role?.toUpperCase() === 'OWNER') {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <User className="h-8 w-8 text-primary-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Esta página es para empleados
        </h1>
        <p className="text-gray-500 mb-6">
          Como propietario, tu verificación se gestiona desde el Centro de Verificación.
        </p>
        <button
          onClick={() => router.push('/dashboard/verificacion')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          Ir al Centro de Verificación
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-24 bg-gray-200 rounded-xl mb-6" />
          <div className="h-8 bg-gray-200 rounded w-48 mb-4" />
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded-xl" />
            <div className="h-32 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-full bg-danger-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-danger-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Error al cargar</h1>
        <p className="text-gray-500 mb-6">{error}</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      </div>
    );
  }

  // Show verification flow for new employees or when starting over
  if (showVerificationFlow || (!isSetupStarted && !isSetupComplete)) {
    return (
      <div className="max-w-lg mx-auto">
        <EmployeeVerificationFlow
          completedSteps={completedSteps}
          phoneVerified={phoneVerified}
          phoneNumber={phoneNumber}
          onComplete={() => {
            setShowVerificationFlow(false);
            refetch();
          }}
          onCancel={() => setShowVerificationFlow(false)}
        />
      </div>
    );
  }

  // Main verification portal view
  const currentStatus = status?.status || 'not_started';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-100">
            <Shield className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mi Verificación</h1>
            <p className="text-gray-500">Gestioná tu verificación de identidad</p>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      <StatusBanner
        status={currentStatus}
        canBeAssignedJobs={canBeAssignedJobs}
        progress={progress}
      />

      {/* Alerts */}
      {requiresAttention.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Requiere atención ({requiresAttention.length})
          </h3>
          <VerificationAlerts
            alerts={requiresAttention}
            onAction={(code) => setSelectedRequirement(code)}
          />
        </div>
      )}

      {/* Continue Setup Button */}
      {isSetupStarted && !isSetupComplete && progress < 100 && (
        <button
          onClick={() => setShowVerificationFlow(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          Continuar verificación
          <ArrowRight className="h-5 w-5" />
        </button>
      )}

      {/* Requirements Section */}
      {requirements.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Requisitos de verificación
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {requirements
              .filter((r) => r.isRequired)
              .map((requirement) => (
                <EmployeeRequirementCard
                  key={requirement.code}
                  requirement={requirement}
                  onSubmit={(code) => {
                    setSelectedRequirement(code);
                    setShowVerificationFlow(true);
                  }}
                  onUpdate={(code) => {
                    setSelectedRequirement(code);
                    setShowVerificationFlow(true);
                  }}
                />
              ))}
          </div>
        </div>
      )}

      {/* Badges Section */}
      {badges.length > 0 && (
        <EmployeeBadgesSection
          badges={badges}
          onObtain={(code) => {
            // TODO: Implement badge obtaining flow
            console.log('Obtain badge:', code);
          }}
          onRenew={(code) => {
            // TODO: Implement badge renewal flow
            console.log('Renew badge:', code);
          }}
        />
      )}

      {/* Help Text */}
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <p className="text-sm text-gray-600">
          ¿Necesitás ayuda con tu verificación?{' '}
          <a
            href="mailto:soporte@campotech.com.ar"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Contactanos
          </a>
        </p>
      </div>
    </div>
  );
}

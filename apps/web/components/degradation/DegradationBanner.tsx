'use client';

/**
 * Degradation Banner Component
 * ============================
 *
 * Displays system status and degraded services to users.
 * Automatically hides when all systems are operational.
 */

import React, { useState } from 'react';
import { useHealth, useSystemStatus } from '@/lib/degradation/use-health';
import type { SystemHealthStatus, FeatureId } from '@/lib/degradation/types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DegradationBannerProps {
  /** Show even when operational (for testing) */
  alwaysShow?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Allow dismissing the banner */
  dismissable?: boolean;
  /** Show detailed feature list */
  showDetails?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function DegradationBanner({
  alwaysShow = false,
  className = '',
  dismissable = true,
  showDetails = false,
  onDismiss,
}: DegradationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(showDetails);
  const { health, loading, getDegradedFeatures } = useHealth();

  // Don't show if dismissed, loading, or operational (unless alwaysShow)
  if (dismissed) return null;
  if (loading && !health) return null;
  if (!alwaysShow && health?.status === 'operational') return null;

  const status = health?.status ?? 'operational';
  const message = health?.message ?? '';
  const degradedFeatures = getDegradedFeatures();
  const hasIncidents = (health?.activeIncidents.length ?? 0) > 0;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const statusConfig = getStatusConfig(status);

  return (
    <div
      className={`${statusConfig.bgColor} ${statusConfig.borderColor} border-b ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Icon and Message */}
          <div className="flex items-center gap-3 flex-1">
            <StatusIcon status={status} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${statusConfig.textColor}`}>
                {message}
              </p>
              {degradedFeatures.length > 0 && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className={`text-xs ${statusConfig.linkColor} hover:underline mt-1`}
                >
                  Ver detalles ({degradedFeatures.length} afectados)
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {hasIncidents && (
              <a
                href="/status"
                className={`text-xs ${statusConfig.linkColor} hover:underline`}
              >
                Ver estado
              </a>
            )}
            {dismissable && (
              <button
                onClick={handleDismiss}
                className={`${statusConfig.textColor} hover:opacity-70`}
                aria-label="Cerrar"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && degradedFeatures.length > 0 && (
          <div className="mt-3 pt-3 border-t border-opacity-20 border-current">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {degradedFeatures.map((featureId) => {
                const feature = health?.features[featureId];
                if (!feature) return null;

                return (
                  <div
                    key={featureId}
                    className={`text-xs p-2 rounded ${statusConfig.cardBg}`}
                  >
                    <p className={`font-medium ${statusConfig.textColor}`}>
                      {feature.name}
                    </p>
                    <p className={`${statusConfig.mutedText} mt-0.5`}>
                      {feature.alternativeAction || feature.userMessage}
                    </p>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setExpanded(false)}
              className={`text-xs ${statusConfig.linkColor} hover:underline mt-2`}
            >
              Ocultar detalles
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS ICON
// ═══════════════════════════════════════════════════════════════════════════════

function StatusIcon({ status }: { status: SystemHealthStatus }) {
  const iconClass = 'w-5 h-5';

  switch (status) {
    case 'operational':
      return (
        <svg
          className={`${iconClass} text-green-600`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'degraded':
      return (
        <svg
          className={`${iconClass} text-yellow-600`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case 'partial_outage':
      return (
        <svg
          className={`${iconClass} text-orange-600`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'major_outage':
      return (
        <svg
          className={`${iconClass} text-red-600`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getStatusConfig(status: SystemHealthStatus) {
  switch (status) {
    case 'operational':
      return {
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-800',
        mutedText: 'text-green-600',
        linkColor: 'text-green-700',
        cardBg: 'bg-green-100/50',
      };
    case 'degraded':
      return {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        mutedText: 'text-yellow-600',
        linkColor: 'text-yellow-700',
        cardBg: 'bg-yellow-100/50',
      };
    case 'partial_outage':
      return {
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-800',
        mutedText: 'text-orange-600',
        linkColor: 'text-orange-700',
        cardBg: 'bg-orange-100/50',
      };
    case 'major_outage':
      return {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        mutedText: 'text-red-600',
        linkColor: 'text-red-700',
        cardBg: 'bg-red-100/50',
      };
    default:
      return {
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-800',
        mutedText: 'text-gray-600',
        linkColor: 'text-gray-700',
        cardBg: 'bg-gray-100/50',
      };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE UNAVAILABLE NOTICE
// ═══════════════════════════════════════════════════════════════════════════════

export interface FeatureUnavailableProps {
  featureId: FeatureId;
  className?: string;
  children?: React.ReactNode;
}

export function FeatureUnavailableNotice({
  featureId,
  className = '',
  children,
}: FeatureUnavailableProps) {
  const { health, isFeatureAvailable } = useHealth();

  if (isFeatureAvailable(featureId)) {
    return <>{children}</>;
  }

  const feature = health?.features[featureId];

  return (
    <div
      className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-yellow-600 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <h4 className="text-sm font-medium text-yellow-800">
            {feature?.name || 'Función'} temporalmente no disponible
          </h4>
          <p className="text-sm text-yellow-700 mt-1">
            {feature?.userMessage || 'Esta función no está disponible en este momento.'}
          </p>
          {feature?.alternativeAction && (
            <p className="text-sm text-yellow-600 mt-2">
              <strong>Alternativa:</strong> {feature.alternativeAction}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default DegradationBanner;

'use client';

/**
 * Onboarding Checklist Component
 * ===============================
 *
 * Displays a checklist for new users who haven't completed their setup.
 * Shows combined progress for account, verification, and subscription setup.
 *
 * Features:
 * - Progress bar with percentage
 * - Checkable items linking to relevant pages
 * - Shows what features are blocked
 * - Can be dismissed (with "show again" option)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useOnboardingStatus,
  dismissOnboardingChecklist,
  showOnboardingChecklist,
  type OnboardingStep,
} from '@/hooks/useOnboardingStatus';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OnboardingChecklistProps {
  className?: string;
  /** Show in compact mode (sidebar) */
  compact?: boolean;
  /** Called when user completes onboarding */
  onComplete?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKLIST ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface ChecklistItemProps {
  step: OnboardingStep;
  isNext: boolean;
}

function ChecklistItem({ step, isNext }: ChecklistItemProps) {
  const isComplete = step.isComplete;
  const isPending = step.description?.includes('revisión');

  return (
    <Link
      href={step.actionUrl}
      className={cn(
        'flex items-start gap-3 p-2 rounded-lg transition-colors group',
        isComplete
          ? 'text-gray-400'
          : isNext
            ? 'bg-primary-50 text-primary-900'
            : 'hover:bg-gray-50 text-gray-700'
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {isComplete ? (
          <CheckCircle className="h-5 w-5 text-success-500" />
        ) : isPending ? (
          <Clock className="h-5 w-5 text-amber-500" />
        ) : (
          <Circle
            className={cn(
              'h-5 w-5',
              isNext ? 'text-primary-500' : 'text-gray-300'
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium',
            isComplete && 'line-through text-gray-400'
          )}
        >
          {step.label}
          {!step.isRequired && (
            <span className="ml-1 text-xs text-gray-400">(opcional)</span>
          )}
        </p>
        {step.description && !isComplete && (
          <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
        )}
      </div>

      {/* Arrow for next step */}
      {isNext && !isComplete && (
        <ArrowRight className="h-4 w-4 text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS BAR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface ProgressBarProps {
  progress: number;
  label?: string;
}

function ProgressBar({ progress, label }: ProgressBarProps) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900">{label}</span>
          <span className="text-gray-500">{progress}%</span>
        </div>
      )}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            progress === 100
              ? 'bg-success-500'
              : progress >= 70
                ? 'bg-primary-500'
                : progress >= 40
                  ? 'bg-amber-500'
                  : 'bg-gray-400'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPACT CHECKLIST (for sidebar)
// ═══════════════════════════════════════════════════════════════════════════════

function CompactChecklist({ className }: { className?: string }) {
  const { progress, requiredCompleted, requiredTotal, nextActionRequired, isOnboardingComplete, isLoading } =
    useOnboardingStatus();

  if (isLoading || isOnboardingComplete) {
    return null;
  }

  return (
    <div className={cn('p-4 rounded-lg bg-primary-50 border border-primary-100', className)}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary-600" />
        <span className="text-sm font-medium text-primary-900">
          Configuración
        </span>
      </div>

      <ProgressBar progress={progress} />

      <p className="text-xs text-primary-700 mt-2">
        {requiredCompleted}/{requiredTotal} pasos completados
      </p>

      {nextActionRequired && (
        <Link
          href={nextActionRequired.actionUrl}
          className="mt-3 flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          {nextActionRequired.label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function OnboardingChecklist({ className, compact = false, onComplete }: OnboardingChecklistProps) {
  const {
    steps,
    progress,
    isOnboardingComplete,
    isChecklistDismissed,
    nextActionRequired,
    blockedFeatures,
    isLoading,
  } = useOnboardingStatus();

  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // Sync dismissed state with localStorage
  useEffect(() => {
    setIsDismissed(isChecklistDismissed);
  }, [isChecklistDismissed]);

  // Notify when complete
  useEffect(() => {
    if (isOnboardingComplete && onComplete) {
      onComplete();
    }
  }, [isOnboardingComplete, onComplete]);

  // Compact mode
  if (compact) {
    return <CompactChecklist className={className} />;
  }

  // Don't show if loading
  if (isLoading) {
    return null;
  }

  // Don't show if complete (unless user wants to see it again)
  if (isOnboardingComplete) {
    return null;
  }

  // Handle dismiss
  if (isDismissed) {
    return (
      <div className={cn('flex items-center justify-end', className)}>
        <button
          onClick={() => {
            showOnboardingChecklist();
            setIsDismissed(false);
          }}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <Eye className="h-3 w-3" />
          Mostrar checklist de configuración
        </button>
      </div>
    );
  }

  const handleDismiss = () => {
    dismissOnboardingChecklist();
    setIsDismissed(true);
  };

  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-100">
            <Sparkles className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              Completá tu configuración para empezar
            </h3>
            <p className="text-sm text-gray-500">
              {progress}% completado
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dismiss button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Ocultar"
          >
            <EyeOff className="h-4 w-4" />
          </button>

          {/* Expand/collapse */}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-4">
        <ProgressBar progress={progress} />
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <>
          {/* Blocked features warning */}
          {blockedFeatures.length > 0 && (
            <div className="px-4 pb-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900">
                    Funciones bloqueadas:
                  </p>
                  <ul className="text-xs text-amber-700 mt-1 list-disc list-inside">
                    {blockedFeatures.map((feature, i) => (
                      <li key={i}>{feature}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Checklist items */}
          <div className="px-4 pb-4 space-y-1">
            {steps.map((step) => (
              <ChecklistItem
                key={step.id}
                step={step}
                isNext={nextActionRequired?.id === step.id}
              />
            ))}
          </div>

          {/* CTA for next action */}
          {nextActionRequired && (
            <div className="px-4 pb-4">
              <Link
                href={nextActionRequired.actionUrl}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium text-sm hover:bg-primary-700 transition-colors"
              >
                Continuar: {nextActionRequired.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { CompactChecklist as OnboardingChecklistCompact };
export default OnboardingChecklist;

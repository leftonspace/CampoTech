'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  X,
  ArrowUpRight,
  Lock,
  AlertTriangle,
  Zap,
  CheckCircle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface UpgradePromptProps {
  type: 'banner' | 'modal' | 'inline' | 'card';
  feature?: string;
  featureLabel?: string;
  currentTier?: string;
  suggestedTier?: string;
  message?: string;
  onDismiss?: () => void;
  showDismiss?: boolean;
}

interface LimitReachedPromptProps {
  limitType: string;
  limitLabel: string;
  currentUsage: number;
  limit: number;
  suggestedTier: string;
  onDismiss?: () => void;
}

interface FeatureLockedProps {
  feature: string;
  featureLabel: string;
  requiredTier: string;
  description?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER INFO
// ═══════════════════════════════════════════════════════════════════════════════

const TIER_NAMES: Record<string, string> = {
  FREE: 'Gratis',
  BASICO: 'Inicial',
  PROFESIONAL: 'Profesional',
  EMPRESARIAL: 'Empresa',
};

const TIER_PRICES: Record<string, string> = {
  FREE: 'Gratis',
  BASICO: '$25/mes',
  PROFESIONAL: '$55/mes',
  EMPRESARIAL: '$120/mes',
};

// ═══════════════════════════════════════════════════════════════════════════════
// UPGRADE BANNER
// ═══════════════════════════════════════════════════════════════════════════════

export function UpgradeBanner({
  message = 'Desbloquea mas funcionalidades con un plan superior',
  suggestedTier = 'PROFESIONAL',
  onDismiss,
  showDismiss = true,
}: Pick<UpgradePromptProps, 'message' | 'suggestedTier' | 'onDismiss' | 'showDismiss'>) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="bg-gradient-to-r from-primary-600 to-purple-600 text-white px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/settings/billing"
          className="flex items-center gap-1 px-3 py-1.5 bg-white text-primary-600 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          Actualizar a {TIER_NAMES[suggestedTier]}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
        {showDismiss && (
          <button onClick={handleDismiss} className="text-white/80 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPGRADE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export function UpgradeModal({
  isOpen,
  onClose,
  feature,
  featureLabel,
  suggestedTier = 'PROFESIONAL',
}: {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
  featureLabel?: string;
  suggestedTier?: string;
}) {
  if (!isOpen) return null;

  const tierName = TIER_NAMES[suggestedTier];
  const tierPrice = TIER_PRICES[suggestedTier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-purple-600 p-6 text-white text-center">
          <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <Zap className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold">Desbloquea {featureLabel || 'esta funcionalidad'}</h2>
          <p className="text-white/80 text-sm mt-2">
            Actualiza a {tierName} para acceder a todas las funciones
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success-500" />
              <span className="text-gray-700">Acceso a {featureLabel || 'la funcionalidad'}</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success-500" />
              <span className="text-gray-700">Mas capacidad de almacenamiento</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success-500" />
              <span className="text-gray-700">Soporte prioritario</span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center">
            <p className="text-sm text-gray-500">Plan {tierName}</p>
            <p className="text-2xl font-bold text-gray-900">{tierPrice}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Despues
            </button>
            <Link
              href="/dashboard/settings/billing"
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-center font-medium"
            >
              Actualizar ahora
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIMIT REACHED PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

export function LimitReachedPrompt({
  limitType,
  limitLabel,
  currentUsage,
  limit,
  suggestedTier,
  onDismiss,
}: LimitReachedPromptProps) {
  const tierName = TIER_NAMES[suggestedTier];
  const percentage = Math.round((currentUsage / limit) * 100);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-amber-800">
            Has alcanzado el limite de {limitLabel.toLowerCase()}
          </h3>
          <p className="text-sm text-amber-700 mt-1">
            Estas usando {currentUsage} de {limit} ({percentage}%).
            Actualiza a {tierName} para aumentar tu limite.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/dashboard/settings/billing"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700"
            >
              <ArrowUpRight className="h-4 w-4" />
              Actualizar plan
            </Link>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 text-amber-700 text-sm hover:underline"
              >
                Despues
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE LOCKED CARD
// ═══════════════════════════════════════════════════════════════════════════════

export function FeatureLockedCard({
  feature,
  featureLabel,
  requiredTier,
  description,
}: FeatureLockedProps) {
  const tierName = TIER_NAMES[requiredTier];
  const tierPrice = TIER_PRICES[requiredTier];

  return (
    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
      <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
        <Lock className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{featureLabel}</h3>
      <p className="text-sm text-gray-500 mb-4">
        {description || `Esta funcionalidad requiere el plan ${tierName} o superior.`}
      </p>
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm text-gray-400">Disponible desde {tierPrice}</span>
        <Link
          href="/dashboard/settings/billing"
          className="inline-flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          <Sparkles className="h-4 w-4" />
          Desbloquear
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE UPGRADE HINT
// ═══════════════════════════════════════════════════════════════════════════════

export function UpgradeHint({
  featureLabel,
  suggestedTier = 'PROFESIONAL',
}: {
  featureLabel: string;
  suggestedTier?: string;
}) {
  const tierName = TIER_NAMES[suggestedTier];

  return (
    <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
      <Lock className="h-3 w-3" />
      <span>{featureLabel} disponible en {tierName}</span>
      <Link href="/dashboard/settings/billing" className="text-primary-600 hover:underline">
        Actualizar
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE WARNING
// ═══════════════════════════════════════════════════════════════════════════════

export function UsageWarning({
  label,
  percentage,
  onUpgrade,
}: {
  label: string;
  percentage: number;
  onUpgrade?: () => void;
}) {
  if (percentage < 80) return null;

  const isOver = percentage >= 100;

  return (
    <div
      className={`px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
        isOver ? 'bg-danger-50 text-danger-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span>
          {isOver
            ? `Has alcanzado el limite de ${label.toLowerCase()}`
            : `${percentage}% de ${label.toLowerCase()} usado`}
        </span>
      </div>
      <Link
        href="/dashboard/settings/billing"
        className={`text-xs font-medium hover:underline ${
          isOver ? 'text-danger-800' : 'text-amber-800'
        }`}
      >
        Ampliar
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC UPGRADE PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

export function UpgradePrompt({
  type,
  feature,
  featureLabel,
  currentTier,
  suggestedTier = 'PROFESIONAL',
  message,
  onDismiss,
  showDismiss = true,
}: UpgradePromptProps) {
  switch (type) {
    case 'banner':
      return (
        <UpgradeBanner
          message={message}
          suggestedTier={suggestedTier}
          onDismiss={onDismiss}
          showDismiss={showDismiss}
        />
      );
    case 'card':
      return (
        <FeatureLockedCard
          feature={feature || ''}
          featureLabel={featureLabel || 'Esta funcionalidad'}
          requiredTier={suggestedTier}
          description={message}
        />
      );
    case 'inline':
      return (
        <UpgradeHint
          featureLabel={featureLabel || 'Esta funcionalidad'}
          suggestedTier={suggestedTier}
        />
      );
    default:
      return (
        <FeatureLockedCard
          feature={feature || ''}
          featureLabel={featureLabel || 'Esta funcionalidad'}
          requiredTier={suggestedTier}
          description={message}
        />
      );
  }
}

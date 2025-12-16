'use client';

import { useRouter } from 'next/navigation';
import {
  FEATURES,
  getMinimumTierForFeature,
  getUnlockableFeatures,
  type FeatureId,
} from '@/lib/config/feature-flags';
import { type SubscriptionTier, TIER_LIMITS } from '@/lib/config/tier-limits';
import { Lock, ArrowRight, Check, X } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TierUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: FeatureId;
  moduleName?: string;
  currentTier: SubscriptionTier;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER DISPLAY NAMES
// ═══════════════════════════════════════════════════════════════════════════════

const TIER_NAMES: Record<SubscriptionTier, string> = {
  FREE: 'Gratis',
  BASICO: 'Inicial',
  PROFESIONAL: 'Profesional',
  EMPRESARIAL: 'Empresa',
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function TierUpgradeModal({
  isOpen,
  onClose,
  feature,
  moduleName,
  currentTier,
}: TierUpgradeModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  // Get feature details
  const featureConfig = feature ? FEATURES[feature] : null;
  const requiredTier = feature ? getMinimumTierForFeature(feature) : null;
  const displayName = moduleName || featureConfig?.name || 'Esta funcionalidad';

  // Get features that would be unlocked by upgrading
  const unlockableFeatures = requiredTier
    ? getUnlockableFeatures(currentTier, requiredTier).slice(0, 5)
    : [];

  // Get pricing info
  const currentPrice = TIER_LIMITS[currentTier]?.priceUsd || 0;
  const requiredPrice = requiredTier ? TIER_LIMITS[requiredTier]?.priceUsd || 0 : 0;

  const handleUpgrade = () => {
    onClose();
    router.push(`/dashboard/settings/billing?upgrade=${requiredTier}`);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 transform">
        <div className="rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="relative border-b px-6 py-4">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Funcionalidad Premium
                </h2>
                <p className="text-sm text-gray-500">
                  Mejora tu plan para acceder
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {/* Feature info */}
            <div className="mb-4 rounded-lg bg-gray-50 p-4">
              <p className="font-medium text-gray-900">{displayName}</p>
              {featureConfig?.description && (
                <p className="mt-1 text-sm text-gray-600">
                  {featureConfig.description}
                </p>
              )}
              {requiredTier && (
                <p className="mt-2 text-sm font-medium text-primary-600">
                  Disponible desde plan {TIER_NAMES[requiredTier]}
                </p>
              )}
            </div>

            {/* Current vs Required tier */}
            <div className="mb-4 flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Tu plan actual</p>
                <p className="text-lg font-semibold text-gray-700">
                  {TIER_NAMES[currentTier]}
                </p>
                {currentPrice > 0 && (
                  <p className="text-sm text-gray-500">
                    ${currentPrice.toLocaleString('es-AR')}/mes
                  </p>
                )}
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Plan requerido</p>
                <p className="text-lg font-semibold text-primary-600">
                  {requiredTier ? TIER_NAMES[requiredTier] : 'Premium'}
                </p>
                {requiredPrice > 0 && (
                  <p className="text-sm text-primary-600">
                    ${requiredPrice.toLocaleString('es-AR')}/mes
                  </p>
                )}
              </div>
            </div>

            {/* Additional features unlocked */}
            {unlockableFeatures.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Tambien desbloqueas:
                </p>
                <ul className="space-y-1">
                  {unlockableFeatures.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center gap-2 text-sm text-gray-600"
                    >
                      <Check className="h-4 w-4 text-green-500" />
                      {f.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t px-6 py-4">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Ahora no
            </button>
            <button
              onClick={handleUpgrade}
              className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Mejorar Plan
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default TierUpgradeModal;

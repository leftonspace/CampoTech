'use client';

/**
 * useOnboardingStatus Hook
 * ========================
 *
 * Hook to track user onboarding progress combining subscription and verification status.
 * Used by OnboardingChecklist and other components to show setup progress.
 *
 * Returns:
 * - isOnboardingComplete: Whether all required steps are done
 * - completedSteps: List of completed step IDs
 * - pendingSteps: List of pending step IDs with details
 * - nextActionRequired: The most important next step to complete
 * - progress: Percentage of completion (0-100)
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccessStatus } from './useAccessStatus';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OnboardingStep {
  id: string;
  label: string;
  description?: string;
  isComplete: boolean;
  isRequired: boolean;
  actionUrl: string;
  priority: number; // Lower = higher priority
  category: 'account' | 'verification' | 'subscription' | 'optional';
  blockingMessage?: string; // If incomplete, what does it block?
}

export interface OnboardingStatus {
  /** Whether all required onboarding steps are complete */
  isOnboardingComplete: boolean;
  /** Whether the user has dismissed the checklist */
  isChecklistDismissed: boolean;
  /** All onboarding steps with their status */
  steps: OnboardingStep[];
  /** IDs of completed steps */
  completedSteps: string[];
  /** IDs of pending steps */
  pendingSteps: string[];
  /** The next required action */
  nextActionRequired: OnboardingStep | null;
  /** Percentage of completion (0-100) */
  progress: number;
  /** Number of required steps completed */
  requiredCompleted: number;
  /** Total number of required steps */
  requiredTotal: number;
  /** What features are blocked */
  blockedFeatures: string[];
  /** Trial end date if applicable */
  trialEndsAt: string | null;
  /** Loading state */
  isLoading: boolean;
}

interface VerificationStatusResponse {
  success: boolean;
  type: 'organization';
  status: string;
  tier2: {
    total: number;
    completed: number;
    pending: number;
    inReview: number;
    rejected: number;
  };
  requirements: Array<{
    code: string;
    name: string;
    status: string;
    isRequired: boolean;
  }>;
}

interface TrialStatusResponse {
  success: boolean;
  data: {
    isTrialing: boolean;
    daysRemaining: number;
    trialEndsAt: string | null;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchVerificationStatus(): Promise<VerificationStatusResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/verification/status', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  if (!res.ok) throw new Error('Failed to fetch verification status');
  return res.json();
}

async function fetchTrialStatus(): Promise<TrialStatusResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/subscription/trial-status', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  if (!res.ok) throw new Error('Failed to fetch trial status');
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CHECKLIST_DISMISSED_KEY = 'onboarding-checklist-dismissed';

// Requirement codes that are part of onboarding
const ONBOARDING_REQUIREMENTS = [
  { code: 'CUIT', label: 'Verificar CUIT', priority: 3 },
  { code: 'DNI_FRENTE', label: 'Subir DNI (frente)', priority: 4 },
  { code: 'DNI_DORSO', label: 'Subir DNI (dorso)', priority: 5 },
  { code: 'SELFIE_DNI', label: 'Selfie con DNI', priority: 6 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useOnboardingStatus(): OnboardingStatus {
  const { accessStatus, isLoading: accessLoading } = useAccessStatus();

  const { data: verificationData, isLoading: verificationLoading } = useQuery({
    queryKey: ['verification-status-onboarding'],
    queryFn: fetchVerificationStatus,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const { data: trialData, isLoading: trialLoading } = useQuery({
    queryKey: ['trial-status-onboarding'],
    queryFn: fetchTrialStatus,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const isLoading = accessLoading || verificationLoading || trialLoading;

  const status = useMemo<OnboardingStatus>(() => {
    // Check if checklist was dismissed
    let isChecklistDismissed = false;
    try {
      isChecklistDismissed = localStorage.getItem(CHECKLIST_DISMISSED_KEY) === 'true';
    } catch {
      // Ignore storage errors
    }

    // Build steps list
    const steps: OnboardingStep[] = [];

    // Step 1: Create account (always complete if they're here)
    steps.push({
      id: 'create_account',
      label: 'Crear cuenta',
      isComplete: true,
      isRequired: true,
      actionUrl: '/register',
      priority: 1,
      category: 'account',
    });

    // Step 2: Verify email (from access status)
    const emailVerified = true; // Assume verified if they can access dashboard
    steps.push({
      id: 'verify_email',
      label: 'Verificar email',
      isComplete: emailVerified,
      isRequired: true,
      actionUrl: '/verify-email',
      priority: 2,
      category: 'account',
    });

    // Steps 3-6: Verification requirements
    if (verificationData?.requirements) {
      for (const reqDef of ONBOARDING_REQUIREMENTS) {
        const req = verificationData.requirements.find((r) => r.code === reqDef.code);
        const isComplete = req?.status === 'approved';
        const isPending = req?.status === 'pending' || req?.status === 'in_review';

        steps.push({
          id: `verification_${reqDef.code.toLowerCase()}`,
          label: reqDef.label,
          description: isPending ? 'En revisión' : undefined,
          isComplete,
          isRequired: req?.isRequired ?? true,
          actionUrl: '/dashboard/verificacion',
          priority: reqDef.priority,
          category: 'verification',
          blockingMessage: 'No podrás recibir trabajos del marketplace',
        });
      }
    } else {
      // If verification data not loaded, add placeholder steps
      for (const reqDef of ONBOARDING_REQUIREMENTS) {
        steps.push({
          id: `verification_${reqDef.code.toLowerCase()}`,
          label: reqDef.label,
          isComplete: false,
          isRequired: true,
          actionUrl: '/dashboard/verificacion',
          priority: reqDef.priority,
          category: 'verification',
          blockingMessage: 'No podrás recibir trabajos del marketplace',
        });
      }
    }

    // Step 7: First job created (optional)
    steps.push({
      id: 'first_job',
      label: 'Primer trabajo creado',
      description: 'Opcional',
      isComplete: false, // Would need to fetch this from jobs API
      isRequired: false,
      actionUrl: '/dashboard/jobs/new',
      priority: 10,
      category: 'optional',
    });

    // Step 8: Choose plan before trial ends
    const isTrialing = trialData?.data?.isTrialing ?? false;
    const trialEndsAt = trialData?.data?.trialEndsAt ?? null;
    const subscription = accessStatus?.subscription;
    const hasPaidPlan = subscription?.isPaid ?? false;

    if (isTrialing || !hasPaidPlan) {
      const trialEndDate = trialEndsAt
        ? new Date(trialEndsAt).toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'long',
          })
        : 'la fecha límite';

      steps.push({
        id: 'choose_plan',
        label: `Elegir plan antes del ${trialEndDate}`,
        isComplete: hasPaidPlan,
        isRequired: true,
        actionUrl: '/dashboard/settings/billing',
        priority: 8,
        category: 'subscription',
        blockingMessage: 'Tu acceso será limitado cuando termine la prueba',
      });
    }

    // Sort steps by priority
    steps.sort((a, b) => a.priority - b.priority);

    // Calculate completion
    const requiredSteps = steps.filter((s) => s.isRequired);
    const completedRequired = requiredSteps.filter((s) => s.isComplete);
    const completedSteps = steps.filter((s) => s.isComplete).map((s) => s.id);
    const pendingSteps = steps.filter((s) => !s.isComplete).map((s) => s.id);

    const progress = requiredSteps.length > 0
      ? Math.round((completedRequired.length / requiredSteps.length) * 100)
      : 100;

    // Find next action (first incomplete required step)
    const nextActionRequired = steps.find((s) => s.isRequired && !s.isComplete) || null;

    // Determine blocked features
    const blockedFeatures: string[] = [];
    const verificationIncomplete = steps.some(
      (s) => s.category === 'verification' && s.isRequired && !s.isComplete
    );
    if (verificationIncomplete) {
      blockedFeatures.push('Recibir trabajos del marketplace');
    }
    if (!hasPaidPlan && !isTrialing) {
      blockedFeatures.push('Acceso completo a la plataforma');
    }

    return {
      isOnboardingComplete: completedRequired.length === requiredSteps.length,
      isChecklistDismissed,
      steps,
      completedSteps,
      pendingSteps,
      nextActionRequired,
      progress,
      requiredCompleted: completedRequired.length,
      requiredTotal: requiredSteps.length,
      blockedFeatures,
      trialEndsAt,
      isLoading,
    };
  }, [accessStatus, verificationData, trialData, isLoading]);

  return status;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Dismiss the onboarding checklist
 */
export function dismissOnboardingChecklist(): void {
  try {
    localStorage.setItem(CHECKLIST_DISMISSED_KEY, 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Show the onboarding checklist again
 */
export function showOnboardingChecklist(): void {
  try {
    localStorage.removeItem(CHECKLIST_DISMISSED_KEY);
  } catch {
    // Ignore storage errors
  }
}

export default useOnboardingStatus;

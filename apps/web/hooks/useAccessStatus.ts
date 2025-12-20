'use client';

/**
 * useAccessStatus Hook
 * ====================
 *
 * React hook for accessing the current organization's access status.
 * Fetches from /api/access/status and caches the result.
 *
 * Usage:
 * ```typescript
 * function MyComponent() {
 *   const { accessStatus, isLoading, refetch } = useAccessStatus();
 *
 *   if (isLoading) return <Loading />;
 *
 *   if (!accessStatus.canReceiveJobs) {
 *     return <VerificationRequired />;
 *   }
 *
 *   return <JobsList />;
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BlockReason {
  code: string;
  type: 'subscription' | 'verification' | 'compliance';
  severity: 'warning' | 'soft_block' | 'hard_block';
  message: string;
  actionRequired?: string;
  actionUrl?: string;
}

export interface ExpiringDoc {
  requirementCode: string;
  requirementName: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

export interface SubscriptionInfo {
  status: string;
  tier: string;
  trialDaysRemaining: number | null;
  isTrialExpired: boolean;
  isPaid: boolean;
  isActive: boolean;
}

export interface VerificationInfo {
  status: string;
  tier2Complete: boolean;
  pendingRequirements: string[];
  expiredDocuments: string[];
  expiringDocuments: ExpiringDoc[];
  hasActiveBlock: boolean;
}

export interface UserInfo {
  canBeAssignedJobs: boolean;
  isVerified: boolean;
  status: string;
}

export interface AccessStatusData {
  // Overall access
  canAccessDashboard: boolean;
  canReceiveJobs: boolean;
  canAssignEmployees: boolean;
  isMarketplaceVisible: boolean;

  // Quick flags
  requiresAction: boolean;
  hasWarnings: boolean;
  isSoftBlocked: boolean;
  isHardBlocked: boolean;

  // Block reasons
  blockReasons: BlockReason[];

  // Subscription info
  subscription: SubscriptionInfo;

  // Verification info
  verification: VerificationInfo;

  // User-specific info (for employees)
  user?: UserInfo;
}

export interface UseAccessStatusResult {
  /** The current access status, or null if not loaded */
  accessStatus: AccessStatusData | null;
  /** Whether the access status is currently loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refetch the access status */
  refetch: () => void;
  /** Whether there are any blocking issues */
  hasBlockingIssues: boolean;
  /** Whether there are any warnings */
  hasWarnings: boolean;
  /** Get the most severe block reason */
  primaryBlockReason: BlockReason | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchAccessStatus(): Promise<AccessStatusData> {
  const response = await fetch('/api/access/status');
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Error al obtener estado de acceso');
  }

  return result.data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to get and monitor access status
 */
export function useAccessStatus(options?: {
  /** Whether to enable automatic fetching (default: true) */
  enabled?: boolean;
  /** Refetch interval in milliseconds (default: 5 minutes) */
  refetchInterval?: number;
}): UseAccessStatusResult {
  const {
    enabled = true,
    refetchInterval = 5 * 60 * 1000, // 5 minutes
  } = options || {};

  const queryClient = useQueryClient();

  const {
    data: accessStatus,
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: ['accessStatus'],
    queryFn: fetchAccessStatus,
    enabled,
    staleTime: 60 * 1000, // Consider stale after 1 minute
    refetchInterval,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const refetch = useCallback(() => {
    queryRefetch();
  }, [queryRefetch]);

  // Compute derived values
  const hasBlockingIssues = accessStatus
    ? accessStatus.isSoftBlocked || accessStatus.isHardBlocked
    : false;

  const hasWarnings = accessStatus?.hasWarnings ?? false;

  // Get the most severe block reason
  const primaryBlockReason = accessStatus?.blockReasons?.reduce<BlockReason | null>(
    (primary, current) => {
      if (!primary) return current;

      const severityOrder = { hard_block: 3, soft_block: 2, warning: 1 };
      const currentSeverity = severityOrder[current.severity] || 0;
      const primarySeverity = severityOrder[primary.severity] || 0;

      return currentSeverity > primarySeverity ? current : primary;
    },
    null
  ) ?? null;

  return {
    accessStatus: accessStatus ?? null,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    refetch,
    hasBlockingIssues,
    hasWarnings,
    primaryBlockReason,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to check if a specific feature is accessible
 */
export function useFeatureAccess(feature: 'jobs' | 'employees' | 'marketplace'): {
  isAccessible: boolean;
  isLoading: boolean;
  blockReason: BlockReason | null;
} {
  const { accessStatus, isLoading } = useAccessStatus();

  if (isLoading || !accessStatus) {
    return { isAccessible: false, isLoading: true, blockReason: null };
  }

  let isAccessible = false;
  let relevantBlock: BlockReason | null = null;

  switch (feature) {
    case 'jobs':
      isAccessible = accessStatus.canReceiveJobs;
      if (!isAccessible) {
        relevantBlock = accessStatus.blockReasons.find(
          (r) =>
            r.type === 'verification' ||
            r.code === 'trial_expired' ||
            r.code === 'payment_past_due'
        ) ?? null;
      }
      break;
    case 'employees':
      isAccessible = accessStatus.canAssignEmployees;
      if (!isAccessible) {
        relevantBlock = accessStatus.blockReasons.find(
          (r) => r.type === 'verification' || r.severity !== 'warning'
        ) ?? null;
      }
      break;
    case 'marketplace':
      isAccessible = accessStatus.isMarketplaceVisible;
      if (!isAccessible) {
        relevantBlock = accessStatus.blockReasons.find(
          (r) => r.severity !== 'warning'
        ) ?? null;
      }
      break;
  }

  return { isAccessible, isLoading: false, blockReason: relevantBlock };
}

/**
 * Hook to get subscription-specific information
 */
export function useSubscriptionStatus(): {
  subscription: SubscriptionInfo | null;
  isLoading: boolean;
  isTrialExpiring: boolean;
  trialDaysRemaining: number | null;
  isPaid: boolean;
} {
  const { accessStatus, isLoading } = useAccessStatus();

  if (isLoading || !accessStatus) {
    return {
      subscription: null,
      isLoading: true,
      isTrialExpiring: false,
      trialDaysRemaining: null,
      isPaid: false,
    };
  }

  const { subscription } = accessStatus;

  return {
    subscription,
    isLoading: false,
    isTrialExpiring:
      subscription.trialDaysRemaining !== null &&
      subscription.trialDaysRemaining <= 7 &&
      subscription.trialDaysRemaining > 0,
    trialDaysRemaining: subscription.trialDaysRemaining,
    isPaid: subscription.isPaid,
  };
}

/**
 * Hook to get verification-specific information
 */
export function useVerificationStatus(): {
  verification: VerificationInfo | null;
  isLoading: boolean;
  isComplete: boolean;
  hasExpiredDocs: boolean;
  hasExpiringDocs: boolean;
  pendingCount: number;
} {
  const { accessStatus, isLoading } = useAccessStatus();

  if (isLoading || !accessStatus) {
    return {
      verification: null,
      isLoading: true,
      isComplete: false,
      hasExpiredDocs: false,
      hasExpiringDocs: false,
      pendingCount: 0,
    };
  }

  const { verification } = accessStatus;

  return {
    verification,
    isLoading: false,
    isComplete: verification.tier2Complete,
    hasExpiredDocs: verification.expiredDocuments.length > 0,
    hasExpiringDocs: verification.expiringDocuments.length > 0,
    pendingCount: verification.pendingRequirements.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default useAccessStatus;

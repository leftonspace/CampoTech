'use client';

/**
 * Employee Verification Hook
 * ==========================
 *
 * Custom hook for fetching and managing employee verification status.
 * Provides data for the mi-verificacion page.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmployeeRequirement {
  code: string;
  name: string;
  description: string;
  tier: number;
  isRequired: boolean;
  appliesTo: string;
  status: 'not_started' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  submittedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
  canUpload: boolean;
  canUpdate: boolean;
  rejectionReason: string | null;
  submittedValue?: string;
}

export interface EmployeeBadge {
  code: string;
  name: string;
  description: string;
  benefit: string;
  icon: string | null;
  isEarned: boolean;
  earnedAt?: string;
  expiresAt?: string | null;
  isValid?: boolean;
  isExpiringSoon?: boolean;
  daysUntilExpiry?: number | null;
}

export interface EmployeeVerificationStatus {
  success: boolean;
  userId: string;
  status: 'not_started' | 'pending' | 'in_review' | 'verified' | 'suspended';
  canBeAssignedJobs: boolean;
  identityVerified: boolean;
  verificationCompletedAt: string | null;
  tier3: {
    total: number;
    completed: number;
    pending: number;
    inReview: number;
    rejected: number;
  };
  requirements: EmployeeRequirement[];
  badges: EmployeeBadge[];
  requiresAttention: Array<{
    code: string;
    name: string;
    status: string;
    reason: string;
  }>;
  phoneVerified: boolean;
  phoneNumber?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchEmployeeStatus(): Promise<EmployeeVerificationStatus> {
  const response = await fetch('/api/verification/employee/status');
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Error al obtener estado de verificación');
  }

  return data;
}

async function submitVerification(params: {
  requirementCode: string;
  value?: string;
}): Promise<{ submissionId: string; status: string }> {
  const response = await fetch('/api/verification/employee/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Error al enviar verificación');
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useEmployeeVerification() {
  const queryClient = useQueryClient();

  // Query for verification status
  const {
    data: status,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['employee-verification-status'],
    queryFn: fetchEmployeeStatus,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Mutation for submitting verification
  const submitMutation = useMutation({
    mutationFn: submitVerification,
    onSuccess: () => {
      // Invalidate and refetch status
      queryClient.invalidateQueries({ queryKey: ['employee-verification-status'] });
    },
  });

  // Derived data
  const requirements = status?.requirements || [];
  const badges = status?.badges || [];
  const requiresAttention = status?.requiresAttention || [];

  // Calculate progress
  const requiredRequirements = requirements.filter((r) => r.isRequired);
  const completedRequired = requiredRequirements.filter(
    (r) => r.status === 'approved'
  ).length;
  const totalRequired = requiredRequirements.length;
  const progress = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;

  // Get completed step codes
  const completedSteps = requirements
    .filter((r) => r.status === 'approved' || r.status === 'in_review' || r.status === 'pending')
    .map((r) => r.code);

  // Determine if setup is complete
  const isSetupComplete = status?.status === 'verified';
  const isSetupStarted = requirements.some((r) => r.status !== 'not_started');

  // Check what step they should be on
  const getNextStep = (): string | null => {
    const cuilReq = requirements.find((r) => r.code === 'employee_cuil');
    if (!cuilReq || cuilReq.status === 'not_started') return 'cuil';

    const dniReq = requirements.find((r) => r.code === 'dni_front');
    if (!dniReq || dniReq.status === 'not_started') return 'dni';

    const selfieReq = requirements.find((r) => r.code === 'identity_selfie');
    if (!selfieReq || selfieReq.status === 'not_started') return 'selfie';

    if (!status?.phoneVerified) return 'phone';

    return null;
  };

  return {
    // Status
    status,
    isLoading,
    isError,
    error: error instanceof Error ? error.message : 'Error desconocido',
    refetch,

    // Requirements & badges
    requirements,
    badges,
    requiresAttention,

    // Progress
    progress,
    completedRequired,
    totalRequired,
    completedSteps,

    // State
    isSetupComplete,
    isSetupStarted,
    nextStep: getNextStep(),
    canBeAssignedJobs: status?.canBeAssignedJobs ?? false,
    identityVerified: status?.identityVerified ?? false,
    phoneVerified: status?.phoneVerified ?? false,
    phoneNumber: status?.phoneNumber,

    // Actions
    submit: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.error instanceof Error ? submitMutation.error.message : null,
  };
}

export default useEmployeeVerification;

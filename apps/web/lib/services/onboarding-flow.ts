/**
 * CampoTech Onboarding Flow Service
 * ==================================
 *
 * Manages the complete new user onboarding experience:
 * Signup → Auto-create trial → Verification → Can receive jobs
 *
 * Flow Steps:
 * 1. User signs up (phone/OTP)
 * 2. Organization is created
 * 3. 14-day trial is automatically started
 * 4. Onboarding checklist shown
 * 5. User guided through verification (CUIT first, then DNI, selfie)
 * 6. Trial countdown visible throughout
 * 7. Upgrade CTA becomes prominent as trial ends
 *
 * Business Rules:
 * - All orgs start with INICIAL tier during trial
 * - Verification is encouraged but not required during trial
 * - After trial expires, must upgrade to continue receiving jobs
 * - Verification must be complete to receive first job
 */

import { prisma } from '@/lib/prisma';
import { trialManager, TRIAL_DAYS, TRIAL_TIER } from './trial-manager';
import { verificationManager } from './verification-manager';
import { blockManager } from './block-manager';
import { funnelTracker, FunnelEvent } from './funnel-tracker';
import type { SubscriptionTier } from '@/lib/types/subscription';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending' | 'blocked';
  actionUrl?: string;
  actionLabel?: string;
  isRequired: boolean;
  order: number;
  metadata?: Record<string, unknown>;
}

export interface OnboardingStatus {
  isComplete: boolean;
  currentStep: string | null;
  progress: number; // 0-100
  steps: OnboardingStep[];
  canReceiveJobs: boolean;
  blockedReasons: string[];
  trial: {
    isActive: boolean;
    daysRemaining: number;
    endsAt: Date | null;
    isExpiringSoon: boolean;
    isExpired: boolean;
  };
  verification: {
    status: 'unverified' | 'pending' | 'partial' | 'in_review' | 'verified' | 'rejected' | 'suspended';
    tier2Complete: boolean;
    pendingCount: number;
  };
  nextAction: {
    step: string;
    title: string;
    description: string;
    url: string;
    priority: 'high' | 'medium' | 'low';
  } | null;
}

export interface CreateOrganizationResult {
  success: boolean;
  organizationId?: string;
  userId?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ONBOARDING_STEPS = {
  ACCOUNT_CREATED: 'account_created',
  CUIT_VERIFIED: 'cuit_verified',
  DNI_UPLOADED: 'dni_uploaded',
  SELFIE_UPLOADED: 'selfie_uploaded',
  PHONE_VERIFIED: 'phone_verified',
  VERIFICATION_COMPLETE: 'verification_complete',
  FIRST_JOB: 'first_job',
  PLAN_SELECTED: 'plan_selected',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING FLOW SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class OnboardingFlowService {
  /**
   * Initialize a new organization with trial subscription
   * Called after successful signup
   */
  async initializeOrganization(
    organizationId: string,
    ownerId: string,
    metadata?: {
      cuit?: string;
      businessName?: string;
      phone?: string;
      email?: string;
      referralSource?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[OnboardingFlow] Initializing org ${organizationId} for user ${ownerId}`);

      // 1. Create trial subscription
      const trialResult = await trialManager.createTrial(organizationId);
      if (!trialResult.success) {
        return { success: false, error: trialResult.error || 'Failed to create trial' };
      }

      // 2. Update organization with initial settings
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          onboardingStartedAt: new Date(),
          onboardingStep: ONBOARDING_STEPS.ACCOUNT_CREATED,
        },
      });

      // 3. Track signup in funnel
      await funnelTracker.trackEvent({
        event: 'signup_completed',
        organizationId,
        userId: ownerId,
        metadata: {
          ...metadata,
          trialDays: TRIAL_DAYS,
          tier: TRIAL_TIER,
        },
      });

      // 4. If CUIT was provided during signup, auto-submit for verification
      if (metadata?.cuit) {
        try {
          await verificationManager.submitVerification({
            organizationId,
            requirementCode: 'owner_cuit',
            submittedValue: metadata.cuit,
            userId: ownerId,
          });

          await this.updateOnboardingStep(organizationId, ONBOARDING_STEPS.CUIT_VERIFIED);
        } catch (error) {
          console.error('[OnboardingFlow] Error submitting CUIT:', error);
          // Don't fail onboarding if CUIT submission fails
        }
      }

      console.log(`[OnboardingFlow] Organization ${organizationId} initialized successfully`);

      return { success: true };
    } catch (error) {
      console.error('[OnboardingFlow] Error initializing organization:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get complete onboarding status for an organization
   */
  async getOnboardingStatus(organizationId: string): Promise<OnboardingStatus> {
    // Get organization with all relevant data
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        trialEndsAt: true,
        verificationStatus: true,
        canReceiveJobs: true,
        onboardingStep: true,
        onboardingCompletedAt: true,
        phoneVerifiedAt: true,
        owner: {
          select: {
            id: true,
            phoneVerified: true,
            identityVerified: true,
          },
        },
      },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Get trial status
    const trialStatus = await trialManager.getTrialStatus(organizationId);

    // Get verification status
    const verificationSummary = await verificationManager.getOrgVerificationSummary(organizationId);

    // Get verification requirements status
    const requirements = await verificationManager.getRequirementsForOrg(organizationId);

    // Get block reasons
    const blockSummary = await blockManager.getBlockSummary(organizationId);

    // Build onboarding steps
    const steps = await this.buildOnboardingSteps(org, requirements, verificationSummary);

    // Calculate progress
    const completedSteps = steps.filter((s) => s.status === 'completed').length;
    const totalSteps = steps.filter((s) => s.isRequired).length;
    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    // Determine current step
    const currentStep = steps.find((s) => s.status === 'in_progress' || s.status === 'pending');

    // Determine next action
    const nextAction = this.determineNextAction(steps, trialStatus, verificationSummary);

    // Check if onboarding is complete
    const isComplete =
      verificationSummary.status === 'verified' &&
      (org.subscriptionStatus === 'active' || trialStatus.isActive);

    return {
      isComplete,
      currentStep: currentStep?.id || null,
      progress,
      steps,
      canReceiveJobs: org.canReceiveJobs,
      blockedReasons: blockSummary.reasons,
      trial: {
        isActive: trialStatus.isActive,
        daysRemaining: trialStatus.daysRemaining,
        endsAt: trialStatus.trialEndsAt,
        isExpiringSoon: trialStatus.isExpiringSoon,
        isExpired: trialStatus.isExpired,
      },
      verification: {
        status: verificationSummary.status,
        tier2Complete: verificationSummary.tier2.completed === verificationSummary.tier2.total,
        pendingCount: verificationSummary.tier2.pending + verificationSummary.tier2.inReview,
      },
      nextAction,
    };
  }

  /**
   * Build the list of onboarding steps with their current status
   */
  private async buildOnboardingSteps(
    org: {
      id: string;
      ownerId: string | null;
      phoneVerifiedAt: Date | null;
      subscriptionStatus: string;
      subscriptionTier: SubscriptionTier;
      owner: { phoneVerified: boolean; identityVerified: boolean } | null;
    },
    requirements: Awaited<ReturnType<typeof verificationManager.getRequirementsForOrg>>,
    verification: Awaited<ReturnType<typeof verificationManager.getOrgVerificationSummary>>
  ): Promise<OnboardingStep[]> {
    const steps: OnboardingStep[] = [];

    // Step 1: Account Created (always complete if we're here)
    steps.push({
      id: ONBOARDING_STEPS.ACCOUNT_CREATED,
      title: 'Cuenta creada',
      description: 'Tu cuenta y organización fueron creadas',
      status: 'completed',
      isRequired: true,
      order: 1,
    });

    // Step 2: CUIT Verification
    const cuitReq = requirements.find((r) => r.requirement.code === 'owner_cuit');
    steps.push({
      id: ONBOARDING_STEPS.CUIT_VERIFIED,
      title: 'Verificar CUIT',
      description: 'Validamos tu CUIT contra AFIP',
      status: cuitReq?.status === 'approved' ? 'completed' :
              cuitReq?.status === 'in_review' ? 'in_progress' :
              cuitReq?.status === 'rejected' ? 'blocked' : 'pending',
      actionUrl: '/dashboard/verificacion/cuit',
      actionLabel: cuitReq?.status === 'rejected' ? 'Corregir' : 'Verificar',
      isRequired: true,
      order: 2,
      metadata: cuitReq ? { submissionId: cuitReq.submission?.id } : undefined,
    });

    // Step 3: DNI Upload
    const dniReq = requirements.find((r) => r.requirement.code === 'owner_dni');
    steps.push({
      id: ONBOARDING_STEPS.DNI_UPLOADED,
      title: 'Subir DNI',
      description: 'Foto del frente de tu documento',
      status: dniReq?.status === 'approved' ? 'completed' :
              dniReq?.status === 'in_review' ? 'in_progress' :
              dniReq?.status === 'rejected' ? 'blocked' : 'pending',
      actionUrl: '/dashboard/verificacion/dni',
      actionLabel: dniReq?.status === 'rejected' ? 'Corregir' : 'Subir',
      isRequired: true,
      order: 3,
    });

    // Step 4: Selfie Upload
    const selfieReq = requirements.find((r) => r.requirement.code === 'owner_selfie');
    steps.push({
      id: ONBOARDING_STEPS.SELFIE_UPLOADED,
      title: 'Sacate una selfie',
      description: 'Con tu DNI en la mano',
      status: selfieReq?.status === 'approved' ? 'completed' :
              selfieReq?.status === 'in_review' ? 'in_progress' :
              selfieReq?.status === 'rejected' ? 'blocked' : 'pending',
      actionUrl: '/dashboard/verificacion/selfie',
      actionLabel: selfieReq?.status === 'rejected' ? 'Corregir' : 'Tomar',
      isRequired: true,
      order: 4,
    });

    // Step 5: Phone Verification
    const isPhoneVerified = org.owner?.phoneVerified || org.phoneVerifiedAt !== null;
    steps.push({
      id: ONBOARDING_STEPS.PHONE_VERIFIED,
      title: 'Verificar teléfono',
      description: 'Validamos tu número con un código SMS',
      status: isPhoneVerified ? 'completed' : 'pending',
      actionUrl: '/dashboard/verificacion/telefono',
      actionLabel: 'Verificar',
      isRequired: true,
      order: 5,
    });

    // Step 6: Verification Complete (virtual step)
    steps.push({
      id: ONBOARDING_STEPS.VERIFICATION_COMPLETE,
      title: 'Verificación completa',
      description: 'Tu negocio está listo para recibir trabajos',
      status: verification.status === 'verified' ? 'completed' : 'pending',
      isRequired: true,
      order: 6,
    });

    // Step 7: First Job (optional)
    const hasJobs = await prisma.job.count({
      where: { organizationId: org.id },
    }) > 0;
    steps.push({
      id: ONBOARDING_STEPS.FIRST_JOB,
      title: 'Crear primer trabajo',
      description: 'Opcional: crea tu primer trabajo de prueba',
      status: hasJobs ? 'completed' : 'pending',
      actionUrl: '/dashboard/trabajos/nuevo',
      actionLabel: 'Crear',
      isRequired: false,
      order: 7,
    });

    // Step 8: Plan Selection
    const hasPaidPlan = org.subscriptionStatus === 'active' && org.subscriptionTier !== 'FREE';
    steps.push({
      id: ONBOARDING_STEPS.PLAN_SELECTED,
      title: 'Elegir plan',
      description: 'Seleccioná el plan que mejor se adapte a tu negocio',
      status: hasPaidPlan ? 'completed' : 'pending',
      actionUrl: '/dashboard/settings/billing/plans',
      actionLabel: 'Ver planes',
      isRequired: false, // Not required during trial
      order: 8,
    });

    return steps;
  }

  /**
   * Determine the next recommended action for the user
   */
  private determineNextAction(
    steps: OnboardingStep[],
    trial: Awaited<ReturnType<typeof trialManager.getTrialStatus>>,
    verification: Awaited<ReturnType<typeof verificationManager.getOrgVerificationSummary>>
  ): OnboardingStatus['nextAction'] | null {
    // Priority 1: Trial expiring soon - show upgrade CTA
    if (trial.isExpired) {
      return {
        step: ONBOARDING_STEPS.PLAN_SELECTED,
        title: 'Tu período de prueba terminó',
        description: 'Elegí un plan para seguir usando CampoTech',
        url: '/dashboard/settings/billing/plans',
        priority: 'high',
      };
    }

    if (trial.isExpiringSoon && trial.daysRemaining <= 3) {
      return {
        step: ONBOARDING_STEPS.PLAN_SELECTED,
        title: `Tu prueba vence en ${trial.daysRemaining} días`,
        description: 'Elegí un plan para no perder acceso',
        url: '/dashboard/settings/billing/plans',
        priority: 'high',
      };
    }

    // Priority 2: Rejected documents need correction
    const rejectedStep = steps.find((s) => s.status === 'blocked');
    if (rejectedStep) {
      return {
        step: rejectedStep.id,
        title: `Corregir: ${rejectedStep.title}`,
        description: 'Tu documento fue rechazado y necesita corrección',
        url: rejectedStep.actionUrl || '/dashboard/verificacion',
        priority: 'high',
      };
    }

    // Priority 3: Continue verification
    if (verification.status !== 'verified') {
      const pendingStep = steps.find(
        (s) => s.isRequired && s.status === 'pending'
      );
      if (pendingStep) {
        return {
          step: pendingStep.id,
          title: pendingStep.title,
          description: pendingStep.description,
          url: pendingStep.actionUrl || '/dashboard/verificacion',
          priority: verification.tier2.completed === 0 ? 'high' : 'medium',
        };
      }
    }

    // Priority 4: Trial expiring (more than 3 days but expiring soon)
    if (trial.isExpiringSoon) {
      return {
        step: ONBOARDING_STEPS.PLAN_SELECTED,
        title: `Tu prueba vence en ${trial.daysRemaining} días`,
        description: 'Considerá elegir un plan',
        url: '/dashboard/settings/billing/plans',
        priority: 'medium',
      };
    }

    // No urgent action needed
    return null;
  }

  /**
   * Update the current onboarding step
   */
  async updateOnboardingStep(organizationId: string, step: string): Promise<void> {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        onboardingStep: step,
      },
    });

    // Track step completion
    await funnelTracker.trackEvent({
      event: 'onboarding_step_completed',
      organizationId,
      metadata: { step },
    });
  }

  /**
   * Mark onboarding as complete
   */
  async completeOnboarding(organizationId: string): Promise<void> {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        onboardingCompletedAt: new Date(),
        onboardingStep: 'completed',
      },
    });

    await funnelTracker.trackEvent({
      event: 'onboarding_completed',
      organizationId,
    });
  }

  /**
   * Check and auto-complete onboarding if all requirements are met
   */
  async checkOnboardingCompletion(organizationId: string): Promise<boolean> {
    const status = await this.getOnboardingStatus(organizationId);

    if (status.verification.tier2Complete && !status.isComplete) {
      await this.completeOnboarding(organizationId);

      // Remove any verification blocks
      await blockManager.onVerificationComplete(organizationId);

      return true;
    }

    return false;
  }

  /**
   * Get onboarding metrics for analytics
   */
  async getOnboardingMetrics(organizationId: string): Promise<{
    daysInOnboarding: number;
    stepsCompleted: number;
    totalSteps: number;
    completionRate: number;
    dropOffStep: string | null;
  }> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        createdAt: true,
        onboardingCompletedAt: true,
        onboardingStep: true,
      },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    const status = await this.getOnboardingStatus(organizationId);
    const now = new Date();
    const endDate = org.onboardingCompletedAt || now;
    const daysInOnboarding = Math.ceil(
      (endDate.getTime() - org.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const requiredSteps = status.steps.filter((s) => s.isRequired);
    const completedSteps = requiredSteps.filter((s) => s.status === 'completed');

    return {
      daysInOnboarding,
      stepsCompleted: completedSteps.length,
      totalSteps: requiredSteps.length,
      completionRate: status.progress,
      dropOffStep: status.isComplete ? null : status.currentStep,
    };
  }
}

// Export singleton
export const onboardingFlow = new OnboardingFlowService();

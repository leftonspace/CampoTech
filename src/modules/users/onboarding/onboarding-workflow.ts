/**
 * Onboarding Workflow
 * ===================
 *
 * Phase 9.5: Employee Onboarding & Verification
 * Manages the complete employee onboarding flow.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { sendWelcomeWithVerification } from './welcome-message.service';
import { sendVerificationCode, checkVerificationStatus } from './employee-verification.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type OnboardingStep =
  | 'pending'
  | 'verification_sent'
  | 'phone_verified'
  | 'terms_accepted'
  | 'profile_completed'
  | 'tutorial_completed'
  | 'completed';

export interface OnboardingStatus {
  currentStep: OnboardingStep;
  progress: {
    phoneVerified: boolean;
    termsAccepted: boolean;
    profileCompleted: boolean;
    tutorialCompleted: boolean;
  };
  completedAt?: Date;
  percentComplete: number;
}

export interface OnboardingConfig {
  requirePhoneVerification: boolean;
  requireTermsAcceptance: boolean;
  requireProfileCompletion: boolean;
  requireTutorial: boolean;
  allowSkipTutorial: boolean;
}

// Default configuration for Argentine market
const DEFAULT_CONFIG: OnboardingConfig = {
  requirePhoneVerification: true,
  requireTermsAcceptance: true,
  requireProfileCompletion: false, // Optional for technicians
  requireTutorial: true,
  allowSkipTutorial: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING FLOW
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize onboarding for new employee
 * Called when a new user is created
 */
export async function initializeOnboarding(
  userId: string,
  organizationId: string,
  sendNotification: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user details
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isVerified: true,
      },
    });

    if (!user) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    // Create or update onboarding progress record
    await db.onboardingProgress.upsert({
      where: { userId },
      create: {
        userId,
        organizationId,
        phoneVerified: false,
        termsAccepted: false,
        profileCompleted: false,
        tutorialCompleted: false,
        completed: false,
      },
      update: {
        // Reset if re-initializing
        phoneVerified: false,
        termsAccepted: false,
        profileCompleted: false,
        tutorialCompleted: false,
        completed: false,
        completedAt: null,
      },
    });

    // Update user onboarding step
    await db.user.update({
      where: { id: userId },
      data: {
        onboardingStep: 'pending',
        onboardingCompleted: false,
      },
    });

    // Send welcome message with verification code
    if (sendNotification && user.phone) {
      const result = await sendWelcomeWithVerification(
        userId,
        organizationId,
        user.name || 'Equipo',
        user.phone,
        user.role
      );

      if (result.success) {
        await db.user.update({
          where: { id: userId },
          data: { onboardingStep: 'verification_sent' },
        });
      }

      log.info('Onboarding initialized with welcome message', {
        userId,
        notificationSent: result.success,
        channel: result.channel,
      });
    }

    return { success: true };
  } catch (error) {
    log.error('Error initializing onboarding', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Error inicializando onboarding' };
  }
}

/**
 * Get current onboarding status for user
 */
export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus | null> {
  const progress = await db.onboardingProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { onboardingStep: true },
  });

  // Calculate completion percentage
  const steps = [
    progress.phoneVerified,
    progress.termsAccepted,
    progress.profileCompleted || true, // Optional
    progress.tutorialCompleted || progress.tutorialSkipped,
  ];
  const completedSteps = steps.filter(Boolean).length;
  const percentComplete = Math.round((completedSteps / steps.length) * 100);

  return {
    currentStep: (user?.onboardingStep as OnboardingStep) || 'pending',
    progress: {
      phoneVerified: progress.phoneVerified,
      termsAccepted: progress.termsAccepted,
      profileCompleted: progress.profileCompleted,
      tutorialCompleted: progress.tutorialCompleted || progress.tutorialSkipped || false,
    },
    completedAt: progress.completedAt || undefined,
    percentComplete,
  };
}

/**
 * Advance onboarding to next step after phone verification
 */
export async function completePhoneVerification(userId: string): Promise<{ success: boolean }> {
  try {
    await db.$transaction([
      db.onboardingProgress.update({
        where: { userId },
        data: {
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
        },
      }),
      db.user.update({
        where: { id: userId },
        data: {
          onboardingStep: 'phone_verified',
          isVerified: true,
          verifiedAt: new Date(),
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    log.error('Error completing phone verification step', { userId, error });
    return { success: false };
  }
}

/**
 * Record terms acceptance
 */
export async function acceptTerms(userId: string): Promise<{ success: boolean }> {
  try {
    await db.$transaction([
      db.onboardingProgress.update({
        where: { userId },
        data: {
          termsAccepted: true,
          termsAcceptedAt: new Date(),
        },
      }),
      db.user.update({
        where: { id: userId },
        data: {
          onboardingStep: 'terms_accepted',
          termsAcceptedAt: new Date(),
        },
      }),
    ]);

    // Check if onboarding is complete
    await checkAndCompleteOnboarding(userId);

    return { success: true };
  } catch (error) {
    log.error('Error accepting terms', { userId, error });
    return { success: false };
  }
}

/**
 * Record profile completion
 */
export async function completeProfile(userId: string): Promise<{ success: boolean }> {
  try {
    await db.$transaction([
      db.onboardingProgress.update({
        where: { userId },
        data: {
          profileCompleted: true,
          profileCompletedAt: new Date(),
        },
      }),
      db.user.update({
        where: { id: userId },
        data: { onboardingStep: 'profile_completed' },
      }),
    ]);

    await checkAndCompleteOnboarding(userId);

    return { success: true };
  } catch (error) {
    log.error('Error completing profile', { userId, error });
    return { success: false };
  }
}

/**
 * Record tutorial completion or skip
 */
export async function completeTutorial(
  userId: string,
  skipped: boolean = false
): Promise<{ success: boolean }> {
  try {
    await db.$transaction([
      db.onboardingProgress.update({
        where: { userId },
        data: {
          tutorialCompleted: !skipped,
          tutorialCompletedAt: new Date(),
          tutorialSkipped: skipped,
        },
      }),
      db.user.update({
        where: { id: userId },
        data: { onboardingStep: 'tutorial_completed' },
      }),
    ]);

    await checkAndCompleteOnboarding(userId);

    return { success: true };
  } catch (error) {
    log.error('Error completing tutorial', { userId, error });
    return { success: false };
  }
}

/**
 * Check if all required steps are complete and mark onboarding as done
 */
async function checkAndCompleteOnboarding(userId: string): Promise<boolean> {
  const progress = await db.onboardingProgress.findUnique({
    where: { userId },
  });

  if (!progress) return false;

  const config = DEFAULT_CONFIG;

  // Check required steps
  const isComplete =
    (!config.requirePhoneVerification || progress.phoneVerified) &&
    (!config.requireTermsAcceptance || progress.termsAccepted) &&
    (!config.requireProfileCompletion || progress.profileCompleted) &&
    (!config.requireTutorial || progress.tutorialCompleted || progress.tutorialSkipped);

  if (isComplete && !progress.completed) {
    await db.$transaction([
      db.onboardingProgress.update({
        where: { userId },
        data: {
          completed: true,
          completedAt: new Date(),
        },
      }),
      db.user.update({
        where: { id: userId },
        data: {
          onboardingStep: 'completed',
          onboardingCompleted: true,
        },
      }),
    ]);

    log.info('Onboarding completed', { userId });
    return true;
  }

  return false;
}

/**
 * Record first login
 */
export async function recordFirstLogin(userId: string): Promise<void> {
  const progress = await db.onboardingProgress.findUnique({
    where: { userId },
    select: { firstLoginAt: true },
  });

  if (progress && !progress.firstLoginAt) {
    await db.onboardingProgress.update({
      where: { userId },
      data: { firstLoginAt: new Date() },
    });
  }
}

/**
 * Get onboarding configuration for organization
 */
export async function getOnboardingConfig(organizationId: string): Promise<OnboardingConfig> {
  // In the future, this could be stored per-organization
  // For now, return defaults
  return DEFAULT_CONFIG;
}

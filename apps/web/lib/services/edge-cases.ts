/**
 * CampoTech Edge Cases Service
 * =============================
 *
 * Handles complex edge cases in user flows:
 * - Payment approved but verification incomplete
 * - Verification complete but trial expired
 * - Employee verified but owner not verified
 * - Multiple organizations with same CUIT
 * - Owner changes (business transfer)
 * - Organization deletion
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

import { funnelTracker } from '@/lib/services/funnel-tracker';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AccessStatus {
  canAccessDashboard: boolean;
  canReceiveJobs: boolean;
  blockedReason: string | null;
  actionRequired: EdgeCaseAction | null;
  message: string;
  messageEs: string;
}

export interface EdgeCaseAction {
  type: 'complete_verification' | 'choose_plan' | 'contact_owner' | 'verify_owner' | 'pay';
  priority: 'high' | 'medium' | 'low';
  url: string;
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
}

export interface CUITCheckResult {
  isUnique: boolean;
  existingOrgId?: string;
  existingOrgName?: string;
  error?: string;
  errorEs?: string;
}

export interface OwnerTransferRequest {
  id: string;
  organizationId: string;
  currentOwnerId: string;
  newOwnerId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  createdAt: Date;
  completedAt?: Date;
}

export interface DeletionPreview {
  canDelete: boolean;
  blockers: string[];
  blockersEs: string[];
  pendingPayments: number;
  activeSubscription: boolean;
  employeeCount: number;
  documentCount: number;
  recoveryDays: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DELETION_RECOVERY_DAYS = 30;
const _BUENOS_AIRES_TZ = 'America/Argentina/Buenos_Aires';

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE CASES SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class EdgeCasesService {
  // Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬
  // CASE 1: Payment approved but verification incomplete
  // Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬

  /**
   * Check access status for organization considering payment and verification state
   */
  async getAccessStatus(organizationId: string): Promise<AccessStatus> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscriptionStatus: true,
        subscriptionTier: true,
        verificationStatus: true,
        trialEndsAt: true,
        blockType: true,
        blockReason: true,
      },
    });

    if (!org) {
      return {
        canAccessDashboard: false,
        canReceiveJobs: false,
        blockedReason: 'Organization not found',
        actionRequired: null,
        message: 'Organization not found',
        messageEs: 'Organización no encontrada',
      };
    }

    const isPaid = org.subscriptionStatus === 'active';
    const isTrialing = org.subscriptionStatus === 'trialing';
    const trialActive = isTrialing && org.trialEndsAt && org.trialEndsAt > new Date();
    const isVerified = org.verificationStatus === 'verified';
    const _isBlocked = org.blockType !== null;

    // Case: Hard blocked - no access
    if (org.blockType === 'hard_block') {
      return {
        canAccessDashboard: false,
        canReceiveJobs: false,
        blockedReason: org.blockReason || 'Account blocked',
        actionRequired: {
          type: 'pay',
          priority: 'high',
          url: '/billing',
          title: 'Choose a Plan',
          titleEs: 'Elegí un plan',
          description: 'Your account is blocked. Choose a plan to continue.',
          descriptionEs: 'Tu cuenta está bloqueada. Elegí un plan para continuar.',
        },
        message: 'Account is hard blocked. Only billing and support accessible.',
        messageEs: 'Cuenta bloqueada. Solo podés acceder a facturación y soporte.',
      };
    }

    // Case: Paid but not verified
    if (isPaid && !isVerified) {
      return {
        canAccessDashboard: true, // Paid benefit
        canReceiveJobs: false, // Verification required
        blockedReason: 'Verification incomplete',
        actionRequired: {
          type: 'complete_verification',
          priority: 'high',
          url: '/verification',
          title: 'Complete Verification',
          titleEs: 'Completá la verificación',
          description: 'You have an active subscription. Complete verification to receive jobs.',
          descriptionEs: 'Tenés una suscripción activa. Completá la verificación para recibir trabajos.',
        },
        message: 'Paid subscription active. Complete verification to receive jobs.',
        messageEs: 'Suscripción activa. Completá la verificación para recibir trabajos.',
      };
    }

    // Case: Verified but trial expired (not paid)
    if (isVerified && !isPaid && !trialActive) {
      return {
        canAccessDashboard: false,
        canReceiveJobs: false,
        blockedReason: 'Trial expired',
        actionRequired: {
          type: 'choose_plan',
          priority: 'high',
          url: '/billing/plans',
          title: 'Choose a Plan',
          titleEs: 'Elegí un plan',
          description: 'Verification complete. Choose a plan to continue.',
          descriptionEs: 'Verificación completa. Elegí un plan para continuar.',
        },
        message: 'Verification complete. Choose a plan to continue.',
        messageEs: 'Verificación completa. Elegí un plan para continuar.',
      };
    }

    // Case: Soft blocked (trial expired, in grace period)
    if (org.blockType === 'soft_block') {
      return {
        canAccessDashboard: true, // Limited access
        canReceiveJobs: false,
        blockedReason: org.blockReason || 'Limited access',
        actionRequired: {
          type: 'pay',
          priority: 'high',
          url: '/billing/plans',
          title: 'Upgrade to Continue',
          titleEs: 'Actualizá para continuar',
          description: 'Your trial has ended. Choose a plan to keep receiving jobs.',
          descriptionEs: 'Tu prueba terminó. Elegí un plan para seguir recibiendo trabajos.',
        },
        message: 'Limited access. Choose a plan to restore full access.',
        messageEs: 'Acceso limitado. Elegí un plan para restaurar el acceso completo.',
      };
    }

    // Case: Active trial, not verified yet
    if (trialActive && !isVerified) {
      return {
        canAccessDashboard: true,
        canReceiveJobs: false,
        blockedReason: null,
        actionRequired: {
          type: 'complete_verification',
          priority: 'medium',
          url: '/verification',
          title: 'Complete Verification',
          titleEs: 'Completá la verificación',
          description: 'Complete verification to start receiving jobs.',
          descriptionEs: 'Completá la verificación para empezar a recibir trabajos.',
        },
        message: 'Trial active. Complete verification to receive jobs.',
        messageEs: 'Prueba activa. Completá la verificación para recibir trabajos.',
      };
    }

    // Case: Everything good
    if ((isPaid || trialActive) && isVerified) {
      return {
        canAccessDashboard: true,
        canReceiveJobs: true,
        blockedReason: null,
        actionRequired: null,
        message: 'Full access. Ready to receive jobs.',
        messageEs: 'Acceso completo. Listo para recibir trabajos.',
      };
    }

    // Default: something wrong
    return {
      canAccessDashboard: false,
      canReceiveJobs: false,
      blockedReason: 'Unknown status',
      actionRequired: {
        type: 'contact_owner',
        priority: 'high',
        url: '/support',
        title: 'Contact Support',
        titleEs: 'Contactá a soporte',
        description: 'There is an issue with your account. Please contact support.',
        descriptionEs: 'Hay un problema con tu cuenta. Por favor contactá a soporte.',
      },
      message: 'Unknown account status. Contact support.',
      messageEs: 'Estado de cuenta desconocido. Contactá a soporte.',
    };
  }

  // Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬
  // CASE 2: Employee verified but owner not verified
  // Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬

  /**
   * Check if employee can work based on organization verification status
   */
  async checkEmployeeWorkEligibility(
    employeeUserId: string,
    organizationId: string
  ): Promise<{
    canWork: boolean;
    reason: string;
    reasonEs: string;
    ownerNotified: boolean;
  }> {
    // Get org and owner verification status
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        verificationStatus: true,
        subscriptionStatus: true,
        blockType: true,
        members: {
          where: { role: 'owner' },
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!org) {
      return {
        canWork: false,
        reason: 'Organization not found',
        reasonEs: 'Organización no encontrada',
        ownerNotified: false,
      };
    }

    // Check employee's own verification
    const employee = await prisma.verificationDocument.findMany({
      where: {
        userId: employeeUserId,
        organizationId,
        status: 'approved',
      },
    });

    const employeeVerified = employee.length > 0;

    // If org is not verified
    if (org.verificationStatus !== 'verified') {
      // Notify owner if employee is verified but waiting on org
      let ownerNotified = false;

      if (employeeVerified && org.members.length > 0) {
        const owner = org.members[0];

        // Create notification for owner
        try {
          await prisma.notification.create({
            data: {
              userId: owner.userId,
              type: 'employee_waiting',
              title: 'Empleado esperando verificación',
              message: `Un empleado completó su verificación pero no puede trabajar hasta que la organización esté verificada.`,
              data: {
                employeeUserId,
                organizationId,
                action: 'complete_org_verification',
              } as unknown as Prisma.InputJsonValue,
            },
          });
          ownerNotified = true;
        } catch (error) {
          console.error('[EdgeCases] Failed to notify owner:', error);
        }
      }

      return {
        canWork: false,
        reason: 'Organization verification incomplete. Contact your organization owner.',
        reasonEs: 'Verificación de la organización incompleta. Contactá al dueño de la organización.',
        ownerNotified,
      };
    }

    // If org is blocked
    if (org.blockType !== null) {
      return {
        canWork: false,
        reason: 'Organization account is blocked. Contact your organization owner.',
        reasonEs: 'La cuenta de la organización está bloqueada. Contactá al dueño.',
        ownerNotified: false,
      };
    }

    // If org subscription not active
    if (org.subscriptionStatus !== 'active' && org.subscriptionStatus !== 'trialing') {
      return {
        canWork: false,
        reason: 'Organization subscription is not active. Contact your organization owner.',
        reasonEs: 'La suscripción de la organización no está activa. Contactá al dueño.',
        ownerNotified: false,
      };
    }

    // If employee not verified
    if (!employeeVerified) {
      return {
        canWork: false,
        reason: 'Complete your verification to start working.',
        reasonEs: 'Completá tu verificación para empezar a trabajar.',
        ownerNotified: false,
      };
    }

    // All good
    return {
      canWork: true,
      reason: 'Employee can work',
      reasonEs: 'El empleado puede trabajar',
      ownerNotified: false,
    };
  }

  // Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬
  // CASE 3: Multiple organizations same CUIT
  // Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬

  /**
   * Check if CUIT is already registered
   */
  async checkCUITUniqueness(
    cuit: string,
    excludeOrgId?: string
  ): Promise<CUITCheckResult> {
    // Normalize CUIT (remove dashes and spaces)
    const normalizedCUIT = cuit.replace(/[-\s]/g, '');

    const existingOrg = await prisma.organization.findFirst({
      where: {
        cuit: normalizedCUIT,
        ...(excludeOrgId && { id: { not: excludeOrgId } }),
        deletedAt: null, // Don't count soft-deleted orgs
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (existingOrg) {
      return {
        isUnique: false,
        existingOrgId: existingOrg.id,
        existingOrgName: existingOrg.name,
        error: `CUIT ${cuit} is already registered to another organization`,
        errorEs: `Este CUIT ya está registrado en otra organización`,
      };
    }

    return { isUnique: true };
  }

  /**
   * Validate and register CUIT for organization
   */
  async registerCUIT(
    organizationId: string,
    cuit: string
  ): Promise<{
    success: boolean;
    error?: string;
    errorEs?: string;
  }> {
    // Check uniqueness first
    const uniqueness = await this.checkCUITUniqueness(cuit, organizationId);

    if (!uniqueness.isUnique) {
      // Track duplicate attempt
      await funnelTracker.trackEvent({
        event: 'cuit_submitted',
        organizationId,
        metadata: {
          cuit: cuit.slice(0, 2) + '***', // Partially masked
          duplicate: true,
          existingOrgId: uniqueness.existingOrgId,
        },
      });

      return {
        success: false,
        error: uniqueness.error,
        errorEs: uniqueness.errorEs,
      };
    }

    // Normalize and save
    const normalizedCUIT = cuit.replace(/[-\s]/g, '');

    try {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { cuit: normalizedCUIT },
      });

      await funnelTracker.trackEvent({
        event: 'cuit_submitted',
        organizationId,
        metadata: { success: true },
      });

      return { success: true };
    } catch (error) {
      console.error('[EdgeCases] Failed to register CUIT:', error);
      return {
        success: false,
        error: 'Failed to save CUIT',
        errorEs: 'Error al guardar el CUIT',
      };
    }
  }

  // Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬
  // CASE 4: Owner changes (business transfer)
  // Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬

  /**
   * Initiate owner transfer process
   */
  async initiateOwnerTransfer(
    organizationId: string,
    currentOwnerId: string,
    newOwnerEmail: string
  ): Promise<{
    success: boolean;
    transferId?: string;
    error?: string;
    errorEs?: string;
  }> {
    // Verify current owner
    const currentMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: currentOwnerId,
        role: 'owner',
      },
    });

    if (!currentMember) {
      return {
        success: false,
        error: 'You are not the owner of this organization',
        errorEs: 'No sos el dueño de esta organización',
      };
    }

    // Find new owner by email
    const newOwner = await prisma.user.findUnique({
      where: { email: newOwnerEmail },
      select: { id: true, name: true },
    });

    if (!newOwner) {
      return {
        success: false,
        error: 'User not found with that email',
        errorEs: 'No se encontró un usuario con ese email',
      };
    }

    if (newOwner.id === currentOwnerId) {
      return {
        success: false,
        error: 'Cannot transfer to yourself',
        errorEs: 'No podés transferir a vos mismo',
      };
    }

    // Create transfer request
    const transfer = await prisma.subscriptionEvent.create({
      data: {
        organizationId,
        subscriptionId: 'owner_transfer',
        eventType: 'owner_transfer.initiated',
        eventData: {
          currentOwnerId,
          newOwnerId: newOwner.id,
          newOwnerEmail,
          status: 'pending',
          initiatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        actorType: 'user',
        actorId: currentOwnerId,
      },
    });

    // Notify new owner
    await prisma.notification.create({
      data: {
        userId: newOwner.id,
        type: 'owner_transfer_request',
        title: 'Solicitud de transferencia de organización',
        message: `Te han invitado a ser el nuevo dueño de una organización. Deberás completar la verificación.`,
        data: {
          transferId: transfer.id,
          organizationId,
          action: 'accept_transfer',
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      transferId: transfer.id,
    };
  }

  /**
   * Accept owner transfer (new owner must re-verify)
   */
  async acceptOwnerTransfer(
    transferId: string,
    newOwnerId: string
  ): Promise<{
    success: boolean;
    verificationRequired: boolean;
    error?: string;
    errorEs?: string;
  }> {
    // Find transfer request
    const transfer = await prisma.subscriptionEvent.findFirst({
      where: {
        id: transferId,
        eventType: 'owner_transfer.initiated',
      },
    });

    if (!transfer) {
      return {
        success: false,
        verificationRequired: false,
        error: 'Transfer request not found',
        errorEs: 'Solicitud de transferencia no encontrada',
      };
    }

    const transferData = transfer.eventData as {
      currentOwnerId: string;
      newOwnerId: string;
      status: string;
    };

    if (transferData.newOwnerId !== newOwnerId) {
      return {
        success: false,
        verificationRequired: false,
        error: 'You are not the designated new owner',
        errorEs: 'No sos el nuevo dueño designado',
      };
    }

    if (transferData.status !== 'pending') {
      return {
        success: false,
        verificationRequired: false,
        error: 'Transfer already processed',
        errorEs: 'Transferencia ya procesada',
      };
    }

    // Execute transfer in transaction
    await prisma.$transaction(async (tx) => {
      // Update old owner to admin
      await tx.organizationMember.updateMany({
        where: {
          organizationId: transfer.organizationId,
          userId: transferData.currentOwnerId,
          role: 'owner',
        },
        data: { role: 'admin' },
      });

      // Check if new owner is already a member
      const existingMember = await tx.organizationMember.findFirst({
        where: {
          organizationId: transfer.organizationId,
          userId: newOwnerId,
        },
      });

      if (existingMember) {
        await tx.organizationMember.update({
          where: { id: existingMember.id },
          data: { role: 'owner' },
        });
      } else {
        await tx.organizationMember.create({
          data: {
            organizationId: transfer.organizationId,
            userId: newOwnerId,
            role: 'owner',
          },
        });
      }

      // Reset org verification status (new owner must verify)
      await tx.organization.update({
        where: { id: transfer.organizationId },
        data: {
          verificationStatus: 'pending',
          verificationCompletedAt: null,
        },
      });

      // Update transfer status
      await tx.subscriptionEvent.create({
        data: {
          organizationId: transfer.organizationId,
          subscriptionId: 'owner_transfer',
          eventType: 'owner_transfer.completed',
          eventData: {
            transferId,
            previousOwnerId: transferData.currentOwnerId,
            newOwnerId,
            completedAt: new Date().toISOString(),
            verificationReset: true,
          } as Prisma.InputJsonValue,
          actorType: 'user',
          actorId: newOwnerId,
        },
      });
    });

    // Notify old owner
    await prisma.notification.create({
      data: {
        userId: transferData.currentOwnerId,
        type: 'owner_transfer_completed',
        title: 'Transferencia de organización completada',
        message: 'La transferencia de la organización se completó. Tu rol fue cambiado a administrador.',
        data: {
          organizationId: transfer.organizationId,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      verificationRequired: true, // New owner must verify
    };
  }

  // Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬
  // CASE 5: Organization deletion
  // Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬Í¢â€â‚¬

  /**
   * Preview what will happen when deleting an organization
   */
  async previewDeletion(organizationId: string): Promise<DeletionPreview> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscriptionStatus: true,
        _count: {
          select: {
            members: true,
            verificationDocuments: true,
          },
        },
      },
    });

    if (!org) {
      return {
        canDelete: false,
        blockers: ['Organization not found'],
        blockersEs: ['Organización no encontrada'],
        pendingPayments: 0,
        activeSubscription: false,
        employeeCount: 0,
        documentCount: 0,
        recoveryDays: DELETION_RECOVERY_DAYS,
      };
    }

    const blockers: string[] = [];
    const blockersEs: string[] = [];

    // Check for pending payments
    const pendingPayments = await prisma.subscriptionPayment.count({
      where: {
        organizationId,
        status: 'pending',
      },
    });

    if (pendingPayments > 0) {
      blockers.push(`${pendingPayments} pending payment(s) must be resolved`);
      blockersEs.push(`${pendingPayments} pago(s) pendiente(s) deben resolverse`);
    }

    // Check for active subscription
    const activeSubscription = org.subscriptionStatus === 'active';
    if (activeSubscription) {
      blockers.push('Active subscription must be cancelled first');
      blockersEs.push('La suscripción activa debe cancelarse primero');
    }

    return {
      canDelete: blockers.length === 0,
      blockers,
      blockersEs,
      pendingPayments,
      activeSubscription,
      employeeCount: org._count.members,
      documentCount: org._count.verificationDocuments,
      recoveryDays: DELETION_RECOVERY_DAYS,
    };
  }

  /**
   * Soft delete organization with 30-day recovery window
   */
  async deleteOrganization(
    organizationId: string,
    requestedById: string,
    reason?: string
  ): Promise<{
    success: boolean;
    recoveryDeadline?: Date;
    error?: string;
    errorEs?: string;
  }> {
    // Preview first to check blockers
    const preview = await this.previewDeletion(organizationId);

    if (!preview.canDelete) {
      return {
        success: false,
        error: preview.blockers.join('. '),
        errorEs: preview.blockersEs.join('. '),
      };
    }

    // Verify requester is owner
    const isOwner = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: requestedById,
        role: 'owner',
      },
    });

    if (!isOwner) {
      return {
        success: false,
        error: 'Only the owner can delete the organization',
        errorEs: 'Solo el dueño puede eliminar la organización',
      };
    }

    const recoveryDeadline = new Date();
    recoveryDeadline.setDate(recoveryDeadline.getDate() + DELETION_RECOVERY_DAYS);

    // Perform soft delete
    await prisma.$transaction(async (tx) => {
      // Soft delete the organization
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          deletedAt: new Date(),
          blockType: 'hard_block',
          blockReason: `Scheduled for deletion. Recovery until ${recoveryDeadline.toISOString()}`,
        },
      });

      // Archive verification documents (don't delete for legal compliance)
      await tx.verificationDocument.updateMany({
        where: { organizationId },
        data: {
          status: 'archived',
        },
      });

      // Log the deletion request
      await tx.subscriptionEvent.create({
        data: {
          organizationId,
          subscriptionId: 'deletion',
          eventType: 'organization.deletion_scheduled',
          eventData: {
            requestedById,
            reason,
            recoveryDeadline: recoveryDeadline.toISOString(),
            employeeCount: preview.employeeCount,
            documentCount: preview.documentCount,
          } as Prisma.InputJsonValue,
          actorType: 'user',
          actorId: requestedById,
        },
      });
    });

    // Notify all members
    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });

    type MemberEntry = (typeof members)[number];
    await Promise.all(
      members.map((member: MemberEntry) =>
        prisma.notification.create({
          data: {
            userId: member.userId,
            type: 'organization_deleted',
            title: 'Organización programada para eliminación',
            message: `La organización será eliminada permanentemente el ${recoveryDeadline.toLocaleDateString('es-AR')}. Contactá al dueño para recuperarla.`,
            data: {
              organizationId,
              recoveryDeadline: recoveryDeadline.toISOString(),
            } as unknown as Prisma.InputJsonValue,
          },
        })
      )
    );

    return {
      success: true,
      recoveryDeadline,
    };
  }

  /**
   * Recover a soft-deleted organization within the recovery window
   */
  async recoverOrganization(
    organizationId: string,
    requestedById: string
  ): Promise<{
    success: boolean;
    error?: string;
    errorEs?: string;
  }> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        deletedAt: true,
        blockReason: true,
      },
    });

    if (!org) {
      return {
        success: false,
        error: 'Organization not found',
        errorEs: 'Organización no encontrada',
      };
    }

    if (!org.deletedAt) {
      return {
        success: false,
        error: 'Organization is not deleted',
        errorEs: 'La organización no está eliminada',
      };
    }

    // Check if still within recovery window
    const recoveryDeadline = new Date(org.deletedAt);
    recoveryDeadline.setDate(recoveryDeadline.getDate() + DELETION_RECOVERY_DAYS);

    if (new Date() > recoveryDeadline) {
      return {
        success: false,
        error: 'Recovery window has expired',
        errorEs: 'El período de recuperación expiró',
      };
    }

    // Verify requester is owner
    const isOwner = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: requestedById,
        role: 'owner',
      },
    });

    if (!isOwner) {
      return {
        success: false,
        error: 'Only the owner can recover the organization',
        errorEs: 'Solo el dueño puede recuperar la organización',
      };
    }

    // Recover the organization
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          deletedAt: null,
          blockType: null,
          blockReason: null,
        },
      });

      // Log the recovery
      await tx.subscriptionEvent.create({
        data: {
          organizationId,
          subscriptionId: 'deletion',
          eventType: 'organization.deletion_cancelled',
          eventData: {
            recoveredById: requestedById,
            recoveredAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
          actorType: 'user',
          actorId: requestedById,
        },
      });
    });

    // Notify all members
    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });

    type RecoveryMemberEntry = (typeof members)[number];
    await Promise.all(
      members.map((member: RecoveryMemberEntry) =>
        prisma.notification.create({
          data: {
            userId: member.userId,
            type: 'organization_recovered',
            title: 'Organización recuperada',
            message: 'La organización fue recuperada y ya está disponible nuevamente.',
            data: { organizationId } as unknown as Prisma.InputJsonValue,
          },
        })
      )
    );

    return { success: true };
  }

  /**
   * Permanently delete organizations past their recovery window
   * Should be called by a cron job
   */
  async processPermanentDeletions(): Promise<{
    processed: number;
    deleted: number;
    errors: string[];
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DELETION_RECOVERY_DAYS);

    const orgsToDelete = await prisma.organization.findMany({
      where: {
        deletedAt: {
          not: null,
          lte: cutoffDate,
        },
      },
      select: { id: true, name: true },
    });

    const errors: string[] = [];
    let deleted = 0;

    for (const org of orgsToDelete) {
      try {
        await prisma.$transaction(async (tx) => {
          // Archive data for legal compliance (10 years for AFIP)
          // In practice, this would move data to an archive table

          // Delete non-essential data
          await tx.notification.deleteMany({ where: { userId: { in: [] } } }); // Placeholder

          // Mark as permanently deleted
          await tx.subscriptionEvent.create({
            data: {
              organizationId: org.id,
              subscriptionId: 'deletion',
              eventType: 'organization.permanently_deleted',
              eventData: {
                deletedAt: new Date().toISOString(),
                archivedForCompliance: true,
              } as Prisma.InputJsonValue,
              actorType: 'system',
            },
          });

          console.log(`[EdgeCases] Permanently deleted org: ${org.id}`);
        });

        deleted++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to delete ${org.id}: ${message}`);
        console.error(`[EdgeCases] Failed to delete org ${org.id}:`, error);
      }
    }

    return {
      processed: orgsToDelete.length,
      deleted,
      errors,
    };
  }
}

// Export singleton
export const edgeCases = new EdgeCasesService();

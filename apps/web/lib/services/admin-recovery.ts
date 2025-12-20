/**
 * CampoTech Admin Recovery Service
 * ==================================
 *
 * Admin-only recovery flows for handling errors:
 * - Manually approve AFIP checks
 * - Manually process payments
 * - Override blocks
 * - Manual verification approval
 * - Payment refund processing
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nextjs';
import { blockManager } from '@/lib/services/block-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AdminAction {
  id: string;
  adminId: string;
  actionType: AdminActionType;
  targetType: 'organization' | 'user' | 'payment' | 'verification';
  targetId: string;
  reason: string;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  createdAt: Date;
}

export type AdminActionType =
  | 'manual_afip_approve'
  | 'manual_afip_reject'
  | 'manual_payment_approve'
  | 'manual_payment_reject'
  | 'manual_refund'
  | 'block_override'
  | 'block_apply'
  | 'verification_override'
  | 'subscription_override';

export interface RecoveryResult {
  success: boolean;
  actionId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  error?: string;
  errorEs?: string;
}

export interface PendingRecoveryItem {
  id: string;
  type: 'afip_verification' | 'payment' | 'block' | 'verification';
  organizationId: string;
  organizationName?: string;
  userId?: string;
  userName?: string;
  status: string;
  reason: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN RECOVERY SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class AdminRecoveryService {
  // ─────────────────────────────────────────────────────────────────────────────
  // Permission Check
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Verify admin has permission for recovery actions
   */
  private async verifyAdminPermission(adminId: string): Promise<boolean> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    return admin?.role === 'admin' || admin?.role === 'superadmin';
  }

  /**
   * Log admin action for audit trail
   */
  private async logAdminAction(action: Omit<AdminAction, 'id' | 'createdAt'>): Promise<string> {
    const event = await prisma.subscriptionEvent.create({
      data: {
        organizationId: action.targetId,
        subscriptionId: 'admin_action',
        eventType: `admin.${action.actionType}`,
        eventData: {
          adminId: action.adminId,
          targetType: action.targetType,
          targetId: action.targetId,
          reason: action.reason,
          previousState: action.previousState,
          newState: action.newState,
        } as Prisma.InputJsonValue,
        actorType: 'admin',
        actorId: action.adminId,
      },
    });

    console.log(`[AdminRecovery] Action logged: ${action.actionType} by ${action.adminId}`);

    return event.id;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Manual AFIP Approval
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get pending AFIP verifications that need manual review
   */
  async getPendingAFIPVerifications(): Promise<PendingRecoveryItem[]> {
    const pending = await prisma.subscriptionEvent.findMany({
      where: {
        eventType: 'afip.manual_verification_queued',
        eventData: {
          path: ['status'],
          equals: 'pending',
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const items: PendingRecoveryItem[] = [];

    for (const event of pending) {
      const data = event.eventData as Record<string, unknown>;

      // Get org and user details
      const org = await prisma.organization.findUnique({
        where: { id: event.organizationId },
        select: { name: true },
      });

      const user = data.userId
        ? await prisma.user.findUnique({
            where: { id: data.userId as string },
            select: { name: true },
          })
        : null;

      items.push({
        id: event.id,
        type: 'afip_verification',
        organizationId: event.organizationId,
        organizationName: org?.name,
        userId: data.userId as string,
        userName: user?.name || undefined,
        status: data.status as string,
        reason: data.reason as string,
        createdAt: event.createdAt,
        metadata: {
          cuit: data.cuit,
          attemptCount: data.attemptCount,
        },
      });
    }

    return items;
  }

  /**
   * Manually approve AFIP verification
   */
  async approveAFIPVerification(
    adminId: string,
    queueId: string,
    reason: string
  ): Promise<RecoveryResult> {
    // Verify admin permission
    if (!(await this.verifyAdminPermission(adminId))) {
      return {
        success: false,
        error: 'Unauthorized: Admin permission required',
        errorEs: 'No autorizado: Se requiere permiso de administrador',
      };
    }

    // Find the queued verification
    const queueEntry = await prisma.subscriptionEvent.findFirst({
      where: {
        id: queueId,
        eventType: 'afip.manual_verification_queued',
      },
    });

    if (!queueEntry) {
      return {
        success: false,
        error: 'Verification request not found',
        errorEs: 'Solicitud de verificación no encontrada',
      };
    }

    const data = queueEntry.eventData as Record<string, unknown>;
    const previousState = { status: data.status, cuit: data.cuit };

    try {
      await prisma.$transaction(async (tx) => {
        // Update the queue entry status
        await tx.subscriptionEvent.update({
          where: { id: queueId },
          data: {
            eventData: {
              ...data,
              status: 'completed',
              approvedBy: adminId,
              approvedAt: new Date().toISOString(),
              approvalReason: reason,
            } as Prisma.InputJsonValue,
          },
        });

        // Update organization CUIT verification status
        await tx.organization.update({
          where: { id: queueEntry.organizationId },
          data: {
            cuit: data.cuit as string,
            // Note: Additional verification fields would be updated here
          },
        });

        // Create a verification document record if needed
        await tx.verificationDocument.create({
          data: {
            organizationId: queueEntry.organizationId,
            userId: data.userId as string,
            documentType: 'cuit',
            status: 'approved',
            metadata: {
              manualApproval: true,
              approvedBy: adminId,
              reason,
            } as Prisma.InputJsonValue,
          },
        });
      });

      const newState = { status: 'completed', approvedBy: adminId };

      // Log admin action
      const actionId = await this.logAdminAction({
        adminId,
        actionType: 'manual_afip_approve',
        targetType: 'verification',
        targetId: queueEntry.organizationId,
        reason,
        previousState,
        newState,
      });

      // Notify user
      if (data.userId) {
        await prisma.notification.create({
          data: {
            userId: data.userId as string,
            type: 'verification_approved',
            title: 'Verificación CUIT aprobada',
            message: 'Tu CUIT fue verificado manualmente. Ya podés continuar con el proceso.',
            data: { organizationId: queueEntry.organizationId } as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return {
        success: true,
        actionId,
        previousState,
        newState,
      };
    } catch (error) {
      console.error('[AdminRecovery] AFIP approval failed:', error);
      Sentry.captureException(error);

      return {
        success: false,
        error: 'Failed to approve verification',
        errorEs: 'Error al aprobar la verificación',
      };
    }
  }

  /**
   * Manually reject AFIP verification
   */
  async rejectAFIPVerification(
    adminId: string,
    queueId: string,
    reason: string
  ): Promise<RecoveryResult> {
    if (!(await this.verifyAdminPermission(adminId))) {
      return {
        success: false,
        error: 'Unauthorized',
        errorEs: 'No autorizado',
      };
    }

    const queueEntry = await prisma.subscriptionEvent.findFirst({
      where: {
        id: queueId,
        eventType: 'afip.manual_verification_queued',
      },
    });

    if (!queueEntry) {
      return {
        success: false,
        error: 'Verification request not found',
        errorEs: 'Solicitud no encontrada',
      };
    }

    const data = queueEntry.eventData as Record<string, unknown>;
    const previousState = { status: data.status };

    await prisma.subscriptionEvent.update({
      where: { id: queueId },
      data: {
        eventData: {
          ...data,
          status: 'failed',
          rejectedBy: adminId,
          rejectedAt: new Date().toISOString(),
          rejectionReason: reason,
        } as Prisma.InputJsonValue,
      },
    });

    const newState = { status: 'failed', rejectedBy: adminId, reason };

    const actionId = await this.logAdminAction({
      adminId,
      actionType: 'manual_afip_reject',
      targetType: 'verification',
      targetId: queueEntry.organizationId,
      reason,
      previousState,
      newState,
    });

    // Notify user
    if (data.userId) {
      await prisma.notification.create({
        data: {
          userId: data.userId as string,
          type: 'verification_rejected',
          title: 'Verificación CUIT rechazada',
          message: `Tu verificación de CUIT fue rechazada: ${reason}. Por favor contactá a soporte.`,
          data: { organizationId: queueEntry.organizationId } as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return {
      success: true,
      actionId,
      previousState,
      newState,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Manual Payment Processing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get pending payments that need manual review
   */
  async getPendingPayments(): Promise<PendingRecoveryItem[]> {
    const pending = await prisma.subscriptionPayment.findMany({
      where: {
        status: { in: ['pending', 'processing'] },
      },
      include: {
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    type PendingPaymentEntry = (typeof pending)[number];
    return pending.map((payment: PendingPaymentEntry) => ({
      id: payment.id,
      type: 'payment' as const,
      organizationId: payment.organizationId,
      organizationName: payment.organization.name,
      status: payment.status,
      reason: `${payment.amount} ${payment.currency} - ${payment.paymentMethod}`,
      createdAt: payment.createdAt,
      metadata: {
        amount: payment.amount,
        currency: payment.currency,
        mercadoPagoId: payment.mercadoPagoPaymentId,
      },
    }));
  }

  /**
   * Manually approve a payment
   */
  async approvePayment(
    adminId: string,
    paymentId: string,
    reason: string
  ): Promise<RecoveryResult> {
    if (!(await this.verifyAdminPermission(adminId))) {
      return {
        success: false,
        error: 'Unauthorized',
        errorEs: 'No autorizado',
      };
    }

    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { organization: true },
    });

    if (!payment) {
      return {
        success: false,
        error: 'Payment not found',
        errorEs: 'Pago no encontrado',
      };
    }

    const previousState = { status: payment.status };

    try {
      await prisma.$transaction(async (tx) => {
        // Update payment status
        await tx.subscriptionPayment.update({
          where: { id: paymentId },
          data: {
            status: 'completed',
            paidAt: new Date(),
            metadata: {
              ...(payment.metadata as object),
              manualApproval: true,
              approvedBy: adminId,
              approvalReason: reason,
            },
          },
        });

        // Update organization subscription
        await tx.organization.update({
          where: { id: payment.organizationId },
          data: {
            subscriptionStatus: 'active',
            blockType: null,
            blockReason: null,
          },
        });

        // Update subscription record
        await tx.organizationSubscription.updateMany({
          where: {
            organizationId: payment.organizationId,
            status: { in: ['pending', 'trialing'] },
          },
          data: {
            status: 'active',
          },
        });
      });

      const newState = { status: 'completed', approvedBy: adminId };

      const actionId = await this.logAdminAction({
        adminId,
        actionType: 'manual_payment_approve',
        targetType: 'payment',
        targetId: paymentId,
        reason,
        previousState,
        newState,
      });

      // Notify org owner
      const owner = await prisma.organizationMember.findFirst({
        where: {
          organizationId: payment.organizationId,
          role: 'owner',
        },
      });

      if (owner) {
        await prisma.notification.create({
          data: {
            userId: owner.userId,
            type: 'payment_approved',
            title: 'Pago confirmado',
            message: 'Tu pago fue procesado correctamente. Tu suscripción está activa.',
            data: { paymentId } as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return {
        success: true,
        actionId,
        previousState,
        newState,
      };
    } catch (error) {
      console.error('[AdminRecovery] Payment approval failed:', error);
      Sentry.captureException(error);

      return {
        success: false,
        error: 'Failed to approve payment',
        errorEs: 'Error al aprobar el pago',
      };
    }
  }

  /**
   * Manually process a refund
   */
  async processRefund(
    adminId: string,
    paymentId: string,
    reason: string,
    amount?: number
  ): Promise<RecoveryResult> {
    if (!(await this.verifyAdminPermission(adminId))) {
      return {
        success: false,
        error: 'Unauthorized',
        errorEs: 'No autorizado',
      };
    }

    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return {
        success: false,
        error: 'Payment not found',
        errorEs: 'Pago no encontrado',
      };
    }

    if (payment.status !== 'completed') {
      return {
        success: false,
        error: 'Only completed payments can be refunded',
        errorEs: 'Solo se pueden reembolsar pagos completados',
      };
    }

    const refundAmount = amount || payment.amount;
    const previousState = { status: payment.status, amount: payment.amount };

    try {
      await prisma.$transaction(async (tx) => {
        // Update payment status
        await tx.subscriptionPayment.update({
          where: { id: paymentId },
          data: {
            status: 'refunded',
            metadata: {
              ...(payment.metadata as object),
              refundedBy: adminId,
              refundAmount,
              refundReason: reason,
              refundedAt: new Date().toISOString(),
            },
          },
        });

        // Log refund event
        await tx.subscriptionEvent.create({
          data: {
            organizationId: payment.organizationId,
            subscriptionId: payment.subscriptionId,
            eventType: 'payment.refunded',
            eventData: {
              paymentId,
              refundAmount,
              reason,
              processedBy: adminId,
            } as Prisma.InputJsonValue,
            actorType: 'admin',
            actorId: adminId,
          },
        });
      });

      const newState = { status: 'refunded', refundAmount, processedBy: adminId };

      const actionId = await this.logAdminAction({
        adminId,
        actionType: 'manual_refund',
        targetType: 'payment',
        targetId: paymentId,
        reason,
        previousState,
        newState,
      });

      return {
        success: true,
        actionId,
        previousState,
        newState,
      };
    } catch (error) {
      console.error('[AdminRecovery] Refund processing failed:', error);
      Sentry.captureException(error);

      return {
        success: false,
        error: 'Failed to process refund',
        errorEs: 'Error al procesar el reembolso',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Block Override
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get blocked organizations
   */
  async getBlockedOrganizations(): Promise<PendingRecoveryItem[]> {
    const blocked = await prisma.organization.findMany({
      where: {
        blockType: { not: null },
      },
      select: {
        id: true,
        name: true,
        blockType: true,
        blockReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    type BlockedOrgEntry = (typeof blocked)[number];
    return blocked.map((org: BlockedOrgEntry) => ({
      id: org.id,
      type: 'block' as const,
      organizationId: org.id,
      organizationName: org.name,
      status: org.blockType || 'unknown',
      reason: org.blockReason || 'No reason specified',
      createdAt: org.createdAt,
    }));
  }

  /**
   * Override/remove a block
   */
  async overrideBlock(
    adminId: string,
    organizationId: string,
    reason: string
  ): Promise<RecoveryResult> {
    if (!(await this.verifyAdminPermission(adminId))) {
      return {
        success: false,
        error: 'Unauthorized',
        errorEs: 'No autorizado',
      };
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { blockType: true, blockReason: true },
    });

    if (!org) {
      return {
        success: false,
        error: 'Organization not found',
        errorEs: 'Organización no encontrada',
      };
    }

    const previousState = {
      blockType: org.blockType,
      blockReason: org.blockReason,
    };

    try {
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          blockType: null,
          blockReason: null,
        },
      });

      const newState = { blockType: null, overriddenBy: adminId };

      const actionId = await this.logAdminAction({
        adminId,
        actionType: 'block_override',
        targetType: 'organization',
        targetId: organizationId,
        reason,
        previousState,
        newState,
      });

      // Notify org owner
      const owner = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          role: 'owner',
        },
      });

      if (owner) {
        await prisma.notification.create({
          data: {
            userId: owner.userId,
            type: 'block_removed',
            title: 'Cuenta desbloqueada',
            message: 'Tu cuenta fue desbloqueada por un administrador. Ya podés acceder normalmente.',
            data: { organizationId } as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return {
        success: true,
        actionId,
        previousState,
        newState,
      };
    } catch (error) {
      console.error('[AdminRecovery] Block override failed:', error);
      Sentry.captureException(error);

      return {
        success: false,
        error: 'Failed to override block',
        errorEs: 'Error al desbloquear la cuenta',
      };
    }
  }

  /**
   * Manually apply a block
   */
  async applyBlock(
    adminId: string,
    organizationId: string,
    blockType: 'soft_block' | 'hard_block',
    reason: string
  ): Promise<RecoveryResult> {
    if (!(await this.verifyAdminPermission(adminId))) {
      return {
        success: false,
        error: 'Unauthorized',
        errorEs: 'No autorizado',
      };
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { blockType: true, blockReason: true },
    });

    if (!org) {
      return {
        success: false,
        error: 'Organization not found',
        errorEs: 'Organización no encontrada',
      };
    }

    const previousState = {
      blockType: org.blockType,
      blockReason: org.blockReason,
    };

    try {
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          blockType,
          blockReason: `[Admin: ${adminId}] ${reason}`,
        },
      });

      const newState = { blockType, reason, appliedBy: adminId };

      const actionId = await this.logAdminAction({
        adminId,
        actionType: 'block_apply',
        targetType: 'organization',
        targetId: organizationId,
        reason,
        previousState,
        newState,
      });

      // Notify org owner
      const owner = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          role: 'owner',
        },
      });

      if (owner) {
        await prisma.notification.create({
          data: {
            userId: owner.userId,
            type: 'account_blocked',
            title: 'Cuenta bloqueada',
            message: `Tu cuenta fue bloqueada: ${reason}. Contactá a soporte para más información.`,
            data: { organizationId, blockType } as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return {
        success: true,
        actionId,
        previousState,
        newState,
      };
    } catch (error) {
      console.error('[AdminRecovery] Block apply failed:', error);
      Sentry.captureException(error);

      return {
        success: false,
        error: 'Failed to apply block',
        errorEs: 'Error al bloquear la cuenta',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Verification Override
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Manually override verification status
   */
  async overrideVerificationStatus(
    adminId: string,
    organizationId: string,
    newStatus: 'pending' | 'in_review' | 'verified' | 'rejected',
    reason: string
  ): Promise<RecoveryResult> {
    if (!(await this.verifyAdminPermission(adminId))) {
      return {
        success: false,
        error: 'Unauthorized',
        errorEs: 'No autorizado',
      };
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { verificationStatus: true },
    });

    if (!org) {
      return {
        success: false,
        error: 'Organization not found',
        errorEs: 'Organización no encontrada',
      };
    }

    const previousState = { verificationStatus: org.verificationStatus };

    try {
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          verificationStatus: newStatus,
          ...(newStatus === 'verified' && { verificationCompletedAt: new Date() }),
        },
      });

      const newState = { verificationStatus: newStatus, overriddenBy: adminId };

      const actionId = await this.logAdminAction({
        adminId,
        actionType: 'verification_override',
        targetType: 'organization',
        targetId: organizationId,
        reason,
        previousState,
        newState,
      });

      return {
        success: true,
        actionId,
        previousState,
        newState,
      };
    } catch (error) {
      console.error('[AdminRecovery] Verification override failed:', error);
      Sentry.captureException(error);

      return {
        success: false,
        error: 'Failed to override verification',
        errorEs: 'Error al modificar la verificación',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Subscription Override
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Manually override subscription status
   */
  async overrideSubscription(
    adminId: string,
    organizationId: string,
    newTier: 'FREE' | 'INICIAL' | 'PROFESIONAL' | 'EMPRESA',
    newStatus: 'active' | 'trialing' | 'expired' | 'cancelled',
    reason: string,
    periodEndDays?: number
  ): Promise<RecoveryResult> {
    if (!(await this.verifyAdminPermission(adminId))) {
      return {
        success: false,
        error: 'Unauthorized',
        errorEs: 'No autorizado',
      };
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
      },
    });

    if (!org) {
      return {
        success: false,
        error: 'Organization not found',
        errorEs: 'Organización no encontrada',
      };
    }

    const previousState = {
      subscriptionTier: org.subscriptionTier,
      subscriptionStatus: org.subscriptionStatus,
    };

    try {
      const periodEnd = periodEndDays
        ? new Date(Date.now() + periodEndDays * 24 * 60 * 60 * 1000)
        : undefined;

      await prisma.$transaction(async (tx) => {
        // Update organization
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            subscriptionTier: newTier,
            subscriptionStatus: newStatus,
            // Remove blocks if activating
            ...(newStatus === 'active' && {
              blockType: null,
              blockReason: null,
            }),
          },
        });

        // Update or create subscription record
        const existingSub = await tx.organizationSubscription.findFirst({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
        });

        if (existingSub) {
          await tx.organizationSubscription.update({
            where: { id: existingSub.id },
            data: {
              tier: newTier,
              status: newStatus,
              ...(periodEnd && { currentPeriodEnd: periodEnd }),
            },
          });
        }
      });

      const newState = {
        subscriptionTier: newTier,
        subscriptionStatus: newStatus,
        overriddenBy: adminId,
        periodEnd: periodEndDays ? `+${periodEndDays} days` : undefined,
      };

      const actionId = await this.logAdminAction({
        adminId,
        actionType: 'subscription_override',
        targetType: 'organization',
        targetId: organizationId,
        reason,
        previousState,
        newState,
      });

      // Notify org owner
      const owner = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          role: 'owner',
        },
      });

      if (owner) {
        await prisma.notification.create({
          data: {
            userId: owner.userId,
            type: 'subscription_updated',
            title: 'Suscripción actualizada',
            message: `Tu suscripción fue actualizada a ${newTier} (${newStatus}).`,
            data: { organizationId, tier: newTier, status: newStatus } as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return {
        success: true,
        actionId,
        previousState,
        newState,
      };
    } catch (error) {
      console.error('[AdminRecovery] Subscription override failed:', error);
      Sentry.captureException(error);

      return {
        success: false,
        error: 'Failed to override subscription',
        errorEs: 'Error al modificar la suscripción',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Audit Log
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get admin action audit log
   */
  async getAuditLog(options?: {
    adminId?: string;
    actionType?: AdminActionType;
    targetId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AdminAction[]> {
    const events = await prisma.subscriptionEvent.findMany({
      where: {
        eventType: { startsWith: 'admin.' },
        ...(options?.adminId && {
          actorId: options.adminId,
        }),
        ...(options?.actionType && {
          eventType: `admin.${options.actionType}`,
        }),
        ...(options?.targetId && {
          organizationId: options.targetId,
        }),
        ...(options?.startDate || options?.endDate
          ? {
              createdAt: {
                ...(options.startDate && { gte: options.startDate }),
                ...(options.endDate && { lte: options.endDate }),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
    });

    type AdminEventEntry = (typeof events)[number];
    return events.map((event: AdminEventEntry) => {
      const data = event.eventData as Record<string, unknown>;
      return {
        id: event.id,
        adminId: data.adminId as string,
        actionType: event.eventType.replace('admin.', '') as AdminActionType,
        targetType: data.targetType as AdminAction['targetType'],
        targetId: data.targetId as string,
        reason: data.reason as string,
        previousState: data.previousState as Record<string, unknown>,
        newState: data.newState as Record<string, unknown>,
        createdAt: event.createdAt,
      };
    });
  }
}

// Export singleton
export const adminRecovery = new AdminRecoveryService();

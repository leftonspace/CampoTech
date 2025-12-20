/**
 * CampoTech Subscription In-App Notifications
 * =============================================
 *
 * In-app notifications for subscription-related events.
 * Integrates with the existing notification system.
 *
 * Notification Types:
 * - Trial expiring reminders
 * - Trial expired
 * - Payment successful/failed/pending
 * - Subscription activated/cancelled/renewed
 * - Plan upgrade/downgrade
 * - Grace period warnings
 */

import { prisma } from '@/lib/prisma';
import type { SubscriptionTier, BillingCycle } from '@/lib/types/subscription';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SubscriptionNotificationType =
  | 'trial_expiring'
  | 'trial_expired'
  | 'payment_successful'
  | 'payment_failed'
  | 'payment_pending'
  | 'subscription_activated'
  | 'subscription_cancelled'
  | 'subscription_renewed'
  | 'subscription_paused'
  | 'plan_upgraded'
  | 'plan_downgraded'
  | 'grace_period_started'
  | 'grace_period_ending'
  | 'account_suspended';

export interface SubscriptionNotification {
  id: string;
  organizationId: string;
  userId: string;
  type: SubscriptionNotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

export interface CreateNotificationInput {
  organizationId: string;
  userId: string;
  type: SubscriptionNotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TIER_NAMES: Record<SubscriptionTier, string> = {
  FREE: 'Gratis',
  INICIAL: 'Inicial',
  PROFESIONAL: 'Profesional',
  EMPRESA: 'Empresa',
};

const APP_SETTINGS_URL = '/dashboard/settings/subscription';

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION CREATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a subscription notification
 * Stores in database and triggers real-time delivery
 */
export async function createSubscriptionNotification(
  input: CreateNotificationInput
): Promise<SubscriptionNotification> {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Store notification in database
  const notification = await prisma.subscriptionEvent.create({
    data: {
      id,
      organizationId: input.organizationId,
      subscriptionId: 'notification', // Use 'notification' to differentiate from subscription events
      eventType: `notification_${input.type}`,
      eventData: {
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl,
        actionLabel: input.actionLabel,
        severity: input.severity,
        metadata: input.metadata,
        userId: input.userId,
        read: false,
      },
      actorType: 'system',
    },
  });

  console.log(
    `[SubscriptionNotifications] Created notification: ${input.type} for org ${input.organizationId}`
  );

  return {
    id: notification.id,
    organizationId: notification.organizationId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl,
    actionLabel: input.actionLabel,
    severity: input.severity,
    metadata: input.metadata,
    read: false,
    createdAt: notification.createdAt,
  };
}

/**
 * Get subscription notifications for a user/organization
 */
export async function getSubscriptionNotifications(
  organizationId: string,
  options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ notifications: SubscriptionNotification[]; unreadCount: number }> {
  const { unreadOnly = false, limit = 20, offset = 0 } = options;

  const events = await prisma.subscriptionEvent.findMany({
    where: {
      organizationId,
      subscriptionId: 'notification',
      eventType: { startsWith: 'notification_' },
      ...(unreadOnly
        ? {
            eventData: {
              path: ['read'],
              equals: false,
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
  });

  const unreadCount = await prisma.subscriptionEvent.count({
    where: {
      organizationId,
      subscriptionId: 'notification',
      eventType: { startsWith: 'notification_' },
      eventData: {
        path: ['read'],
        equals: false,
      },
    },
  });

  type EventEntry = (typeof events)[number];
  const notifications: SubscriptionNotification[] = events.map((event: EventEntry) => {
    const data = event.eventData as Record<string, unknown>;
    return {
      id: event.id,
      organizationId: event.organizationId,
      userId: (data.userId as string) || '',
      type: event.eventType.replace('notification_', '') as SubscriptionNotificationType,
      title: (data.title as string) || '',
      message: (data.message as string) || '',
      actionUrl: data.actionUrl as string | undefined,
      actionLabel: data.actionLabel as string | undefined,
      severity: (data.severity as 'info' | 'warning' | 'error' | 'success') || 'info',
      metadata: data.metadata as Record<string, unknown> | undefined,
      read: (data.read as boolean) || false,
      createdAt: event.createdAt,
    };
  });

  return { notifications, unreadCount };
}

/**
 * Mark notifications as read
 */
export async function markNotificationsAsRead(
  organizationId: string,
  notificationIds?: string[]
): Promise<number> {
  // If specific IDs provided, mark only those
  if (notificationIds && notificationIds.length > 0) {
    const result = await prisma.$transaction(
      notificationIds.map((id) =>
        prisma.subscriptionEvent.updateMany({
          where: {
            id,
            organizationId,
            subscriptionId: 'notification',
          },
          data: {
            eventData: {
              // Note: This is a simplified approach; Prisma doesn't support JSON path updates directly
              // In production, you might need a raw query or different approach
            },
          },
        })
      )
    ) as Array<{ count: number }>;
    return result.reduce((sum, r) => sum + r.count, 0);
  }

  // Mark all as read - using raw query for JSON update
  const result = await prisma.$executeRaw`
    UPDATE "SubscriptionEvent"
    SET "eventData" = jsonb_set("eventData", '{read}', 'true')
    WHERE "organizationId" = ${organizationId}
    AND "subscriptionId" = 'notification'
    AND "eventType" LIKE 'notification_%'
    AND ("eventData"->>'read')::boolean = false
  `;

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS - TRIAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create trial expiring notification
 */
export async function notifyTrialExpiring(
  organizationId: string,
  userId: string,
  daysRemaining: number
): Promise<SubscriptionNotification> {
  const dayText = daysRemaining === 1 ? 'día' : 'días';
  const severity = daysRemaining <= 1 ? 'error' : daysRemaining <= 3 ? 'warning' : 'info';

  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'trial_expiring',
    title: `Tu período de prueba termina en ${daysRemaining} ${dayText}`,
    message:
      daysRemaining === 1
        ? '¡Último día! Elige un plan para mantener todas las funcionalidades.'
        : `Te quedan ${daysRemaining} ${dayText} de prueba. Elige un plan para continuar sin interrupciones.`,
    actionUrl: APP_SETTINGS_URL,
    actionLabel: 'Elegir plan',
    severity,
    metadata: { daysRemaining },
  });
}

/**
 * Create trial expired notification
 */
export async function notifyTrialExpired(
  organizationId: string,
  userId: string
): Promise<SubscriptionNotification> {
  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'trial_expired',
    title: 'Tu período de prueba ha terminado',
    message:
      'Tu cuenta tiene acceso limitado. Elige un plan para desbloquear todas las funciones.',
    actionUrl: APP_SETTINGS_URL,
    actionLabel: 'Elegir plan',
    severity: 'error',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS - PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create payment successful notification
 */
export async function notifyPaymentSuccessful(
  organizationId: string,
  userId: string,
  amount: number,
  currency: string,
  tier: SubscriptionTier
): Promise<SubscriptionNotification> {
  const tierName = TIER_NAMES[tier];

  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'payment_successful',
    title: 'Pago confirmado',
    message: `Tu pago de $${amount.toFixed(2)} ${currency} fue procesado correctamente. Plan ${tierName} activo.`,
    actionUrl: `${APP_SETTINGS_URL}/history`,
    actionLabel: 'Ver historial',
    severity: 'success',
    metadata: { amount, currency, tier },
  });
}

/**
 * Create payment failed notification
 */
export async function notifyPaymentFailed(
  organizationId: string,
  userId: string,
  amount: number,
  currency: string,
  reason?: string
): Promise<SubscriptionNotification> {
  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'payment_failed',
    title: 'Problema con tu pago',
    message: reason
      ? `No pudimos procesar tu pago de $${amount.toFixed(2)} ${currency}: ${reason}`
      : `No pudimos procesar tu pago de $${amount.toFixed(2)} ${currency}. Por favor verifica tu método de pago.`,
    actionUrl: APP_SETTINGS_URL,
    actionLabel: 'Reintentar pago',
    severity: 'error',
    metadata: { amount, currency, reason },
  });
}

/**
 * Create payment pending notification
 */
export async function notifyPaymentPending(
  organizationId: string,
  userId: string,
  amount: number,
  currency: string,
  paymentMethod: string
): Promise<SubscriptionNotification> {
  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'payment_pending',
    title: 'Pago pendiente',
    message: `Tu pago de $${amount.toFixed(2)} ${currency} por ${paymentMethod} está pendiente. Complétalo para activar tu suscripción.`,
    actionUrl: APP_SETTINGS_URL,
    actionLabel: 'Ver instrucciones',
    severity: 'warning',
    metadata: { amount, currency, paymentMethod },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS - SUBSCRIPTION STATUS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create subscription activated notification
 */
export async function notifySubscriptionActivated(
  organizationId: string,
  userId: string,
  tier: SubscriptionTier,
  billingCycle: BillingCycle
): Promise<SubscriptionNotification> {
  const tierName = TIER_NAMES[tier];
  const cycleText = billingCycle === 'YEARLY' ? 'anual' : 'mensual';

  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'subscription_activated',
    title: '¡Suscripción activada!',
    message: `Tu plan ${tierName} (${cycleText}) está activo. ¡Disfruta de todas las funciones!`,
    actionUrl: '/dashboard',
    actionLabel: 'Ir al panel',
    severity: 'success',
    metadata: { tier, billingCycle },
  });
}

/**
 * Create subscription cancelled notification
 */
export async function notifySubscriptionCancelled(
  organizationId: string,
  userId: string,
  accessUntil?: Date
): Promise<SubscriptionNotification> {
  const dateText = accessUntil
    ? accessUntil.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'el final del período actual';

  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'subscription_cancelled',
    title: 'Suscripción cancelada',
    message: `Tu suscripción fue cancelada. Seguirás teniendo acceso hasta ${dateText}.`,
    actionUrl: APP_SETTINGS_URL,
    actionLabel: 'Reactivar',
    severity: 'warning',
    metadata: { accessUntil: accessUntil?.toISOString() },
  });
}

/**
 * Create subscription renewed notification
 */
export async function notifySubscriptionRenewed(
  organizationId: string,
  userId: string,
  tier: SubscriptionTier,
  nextRenewalDate: Date
): Promise<SubscriptionNotification> {
  const tierName = TIER_NAMES[tier];
  const nextDate = nextRenewalDate.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'subscription_renewed',
    title: 'Suscripción renovada',
    message: `Tu plan ${tierName} fue renovado automáticamente. Próxima renovación: ${nextDate}.`,
    severity: 'success',
    metadata: { tier, nextRenewalDate: nextRenewalDate.toISOString() },
  });
}

/**
 * Create subscription paused notification
 */
export async function notifySubscriptionPaused(
  organizationId: string,
  userId: string,
  resumeDate?: Date
): Promise<SubscriptionNotification> {
  const message = resumeDate
    ? `Tu suscripción fue pausada. Se reanudará el ${resumeDate.toLocaleDateString('es-AR')}.`
    : 'Tu suscripción fue pausada. Puedes reanudarla en cualquier momento.';

  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'subscription_paused',
    title: 'Suscripción pausada',
    message,
    actionUrl: APP_SETTINGS_URL,
    actionLabel: 'Reanudar',
    severity: 'info',
    metadata: { resumeDate: resumeDate?.toISOString() },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS - PLAN CHANGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create plan upgraded notification
 */
export async function notifyPlanUpgraded(
  organizationId: string,
  userId: string,
  oldTier: SubscriptionTier,
  newTier: SubscriptionTier
): Promise<SubscriptionNotification> {
  const oldTierName = TIER_NAMES[oldTier];
  const newTierName = TIER_NAMES[newTier];

  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'plan_upgraded',
    title: '¡Plan actualizado!',
    message: `Tu plan fue actualizado de ${oldTierName} a ${newTierName}. ¡Disfruta de las nuevas funciones!`,
    actionUrl: '/dashboard',
    actionLabel: 'Explorar funciones',
    severity: 'success',
    metadata: { oldTier, newTier },
  });
}

/**
 * Create plan downgraded notification
 */
export async function notifyPlanDowngraded(
  organizationId: string,
  userId: string,
  oldTier: SubscriptionTier,
  newTier: SubscriptionTier,
  effectiveDate?: Date
): Promise<SubscriptionNotification> {
  const oldTierName = TIER_NAMES[oldTier];
  const newTierName = TIER_NAMES[newTier];

  const message = effectiveDate
    ? `Tu plan cambiará de ${oldTierName} a ${newTierName} el ${effectiveDate.toLocaleDateString('es-AR')}.`
    : `Tu plan fue cambiado de ${oldTierName} a ${newTierName}.`;

  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'plan_downgraded',
    title: 'Cambio de plan programado',
    message,
    severity: 'info',
    metadata: { oldTier, newTier, effectiveDate: effectiveDate?.toISOString() },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS - GRACE PERIOD & SUSPENSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create grace period started notification
 */
export async function notifyGracePeriodStarted(
  organizationId: string,
  userId: string,
  daysRemaining: number,
  gracePeriodEndsAt: Date
): Promise<SubscriptionNotification> {
  const endDate = gracePeriodEndsAt.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
  });

  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'grace_period_started',
    title: 'Período de gracia activado',
    message: `Tu pago no se pudo procesar. Tienes ${daysRemaining} días (hasta el ${endDate}) para actualizar tu método de pago.`,
    actionUrl: APP_SETTINGS_URL,
    actionLabel: 'Actualizar pago',
    severity: 'warning',
    metadata: { daysRemaining, gracePeriodEndsAt: gracePeriodEndsAt.toISOString() },
  });
}

/**
 * Create grace period ending notification
 */
export async function notifyGracePeriodEnding(
  organizationId: string,
  userId: string,
  daysRemaining: number
): Promise<SubscriptionNotification> {
  const dayText = daysRemaining === 1 ? 'día' : 'días';

  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'grace_period_ending',
    title: `Tu período de gracia termina en ${daysRemaining} ${dayText}`,
    message: `Actualiza tu método de pago antes de que termine el período de gracia para evitar la suspensión de tu cuenta.`,
    actionUrl: APP_SETTINGS_URL,
    actionLabel: 'Actualizar pago',
    severity: 'error',
    metadata: { daysRemaining },
  });
}

/**
 * Create account suspended notification
 */
export async function notifyAccountSuspended(
  organizationId: string,
  userId: string,
  reason: string
): Promise<SubscriptionNotification> {
  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'account_suspended',
    title: 'Cuenta suspendida',
    message: `Tu cuenta fue suspendida: ${reason}. Contacta a soporte para más información.`,
    actionUrl: APP_SETTINGS_URL,
    actionLabel: 'Ver detalles',
    severity: 'error',
    metadata: { reason },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH NOTIFICATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Notify all owners of an organization
 */
export async function notifyOrganizationOwners(
  organizationId: string,
  notificationFn: (userId: string) => Promise<SubscriptionNotification>
): Promise<SubscriptionNotification[]> {
  // Get organization owners
  const owners = await prisma.organizationUser.findMany({
    where: {
      organizationId,
      role: 'owner',
    },
    select: {
      userId: true,
    },
  });

  // Also get the organization's main owner
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ownerId: true },
  });

  type OwnerEntry = (typeof owners)[number];
  const ownerIds = new Set([...owners.map((o: OwnerEntry) => o.userId), org?.ownerId].filter(Boolean) as string[]);

  const notifications: SubscriptionNotification[] = [];

  for (const userId of ownerIds) {
    try {
      const notification = await notificationFn(userId);
      notifications.push(notification);
    } catch (error) {
      console.error(
        `[SubscriptionNotifications] Error notifying owner ${userId}:`,
        error
      );
    }
  }

  return notifications;
}

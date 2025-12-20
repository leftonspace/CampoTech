/**
 * CampoTech Verification In-App Notifications
 * =============================================
 *
 * In-app notifications for verification-related events.
 * Integrates with the existing notification system.
 *
 * Notification Types:
 * - Document status changes (approved, rejected, expiring, expired)
 * - Verification complete
 * - Account blocked/unblocked
 * - Employee compliance alerts
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type VerificationNotificationType =
  | 'document_expiring'
  | 'document_expired'
  | 'document_approved'
  | 'document_rejected'
  | 'verification_complete'
  | 'verification_incomplete'
  | 'account_blocked'
  | 'account_unblocked'
  | 'employee_doc_expiring'
  | 'employee_compliance_alert'
  | 'employee_verified'
  | 'employee_not_verified'
  | 'afip_status_changed'
  | 'badge_earned';

export interface VerificationNotification {
  id: string;
  organizationId: string;
  userId: string;
  type: VerificationNotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

export interface CreateVerificationNotificationInput {
  organizationId: string;
  userId: string;
  type: VerificationNotificationType;
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

const VERIFICATION_URL = '/dashboard/verificacion';
const EMPLOYEE_VERIFICATION_URL = '/dashboard/mi-verificacion';

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION CREATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a verification notification
 * Stores in database using SubscriptionEvent table with 'verification_notification' marker
 */
export async function createVerificationNotification(
  input: CreateVerificationNotificationInput
): Promise<VerificationNotification> {
  const id = `vnotif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Store notification in database
  const notification = await prisma.subscriptionEvent.create({
    data: {
      id,
      organizationId: input.organizationId,
      subscriptionId: 'verification_notification', // Use this to differentiate from subscription events
      eventType: `verification_${input.type}`,
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
    `[VerificationNotifications] Created notification: ${input.type} for org ${input.organizationId}`
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
 * Get verification notifications for a user/organization
 */
export async function getVerificationNotifications(
  organizationId: string,
  options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ notifications: VerificationNotification[]; unreadCount: number }> {
  const { unreadOnly = false, limit = 20, offset = 0 } = options;

  const events = await prisma.subscriptionEvent.findMany({
    where: {
      organizationId,
      subscriptionId: 'verification_notification',
      eventType: { startsWith: 'verification_' },
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
      subscriptionId: 'verification_notification',
      eventType: { startsWith: 'verification_' },
      eventData: {
        path: ['read'],
        equals: false,
      },
    },
  });

  const notifications: VerificationNotification[] = events.map((event) => {
    const data = event.eventData as Record<string, unknown>;
    return {
      id: event.id,
      organizationId: event.organizationId,
      userId: (data.userId as string) || '',
      type: event.eventType.replace('verification_', '') as VerificationNotificationType,
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
 * Mark verification notifications as read
 */
export async function markVerificationNotificationsAsRead(
  organizationId: string,
  notificationIds?: string[]
): Promise<number> {
  // If specific IDs provided, mark only those using raw query
  if (notificationIds && notificationIds.length > 0) {
    const result = await prisma.$executeRaw`
      UPDATE "SubscriptionEvent"
      SET "eventData" = jsonb_set("eventData", '{read}', 'true')
      WHERE "id" = ANY(${notificationIds})
      AND "organizationId" = ${organizationId}
      AND "subscriptionId" = 'verification_notification'
    `;
    return result;
  }

  // Mark all as read
  const result = await prisma.$executeRaw`
    UPDATE "SubscriptionEvent"
    SET "eventData" = jsonb_set("eventData", '{read}', 'true')
    WHERE "organizationId" = ${organizationId}
    AND "subscriptionId" = 'verification_notification'
    AND "eventType" LIKE 'verification_%'
    AND ("eventData"->>'read')::boolean = false
  `;

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS - DOCUMENT STATUS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create document expiring notification
 */
export async function notifyDocumentExpiring(
  organizationId: string,
  userId: string,
  documentName: string,
  daysRemaining: number
): Promise<VerificationNotification> {
  const dayText = daysRemaining === 1 ? 'día' : 'días';
  const severity = daysRemaining <= 1 ? 'error' : daysRemaining <= 7 ? 'warning' : 'info';

  return createVerificationNotification({
    organizationId,
    userId,
    type: 'document_expiring',
    title: `Documento por vencer: ${documentName}`,
    message:
      daysRemaining === 1
        ? `¡Tu ${documentName} vence mañana! Actualízalo para evitar bloqueos.`
        : `Tu ${documentName} vence en ${daysRemaining} ${dayText}. Actualízalo pronto.`,
    actionUrl: VERIFICATION_URL,
    actionLabel: 'Actualizar',
    severity,
    metadata: { documentName, daysRemaining },
  });
}

/**
 * Create document expired notification
 */
export async function notifyDocumentExpired(
  organizationId: string,
  userId: string,
  documentName: string
): Promise<VerificationNotification> {
  return createVerificationNotification({
    organizationId,
    userId,
    type: 'document_expired',
    title: `Documento vencido: ${documentName}`,
    message: `Tu ${documentName} ha vencido. Actualízalo lo antes posible para mantener tu verificación activa.`,
    actionUrl: VERIFICATION_URL,
    actionLabel: 'Actualizar',
    severity: 'error',
    metadata: { documentName },
  });
}

/**
 * Create document approved notification
 */
export async function notifyDocumentApproved(
  organizationId: string,
  userId: string,
  documentName: string,
  badgeEarned?: { label: string; icon: string }
): Promise<VerificationNotification> {
  const title = badgeEarned
    ? `Documento aprobado + Nueva insignia`
    : `Documento aprobado: ${documentName}`;

  const message = badgeEarned
    ? `Tu ${documentName} fue aprobado. ¡Ganaste la insignia "${badgeEarned.label}"!`
    : `Tu ${documentName} fue verificado y aprobado correctamente.`;

  return createVerificationNotification({
    organizationId,
    userId,
    type: 'document_approved',
    title,
    message,
    actionUrl: VERIFICATION_URL,
    actionLabel: 'Ver verificación',
    severity: 'success',
    metadata: { documentName, badgeEarned },
  });
}

/**
 * Create document rejected notification
 */
export async function notifyDocumentRejected(
  organizationId: string,
  userId: string,
  documentName: string,
  reason: string
): Promise<VerificationNotification> {
  return createVerificationNotification({
    organizationId,
    userId,
    type: 'document_rejected',
    title: `Documento rechazado: ${documentName}`,
    message: `Tu ${documentName} fue rechazado: ${reason}. Por favor, vuelve a subirlo.`,
    actionUrl: VERIFICATION_URL,
    actionLabel: 'Corregir',
    severity: 'error',
    metadata: { documentName, reason },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS - VERIFICATION STATUS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create verification complete notification
 */
export async function notifyVerificationComplete(
  organizationId: string,
  userId: string
): Promise<VerificationNotification> {
  return createVerificationNotification({
    organizationId,
    userId,
    type: 'verification_complete',
    title: '¡Verificación completa!',
    message: 'Tu negocio está verificado y listo para operar. Ya podés recibir trabajos.',
    actionUrl: '/dashboard',
    actionLabel: 'Ir al panel',
    severity: 'success',
  });
}

/**
 * Create verification incomplete notification
 */
export async function notifyVerificationIncomplete(
  organizationId: string,
  userId: string,
  pendingCount: number
): Promise<VerificationNotification> {
  return createVerificationNotification({
    organizationId,
    userId,
    type: 'verification_incomplete',
    title: 'Verificación incompleta',
    message: `Tenés ${pendingCount} ${pendingCount === 1 ? 'documento pendiente' : 'documentos pendientes'} para completar tu verificación.`,
    actionUrl: VERIFICATION_URL,
    actionLabel: 'Completar',
    severity: 'warning',
    metadata: { pendingCount },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS - ACCOUNT STATUS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create account blocked notification
 */
export async function notifyAccountBlocked(
  organizationId: string,
  userId: string,
  reason: string
): Promise<VerificationNotification> {
  return createVerificationNotification({
    organizationId,
    userId,
    type: 'account_blocked',
    title: 'Cuenta bloqueada',
    message: `Tu cuenta fue bloqueada: ${reason}. Resuelve el problema para continuar operando.`,
    actionUrl: VERIFICATION_URL,
    actionLabel: 'Resolver',
    severity: 'error',
    metadata: { reason },
  });
}

/**
 * Create account unblocked notification
 */
export async function notifyAccountUnblocked(
  organizationId: string,
  userId: string
): Promise<VerificationNotification> {
  return createVerificationNotification({
    organizationId,
    userId,
    type: 'account_unblocked',
    title: 'Cuenta desbloqueada',
    message: 'Tu cuenta fue desbloqueada. Ya podés volver a recibir trabajos.',
    actionUrl: '/dashboard',
    actionLabel: 'Ir al panel',
    severity: 'success',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS - EMPLOYEE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create employee document expiring notification (for owner)
 */
export async function notifyEmployeeDocExpiring(
  organizationId: string,
  ownerId: string,
  employeeName: string,
  documentName: string,
  daysRemaining: number
): Promise<VerificationNotification> {
  const dayText = daysRemaining === 1 ? 'mañana' : `en ${daysRemaining} días`;
  const severity = daysRemaining <= 7 ? 'warning' : 'info';

  return createVerificationNotification({
    organizationId,
    userId: ownerId,
    type: 'employee_doc_expiring',
    title: `Documento de empleado por vencer`,
    message: `El ${documentName} de ${employeeName} vence ${dayText}.`,
    actionUrl: `${VERIFICATION_URL}/empleados`,
    actionLabel: 'Ver empleados',
    severity,
    metadata: { employeeName, documentName, daysRemaining },
  });
}

/**
 * Create employee compliance alert notification (for owner)
 */
export async function notifyEmployeeComplianceAlert(
  organizationId: string,
  ownerId: string,
  affectedEmployeesCount: number
): Promise<VerificationNotification> {
  return createVerificationNotification({
    organizationId,
    userId: ownerId,
    type: 'employee_compliance_alert',
    title: 'Alerta de cumplimiento de empleados',
    message: `${affectedEmployeesCount} ${affectedEmployeesCount === 1 ? 'empleado tiene' : 'empleados tienen'} problemas de verificación que requieren atención.`,
    actionUrl: `${VERIFICATION_URL}/empleados`,
    actionLabel: 'Ver empleados',
    severity: 'error',
    metadata: { affectedEmployeesCount },
  });
}

/**
 * Create employee verified notification (for owner)
 */
export async function notifyEmployeeVerified(
  organizationId: string,
  ownerId: string,
  employeeName: string
): Promise<VerificationNotification> {
  return createVerificationNotification({
    organizationId,
    userId: ownerId,
    type: 'employee_verified',
    title: 'Empleado verificado',
    message: `${employeeName} completó su verificación. Ya puede ser asignado a trabajos.`,
    actionUrl: `${VERIFICATION_URL}/empleados`,
    actionLabel: 'Ver empleados',
    severity: 'success',
    metadata: { employeeName },
  });
}

/**
 * Create employee not verified notification (for employee)
 */
export async function notifyEmployeeNotVerified(
  organizationId: string,
  employeeId: string,
  pendingCount: number
): Promise<VerificationNotification> {
  return createVerificationNotification({
    organizationId,
    userId: employeeId,
    type: 'employee_not_verified',
    title: 'Completa tu verificación',
    message: `Tenés ${pendingCount} ${pendingCount === 1 ? 'documento pendiente' : 'documentos pendientes'}. Completá tu verificación para poder ser asignado a trabajos.`,
    actionUrl: EMPLOYEE_VERIFICATION_URL,
    actionLabel: 'Completar',
    severity: 'warning',
    metadata: { pendingCount },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS - AFIP & BADGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create AFIP status changed notification
 */
export async function notifyAFIPStatusChanged(
  organizationId: string,
  userId: string,
  newStatus: 'active' | 'inactive',
  previousStatus: 'active' | 'inactive'
): Promise<VerificationNotification> {
  const isNowInactive = newStatus === 'inactive';

  return createVerificationNotification({
    organizationId,
    userId,
    type: 'afip_status_changed',
    title: isNowInactive ? 'Estado AFIP: Inactivo' : 'Estado AFIP: Activo',
    message: isNowInactive
      ? 'Tu estado en AFIP cambió a inactivo. Esto puede afectar tu capacidad de operar.'
      : 'Tu estado en AFIP volvió a estar activo. Tu verificación fue restaurada.',
    actionUrl: VERIFICATION_URL,
    actionLabel: 'Ver detalles',
    severity: isNowInactive ? 'error' : 'success',
    metadata: { newStatus, previousStatus },
  });
}

/**
 * Create badge earned notification
 */
export async function notifyBadgeEarned(
  organizationId: string,
  userId: string,
  badgeLabel: string,
  badgeIcon: string
): Promise<VerificationNotification> {
  return createVerificationNotification({
    organizationId,
    userId,
    type: 'badge_earned',
    title: `¡Nueva insignia: ${badgeLabel}!`,
    message: `Ganaste la insignia "${badgeLabel}". Esta aparecerá en tu perfil público.`,
    actionUrl: VERIFICATION_URL,
    actionLabel: 'Ver insignias',
    severity: 'success',
    metadata: { badgeLabel, badgeIcon },
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
  notificationFn: (userId: string) => Promise<VerificationNotification>
): Promise<VerificationNotification[]> {
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

  const ownerIds = new Set([...owners.map((o) => o.userId), org?.ownerId].filter(Boolean) as string[]);

  const notifications: VerificationNotification[] = [];

  for (const userId of ownerIds) {
    try {
      const notification = await notificationFn(userId);
      notifications.push(notification);
    } catch (error) {
      console.error(
        `[VerificationNotifications] Error notifying owner ${userId}:`,
        error
      );
    }
  }

  return notifications;
}

/**
 * Get combined notifications (verification + subscription) for dashboard
 */
export async function getAllNotifications(
  organizationId: string,
  options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  notifications: Array<VerificationNotification | { type: string; [key: string]: unknown }>;
  unreadCount: number;
}> {
  const { unreadOnly = false, limit = 20, offset = 0 } = options;

  const events = await prisma.subscriptionEvent.findMany({
    where: {
      organizationId,
      subscriptionId: {
        in: ['notification', 'verification_notification'],
      },
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
      subscriptionId: {
        in: ['notification', 'verification_notification'],
      },
      eventData: {
        path: ['read'],
        equals: false,
      },
    },
  });

  const notifications = events.map((event) => {
    const data = event.eventData as Record<string, unknown>;
    const isVerification = event.subscriptionId === 'verification_notification';

    return {
      id: event.id,
      organizationId: event.organizationId,
      userId: (data.userId as string) || '',
      type: event.eventType.replace(isVerification ? 'verification_' : 'notification_', ''),
      category: isVerification ? 'verification' : 'subscription',
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
 * Mark all notifications (verification + subscription) as read
 */
export async function markAllNotificationsAsRead(
  organizationId: string
): Promise<number> {
  const result = await prisma.$executeRaw`
    UPDATE "SubscriptionEvent"
    SET "eventData" = jsonb_set("eventData", '{read}', 'true')
    WHERE "organizationId" = ${organizationId}
    AND "subscriptionId" IN ('notification', 'verification_notification')
    AND ("eventData"->>'read')::boolean = false
  `;

  return result;
}

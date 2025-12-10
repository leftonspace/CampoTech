/**
 * Notification Preferences Service
 * =================================
 *
 * Manages customer notification preferences for tracking updates.
 * Supports multiple channels: email, SMS, push, WhatsApp.
 */

import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type NotificationChannel = 'email' | 'sms' | 'push' | 'whatsapp';

export type NotificationEventType =
  | 'job_scheduled'
  | 'job_confirmed'
  | 'technician_assigned'
  | 'technician_en_route'
  | 'technician_arrived'
  | 'job_started'
  | 'job_completed'
  | 'job_cancelled'
  | 'eta_update'
  | 'invoice_created'
  | 'payment_received'
  | 'payment_reminder'
  | 'ticket_reply'
  | 'promotion';

export interface NotificationPreference {
  eventType: NotificationEventType;
  channels: NotificationChannel[];
  enabled: boolean;
}

export interface CustomerNotificationPreferences {
  customerId: string;
  organizationId: string;
  globalEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string; // HH:mm format
  preferences: NotificationPreference[];
  pushToken?: string;
  whatsappOptIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Default notification preferences for new customers
const DEFAULT_PREFERENCES: NotificationPreference[] = [
  { eventType: 'job_scheduled', channels: ['email', 'whatsapp'], enabled: true },
  { eventType: 'job_confirmed', channels: ['email', 'whatsapp'], enabled: true },
  { eventType: 'technician_assigned', channels: ['whatsapp'], enabled: true },
  { eventType: 'technician_en_route', channels: ['push', 'whatsapp'], enabled: true },
  { eventType: 'technician_arrived', channels: ['push', 'whatsapp'], enabled: true },
  { eventType: 'job_started', channels: ['push'], enabled: true },
  { eventType: 'job_completed', channels: ['email', 'whatsapp'], enabled: true },
  { eventType: 'job_cancelled', channels: ['email', 'whatsapp', 'sms'], enabled: true },
  { eventType: 'eta_update', channels: ['push'], enabled: true },
  { eventType: 'invoice_created', channels: ['email', 'whatsapp'], enabled: true },
  { eventType: 'payment_received', channels: ['email', 'whatsapp'], enabled: true },
  { eventType: 'payment_reminder', channels: ['email', 'whatsapp'], enabled: true },
  { eventType: 'ticket_reply', channels: ['email', 'push'], enabled: true },
  { eventType: 'promotion', channels: ['email'], enabled: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get customer notification preferences
 */
export async function getNotificationPreferences(
  customerId: string,
  organizationId: string
): Promise<CustomerNotificationPreferences> {
  try {
    const existing = await prisma.customerNotificationPreference.findUnique({
      where: {
        customerId_organizationId: {
          customerId,
          organizationId,
        },
      },
    });

    if (existing) {
      return {
        customerId: existing.customerId,
        organizationId: existing.organizationId,
        globalEnabled: existing.globalEnabled,
        quietHoursEnabled: existing.quietHoursEnabled,
        quietHoursStart: existing.quietHoursStart || undefined,
        quietHoursEnd: existing.quietHoursEnd || undefined,
        preferences: existing.preferences as NotificationPreference[],
        pushToken: existing.pushToken || undefined,
        whatsappOptIn: existing.whatsappOptIn,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }

    // Return default preferences if none exist
    return {
      customerId,
      organizationId,
      globalEnabled: true,
      quietHoursEnabled: false,
      preferences: DEFAULT_PREFERENCES,
      whatsappOptIn: true, // Argentina: WhatsApp is primary
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    log.error('Error getting notification preferences', { customerId, error });
    throw error;
  }
}

/**
 * Update customer notification preferences
 */
export async function updateNotificationPreferences(
  customerId: string,
  organizationId: string,
  updates: Partial<{
    globalEnabled: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    preferences: NotificationPreference[];
    pushToken: string;
    whatsappOptIn: boolean;
  }>
): Promise<CustomerNotificationPreferences> {
  try {
    const result = await prisma.customerNotificationPreference.upsert({
      where: {
        customerId_organizationId: {
          customerId,
          organizationId,
        },
      },
      create: {
        customerId,
        organizationId,
        globalEnabled: updates.globalEnabled ?? true,
        quietHoursEnabled: updates.quietHoursEnabled ?? false,
        quietHoursStart: updates.quietHoursStart,
        quietHoursEnd: updates.quietHoursEnd,
        preferences: updates.preferences ?? DEFAULT_PREFERENCES,
        pushToken: updates.pushToken,
        whatsappOptIn: updates.whatsappOptIn ?? true,
      },
      update: {
        globalEnabled: updates.globalEnabled,
        quietHoursEnabled: updates.quietHoursEnabled,
        quietHoursStart: updates.quietHoursStart,
        quietHoursEnd: updates.quietHoursEnd,
        preferences: updates.preferences,
        pushToken: updates.pushToken,
        whatsappOptIn: updates.whatsappOptIn,
        updatedAt: new Date(),
      },
    });

    log.info('Updated notification preferences', { customerId, organizationId });

    return {
      customerId: result.customerId,
      organizationId: result.organizationId,
      globalEnabled: result.globalEnabled,
      quietHoursEnabled: result.quietHoursEnabled,
      quietHoursStart: result.quietHoursStart || undefined,
      quietHoursEnd: result.quietHoursEnd || undefined,
      preferences: result.preferences as NotificationPreference[],
      pushToken: result.pushToken || undefined,
      whatsappOptIn: result.whatsappOptIn,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  } catch (error) {
    log.error('Error updating notification preferences', { customerId, error });
    throw error;
  }
}

/**
 * Update a single notification preference
 */
export async function updateSinglePreference(
  customerId: string,
  organizationId: string,
  eventType: NotificationEventType,
  update: {
    channels?: NotificationChannel[];
    enabled?: boolean;
  }
): Promise<CustomerNotificationPreferences> {
  const current = await getNotificationPreferences(customerId, organizationId);

  const updatedPreferences = current.preferences.map((pref) => {
    if (pref.eventType === eventType) {
      return {
        ...pref,
        channels: update.channels ?? pref.channels,
        enabled: update.enabled ?? pref.enabled,
      };
    }
    return pref;
  });

  return updateNotificationPreferences(customerId, organizationId, {
    preferences: updatedPreferences,
  });
}

/**
 * Register push notification token
 */
export async function registerPushToken(
  customerId: string,
  organizationId: string,
  pushToken: string
): Promise<void> {
  await updateNotificationPreferences(customerId, organizationId, { pushToken });
  log.info('Registered push token', { customerId, organizationId });
}

/**
 * Unregister push notification token
 */
export async function unregisterPushToken(
  customerId: string,
  organizationId: string
): Promise<void> {
  await prisma.customerNotificationPreference.update({
    where: {
      customerId_organizationId: {
        customerId,
        organizationId,
      },
    },
    data: {
      pushToken: null,
    },
  });
  log.info('Unregistered push token', { customerId, organizationId });
}

/**
 * Check if customer should receive notification for event type
 */
export async function shouldNotify(
  customerId: string,
  organizationId: string,
  eventType: NotificationEventType,
  channel: NotificationChannel
): Promise<boolean> {
  try {
    const prefs = await getNotificationPreferences(customerId, organizationId);

    // Check global enabled
    if (!prefs.globalEnabled) return false;

    // Check quiet hours
    if (prefs.quietHoursEnabled && prefs.quietHoursStart && prefs.quietHoursEnd) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      if (currentTime >= prefs.quietHoursStart && currentTime <= prefs.quietHoursEnd) {
        // Allow critical notifications during quiet hours
        const criticalEvents: NotificationEventType[] = ['job_cancelled', 'technician_en_route'];
        if (!criticalEvents.includes(eventType)) {
          return false;
        }
      }
    }

    // Check WhatsApp opt-in
    if (channel === 'whatsapp' && !prefs.whatsappOptIn) return false;

    // Check specific event preference
    const eventPref = prefs.preferences.find((p) => p.eventType === eventType);
    if (!eventPref) return true; // Default to allow if not configured

    if (!eventPref.enabled) return false;
    if (!eventPref.channels.includes(channel)) return false;

    return true;
  } catch (error) {
    log.error('Error checking notification preference', { customerId, eventType, channel, error });
    return true; // Default to allow on error
  }
}

/**
 * Get customers who should receive a notification
 */
export async function getNotifiableCustomers(
  organizationId: string,
  eventType: NotificationEventType,
  channel: NotificationChannel,
  customerIds?: string[]
): Promise<string[]> {
  try {
    const whereClause: any = {
      organizationId,
      globalEnabled: true,
    };

    if (customerIds && customerIds.length > 0) {
      whereClause.customerId = { in: customerIds };
    }

    if (channel === 'whatsapp') {
      whereClause.whatsappOptIn = true;
    }

    if (channel === 'push') {
      whereClause.pushToken = { not: null };
    }

    const prefs = await prisma.customerNotificationPreference.findMany({
      where: whereClause,
      select: {
        customerId: true,
        preferences: true,
      },
    });

    return prefs
      .filter((pref) => {
        const eventPref = (pref.preferences as NotificationPreference[]).find(
          (p) => p.eventType === eventType
        );
        if (!eventPref) return true;
        return eventPref.enabled && eventPref.channels.includes(channel);
      })
      .map((pref) => pref.customerId);
  } catch (error) {
    log.error('Error getting notifiable customers', { organizationId, eventType, channel, error });
    return [];
  }
}

/**
 * Opt in/out of WhatsApp notifications
 */
export async function setWhatsAppOptIn(
  customerId: string,
  organizationId: string,
  optIn: boolean
): Promise<void> {
  await updateNotificationPreferences(customerId, organizationId, { whatsappOptIn: optIn });
  log.info('Updated WhatsApp opt-in', { customerId, organizationId, optIn });
}

/**
 * Get default preferences for new customers
 */
export function getDefaultPreferences(): NotificationPreference[] {
  return [...DEFAULT_PREFERENCES];
}

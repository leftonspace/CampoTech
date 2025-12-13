/**
 * Notification Service
 * ====================
 *
 * Phase 9.6: Notification Preferences System
 * Central service for multi-channel notification delivery.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { QueueManager } from '../../lib/queue/queue-manager';
import { sendTemplateMessage, buildTemplateWithParams } from '../../integrations/whatsapp/messages/template.sender';
import { getWhatsAppConfig } from '../../integrations/whatsapp/whatsapp.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type NotificationEventType =
  | 'job_assigned'
  | 'job_updated'
  | 'job_reminder'
  | 'job_completed'
  | 'job_cancelled'
  | 'invoice_created'
  | 'invoice_sent'
  | 'payment_received'
  | 'payment_failed'
  | 'team_member_added'
  | 'team_member_removed'
  | 'schedule_change'
  | 'system_alert'
  | 'custom';

export type NotificationChannel = 'web' | 'push' | 'sms' | 'email' | 'whatsapp';

export type ChannelRestriction = 'sms_only' | 'whatsapp_preferred' | 'any';

export interface NotificationPayload {
  eventType: NotificationEventType;
  userId: string;
  organizationId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  channels?: NotificationChannel[];
  templateName?: string;
  templateParams?: Record<string, string>;
}

export interface NotificationPreferences {
  webEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  eventPreferences: Record<string, Record<string, boolean>>;
  reminderIntervals: number[];
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHANNEL RESTRICTIONS (Argentine WhatsApp-first)
// ═══════════════════════════════════════════════════════════════════════════════

const CHANNEL_RESTRICTIONS: Record<NotificationEventType, ChannelRestriction> = {
  job_assigned: 'whatsapp_preferred',
  job_updated: 'whatsapp_preferred',
  job_reminder: 'whatsapp_preferred',
  job_completed: 'whatsapp_preferred',
  job_cancelled: 'whatsapp_preferred',
  invoice_created: 'whatsapp_preferred',
  invoice_sent: 'whatsapp_preferred',
  payment_received: 'whatsapp_preferred',
  payment_failed: 'whatsapp_preferred',
  team_member_added: 'whatsapp_preferred',
  team_member_removed: 'whatsapp_preferred',
  schedule_change: 'whatsapp_preferred',
  system_alert: 'any',
  custom: 'any',
};

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION DELIVERY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send notification to user based on their preferences
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const { eventType, userId, organizationId, title, body, data, entityType, entityId } = payload;

  try {
    // Get user preferences
    const preferences = await getUserPreferences(userId);
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { phone: true, whatsappNumber: true, email: true, pushToken: true },
    });

    if (!user) {
      log.warn('User not found for notification', { userId });
      return;
    }

    // Check quiet hours
    if (preferences.quietHoursEnabled && isInQuietHours(preferences)) {
      log.debug('Notification deferred due to quiet hours', { userId, eventType });
      // Queue for later delivery
      await queueDeferredNotification(payload, preferences);
      return;
    }

    // Get enabled channels for this event type
    const eventPrefs = preferences.eventPreferences[eventType] || {};
    const channelsToUse = getEnabledChannels(preferences, eventPrefs, eventType);

    // Deliver to each enabled channel
    for (const channel of channelsToUse) {
      await deliverToChannel(channel, {
        ...payload,
        user,
        preferences,
      });
    }
  } catch (error) {
    log.error('Error sending notification', {
      userId,
      eventType,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Get user notification preferences
 */
export async function getUserPreferences(userId: string): Promise<NotificationPreferences> {
  const prefs = await db.notificationPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) {
    // Return Argentine defaults (WhatsApp-first)
    return getDefaultPreferences();
  }

  return {
    webEnabled: prefs.webEnabled,
    pushEnabled: prefs.pushEnabled,
    smsEnabled: prefs.smsEnabled,
    emailEnabled: prefs.emailEnabled,
    whatsappEnabled: prefs.whatsappEnabled,
    eventPreferences: prefs.eventPreferences as Record<string, Record<string, boolean>>,
    reminderIntervals: prefs.reminderIntervals as number[],
    quietHoursEnabled: prefs.quietHoursEnabled,
    quietHoursStart: prefs.quietHoursStart?.toString() || '22:00',
    quietHoursEnd: prefs.quietHoursEnd?.toString() || '08:00',
    quietHoursTimezone: prefs.quietHoursTimezone,
  };
}

/**
 * Update user notification preferences
 */
export async function updateUserPreferences(
  userId: string,
  organizationId: string,
  updates: Partial<NotificationPreferences>
): Promise<void> {
  await db.notificationPreferences.upsert({
    where: { userId },
    create: {
      userId,
      organizationId,
      ...mapPreferencesToDb(updates),
    },
    update: mapPreferencesToDb(updates),
  });
}

/**
 * Create default preferences for new user
 */
export async function createDefaultPreferences(
  userId: string,
  organizationId: string
): Promise<void> {
  const defaults = getDefaultPreferences();
  await db.notificationPreferences.create({
    data: {
      userId,
      organizationId,
      ...mapPreferencesToDb(defaults),
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHANNEL DELIVERY
// ═══════════════════════════════════════════════════════════════════════════════

async function deliverToChannel(
  channel: NotificationChannel,
  payload: NotificationPayload & { user: any; preferences: NotificationPreferences }
): Promise<void> {
  const { userId, organizationId, title, body, eventType, entityType, entityId, user } = payload;

  try {
    let status = 'pending';
    let errorMessage: string | undefined;

    switch (channel) {
      case 'whatsapp':
        await deliverWhatsApp(payload);
        status = 'sent';
        break;

      case 'push':
        await deliverPush(payload);
        status = 'sent';
        break;

      case 'email':
        await deliverEmail(payload);
        status = 'sent';
        break;

      case 'sms':
        await deliverSms(payload);
        status = 'sent';
        break;

      case 'web':
        // Web notifications are stored and delivered via WebSocket/polling
        status = 'sent';
        break;
    }

    // Log delivery
    await db.notificationLogs.create({
      data: {
        organizationId,
        userId,
        eventType,
        channel,
        title,
        body,
        data: payload.data || {},
        status,
        sentAt: new Date(),
        entityType,
        entityId,
        errorMessage,
      },
    });
  } catch (error) {
    log.error('Channel delivery failed', {
      channel,
      userId,
      eventType,
      error: error instanceof Error ? error.message : 'Unknown',
    });

    // Log failure
    await db.notificationLogs.create({
      data: {
        organizationId,
        userId,
        eventType,
        channel,
        title,
        body,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        entityType,
        entityId,
      },
    });
  }
}

async function deliverWhatsApp(payload: any): Promise<void> {
  const { organizationId, templateName, templateParams, user, body } = payload;
  const phone = user.whatsappNumber || user.phone;

  const config = await getWhatsAppConfig(organizationId);
  if (!config) {
    throw new Error('WhatsApp not configured');
  }

  if (templateName && templateParams) {
    // Convert templateParams object to array of values
    const paramValues = Object.keys(templateParams)
      .sort()
      .map(key => String(templateParams[key]));
    const template = buildTemplateWithParams(templateName, paramValues, 'es_AR');
    await sendTemplateMessage(config, phone, template);
  } else {
    // Queue as text message (requires 24h window)
    await QueueManager.getInstance().addToQueue('WHATSAPP', {
      type: 'send_message',
      organizationId,
      to: phone,
      content: body,
    });
  }
}

async function deliverPush(payload: any): Promise<void> {
  const { user, title, body, data } = payload;

  if (!user.pushToken) {
    log.debug('No push token for user', { userId: payload.userId });
    return;
  }

  // Queue push notification
  await QueueManager.getInstance().addToQueue('NOTIFICATION', {
    type: 'push',
    token: user.pushToken,
    title,
    body,
    data,
  });
}

async function deliverEmail(payload: any): Promise<void> {
  const { user, title, body, data, organizationId } = payload;

  if (!user.email) {
    log.debug('No email for user', { userId: payload.userId });
    return;
  }

  // Queue email
  await QueueManager.getInstance().addToQueue('NOTIFICATION', {
    type: 'email',
    to: user.email,
    subject: title,
    body,
    data,
    organizationId,
  });
}

async function deliverSms(payload: any): Promise<void> {
  const { user, body } = payload;

  // SMS should only be used for OTP and critical alerts
  await QueueManager.getInstance().addToQueue('NOTIFICATION', {
    type: 'sms',
    to: user.phone,
    body,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getDefaultPreferences(): NotificationPreferences {
  return {
    webEnabled: true,
    pushEnabled: true,
    smsEnabled: false,
    emailEnabled: false,
    whatsappEnabled: true,
    eventPreferences: {
      job_assigned: { whatsapp: true, push: true, email: false, sms: false },
      job_reminder: { whatsapp: true, push: true, email: false, sms: false },
      job_completed: { whatsapp: true, push: true, email: false, sms: false },
      schedule_change: { whatsapp: true, push: true, email: false, sms: false },
      invoice_created: { whatsapp: true, push: false, email: true, sms: false },
      payment_received: { whatsapp: true, push: true, email: false, sms: false },
      team_member_added: { whatsapp: true, push: false, email: false, sms: false },
      system_alert: { whatsapp: true, push: true, email: true, sms: true },
    },
    reminderIntervals: [1440, 60, 30], // 24h, 1h, 30min
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    quietHoursTimezone: 'America/Argentina/Buenos_Aires',
  };
}

function getEnabledChannels(
  prefs: NotificationPreferences,
  eventPrefs: Record<string, boolean>,
  eventType: NotificationEventType
): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  const restriction = CHANNEL_RESTRICTIONS[eventType];

  // WhatsApp first for Argentine market
  if (restriction === 'whatsapp_preferred') {
    if (prefs.whatsappEnabled && eventPrefs.whatsapp !== false) {
      channels.push('whatsapp');
    }
    if (prefs.pushEnabled && eventPrefs.push !== false) {
      channels.push('push');
    }
    // Only add email/sms if explicitly enabled in event prefs
    if (prefs.emailEnabled && eventPrefs.email === true) {
      channels.push('email');
    }
  } else if (restriction === 'sms_only') {
    channels.push('sms');
  } else {
    // 'any' - respect all preferences
    if (prefs.whatsappEnabled && eventPrefs.whatsapp !== false) channels.push('whatsapp');
    if (prefs.pushEnabled && eventPrefs.push !== false) channels.push('push');
    if (prefs.emailEnabled && eventPrefs.email !== false) channels.push('email');
    if (prefs.smsEnabled && eventPrefs.sms !== false) channels.push('sms');
  }

  // Always include web for logged-in users
  if (prefs.webEnabled) {
    channels.push('web');
  }

  return channels;
}

function isInQuietHours(prefs: NotificationPreferences): boolean {
  const now = new Date();
  const tz = prefs.quietHoursTimezone || 'America/Argentina/Buenos_Aires';

  // Get current time in user's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const currentTime = formatter.format(now);
  const [currentHour, currentMin] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMin;

  const [startHour, startMin] = prefs.quietHoursStart.split(':').map(Number);
  const [endHour, endMin] = prefs.quietHoursEnd.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

async function queueDeferredNotification(
  payload: NotificationPayload,
  prefs: NotificationPreferences
): Promise<void> {
  // Calculate when quiet hours end
  const [endHour, endMin] = prefs.quietHoursEnd.split(':').map(Number);
  const deliverAt = new Date();
  deliverAt.setHours(endHour, endMin, 0, 0);

  if (deliverAt <= new Date()) {
    deliverAt.setDate(deliverAt.getDate() + 1);
  }

  await QueueManager.getInstance().addToQueue('SCHEDULED', {
    type: 'deferred_notification',
    payload,
    deliverAt: deliverAt.toISOString(),
  });
}

function mapPreferencesToDb(prefs: Partial<NotificationPreferences>): Record<string, any> {
  const mapped: Record<string, any> = {};

  if (prefs.webEnabled !== undefined) mapped.webEnabled = prefs.webEnabled;
  if (prefs.pushEnabled !== undefined) mapped.pushEnabled = prefs.pushEnabled;
  if (prefs.smsEnabled !== undefined) mapped.smsEnabled = prefs.smsEnabled;
  if (prefs.emailEnabled !== undefined) mapped.emailEnabled = prefs.emailEnabled;
  if (prefs.whatsappEnabled !== undefined) mapped.whatsappEnabled = prefs.whatsappEnabled;
  if (prefs.eventPreferences !== undefined) mapped.eventPreferences = prefs.eventPreferences;
  if (prefs.reminderIntervals !== undefined) mapped.reminderIntervals = prefs.reminderIntervals;
  if (prefs.quietHoursEnabled !== undefined) mapped.quietHoursEnabled = prefs.quietHoursEnabled;
  if (prefs.quietHoursStart !== undefined) mapped.quietHoursStart = prefs.quietHoursStart;
  if (prefs.quietHoursEnd !== undefined) mapped.quietHoursEnd = prefs.quietHoursEnd;
  if (prefs.quietHoursTimezone !== undefined) mapped.quietHoursTimezone = prefs.quietHoursTimezone;

  return mapped;
}

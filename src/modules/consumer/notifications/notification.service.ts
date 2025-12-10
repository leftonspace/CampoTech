/**
 * Notification Service
 * ====================
 *
 * Unified notification service for WhatsApp and Push.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';
import { WhatsAppService, MESSAGE_TEMPLATES } from './whatsapp.service';
import { PushNotificationService, MockPushNotificationService, PushMessage } from './push.service';
import { NotificationService as INotificationService } from '../quotes/quote.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface NotificationConfig {
  whatsApp?: {
    phoneNumberId: string;
    accessToken: string;
  };
  push?: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
  };
  useMock?: boolean;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  whatsAppEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;
}

export interface NotificationLog {
  id: string;
  recipientId: string;
  recipientType: 'consumer' | 'business';
  channel: 'whatsapp' | 'push' | 'email';
  templateId: string;
  params: Record<string, string>;
  status: 'sent' | 'delivered' | 'failed';
  error?: string;
  sentAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class NotificationService implements INotificationService {
  private whatsApp?: WhatsAppService;
  private push?: PushNotificationService | MockPushNotificationService;
  private pool?: Pool;

  constructor(config: NotificationConfig, pool?: Pool) {
    if (config.whatsApp && !config.useMock) {
      this.whatsApp = new WhatsAppService(config.whatsApp);
    }

    if (config.push && !config.useMock) {
      // Only initialize if we have push config
      // Actual initialization would require firebase-admin
    }

    this.pool = pool;
  }

  /**
   * Send WhatsApp message
   */
  async sendWhatsApp(
    phone: string,
    templateId: string,
    params: Record<string, string>
  ): Promise<void> {
    if (!this.whatsApp) {
      console.log(`[Notification] WhatsApp disabled - would send ${templateId} to ${phone}`);
      return;
    }

    try {
      await this.whatsApp.sendTemplate(
        phone,
        templateId as keyof typeof MESSAGE_TEMPLATES,
        params
      );

      await this.logNotification({
        recipientId: phone,
        recipientType: 'consumer',
        channel: 'whatsapp',
        templateId,
        params,
        status: 'sent',
      });
    } catch (error: any) {
      console.error(`[Notification] WhatsApp error:`, error);

      await this.logNotification({
        recipientId: phone,
        recipientType: 'consumer',
        channel: 'whatsapp',
        templateId,
        params,
        status: 'failed',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Send push notification
   */
  async sendPush(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<void> {
    if (!this.push) {
      console.log(`[Notification] Push disabled - would send "${title}" to token`);
      return;
    }

    try {
      const result = await this.push.send(fcmToken, { title, body, data });

      if (!result.success) {
        throw new Error(result.error);
      }

      await this.logNotification({
        recipientId: fcmToken.substring(0, 20),
        recipientType: 'consumer',
        channel: 'push',
        templateId: 'custom',
        params: { title, body },
        status: 'sent',
      });
    } catch (error: any) {
      console.error(`[Notification] Push error:`, error);

      await this.logNotification({
        recipientId: fcmToken.substring(0, 20),
        recipientType: 'consumer',
        channel: 'push',
        templateId: 'custom',
        params: { title, body },
        status: 'failed',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Send push to multiple tokens
   */
  async sendPushMulticast(
    tokens: string[],
    message: PushMessage
  ): Promise<{ success: number; failed: number }> {
    if (!this.push || tokens.length === 0) {
      console.log(`[Notification] Push multicast disabled - would send to ${tokens.length} devices`);
      return { success: 0, failed: 0 };
    }

    const result = await this.push.sendMulticast(tokens, message);
    return {
      success: result.successCount,
      failed: result.failureCount,
    };
  }

  /**
   * Check if within quiet hours
   */
  isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = preferences.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes <= endMinutes) {
      // Same day range (e.g., 09:00 to 18:00)
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Overnight range (e.g., 22:00 to 08:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  /**
   * Log notification
   */
  private async logNotification(log: Omit<NotificationLog, 'id' | 'sentAt'>): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.query(
        `INSERT INTO notification_logs (
           recipient_id,
           recipient_type,
           channel,
           template_id,
           params,
           status,
           error,
           sent_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          log.recipientId,
          log.recipientType,
          log.channel,
          log.templateId,
          JSON.stringify(log.params),
          log.status,
          log.error,
        ]
      );
    } catch (error) {
      console.error('[Notification] Failed to log notification:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export class NotificationScheduler {
  constructor(
    private pool: Pool,
    private notificationService: NotificationService
  ) {}

  /**
   * Send job reminders (run daily)
   */
  async sendJobReminders(): Promise<number> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // Find jobs scheduled for tomorrow
    const result = await this.pool.query<{
      consumer_phone: string;
      consumer_fcm: string;
      service_title: string;
      business_name: string;
      scheduled_date: Date;
    }>(
      `SELECT
         cp.phone as consumer_phone,
         cp.fcm_token as consumer_fcm,
         csr.title as service_title,
         bp.display_name as business_name,
         j.scheduled_start_time as scheduled_date
       FROM jobs j
       JOIN consumer_service_requests csr ON j.request_id = csr.id
       JOIN consumer_profiles cp ON csr.consumer_id = cp.id
       JOIN business_public_profiles bp ON j.business_profile_id = bp.id
       WHERE j.scheduled_start_time >= $1
         AND j.scheduled_start_time < $2
         AND j.status = 'scheduled'
         AND cp.notification_preferences->>'reminders' != 'false'`,
      [tomorrow, dayAfterTomorrow]
    );

    let sent = 0;
    for (const row of result.rows) {
      try {
        const scheduledDate = new Date(row.scheduled_date);
        const dateStr = scheduledDate.toLocaleDateString('es-AR');
        const timeStr = scheduledDate.toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
        });

        if (row.consumer_phone) {
          await this.notificationService.sendWhatsApp(
            row.consumer_phone,
            'job_reminder',
            {
              service: row.service_title,
              business_name: row.business_name,
              date: dateStr,
              time: timeStr,
            }
          );
        }

        if (row.consumer_fcm) {
          await this.notificationService.sendPush(
            row.consumer_fcm,
            'Recordatorio de servicio',
            `Mañana: ${row.service_title} con ${row.business_name} a las ${timeStr}`,
            { type: 'job_reminder' }
          );
        }

        sent++;
      } catch (error) {
        console.error('Failed to send job reminder:', error);
      }
    }

    return sent;
  }

  /**
   * Send review requests (run daily)
   */
  async sendReviewRequests(): Promise<number> {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    // Find completed jobs without reviews
    const result = await this.pool.query<{
      consumer_phone: string;
      consumer_fcm: string;
      consumer_id: string;
      service_title: string;
      business_name: string;
      business_profile_id: string;
    }>(
      `SELECT
         cp.phone as consumer_phone,
         cp.fcm_token as consumer_fcm,
         cp.id as consumer_id,
         csr.title as service_title,
         bp.display_name as business_name,
         bp.id as business_profile_id
       FROM jobs j
       JOIN consumer_service_requests csr ON j.request_id = csr.id
       JOIN consumer_profiles cp ON csr.consumer_id = cp.id
       JOIN business_public_profiles bp ON j.business_profile_id = bp.id
       LEFT JOIN consumer_reviews cr ON cr.consumer_id = cp.id AND cr.business_profile_id = bp.id
       WHERE j.completed_at >= $1
         AND j.completed_at < $2
         AND j.status = 'completed'
         AND cr.id IS NULL
         AND cp.notification_preferences->>'marketing' != 'false'`,
      [fourDaysAgo, threeDaysAgo]
    );

    let sent = 0;
    for (const row of result.rows) {
      try {
        if (row.consumer_phone) {
          await this.notificationService.sendWhatsApp(
            row.consumer_phone,
            'review_request',
            {
              business_name: row.business_name,
              service: row.service_title,
            }
          );
        }

        if (row.consumer_fcm) {
          await this.notificationService.sendPush(
            row.consumer_fcm,
            '¿Cómo te fue?',
            `Dejá tu opinión sobre ${row.business_name}`,
            {
              type: 'review_request',
              businessProfileId: row.business_profile_id,
            }
          );
        }

        sent++;
      } catch (error) {
        console.error('Failed to send review request:', error);
      }
    }

    return sent;
  }

  /**
   * Expire stale quotes (run hourly)
   */
  async expireStaleQuotes(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE business_quotes
       SET status = 'expired',
           expired_at = NOW(),
           updated_at = NOW()
       WHERE status IN ('pending', 'sent', 'viewed')
         AND valid_until < NOW()
       RETURNING id`
    );

    return result.rowCount || 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

let notificationServiceInstance: NotificationService | null = null;

export function initializeNotificationService(
  config: NotificationConfig,
  pool?: Pool
): NotificationService {
  notificationServiceInstance = new NotificationService(config, pool);
  return notificationServiceInstance;
}

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    throw new Error('Notification service not initialized');
  }
  return notificationServiceInstance;
}

export function resetNotificationService(): void {
  notificationServiceInstance = null;
}

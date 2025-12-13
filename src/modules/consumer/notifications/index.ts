/**
 * Notifications Module
 * ====================
 *
 * Exports for notification services.
 * Phase 15: Consumer Marketplace
 */

export {
  WhatsAppService,
  MESSAGE_TEMPLATES,
  initializeWhatsAppService,
  getWhatsAppService,
  resetWhatsAppService,
} from './whatsapp.service';
export type { WhatsAppConfig, WhatsAppTemplate } from './whatsapp.service';

export {
  PushNotificationService,
  MockPushNotificationService,
  NOTIFICATION_CHANNELS,
  initializePushService,
  initializeMockPushService,
  getPushService,
  resetPushService,
} from './push.service';
export type {
  PushConfig,
  PushMessage,
  SendPushResult,
  MulticastResult,
} from './push.service';

export {
  NotificationService,
  NotificationScheduler,
  initializeNotificationService,
  getNotificationService,
  resetNotificationService,
} from './notification.service';
export type {
  NotificationConfig,
  NotificationPreferences,
  NotificationLog,
} from './notification.service';

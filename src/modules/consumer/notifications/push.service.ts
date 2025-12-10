/**
 * Push Notification Service
 * =========================
 *
 * Firebase Cloud Messaging (FCM) integration.
 * Phase 15: Consumer Marketplace
 */

import axios, { AxiosInstance } from 'axios';
import * as admin from 'firebase-admin';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PushConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

export interface PushMessage {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
}

export interface SendPushResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MulticastResult {
  successCount: number;
  failureCount: number;
  responses: SendPushResult[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const NOTIFICATION_CHANNELS = {
  quotes: {
    id: 'quotes',
    name: 'Cotizaciones',
    description: 'Notificaciones sobre cotizaciones',
    importance: 'high',
  },
  messages: {
    id: 'messages',
    name: 'Mensajes',
    description: 'Mensajes de proveedores',
    importance: 'high',
  },
  requests: {
    id: 'requests',
    name: 'Pedidos',
    description: 'Actualizaciones de pedidos',
    importance: 'default',
  },
  reminders: {
    id: 'reminders',
    name: 'Recordatorios',
    description: 'Recordatorios de servicios',
    importance: 'default',
  },
  marketing: {
    id: 'marketing',
    name: 'Promociones',
    description: 'Ofertas y promociones',
    importance: 'low',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class PushNotificationService {
  private app: admin.app.App;
  private messaging: admin.messaging.Messaging;

  constructor(config: PushConfig) {
    // Initialize Firebase Admin SDK
    this.app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.projectId,
        privateKey: config.privateKey.replace(/\\n/g, '\n'),
        clientEmail: config.clientEmail,
      }),
    });

    this.messaging = this.app.messaging();
  }

  /**
   * Send push notification to a single device
   */
  async send(token: string, message: PushMessage): Promise<SendPushResult> {
    try {
      const fcmMessage: admin.messaging.Message = {
        token,
        notification: {
          title: message.title,
          body: message.body,
          imageUrl: message.imageUrl,
        },
        data: message.data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const result = await this.messaging.send(fcmMessage);

      return {
        success: true,
        messageId: result,
      };
    } catch (error: any) {
      console.error('Push notification failed:', error);

      // Handle invalid token
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        return {
          success: false,
          error: 'INVALID_TOKEN',
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send push notification to multiple devices
   */
  async sendMulticast(tokens: string[], message: PushMessage): Promise<MulticastResult> {
    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, responses: [] };
    }

    const fcmMessage: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: message.title,
        body: message.body,
        imageUrl: message.imageUrl,
      },
      data: message.data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    try {
      const result = await this.messaging.sendEachForMulticast(fcmMessage);

      return {
        successCount: result.successCount,
        failureCount: result.failureCount,
        responses: result.responses.map((r, i) => ({
          success: r.success,
          messageId: r.messageId,
          error: r.error?.message,
        })),
      };
    } catch (error: any) {
      console.error('Multicast push failed:', error);
      return {
        successCount: 0,
        failureCount: tokens.length,
        responses: tokens.map(() => ({
          success: false,
          error: error.message,
        })),
      };
    }
  }

  /**
   * Send to a topic
   */
  async sendToTopic(topic: string, message: PushMessage): Promise<SendPushResult> {
    try {
      const fcmMessage: admin.messaging.Message = {
        topic,
        notification: {
          title: message.title,
          body: message.body,
          imageUrl: message.imageUrl,
        },
        data: message.data,
      };

      const result = await this.messaging.send(fcmMessage);

      return {
        success: true,
        messageId: result,
      };
    } catch (error: any) {
      console.error('Topic push failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Subscribe tokens to a topic
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    await this.messaging.subscribeToTopic(tokens, topic);
  }

  /**
   * Unsubscribe tokens from a topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    await this.messaging.unsubscribeFromTopic(tokens, topic);
  }

  /**
   * Validate a token
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      // Send a dry run message to validate token
      await this.messaging.send(
        {
          token,
          notification: { title: 'test', body: 'test' },
        },
        true // dry run
      );
      return true;
    } catch (error: any) {
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        return false;
      }
      // Other errors might be transient
      return true;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK SERVICE (for development)
// ═══════════════════════════════════════════════════════════════════════════════

export class MockPushNotificationService {
  private sentMessages: Array<{ token: string; message: PushMessage; timestamp: Date }> = [];

  async send(token: string, message: PushMessage): Promise<SendPushResult> {
    console.log(`[Mock Push] To: ${token.substring(0, 20)}...`);
    console.log(`[Mock Push] Title: ${message.title}`);
    console.log(`[Mock Push] Body: ${message.body}`);

    this.sentMessages.push({ token, message, timestamp: new Date() });

    return {
      success: true,
      messageId: `mock-${Date.now()}`,
    };
  }

  async sendMulticast(tokens: string[], message: PushMessage): Promise<MulticastResult> {
    console.log(`[Mock Push] Multicast to ${tokens.length} devices`);
    console.log(`[Mock Push] Title: ${message.title}`);

    const responses = tokens.map(token => {
      this.sentMessages.push({ token, message, timestamp: new Date() });
      return { success: true, messageId: `mock-${Date.now()}` };
    });

    return {
      successCount: tokens.length,
      failureCount: 0,
      responses,
    };
  }

  async sendToTopic(topic: string, message: PushMessage): Promise<SendPushResult> {
    console.log(`[Mock Push] Topic: ${topic}`);
    console.log(`[Mock Push] Title: ${message.title}`);
    return { success: true, messageId: `mock-topic-${Date.now()}` };
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    console.log(`[Mock Push] Subscribe ${tokens.length} tokens to ${topic}`);
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    console.log(`[Mock Push] Unsubscribe ${tokens.length} tokens from ${topic}`);
  }

  async validateToken(token: string): Promise<boolean> {
    return true;
  }

  getSentMessages() {
    return this.sentMessages;
  }

  clearSentMessages() {
    this.sentMessages = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

let pushServiceInstance: PushNotificationService | MockPushNotificationService | null = null;

export function initializePushService(config: PushConfig): PushNotificationService {
  pushServiceInstance = new PushNotificationService(config);
  return pushServiceInstance;
}

export function initializeMockPushService(): MockPushNotificationService {
  pushServiceInstance = new MockPushNotificationService();
  return pushServiceInstance;
}

export function getPushService(): PushNotificationService | MockPushNotificationService {
  if (!pushServiceInstance) {
    throw new Error('Push service not initialized');
  }
  return pushServiceInstance;
}

export function resetPushService(): void {
  pushServiceInstance = null;
}

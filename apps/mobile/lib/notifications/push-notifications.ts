/**
 * Push Notifications Service
 * ==========================
 *
 * Handle push notification registration, receiving, and deep linking
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { api } from '../api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// Configure how notifications are handled when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface NotificationData {
  type: 'job_assigned' | 'job_updated' | 'job_reminder' | 'sync_conflict' | 'message' | 'emergency' | 'badge_reminder';
  jobId?: string;
  customerId?: string;
  conversationId?: string;
  title?: string;
  body?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register for push notifications and get the token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Must be a physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check current permission status
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#059669',
      });

      await Notifications.setNotificationChannelAsync('jobs', {
        name: 'Trabajos',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#059669',
        description: 'Notificaciones de trabajos asignados y recordatorios',
      });

      // Emergency channel for URGENT jobs - high priority with special vibration
      await Notifications.setNotificationChannelAsync('emergency', {
        name: 'Emergencias',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500, 200, 500], // Long urgent pattern
        lightColor: '#DC2626', // Red for emergency
        description: 'Trabajos URGENTES que requieren atención inmediata',
        sound: 'default', // Use default system sound
        enableVibrate: true,
        bypassDnd: true, // Bypass Do Not Disturb
      });

      await Notifications.setNotificationChannelAsync('sync', {
        name: 'Sincronizacion',
        importance: Notifications.AndroidImportance.DEFAULT,
        description: 'Notificaciones de conflictos de sincronizacion',
      });
    }

    return token.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

/**
 * Register token with the server
 */
export async function registerPushToken(token: string): Promise<void> {
  try {
    await api.auth.registerPushToken({
      token,
      platform: Platform.OS,
      deviceId: Constants.deviceId,
    });
  } catch (error) {
    console.error('Failed to register push token:', error);
  }
}

/**
 * Unregister push token from server
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    await api.auth.unregisterPushToken(Constants.deviceId || '');
  } catch (error) {
    console.error('Failed to unregister push token:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle notification received while app is foregrounded
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Handle notification response (user tapped notification)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Process notification data and navigate accordingly
 */
export function handleNotificationNavigation(data: NotificationData): void {
  switch (data.type) {
    case 'job_assigned':
    case 'job_updated':
    case 'job_reminder':
      if (data.jobId) {
        router.push(`/jobs/${data.jobId}`);
      }
      break;

    case 'sync_conflict':
      router.push('/profile'); // Profile has sync status
      break;

    case 'badge_reminder':
      // Navigate to digital badge screen
      router.push('/(tabs)/profile/badge');
      break;

    case 'message':
      if (data.conversationId) {
        // Navigate to conversations (would need web view or link)
        router.push('/');
      }
      break;

    default:
      router.push('/');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Schedule a local notification (for reminders, etc.)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data: NotificationData,
  trigger: Notifications.NotificationTriggerInput
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as unknown as Record<string, unknown>,
      sound: 'default',
    },
    trigger,
  });
}

/**
 * Schedule an URGENT/EMERGENCY notification with special treatment
 * - Uses 🚨 emoji in title
 * - Uses emergency channel on Android (bypasses DND)
 * - High priority vibration pattern
 */
export async function scheduleEmergencyNotification(
  jobId: string,
  title: string,
  body: string
): Promise<string> {
  const content: Notifications.NotificationContentInput = {
    title: `🚨 EMERGENCIA: ${title}`,
    body,
    data: {
      type: 'emergency',
      jobId,
      priority: 'urgent',
    } as unknown as Record<string, unknown>,
    sound: 'default', // Use default system sound
    priority: Notifications.AndroidNotificationPriority.MAX,
    vibrate: [0, 500, 200, 500, 200, 500], // Urgent pattern
    color: '#DC2626', // Red
  };

  // On Android, use the emergency channel
  if (Platform.OS === 'android') {
    (content as { channelId?: string }).channelId = 'emergency';
  }

  return Notifications.scheduleNotificationAsync({
    content,
    trigger: null, // Immediate notification
  });
}

/**
 * Schedule a job reminder notification
 */
export async function scheduleJobReminder(
  jobId: string,
  jobAddress: string,
  scheduledTime: Date
): Promise<string | null> {
  // Remind 30 minutes before
  const reminderTime = new Date(scheduledTime.getTime() - 30 * 60 * 1000);

  // Don't schedule if in the past
  if (reminderTime <= new Date()) {
    return null;
  }

  return scheduleLocalNotification(
    'Trabajo en 30 minutos',
    `Recordatorio: tienes un trabajo programado en ${jobAddress}`,
    {
      type: 'job_reminder',
      jobId,
    },
    {
      date: reminderTime,
    } as Notifications.NotificationTriggerInput
  );
}

/**
 * Cancel a scheduled notification
 */
export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all pending scheduled notifications
 */
export async function getPendingNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

// ═══════════════════════════════════════════════════════════════════════════════
// BADGE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Set the app badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear the app badge
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

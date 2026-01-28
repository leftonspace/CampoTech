/**
 * Notifications Module
 * ====================
 *
 * Push notifications, deep linking, and related functionality
 */

export {
  registerForPushNotifications,
  registerPushToken,
  unregisterPushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  handleNotificationNavigation,
  scheduleLocalNotification,
  scheduleEmergencyNotification,
  scheduleJobReminder,
  cancelScheduledNotification,
  cancelAllScheduledNotifications,
  getPendingNotifications,
  setBadgeCount,
  clearBadge,
  type NotificationData,
} from './push-notifications';

export { useNotifications, useLastNotificationResponse } from './use-notifications';

export {
  linking,
  DEEP_LINK_PREFIX,
  handleDeepLink,
  createDeepLink,
  createJobLink,
  createCustomerLink,
  openPhone,
  openSMS,
  openWhatsApp,
  openEmail,
  openMapsDirections,
  openMapsSearch,
  openWaze,
  openAppSettings,
} from './deep-linking';

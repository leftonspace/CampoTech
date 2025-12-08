/**
 * Notifications Hook
 * ==================
 *
 * React hook for managing push notifications
 */

import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  registerPushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  handleNotificationNavigation,
  NotificationData,
} from './push-notifications';

interface UseNotificationsReturn {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  isRegistered: boolean;
  error: string | null;
}

/**
 * Hook to manage push notification registration and handling
 */
export function useNotifications(): UseNotificationsReturn {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    // Register for push notifications
    registerForPushNotifications()
      .then((token) => {
        if (token) {
          setExpoPushToken(token);
          // Register with server
          registerPushToken(token)
            .then(() => setIsRegistered(true))
            .catch((err) => setError(err.message));
        }
      })
      .catch((err) => setError(err.message));

    // Listen for notifications while app is foregrounded
    notificationListener.current = addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    // Handle notification taps
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as NotificationData;
      handleNotificationNavigation(data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
    isRegistered,
    error,
  };
}

/**
 * Hook to check for notification that launched the app
 */
export function useLastNotificationResponse(): Notifications.NotificationResponse | null {
  const [response, setResponse] = useState<Notifications.NotificationResponse | null>(null);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        setResponse(response);
      }
    });
  }, []);

  return response;
}

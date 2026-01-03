'use client';

/**
 * Notification Center Component
 * =============================
 *
 * Phase 9.6: Notification Preferences System
 * Bell icon with dropdown showing real-time notifications.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  X,
  Settings,
  Briefcase,
  FileText,
  CreditCard,
  Users,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Notification {
  id: string;
  eventType: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  data: Notification[];
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  job_assigned: Briefcase,
  job_updated: Briefcase,
  job_reminder: Bell,
  job_completed: Check,
  job_cancelled: X,
  invoice_created: FileText,
  invoice_sent: FileText,
  payment_received: CreditCard,
  payment_failed: AlertCircle,
  team_member_added: Users,
  team_member_removed: Users,
  schedule_change: MapPin,
  system_alert: AlertCircle,
  custom: Bell,
};

const EVENT_COLORS: Record<string, string> = {
  job_assigned: 'bg-blue-100 text-blue-600',
  job_updated: 'bg-blue-100 text-blue-600',
  job_reminder: 'bg-yellow-100 text-yellow-600',
  job_completed: 'bg-green-100 text-green-600',
  job_cancelled: 'bg-red-100 text-red-600',
  invoice_created: 'bg-purple-100 text-purple-600',
  invoice_sent: 'bg-purple-100 text-purple-600',
  payment_received: 'bg-green-100 text-green-600',
  payment_failed: 'bg-red-100 text-red-600',
  team_member_added: 'bg-indigo-100 text-indigo-600',
  team_member_removed: 'bg-gray-100 text-gray-600',
  schedule_change: 'bg-orange-100 text-orange-600',
  system_alert: 'bg-red-100 text-red-600',
  custom: 'bg-gray-100 text-gray-600',
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await fetch('/api/notifications?limit=20');
      return response.json();
    },
    refetchInterval: 30000, // Fallback polling every 30s
  });

  const notifications: Notification[] = data?.data || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/notifications/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.event === 'notification') {
              // Add new notification to cache
              queryClient.setQueryData<NotificationsResponse>(['notifications'], (old) => {
                if (!old?.data) return old || { data: [] };
                return {
                  ...old,
                  data: [message.payload, ...old.data].slice(0, 50),
                };
              });
            } else if (message.event === 'ping') {
              ws.send(JSON.stringify({ event: 'pong' }));
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          // Reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle notification click
  const handleNotificationClick = useCallback((notification: Notification) => {
    if (!notification.read) {
      markReadMutation.mutate([notification.id]);
    }

    // Navigate based on entity type
    if (notification.entityType && notification.entityId) {
      const routes: Record<string, string> = {
        job: `/dashboard/jobs/${notification.entityId}`,
        invoice: `/dashboard/invoices/${notification.entityId}`,
        customer: `/dashboard/customers/${notification.entityId}`,
        user: `/dashboard/settings/team`,
      };
      const route = routes[notification.entityType];
      if (route) {
        window.location.href = route;
      }
    }

    setIsOpen(false);
  }, [markReadMutation]);

  const getNotificationIcon = (eventType: string) => {
    const Icon = EVENT_ICONS[eventType] || Bell;
    const colorClass = EVENT_COLORS[eventType] || 'bg-gray-100 text-gray-600';
    return (
      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="Notificaciones"
      >
        {wsConnected ? (
          <Bell className="h-5 w-5" />
        ) : (
          <BellOff className="h-5 w-5 text-gray-400" />
        )}

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="font-medium text-gray-900">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                  disabled={markAllReadMutation.isPending}
                >
                  <CheckCheck className="h-3 w-3" />
                  Marcar todas leídas
                </button>
              )}
              <Link
                href="/dashboard/settings/notifications"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Configuración"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Notifications list */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No tenés notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${!notification.read ? 'bg-primary-50/50' : ''
                      }`}
                  >
                    <div className="flex gap-3">
                      {getNotificationIcon(notification.eventType)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!notification.read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                          {notification.body}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2">
              <Link
                href="/dashboard/notifications"
                className="block text-center text-sm text-primary-600 hover:text-primary-700"
                onClick={() => setIsOpen(false)}
              >
                Ver todas las notificaciones
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

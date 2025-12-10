'use client';

/**
 * Alerts Panel Component
 * ======================
 *
 * Phase 10.5: Predictive Analytics
 * Real-time alerts for anomalies, churn risks, and other critical events.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Users,
  TrendingDown,
  X,
  Check,
  ChevronRight,
  Clock,
  RefreshCw,
  Settings,
} from 'lucide-react';
import Link from 'next/link';

interface Alert {
  id: string;
  type: 'anomaly' | 'churn' | 'threshold' | 'system';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

interface AlertsPanelProps {
  maxAlerts?: number;
  className?: string;
  showHeader?: boolean;
}

export default function AlertsPanel({ maxAlerts = 5, className = '', showHeader = true }: AlertsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
  const queryClient = useQueryClient();

  // Fetch alerts from predictions and other sources
  const { data: alerts = [], isLoading, refetch, isFetching } = useQuery<Alert[]>({
    queryKey: ['analytics-alerts'],
    queryFn: async () => {
      // Fetch anomalies and churn data
      const [anomalyRes, churnRes] = await Promise.all([
        fetch('/api/analytics/predictions?type=anomalies'),
        fetch('/api/analytics/predictions?type=churn&limit=5'),
      ]);

      const generatedAlerts: Alert[] = [];

      // Generate alerts from anomalies
      if (anomalyRes.ok) {
        const anomalyData = await anomalyRes.json();
        if (anomalyData.anomalies) {
          anomalyData.anomalies.slice(0, 10).forEach((anomaly: {
            id: string;
            severity: 'critical' | 'warning' | 'info';
            description: string;
            metric: string;
            detectedAt: string;
          }) => {
            generatedAlerts.push({
              id: `anomaly-${anomaly.id}`,
              type: 'anomaly',
              severity: anomaly.severity,
              title: `Anomalía: ${anomaly.metric.replace(/_/g, ' ')}`,
              description: anomaly.description,
              createdAt: anomaly.detectedAt,
              read: false,
              actionUrl: '/dashboard/analytics/predictions?tab=anomalies',
              actionLabel: 'Ver detalles',
            });
          });
        }
      }

      // Generate alerts from high churn risk customers
      if (churnRes.ok) {
        const churnData = await churnRes.json();
        if (churnData.highRiskCustomers) {
          churnData.highRiskCustomers
            .filter((c: { riskLevel: string }) => c.riskLevel === 'critical' || c.riskLevel === 'high')
            .slice(0, 5)
            .forEach((customer: {
              customerId: string;
              customerName: string;
              riskLevel: string;
              riskScore: number;
              potentialRevenueLoss: number;
            }) => {
              generatedAlerts.push({
                id: `churn-${customer.customerId}`,
                type: 'churn',
                severity: customer.riskLevel === 'critical' ? 'critical' : 'warning',
                title: `Riesgo de churn: ${customer.customerName}`,
                description: `Score: ${customer.riskScore}/100. Pérdida potencial: $${customer.potentialRevenueLoss.toLocaleString('es-AR')}`,
                metadata: { customerId: customer.customerId },
                createdAt: new Date().toISOString(),
                read: false,
                actionUrl: `/dashboard/customers/${customer.customerId}`,
                actionLabel: 'Ver cliente',
              });
            });
        }
      }

      // Sort by severity and date
      generatedAlerts.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return generatedAlerts;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });

  // Mark alert as read (local state for demo)
  const markAsRead = useMutation({
    mutationFn: async (alertId: string) => {
      // In production, this would call an API
      return alertId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-alerts'] });
    },
  });

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'unread') return !alert.read;
    if (filter === 'critical') return alert.severity === 'critical';
    return true;
  }).slice(0, maxAlerts);

  const unreadCount = alerts.filter((a) => !a.read).length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  const getAlertIcon = (type: Alert['type'], severity: Alert['severity']) => {
    switch (type) {
      case 'anomaly':
        return <AlertTriangle size={16} />;
      case 'churn':
        return <Users size={16} />;
      case 'threshold':
        return <TrendingDown size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const getSeverityStyles = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };

  const getIconStyles = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500';
      case 'warning':
        return 'text-amber-500';
      case 'info':
        return 'text-blue-500';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell size={20} className="text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900">Alertas</h3>
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                {criticalCount} crítica(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw size={16} className={`text-gray-500 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <Link href="/dashboard/analytics/predictions" className="p-1.5 hover:bg-gray-100 rounded-lg">
              <Settings size={16} className="text-gray-500" />
            </Link>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1 p-2 border-b border-gray-100">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'unread', label: `Sin leer (${unreadCount})` },
          { key: 'critical', label: `Críticas (${criticalCount})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              filter === f.key
                ? 'bg-green-100 text-green-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Check size={32} className="mx-auto mb-2 text-green-500" />
            <p>No hay alertas {filter !== 'all' && 'con este filtro'}</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 ${!alert.read ? 'bg-gray-50' : ''} hover:bg-gray-50 transition-colors`}
            >
              <div className="flex gap-3">
                <div className={`p-2 rounded-lg ${getSeverityStyles(alert.severity)}`}>
                  <span className={getIconStyles(alert.severity)}>
                    {getAlertIcon(alert.type, alert.severity)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{alert.title}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{alert.description}</p>
                    </div>
                    {!alert.read && (
                      <button
                        onClick={() => markAsRead.mutate(alert.id)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Marcar como leída"
                      >
                        <X size={14} className="text-gray-400" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={12} />
                      {formatTime(alert.createdAt)}
                    </span>
                    {alert.actionUrl && (
                      <Link
                        href={alert.actionUrl}
                        className="text-xs text-green-600 hover:text-green-700 flex items-center gap-0.5"
                      >
                        {alert.actionLabel || 'Ver más'} <ChevronRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {alerts.length > maxAlerts && (
        <div className="p-3 border-t border-gray-200 text-center">
          <Link
            href="/dashboard/analytics/predictions"
            className="text-sm text-green-600 hover:text-green-700"
          >
            Ver todas las alertas ({alerts.length})
          </Link>
        </div>
      )}
    </div>
  );
}

// Bell icon with notification badge for header/navbar
export function AlertsBellIcon() {
  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['analytics-alerts'],
    queryFn: async () => {
      const [anomalyRes, churnRes] = await Promise.all([
        fetch('/api/analytics/predictions?type=anomalies'),
        fetch('/api/analytics/predictions?type=churn&limit=5'),
      ]);

      const generatedAlerts: Alert[] = [];

      if (anomalyRes.ok) {
        const anomalyData = await anomalyRes.json();
        anomalyData.anomalies?.forEach((a: { id: string; severity: string }) => {
          generatedAlerts.push({
            id: `anomaly-${a.id}`,
            type: 'anomaly',
            severity: a.severity as Alert['severity'],
            title: '',
            description: '',
            createdAt: new Date().toISOString(),
            read: false,
          });
        });
      }

      if (churnRes.ok) {
        const churnData = await churnRes.json();
        churnData.highRiskCustomers
          ?.filter((c: { riskLevel: string }) => c.riskLevel === 'critical' || c.riskLevel === 'high')
          .forEach((c: { customerId: string; riskLevel: string }) => {
            generatedAlerts.push({
              id: `churn-${c.customerId}`,
              type: 'churn',
              severity: c.riskLevel === 'critical' ? 'critical' : 'warning',
              title: '',
              description: '',
              createdAt: new Date().toISOString(),
              read: false,
            });
          });
      }

      return generatedAlerts;
    },
    staleTime: 2 * 60 * 1000,
  });

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const totalCount = alerts.length;

  return (
    <Link
      href="/dashboard/analytics/predictions"
      className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <Bell size={20} className={criticalCount > 0 ? 'text-red-500' : 'text-gray-600'} />
      {totalCount > 0 && (
        <span className={`absolute -top-0.5 -right-0.5 w-5 h-5 text-xs rounded-full flex items-center justify-center font-medium ${
          criticalCount > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
        }`}>
          {totalCount > 9 ? '9+' : totalCount}
        </span>
      )}
    </Link>
  );
}

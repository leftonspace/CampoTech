'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Package,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';

interface StockAlert {
  type: string;
  severity: string;
  item: { id: string; name: string; sku: string | null };
  message: string;
  details: {
    currentStock: number;
    minStockLevel: number | null;
  };
}

interface AlertsResponse {
  success: boolean;
  data: {
    alerts: StockAlert[];
    summary: {
      total: number;
      critical: number;
      warning: number;
      info: number;
    };
  };
}

async function fetchStockAlerts(): Promise<AlertsResponse> {
  const res = await fetch('/api/inventory/alerts');
  if (!res.ok) throw new Error('Error cargando alertas');
  return res.json();
}

export function StockAlerts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-stock-alerts'],
    queryFn: fetchStockAlerts,
    staleTime: 60000,
  });

  const alerts = data?.data?.alerts || [];
  const summary = data?.data?.summary || { total: 0, critical: 0, warning: 0 };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || alerts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Package className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">
          {error ? 'Error cargando alertas' : 'No hay alertas de stock'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      {(summary.critical > 0 || summary.warning > 0) && (
        <div className="flex gap-2">
          {summary.critical > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
              <AlertTriangle className="h-3 w-3" />
              {summary.critical} crítico{summary.critical > 1 ? 's' : ''}
            </span>
          )}
          {summary.warning > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              <TrendingDown className="h-3 w-3" />
              {summary.warning} bajo{summary.warning > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Alerts list */}
      <ul className="space-y-2">
        {alerts.slice(0, 5).map((alert, index) => (
          <li key={`${alert.item.id}-${index}`}>
            <Link
              href={`/dashboard/inventory/products/${alert.item.id}`}
              className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  alert.severity === 'critical'
                    ? 'bg-red-100 text-red-600'
                    : alert.severity === 'warning'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-blue-100 text-blue-600'
                }`}
              >
                {alert.type === 'OUT_OF_STOCK' ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {alert.item.name}
                </p>
                <p className="text-xs text-gray-500">
                  Stock: {alert.details.currentStock}
                  {alert.details.minStockLevel && ` / Mín: ${alert.details.minStockLevel}`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* View all link */}
      {alerts.length > 5 && (
        <Link
          href="/dashboard/inventory/stock?filter=low"
          className="flex items-center justify-center gap-1 text-sm text-primary-600 hover:underline"
        >
          Ver {alerts.length - 5} más
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils';
import {
  Plus,
  Search,
  ChevronRight,
  ShoppingCart,
  Filter,
  Calendar,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Package,
} from 'lucide-react';

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierName: string;
  status: string;
  totalAmount: number;
  expectedDeliveryDate?: string;
  createdAt: string;
  itemCount: number;
}

const PO_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_APPROVAL: 'Pendiente aprobación',
  APPROVED: 'Aprobado',
  SENT: 'Enviado',
  PARTIALLY_RECEIVED: 'Recibido parcial',
  RECEIVED: 'Recibido',
  CANCELLED: 'Cancelado',
};

const PO_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  SENT: 'bg-purple-100 text-purple-800',
  PARTIALLY_RECEIVED: 'bg-orange-100 text-orange-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const PO_STATUS_ICONS: Record<string, React.ElementType> = {
  DRAFT: Clock,
  PENDING_APPROVAL: Clock,
  APPROVED: CheckCircle,
  SENT: Truck,
  PARTIALLY_RECEIVED: Package,
  RECEIVED: CheckCircle,
  CANCELLED: XCircle,
};

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', { search, status }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const res = await fetch(`/api/inventory/purchase-orders?${params}`);
      return res.json();
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ['purchasing-stats'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/purchase-orders?view=stats');
      return res.json();
    },
  });

  const orders = data?.data?.orders as PurchaseOrder[] | undefined;
  const stats = statsData?.data as {
    pendingOrders: number;
    pendingAmount: number;
    monthlyPurchases: number;
  } | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Órdenes de compra</h1>
          <p className="text-gray-500">Gestiona compras a proveedores</p>
        </div>
        <Link href="/dashboard/inventory/purchase-orders/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nueva orden
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-100 p-2 text-yellow-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ordenes pendientes</p>
              <p className="text-xl font-bold text-gray-900">
                {stats?.pendingOrders ?? '-'}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2 text-purple-600">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Monto pendiente</p>
              <p className="text-xl font-bold text-gray-900">
                {stats?.pendingAmount ? formatCurrency(stats.pendingAmount) : '-'}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Compras este mes</p>
              <p className="text-xl font-bold text-gray-900">
                {stats?.monthlyPurchases ? formatCurrency(stats.monthlyPurchases) : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número o proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input pl-10 pr-8 appearance-none"
            >
              <option value="">Todos los estados</option>
              {Object.entries(PO_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Orders list */}
      <div className="card">
        {isLoading ? (
          <div className="divide-y">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : orders?.length ? (
          <div className="divide-y">
            {orders.map((order) => {
              const StatusIcon = PO_STATUS_ICONS[order.status] || Clock;
              return (
                <Link
                  key={order.id}
                  href={`/dashboard/inventory/purchase-orders/${order.id}`}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50"
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
                      order.status === 'RECEIVED' && 'bg-green-100 text-green-600',
                      order.status === 'CANCELLED' && 'bg-red-100 text-red-600',
                      order.status === 'SENT' && 'bg-purple-100 text-purple-600',
                      !['RECEIVED', 'CANCELLED', 'SENT'].includes(order.status) &&
                        'bg-gray-100 text-gray-600'
                    )}
                  >
                    <StatusIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-gray-900">
                        {order.orderNumber}
                      </p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                          PO_STATUS_COLORS[order.status]
                        )}
                      >
                        {PO_STATUS_LABELS[order.status] || order.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{order.supplierName}</span>
                      <span>•</span>
                      <span>{order.itemCount} items</span>
                      {order.expectedDeliveryDate && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {order.expectedDeliveryDate}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(order.totalAmount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatRelativeTime(order.createdAt)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No hay órdenes de compra</p>
            <Link
              href="/dashboard/inventory/purchase-orders/new"
              className="btn-primary mt-4 inline-flex"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear orden
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

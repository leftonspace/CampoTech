'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { cn, formatCurrency } from '@/lib/utils';
import {
  Package,
  Warehouse,
  AlertTriangle,
  ArrowRight,
  Plus,
  ArrowUpDown,
  BarChart3,
} from 'lucide-react';

interface InventoryStats {
  totalProducts: number;
  totalWarehouses: number;
  lowStockItems: number;
  pendingOrders: number;
  pendingReceiving: number;
  totalStockValue: number;
  replenishmentRequests: number;
}

export default function InventoryPage() {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/products?view=stats');
      return res.json();
    },
  });

  const stats = statsData?.data as InventoryStats | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500">Gestiona productos y stock en oficina y vehículos</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/inventory/products/new" className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo producto
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Productos"
          value={stats?.totalProducts ?? '-'}
          icon={Package}
          loading={isLoading}
          color="blue"
          href="/dashboard/inventory/products"
        />
        <StatCard
          title="Almacenes"
          value={stats?.totalWarehouses ?? '-'}
          icon={Warehouse}
          loading={isLoading}
          color="green"
          href="/dashboard/inventory/warehouses"
        />
        <StatCard
          title="Stock bajo"
          value={stats?.lowStockItems ?? '-'}
          icon={AlertTriangle}
          loading={isLoading}
          color="yellow"
          href="/dashboard/inventory/stock?filter=low"
        />
        <StatCard
          title="Valor total"
          value={stats?.totalStockValue ? formatCurrency(stats.totalStockValue) : '-'}
          icon={BarChart3}
          loading={isLoading}
          color="purple"
        />
      </div>

      {/* Low stock alerts */}
      <div className="card">
        <div className="card-header flex flex-row items-center justify-between">
          <h2 className="card-title text-lg">Alertas de stock</h2>
          <Link
            href="/dashboard/inventory/stock?filter=low"
            className="text-sm text-primary-600 hover:underline"
          >
            Ver todo
            <ArrowRight className="ml-1 inline h-4 w-4" />
          </Link>
        </div>
        <div className="card-content">
          <LowStockList />
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title text-lg">Acciones rápidas</h2>
        </div>
        <div className="card-content">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QuickAction
              href="/dashboard/inventory/products"
              icon={Package}
              title="Productos"
              description="Catálogo de productos"
            />
            <QuickAction
              href="/dashboard/inventory/stock"
              icon={ArrowUpDown}
              title="Movimientos"
              description="Ver movimientos de stock"
            />
            <QuickAction
              href="/dashboard/inventory/warehouses"
              icon={Warehouse}
              title="Almacenes"
              description="Gestionar ubicaciones"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  loading?: boolean;
  color: 'blue' | 'green' | 'yellow' | 'purple';
  href?: string;
}

function StatCard({ title, value, icon: Icon, loading, color, href }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  const content = (
    <div className="flex items-center gap-4">
      <div className={cn('rounded-full p-3', colorClasses[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        {loading ? (
          <div className="h-7 w-16 animate-pulse rounded bg-gray-200" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="card p-4 transition-colors hover:bg-gray-50">
        {content}
      </Link>
    );
  }

  return <div className="card p-4">{content}</div>;
}

interface QuickActionProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

function QuickAction({ href, icon: Icon, title, description }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-gray-50"
    >
      <div className="rounded-full bg-primary-100 p-2 text-primary-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </Link>
  );
}

function LowStockList() {
  const { data, isLoading } = useQuery({
    queryKey: ['low-stock-products'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/products?filter=lowStock&pageSize=5');
      return res.json();
    },
  });

  const products = data?.data?.products as Array<{
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    minStock: number;
  }> | undefined;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 rounded-lg border p-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!products?.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <Package className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-gray-500">Todos los productos tienen stock suficiente</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {products.map((product) => (
        <li key={product.id}>
          <Link
            href={`/dashboard/inventory/products/${product.id}`}
            className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-gray-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-gray-900">{product.name}</p>
              <p className="text-sm text-gray-500">{product.sku}</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-red-600">{product.currentStock}</p>
              <p className="text-xs text-gray-500">Min: {product.minStock}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

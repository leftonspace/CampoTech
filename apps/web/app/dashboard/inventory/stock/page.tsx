'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Package,
  Warehouse,
  Calendar,
  FileText,
} from 'lucide-react';

interface StockMovement {
  id: string;
  productName: string;
  productSku: string;
  warehouseName: string;
  movementType: string;
  direction: 'IN' | 'OUT';
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  reference?: string;
  notes?: string;
  performedByName?: string;
  createdAt: string;
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Compra',
  SALE: 'Venta',
  ADJUSTMENT: 'Ajuste',
  TRANSFER: 'Transferencia',
  RETURN: 'Devolución',
  INITIAL: 'Stock inicial',
  COUNT: 'Conteo',
  RESERVED: 'Reserva',
  RELEASED: 'Liberación',
};

export default function StockPage() {
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [movementType, setMovementType] = useState('');
  const [view, setView] = useState<'movements' | 'levels' | 'counts'>('movements');

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/warehouses');
      return res.json();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['stock-movements', { search, warehouseId, movementType }],
    queryFn: async () => {
      const params = new URLSearchParams({ view: 'movements' });
      if (search) params.set('productId', search);
      if (warehouseId) params.set('warehouseId', warehouseId);
      if (movementType) params.set('movementType', movementType);
      const res = await fetch(`/api/inventory/stock?${params}`);
      return res.json();
    },
    enabled: view === 'movements',
  });

  const movements = data?.data?.movements as StockMovement[] | undefined;
  const warehouses = warehousesData?.data?.warehouses as Array<{ id: string; name: string }> | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
          <p className="text-gray-500">Movimientos y niveles de inventario</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/inventory/stock/adjust" className="btn-secondary">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Ajustar stock
          </Link>
          <Link href="/dashboard/inventory/stock/count" className="btn-primary">
            <FileText className="mr-2 h-4 w-4" />
            Nuevo conteo
          </Link>
        </div>
      </div>

      {/* View tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          <button
            onClick={() => setView('movements')}
            className={cn(
              'border-b-2 px-1 pb-3 text-sm font-medium transition-colors',
              view === 'movements'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Movimientos
          </button>
          <button
            onClick={() => setView('levels')}
            className={cn(
              'border-b-2 px-1 pb-3 text-sm font-medium transition-colors',
              view === 'levels'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Niveles por almacén
          </button>
          <button
            onClick={() => setView('counts')}
            className={cn(
              'border-b-2 px-1 pb-3 text-sm font-medium transition-colors',
              view === 'counts'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Conteos de inventario
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          <div className="relative">
            <Warehouse className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="input pl-10 pr-8 appearance-none"
            >
              <option value="">Todos los almacenes</option>
              {warehouses?.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              className="input pl-10 pr-8 appearance-none"
            >
              <option value="">Todos los tipos</option>
              {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Movements list */}
      {view === 'movements' && (
        <div className="card">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : movements?.length ? (
            <div className="divide-y">
              {movements.map((movement) => (
                <div key={movement.id} className="flex items-center gap-4 p-4">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full',
                      movement.direction === 'IN'
                        ? 'bg-green-100 text-green-600'
                        : 'bg-red-100 text-red-600'
                    )}
                  >
                    {movement.direction === 'IN' ? (
                      <ArrowDown className="h-5 w-5" />
                    ) : (
                      <ArrowUp className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-gray-900">
                        {movement.productName}
                      </p>
                      <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        {MOVEMENT_TYPE_LABELS[movement.movementType] || movement.movementType}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{movement.productSku}</span>
                      <span>•</span>
                      <span>{movement.warehouseName}</span>
                      {movement.reference && (
                        <>
                          <span>•</span>
                          <span>{movement.reference}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'font-semibold',
                        movement.direction === 'IN' ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {movement.direction === 'IN' ? '+' : '-'}
                      {movement.quantity}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatRelativeTime(movement.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <ArrowUpDown className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">No hay movimientos de stock</p>
            </div>
          )}
        </div>
      )}

      {/* Stock levels view */}
      {view === 'levels' && <StockLevelsView warehouseId={warehouseId} />}

      {/* Inventory counts view */}
      {view === 'counts' && <InventoryCountsView />}
    </div>
  );
}

function StockLevelsView({ warehouseId }: { warehouseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-levels', warehouseId],
    queryFn: async () => {
      const params = new URLSearchParams({ view: 'levels' });
      if (warehouseId) params.set('warehouseId', warehouseId);
      const res = await fetch(`/api/inventory/stock?${params}`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="card p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-8 text-center">
      <Package className="mx-auto h-12 w-12 text-gray-400" />
      <p className="mt-4 text-gray-500">
        Selecciona un producto para ver niveles de stock
      </p>
    </div>
  );
}

function InventoryCountsView() {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-counts'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/stock?view=counts');
      return res.json();
    },
  });

  const counts = data?.data?.counts as Array<{
    id: string;
    countNumber: string;
    warehouseName: string;
    countType: string;
    status: string;
    scheduledAt?: string;
    completedAt?: string;
  }> | undefined;

  const COUNT_STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };

  const COUNT_STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pendiente',
    IN_PROGRESS: 'En progreso',
    COMPLETED: 'Completado',
    CANCELLED: 'Cancelado',
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!counts?.length) {
    return (
      <div className="card p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-4 text-gray-500">No hay conteos de inventario</p>
        <Link
          href="/dashboard/inventory/stock/count"
          className="btn-primary mt-4 inline-flex"
        >
          Crear conteo
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="divide-y">
        {counts.map((count) => (
          <Link
            key={count.id}
            href={`/dashboard/inventory/stock/counts/${count.id}`}
            className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <FileText className="h-5 w-5 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-gray-900">
                {count.countNumber}
              </p>
              <p className="text-sm text-gray-500">
                {count.warehouseName} • {count.countType}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-1 text-xs font-medium',
                COUNT_STATUS_COLORS[count.status]
              )}
            >
              {COUNT_STATUS_LABELS[count.status] || count.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

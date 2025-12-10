'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  RefreshCw,
  Search,
  Calendar,
  Package,
  Warehouse,
  FileText,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface StockMovement {
  id: string;
  movementType: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  previousQty: number;
  newQty: number;
  unitCost: number;
  totalCost: number;
  fromWarehouseId?: string;
  fromWarehouseName?: string;
  toWarehouseId?: string;
  toWarehouseName?: string;
  reference?: string;
  notes?: string;
  createdByName?: string;
  createdAt: string;
}

const MOVEMENT_TYPES = [
  { value: '', label: 'Todos' },
  { value: 'PURCHASE', label: 'Compra' },
  { value: 'SALE', label: 'Venta' },
  { value: 'ADJUSTMENT', label: 'Ajuste' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'RETURN', label: 'Devolución' },
  { value: 'JOB_USAGE', label: 'Uso en trabajo' },
  { value: 'COUNT', label: 'Conteo' },
  { value: 'INITIAL', label: 'Stock inicial' },
];

const MOVEMENT_TYPE_ICONS: Record<string, typeof ArrowUpRight> = {
  PURCHASE: ArrowDownRight,
  SALE: ArrowUpRight,
  ADJUSTMENT: RefreshCw,
  TRANSFER: ArrowLeftRight,
  RETURN: ArrowDownRight,
  JOB_USAGE: ArrowUpRight,
  COUNT: RefreshCw,
  INITIAL: ArrowDownRight,
};

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  PURCHASE: 'bg-green-100 text-green-700',
  SALE: 'bg-red-100 text-red-700',
  ADJUSTMENT: 'bg-yellow-100 text-yellow-700',
  TRANSFER: 'bg-blue-100 text-blue-700',
  RETURN: 'bg-purple-100 text-purple-700',
  JOB_USAGE: 'bg-orange-100 text-orange-700',
  COUNT: 'bg-gray-100 text-gray-700',
  INITIAL: 'bg-cyan-100 text-cyan-700',
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Compra',
  SALE: 'Venta',
  ADJUSTMENT: 'Ajuste',
  TRANSFER: 'Transferencia',
  RETURN: 'Devolución',
  JOB_USAGE: 'Uso en trabajo',
  COUNT: 'Conteo',
  INITIAL: 'Stock inicial',
};

export default function StockMovementsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const pageSize = 20;

  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['stock-movements', page, search, typeFilter, warehouseFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        view: 'movements',
        page: String(page),
        limit: String(pageSize),
      });
      if (search) params.append('search', search);
      if (typeFilter) params.append('movementType', typeFilter);
      if (warehouseFilter) params.append('warehouseId', warehouseFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const res = await fetch(`/api/inventory/stock?${params}`);
      return res.json();
    },
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/warehouses');
      return res.json();
    },
  });

  const movements = movementsData?.data?.movements as StockMovement[] | undefined;
  const total = movementsData?.data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const warehouses = warehousesData?.data?.warehouses || [];

  const { data: statsData } = useQuery({
    queryKey: ['movement-stats', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ view: 'movement-stats' });
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      const res = await fetch(`/api/inventory/stock?${params}`);
      return res.json();
    },
  });

  const stats = statsData?.data?.stats;

  const handleExport = async () => {
    const params = new URLSearchParams({
      view: 'movements',
      export: 'csv',
      limit: '10000',
    });
    if (search) params.append('search', search);
    if (typeFilter) params.append('movementType', typeFilter);
    if (warehouseFilter) params.append('warehouseId', warehouseFilter);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    window.open(`/api/inventory/stock?${params}`, '_blank');
  };

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setWarehouseFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/inventory/stock"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Historial de movimientos</h1>
          <p className="text-gray-500">Todos los movimientos de stock</p>
        </div>
        <button onClick={handleExport} className="btn-outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2 text-green-600">
                <ArrowDownRight className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Entradas</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalInbound}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2 text-red-600">
                <ArrowUpRight className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Salidas</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalOutbound}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                <ArrowLeftRight className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Transferencias</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalTransfers}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-100 p-2 text-yellow-600">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Ajustes</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalAdjustments}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por producto, SKU o referencia..."
              className="input pl-10 w-full"
            />
          </div>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="input"
          >
            {MOVEMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          {/* Toggle filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn('btn-outline', showFilters && 'bg-gray-100')}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </button>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="grid gap-4 sm:grid-cols-4 pt-4 border-t">
            {/* Warehouse */}
            <div>
              <label className="label mb-1 block">Almacén</label>
              <div className="relative">
                <Warehouse className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={warehouseFilter}
                  onChange={(e) => {
                    setWarehouseFilter(e.target.value);
                    setPage(1);
                  }}
                  className="input pl-10"
                >
                  <option value="">Todos los almacenes</option>
                  {warehouses.map((wh: any) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date from */}
            <div>
              <label className="label mb-1 block">Desde</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Date to */}
            <div>
              <label className="label mb-1 block">Hasta</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Clear filters */}
            <div className="flex items-end">
              <button onClick={clearFilters} className="btn-outline w-full">
                Limpiar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Movements list */}
      <div className="card">
        <div className="border-b px-6 py-4">
          <h2 className="font-medium text-gray-900">
            Movimientos ({total.toLocaleString()})
          </h2>
        </div>

        {isLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 rounded bg-gray-200" />
              ))}
            </div>
          </div>
        ) : movements?.length ? (
          <>
            <div className="divide-y">
              {movements.map((movement) => {
                const Icon = MOVEMENT_TYPE_ICONS[movement.movementType] || RefreshCw;
                const colorClass =
                  MOVEMENT_TYPE_COLORS[movement.movementType] || 'bg-gray-100 text-gray-700';
                const isInbound = ['PURCHASE', 'RETURN', 'INITIAL'].includes(
                  movement.movementType
                );
                const isTransfer = movement.movementType === 'TRANSFER';

                return (
                  <div key={movement.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-4">
                      {/* Type icon */}
                      <div className={cn('rounded-full p-2', colorClass)}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Movement info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/dashboard/inventory/products/${movement.productId}`}
                            className="font-medium text-gray-900 hover:text-primary-600"
                          >
                            {movement.productName}
                          </Link>
                          <span className="text-sm text-gray-500">{movement.productSku}</span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              colorClass
                            )}
                          >
                            {MOVEMENT_TYPE_LABELS[movement.movementType] || movement.movementType}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="mt-1 text-sm text-gray-500">
                          {isTransfer ? (
                            <span>
                              {movement.fromWarehouseName} &rarr; {movement.toWarehouseName}
                            </span>
                          ) : (
                            movement.toWarehouseName && (
                              <span className="flex items-center gap-1">
                                <Warehouse className="h-3 w-3" />
                                {movement.toWarehouseName || movement.fromWarehouseName}
                              </span>
                            )
                          )}
                          {movement.reference && (
                            <span className="ml-3 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {movement.reference}
                            </span>
                          )}
                        </div>

                        {movement.notes && (
                          <p className="mt-1 text-sm text-gray-500 truncate">{movement.notes}</p>
                        )}

                        <div className="mt-1 text-xs text-gray-400">
                          {formatDate(movement.createdAt, 'PPp')}
                          {movement.createdByName && ` • ${movement.createdByName}`}
                        </div>
                      </div>

                      {/* Quantity change */}
                      <div className="text-right">
                        <div
                          className={cn(
                            'text-lg font-bold',
                            isInbound || isTransfer ? 'text-green-600' : 'text-red-600'
                          )}
                        >
                          {isInbound ? '+' : isTransfer ? '±' : '-'}
                          {Math.abs(movement.quantity)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {movement.previousQty} &rarr; {movement.newQty}
                        </div>
                        {movement.totalCost > 0 && (
                          <div className="text-xs text-gray-400">
                            {formatCurrency(movement.totalCost)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-6 py-4">
                <p className="text-sm text-gray-500">
                  Mostrando {(page - 1) * pageSize + 1} a{' '}
                  {Math.min(page * pageSize, total)} de {total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="btn-outline px-3 py-1 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="flex items-center px-3 text-sm text-gray-600">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="btn-outline px-3 py-1 disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No hay movimientos</p>
            {(search || typeFilter || warehouseFilter || dateFrom || dateTo) && (
              <button
                onClick={clearFilters}
                className="mt-2 text-sm text-primary-600 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

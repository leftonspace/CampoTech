'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn, formatCurrency } from '@/lib/utils';
import {
  Package,
  Plus,
  Search,
  CheckCircle,
  TrendingDown,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Edit2,
  Minus,
  RefreshCw,
  Trash2,
  MapPin,
  X,
} from 'lucide-react';
import InventoryItemModal from './InventoryItemModal';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface InventoryLevel {
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
}

interface ProductCategory {
  id: string;
  code: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  category?: ProductCategory;
  unitOfMeasure: string;
  minStockLevel: number;
  costPrice: number;
  salePrice: number;
  isActive: boolean;
  trackInventory: boolean;
  inventoryLevels: InventoryLevel[];
  stock: {
    onHand: number;
    reserved: number;
    available: number;
    isLowStock: boolean;
    isOutOfStock: boolean;
  };
}

type StockStatus = 'normal' | 'low' | 'critical';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<string, string> = {
  PARTS: 'Repuestos',
  CONSUMABLES: 'Consumibles',
  TOOLS: 'Herramientas',
  EQUIPMENT: 'Equipos',
  REFRIGERATION: 'Refrigeración',
  ELECTRICAL: 'Eléctrico',
  PLUMBING: 'Plomería',
  GAS: 'Gas',
  OTHER: 'Otros',
};

const UNIT_LABELS: Record<string, string> = {
  unidad: 'unidades',
  metro: 'metros',
  litro: 'litros',
  kg: 'kg',
  rollo: 'rollos',
  tubo: 'tubos',
  pieza: 'piezas',
  caja: 'cajas',
  paquete: 'paquetes',
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getStockStatus(currentStock: number, minStock: number): StockStatus {
  if (currentStock <= minStock) return 'critical';
  if (currentStock <= minStock * 1.5) return 'low';
  return 'normal';
}

function getStockPercentage(currentStock: number, minStock: number): number {
  // Progress bar fills up at 2x minimum stock (healthy level)
  const healthyLevel = minStock * 2;
  const percentage = (currentStock / healthyLevel) * 100;
  return Math.min(percentage, 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function InventoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StockStatus | ''>('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Fetch products
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['inventory-products', search, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryFilter) params.set('categoryId', categoryFilter);
      const res = await fetch(`/api/inventory/products?${params.toString()}`);
      if (!res.ok) throw new Error('Error loading inventory');
      return res.json();
    },
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/products?view=categories');
      return res.json();
    },
  });

  const products = useMemo(() => (productsData?.data?.products as Product[]) || [], [productsData?.data?.products]);
  const categories = useMemo(() => (categoriesData?.data?.categories as ProductCategory[]) || [], [categoriesData?.data?.categories]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = products.length;
    let normal = 0;
    let low = 0;
    let critical = 0;

    products.forEach(product => {
      const status = getStockStatus(product.stock?.onHand || 0, product.minStockLevel);
      if (status === 'normal') normal++;
      else if (status === 'low') low++;
      else critical++;
    });

    return { total, normal, low, critical };
  }, [products]);

  // Filter products by status
  const filteredProducts = useMemo(() => {
    if (!statusFilter) return products;
    return products.filter(product => {
      const status = getStockStatus(product.stock?.onHand || 0, product.minStockLevel);
      return status === statusFilter;
    });
  }, [products, statusFilter]);

  // Check if any filters are active
  const hasActiveFilters = search || categoryFilter || statusFilter;

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setStatusFilter('');
  };

  // Handle menu click
  const handleMenuClick = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === itemId ? null : itemId);
  };

  // Handle action
  const handleAction = (action: string, product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);

    switch (action) {
      case 'view':
        setSelectedItemId(product.id);
        break;
      case 'edit':
        router.push(`/dashboard/inventory/products/${product.id}/edit`);
        break;
      case 'add-stock':
        router.push(`/dashboard/inventory/stock/adjust?productId=${product.id}&type=add`);
        break;
      case 'reduce-stock':
        router.push(`/dashboard/inventory/stock/adjust?productId=${product.id}&type=reduce`);
        break;
      case 'transfer':
        router.push(`/dashboard/inventory/stock/transfer?productId=${product.id}`);
        break;
      case 'delete':
        if (confirm(`¿Estás seguro de eliminar "${product.name}"?`)) {
          // TODO: Implement delete
        }
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500">Gestiona productos y stock</p>
        </div>
        <Link href="/dashboard/inventory/products/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Producto
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Productos"
          value={stats.total}
          icon={Package}
          iconBg="bg-teal-100"
          iconColor="text-teal-600"
          loading={productsLoading}
          onClick={() => setStatusFilter('')}
          active={statusFilter === ''}
        />
        <StatCard
          title="Stock Normal"
          value={stats.normal}
          valueColor="text-green-600"
          icon={CheckCircle}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          loading={productsLoading}
          onClick={() => setStatusFilter('normal')}
          active={statusFilter === 'normal'}
        />
        <StatCard
          title="Stock Bajo"
          value={stats.low}
          valueColor="text-orange-600"
          icon={TrendingDown}
          iconBg="bg-orange-100"
          iconColor="text-orange-600"
          loading={productsLoading}
          onClick={() => setStatusFilter('low')}
          active={statusFilter === 'low'}
        />
        <StatCard
          title="Crítico"
          value={stats.critical}
          valueColor="text-red-600"
          icon={AlertTriangle}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          loading={productsLoading}
          onClick={() => setStatusFilter('critical')}
          active={statusFilter === 'critical'}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 py-2 px-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <X className="h-4 w-4" />
            Limpiar
          </button>
        )}
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden">
        {productsLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Cargando productos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {hasActiveFilters ? 'Sin resultados' : 'No hay productos'}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {hasActiveFilters
                ? 'No se encontraron productos con los filtros seleccionados'
                : 'Agregá tu primer producto para comenzar'}
            </p>
            {hasActiveFilters ? (
              <button onClick={clearFilters} className="btn-outline mt-4">
                Limpiar filtros
              </button>
            ) : (
              <Link href="/dashboard/inventory/products/new" className="btn-primary mt-4 inline-flex">
                <Plus className="mr-2 h-4 w-4" />
                Agregar Producto
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Categoría
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Stock
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Ubicación
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Precio
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredProducts.map((product) => {
                  const stockOnHand = product.stock?.onHand || 0;
                  const status = getStockStatus(stockOnHand, product.minStockLevel);
                  const percentage = getStockPercentage(stockOnHand, product.minStockLevel);
                  const primaryLocation = product.inventoryLevels?.[0];

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedItemId(product.id)}
                    >
                      {/* Product */}
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-sm text-gray-500">{product.sku}</p>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600">
                          {product.category?.name || 'Sin categoría'}
                        </span>
                      </td>

                      {/* Stock */}
                      <td className="px-4 py-4">
                        <div className="w-32">
                          <p className="text-sm font-medium text-gray-900">
                            {stockOnHand} {UNIT_LABELS[product.unitOfMeasure] || product.unitOfMeasure}
                          </p>
                          <StockProgressBar percentage={percentage} status={status} />
                          <p className="text-xs text-gray-400 mt-0.5">
                            Mín: {product.minStockLevel}
                          </p>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-4">
                        {product.inventoryLevels && product.inventoryLevels.length > 0 ? (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <MapPin className="h-3.5 w-3.5 text-gray-400" />
                            <span>
                              {primaryLocation?.warehouse?.name}
                              {product.inventoryLevels.length > 1 && (
                                <span className="text-gray-400"> +{product.inventoryLevels.length - 1}</span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="px-4 py-4">
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(product.salePrice)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <StatusBadge status={status} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => handleMenuClick(product.id, e)}
                            className="p-1 rounded hover:bg-gray-100"
                          >
                            <MoreHorizontal className="h-5 w-5 text-gray-400" />
                          </button>
                          {openMenuId === product.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-10">
                              <button
                                onClick={(e) => handleAction('view', product, e)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                Ver detalles
                              </button>
                              <button
                                onClick={(e) => handleAction('edit', product, e)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Edit2 className="h-4 w-4" />
                                Editar producto
                              </button>
                              <button
                                onClick={(e) => handleAction('add-stock', product, e)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Plus className="h-4 w-4" />
                                Agregar stock
                              </button>
                              <button
                                onClick={(e) => handleAction('reduce-stock', product, e)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Minus className="h-4 w-4" />
                                Reducir stock
                              </button>
                              <button
                                onClick={(e) => handleAction('transfer', product, e)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <RefreshCw className="h-4 w-4" />
                                Transferir
                              </button>
                              <div className="border-t my-1" />
                              <button
                                onClick={(e) => handleAction('delete', product, e)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Item Detail Modal */}
      <InventoryItemModal
        itemId={selectedItemId}
        onClose={() => setSelectedItemId(null)}
        onEdit={(itemId) => {
          setSelectedItemId(null);
          router.push(`/dashboard/inventory/products/${itemId}/edit`);
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  title: string;
  value: number;
  valueColor?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
  onClick?: () => void;
  active?: boolean;
}

function StatCard({
  title,
  value,
  valueColor = 'text-gray-900',
  icon: Icon,
  iconBg,
  iconColor,
  loading,
  onClick,
  active,
}: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'card p-4 text-left transition-all hover:shadow-md w-full',
        active && 'ring-2 ring-teal-500 bg-teal-50'
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn('rounded-full p-3', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          {loading ? (
            <div className="h-7 w-12 animate-pulse rounded bg-gray-200 mt-1" />
          ) : (
            <p className={cn('text-2xl font-bold', valueColor)}>{value}</p>
          )}
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK PROGRESS BAR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface StockProgressBarProps {
  percentage: number;
  status: StockStatus;
}

function StockProgressBar({ percentage, status }: StockProgressBarProps) {
  const colorClass = {
    normal: 'bg-green-500',
    low: 'bg-orange-500',
    critical: 'bg-red-500',
  }[status];

  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
      <div
        className={cn('h-1.5 rounded-full transition-all', colorClass)}
        style={{ width: `${Math.max(percentage, 5)}%` }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface StatusBadgeProps {
  status: StockStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    normal: {
      label: 'Normal',
      className: 'bg-green-100 text-green-700',
    },
    low: {
      label: 'Stock Bajo',
      className: 'bg-orange-100 text-orange-700',
    },
    critical: {
      label: 'Crítico',
      className: 'bg-red-100 text-red-700',
    },
  }[status];

  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

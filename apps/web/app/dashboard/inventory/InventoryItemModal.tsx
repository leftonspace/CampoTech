'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  X,
  Package,
  MapPin,
  Edit2,
  Plus,
  Minus,
  RefreshCw,
  History,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface InventoryStock {
  locationId: string;
  quantity: number;
  location: {
    id: string;
    name: string;
    locationType: string;
  };
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  minStockLevel: number;
  costPrice: number;
  salePrice: number;
  isActive: boolean;
  totalStock: number;
  isLowStock: boolean;
  stocks: InventoryStock[];
  createdAt?: string;
  updatedAt?: string;
}

interface InventoryItemModalProps {
  itemId: string | null;
  onClose: () => void;
  onEdit?: (itemId: string) => void;
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
  const healthyLevel = minStock * 2;
  const percentage = (currentStock / healthyLevel) * 100;
  return Math.min(percentage, 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function InventoryItemModal({
  itemId,
  onClose,
  onEdit,
}: InventoryItemModalProps) {
  const router = useRouter();

  // Fetch item details
  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-item-detail', itemId],
    queryFn: async () => {
      if (!itemId) return null;
      const res = await fetch(`/api/inventory/items/${itemId}`);
      if (!res.ok) throw new Error('Error fetching item');
      return res.json();
    },
    enabled: !!itemId,
  });

  const item: InventoryItem | null = data?.data || null;

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Don't render if no item selected
  if (!itemId) return null;

  const handleAddStock = () => {
    router.push(`/dashboard/inventory/stock/adjust?itemId=${itemId}&type=add`);
    onClose();
  };

  const handleReduceStock = () => {
    router.push(`/dashboard/inventory/stock/adjust?itemId=${itemId}&type=reduce`);
    onClose();
  };

  const handleTransfer = () => {
    router.push(`/dashboard/inventory/stock/transfer?itemId=${itemId}`);
    onClose();
  };

  const handleViewHistory = () => {
    router.push(`/dashboard/inventory/products/${itemId}/history`);
    onClose();
  };

  const handleViewFull = () => {
    router.push(`/dashboard/inventory/products/${itemId}`);
    onClose();
  };

  const status = item ? getStockStatus(item.totalStock, item.minStockLevel) : 'normal';
  const percentage = item ? getStockPercentage(item.totalStock, item.minStockLevel) : 0;

  const statusConfig = {
    normal: {
      label: 'Normal',
      className: 'bg-green-100 text-green-700',
      barColor: 'bg-green-500',
    },
    low: {
      label: 'Stock Bajo',
      className: 'bg-orange-100 text-orange-700',
      barColor: 'bg-orange-500',
    },
    critical: {
      label: 'Crítico',
      className: 'bg-red-100 text-red-700',
      barColor: 'bg-red-500',
    },
  }[status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          {isLoading ? (
            <div className="flex items-center gap-4 animate-pulse">
              <div className="h-12 w-12 rounded-lg bg-gray-200" />
              <div className="space-y-2">
                <div className="h-5 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
            </div>
          ) : item ? (
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="h-12 w-12 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Package className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900">{item.name}</h2>
                  <span className={cn(
                    'px-2.5 py-0.5 text-xs font-medium rounded-full',
                    statusConfig.className
                  )}>
                    {statusConfig.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{item.sku}</p>
              </div>
            </div>
          ) : null}

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-4 animate-pulse">
              <div className="h-4 w-full bg-gray-200 rounded" />
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-red-500">Error al cargar el producto</p>
            </div>
          ) : item ? (
            <>
              {/* Stock Overview */}
              <div className="p-6 border-b bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Stock Total</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {item.totalStock} {UNIT_LABELS[item.unit] || item.unit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full transition-all', statusConfig.barColor)}
                    style={{ width: `${Math.max(percentage, 5)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0</span>
                  <span>Mín: {item.minStockLevel}</span>
                  <span>Óptimo: {item.minStockLevel * 2}</span>
                </div>
              </div>

              {/* Details Section */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Detalles
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Categoría</p>
                    <p className="text-sm font-medium text-gray-900">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Unidad</p>
                    <p className="text-sm font-medium text-gray-900">
                      {UNIT_LABELS[item.unit] || item.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Precio de Costo</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(item.costPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Precio de Venta</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(item.salePrice)}
                    </p>
                  </div>
                </div>
                {item.description && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-400">Descripción</p>
                    <p className="text-sm text-gray-700">{item.description}</p>
                  </div>
                )}
              </div>

              {/* Stock by Location */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Stock por Ubicación
                </h3>
                {item.stocks && item.stocks.length > 0 ? (
                  <div className="space-y-2">
                    {item.stocks.map((stock) => (
                      <div
                        key={stock.locationId}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{stock.location.name}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                            {stock.location.locationType}
                          </span>
                        </div>
                        <span className="font-semibold text-gray-900">
                          {stock.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Sin stock en ninguna ubicación
                  </p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Acciones
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleAddStock}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar
                  </button>
                  <button
                    onClick={handleReduceStock}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                    Reducir
                  </button>
                  <button
                    onClick={handleTransfer}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Transferir
                  </button>
                  <button
                    onClick={handleViewHistory}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <History className="h-4 w-4" />
                    Historial
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(itemId!)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Edit2 className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-700">Editar producto</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </button>
                  )}
                  <button
                    onClick={handleViewFull}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="text-sm font-medium">Ver página completa</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

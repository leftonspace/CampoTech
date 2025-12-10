'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { cn, formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Warehouse,
  MapPin,
  Phone,
  Mail,
  Package,
  AlertTriangle,
  CheckCircle,
  Trash2,
  BarChart3,
} from 'lucide-react';

interface WarehouseDetail {
  id: string;
  code: string;
  name: string;
  type: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StockSummary {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

interface StockItem {
  productId: string;
  productName: string;
  productSku: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  minStock: number;
  status: 'OK' | 'LOW' | 'OUT';
}

const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  MAIN: 'Principal',
  SECONDARY: 'Secundario',
  TRANSIT: 'En tránsito',
  VEHICLE: 'Vehículo',
};

export default function WarehouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const warehouseId = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<WarehouseDetail>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouse', warehouseId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/warehouses?id=${warehouseId}`);
      return res.json();
    },
  });

  const { data: stockData } = useQuery({
    queryKey: ['warehouse-stock', warehouseId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/stock?view=levels&warehouseId=${warehouseId}`);
      return res.json();
    },
  });

  const { data: summaryData } = useQuery({
    queryKey: ['warehouse-summary', warehouseId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/warehouses?id=${warehouseId}&view=summary`);
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<WarehouseDetail>) => {
      const res = await fetch('/api/inventory/warehouses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: warehouseId, ...data }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse', warehouseId] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/inventory/warehouses?id=${warehouseId}`, {
        method: 'DELETE',
      });
      return res.json();
    },
    onSuccess: () => {
      router.push('/dashboard/inventory/warehouses');
    },
  });

  const warehouse = data?.data?.warehouse as WarehouseDetail | undefined;
  const stockItems = stockData?.data?.levels as StockItem[] | undefined;
  const summary = summaryData?.data?.summary as StockSummary | undefined;

  const handleEdit = () => {
    if (warehouse) {
      setEditData({
        name: warehouse.name,
        code: warehouse.code,
        type: warehouse.type,
        address: warehouse.address || '',
        contactName: warehouse.contactName || '',
        contactPhone: warehouse.contactPhone || '',
        contactEmail: warehouse.contactEmail || '',
        isDefault: warehouse.isDefault,
        isActive: warehouse.isActive,
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(editData);
  };

  const handleDelete = () => {
    if (confirm('¿Estás seguro de eliminar este almacén? Esta acción no se puede deshacer.')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !warehouse) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/inventory/warehouses"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Almacén no encontrado</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/inventory/warehouses"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{warehouse.name}</h1>
            {warehouse.isDefault && (
              <span className="rounded-full bg-primary-100 px-2 py-1 text-xs font-medium text-primary-700">
                Principal
              </span>
            )}
            {!warehouse.isActive && (
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                Inactivo
              </span>
            )}
          </div>
          <p className="text-gray-500">
            {warehouse.code} • {WAREHOUSE_TYPE_LABELS[warehouse.type]}
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="btn-outline">
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="btn-primary"
              >
                <Save className="mr-2 h-4 w-4" />
                Guardar
              </button>
            </>
          ) : (
            <>
              <button onClick={handleDelete} className="btn-outline text-red-600 hover:bg-red-50">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </button>
              <button onClick={handleEdit} className="btn-primary">
                <Edit2 className="mr-2 h-4 w-4" />
                Editar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Productos</p>
                <p className="text-xl font-bold text-gray-900">{summary.totalProducts}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2 text-green-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Valor total</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(summary.totalValue)}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-100 p-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Stock bajo</p>
                <p className="text-xl font-bold text-gray-900">{summary.lowStockCount}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Sin stock</p>
                <p className="text-xl font-bold text-gray-900">{summary.outOfStockCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Warehouse details */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Detalles</h2>

            {isEditing ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label mb-1 block">Nombre *</label>
                    <input
                      type="text"
                      value={editData.name || ''}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block">Código *</label>
                    <input
                      type="text"
                      value={editData.code || ''}
                      onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="label mb-1 block">Dirección</label>
                  <input
                    type="text"
                    value={editData.address || ''}
                    onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="label mb-1 block">Contacto</label>
                    <input
                      type="text"
                      value={editData.contactName || ''}
                      onChange={(e) => setEditData({ ...editData, contactName: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block">Teléfono</label>
                    <input
                      type="text"
                      value={editData.contactPhone || ''}
                      onChange={(e) => setEditData({ ...editData, contactPhone: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block">Email</label>
                    <input
                      type="email"
                      value={editData.contactEmail || ''}
                      onChange={(e) => setEditData({ ...editData, contactEmail: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editData.isDefault ?? false}
                      onChange={(e) => setEditData({ ...editData, isDefault: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Almacén principal</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editData.isActive ?? true}
                      onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Activo</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {warehouse.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-700">{warehouse.address}</span>
                  </div>
                )}
                {warehouse.contactName && (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">Contacto:</span>
                    <span className="text-gray-700">{warehouse.contactName}</span>
                  </div>
                )}
                {warehouse.contactPhone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-700">{warehouse.contactPhone}</span>
                  </div>
                )}
                {warehouse.contactEmail && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-700">{warehouse.contactEmail}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stock items */}
          <div className="card">
            <div className="border-b px-6 py-4">
              <h2 className="font-medium text-gray-900">Inventario</h2>
            </div>
            {stockItems?.length ? (
              <div className="divide-y">
                {stockItems.slice(0, 20).map((item) => (
                  <Link
                    key={item.productId}
                    href={`/dashboard/inventory/products/${item.productId}`}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                      <Package className="h-5 w-5 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.productName}</p>
                      <p className="text-sm text-gray-500">{item.productSku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{item.quantityOnHand}</p>
                      {item.quantityReserved > 0 && (
                        <p className="text-xs text-gray-500">
                          {item.quantityReserved} reservados
                        </p>
                      )}
                    </div>
                    <div className="w-20">
                      {item.status === 'OUT' ? (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                          Sin stock
                        </span>
                      ) : item.status === 'LOW' ? (
                        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                          Bajo
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          OK
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500">No hay productos en este almacén</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick actions */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Acciones</h2>
            <div className="space-y-2">
              <Link
                href={`/dashboard/inventory/stock/adjust?warehouseId=${warehouseId}`}
                className="btn-outline w-full justify-center"
              >
                Ajustar stock
              </Link>
              <Link
                href={`/dashboard/inventory/stock/count?warehouseId=${warehouseId}`}
                className="btn-outline w-full justify-center"
              >
                Nuevo conteo
              </Link>
            </div>
          </div>

          {/* Info */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Información</h2>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex justify-between">
                <span>Creado</span>
                <span>{new Date(warehouse.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Actualizado</span>
                <span>{new Date(warehouse.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

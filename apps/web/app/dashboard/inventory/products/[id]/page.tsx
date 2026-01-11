'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Package,
  Tag,
  Barcode,
  Warehouse,
  AlertTriangle,
  CheckCircle,
  Trash2,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  salePrice: number;
  costPrice: number;
  minStockLevel: number;
  maxStockLevel?: number;
  unitOfMeasure: string;
  isActive: boolean;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface StockLevel {
  warehouseId: string;
  warehouseName: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
}

interface Category {
  id: string;
  name: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const productId = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Product>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/products/${productId}`);
      return res.json();
    },
  });

  const { data: stockData } = useQuery({
    queryKey: ['product-stock', productId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/stock?view=levels&productId=${productId}`);
      return res.json();
    },
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/products?view=categories');
      return res.json();
    },
    enabled: isEditing,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Product>) => {
      const res = await fetch(`/api/inventory/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/inventory/products/${productId}`, {
        method: 'DELETE',
      });
      return res.json();
    },
    onSuccess: () => {
      router.push('/dashboard/inventory/products');
    },
  });

  const product = data?.data as Product | undefined;
  const stockLevels = stockData?.data?.levels as StockLevel[] | undefined;
  const categories = categoriesData?.data?.categories as Category[] | undefined;

  const totalStock = stockLevels?.reduce((sum, level) => sum + level.quantityOnHand, 0) ?? 0;
  const totalAvailable = stockLevels?.reduce((sum, level) => sum + level.quantityAvailable, 0) ?? 0;

  const handleEdit = () => {
    if (product) {
      setEditData({
        name: product.name,
        description: product.description || '',
        sku: product.sku,
        barcode: product.barcode || '',
        categoryId: product.categoryId || '',
        salePrice: product.salePrice,
        costPrice: product.costPrice,
        minStockLevel: product.minStockLevel,
        maxStockLevel: product.maxStockLevel,
        unitOfMeasure: product.unitOfMeasure,
        isActive: product.isActive,
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(editData);
  };

  const handleDelete = () => {
    if (confirm('¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.')) {
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

  if (error || !product) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/inventory/products"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Producto no encontrado</h1>
          </div>
        </div>
        <div className="card p-8 text-center">
          <p className="text-gray-500">Este producto no existe o no tenés acceso.</p>
          <Link href="/dashboard/inventory/products" className="btn-primary mt-4 inline-flex">
            Volver a productos
          </Link>
        </div>
      </div>
    );
  }

  const profitMargin = product.salePrice > 0
    ? ((product.salePrice - product.costPrice) / product.salePrice) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/inventory/products"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            {!product.isActive && (
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                Inactivo
              </span>
            )}
          </div>
          <p className="text-gray-500">SKU: {product.sku}</p>
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
                {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product details */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Detalles del producto</h2>

            {isEditing ? (
              <div className="space-y-4">
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
                  <label className="label mb-1 block">Descripción</label>
                  <textarea
                    value={editData.description || ''}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={3}
                    className="input"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label mb-1 block">SKU *</label>
                    <input
                      type="text"
                      value={editData.sku || ''}
                      onChange={(e) => setEditData({ ...editData, sku: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block">Código de barras</label>
                    <input
                      type="text"
                      value={editData.barcode || ''}
                      onChange={(e) => setEditData({ ...editData, barcode: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label mb-1 block">Categoría</label>
                    <select
                      value={editData.categoryId || ''}
                      onChange={(e) => setEditData({ ...editData, categoryId: e.target.value })}
                      className="input"
                    >
                      <option value="">Sin categoría</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1 block">Unidad de medida</label>
                    <select
                      value={editData.unitOfMeasure || 'UNIT'}
                      onChange={(e) => setEditData({ ...editData, unitOfMeasure: e.target.value })}
                      className="input"
                    >
                      <option value="UNIT">Unidad</option>
                      <option value="KG">Kilogramo</option>
                      <option value="LT">Litro</option>
                      <option value="MT">Metro</option>
                      <option value="M2">Metro cuadrado</option>
                      <option value="BOX">Caja</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editData.isActive ?? true}
                      onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Producto activo</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {product.description && (
                  <p className="text-gray-700">{product.description}</p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <Barcode className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">SKU</p>
                      <p className="font-medium text-gray-900">{product.sku}</p>
                    </div>
                  </div>
                  {product.barcode && (
                    <div className="flex items-center gap-3">
                      <Barcode className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Código de barras</p>
                        <p className="font-medium text-gray-900">{product.barcode}</p>
                      </div>
                    </div>
                  )}
                  {product.categoryName && (
                    <div className="flex items-center gap-3">
                      <Tag className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Categoría</p>
                        <p className="font-medium text-gray-900">{product.categoryName}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Unidad de medida</p>
                      <p className="font-medium text-gray-900">{product.unitOfMeasure}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Precios</h2>

            {isEditing ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label mb-1 block">Precio de venta *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editData.salePrice || 0}
                    onChange={(e) => setEditData({ ...editData, salePrice: parseFloat(e.target.value) })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label mb-1 block">Costo *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editData.costPrice || 0}
                    onChange={(e) => setEditData({ ...editData, costPrice: parseFloat(e.target.value) })}
                    className="input"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-sm text-green-600">Precio de venta</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(product.salePrice)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">Costo</p>
                  <p className="text-2xl font-bold text-gray-700">
                    {formatCurrency(product.costPrice)}
                  </p>
                </div>
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm text-blue-600">Margen</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {profitMargin.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Stock levels */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-gray-900">Niveles de stock</h2>
              <Link
                href={`/dashboard/inventory/stock/adjust?productId=${productId}`}
                className="btn-outline text-sm"
              >
                Ajustar stock
              </Link>
            </div>

            {isEditing ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label mb-1 block">Stock mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={editData.minStockLevel || 0}
                    onChange={(e) => setEditData({ ...editData, minStockLevel: parseInt(e.target.value) })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label mb-1 block">Stock máximo</label>
                  <input
                    type="number"
                    min="0"
                    value={editData.maxStockLevel || ''}
                    onChange={(e) => setEditData({ ...editData, maxStockLevel: parseInt(e.target.value) || undefined })}
                    className="input"
                  />
                </div>
              </div>
            ) : stockLevels?.length ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-gray-500">Total en existencia</p>
                    <p className="text-2xl font-bold text-gray-900">{totalStock}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-gray-500">Disponible</p>
                    <p className="text-2xl font-bold text-gray-900">{totalAvailable}</p>
                  </div>
                </div>
                <div className="divide-y rounded-lg border">
                  {stockLevels.map((level) => (
                    <div key={level.warehouseId} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <Warehouse className="h-5 w-5 text-gray-400" />
                        <span className="font-medium text-gray-900">{level.warehouseName}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{level.quantityOnHand}</p>
                        {level.quantityReserved > 0 && (
                          <p className="text-xs text-gray-500">
                            {level.quantityReserved} reservados
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {totalStock <= 0 ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-red-600">Sin stock</span>
                    </>
                  ) : totalStock <= product.minStockLevel ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-yellow-600">
                        Stock bajo (mínimo: {product.minStockLevel})
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-600">Stock normal</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No hay stock registrado</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Product image */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Imagen</h2>
            <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-100">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                <Package className="h-16 w-16 text-gray-400" />
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Acciones rápidas</h2>
            <div className="space-y-2">
              <Link
                href={`/dashboard/inventory/stock/adjust?productId=${productId}`}
                className="btn-outline w-full justify-center"
              >
                Ajustar stock
              </Link>
              <Link
                href={`/dashboard/inventory/purchase-orders/new?productId=${productId}`}
                className="btn-outline w-full justify-center"
              >
                Crear orden de compra
              </Link>
            </div>
          </div>

          {/* Timestamps */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Información</h2>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex justify-between">
                <span>Creado</span>
                <span>{new Date(product.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Actualizado</span>
                <span>{new Date(product.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Calendar,
  User,
  Package,
  ShoppingCart,
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  currentStock: number;
  minStock: number;
}

interface OrderItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get('productId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [formData, setFormData] = useState({
    supplierId: '',
    expectedDeliveryDate: '',
    notes: '',
    shippingCost: '',
  });

  const [items, setItems] = useState<OrderItem[]>([]);

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/suppliers');
      return res.json();
    },
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-search', productSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (productSearch) params.set('search', productSearch);
      const res = await fetch(`/api/inventory/products?${params}`);
      return res.json();
    },
    enabled: productSearch.length > 2 || !!preselectedProductId,
  });

  const suppliers = suppliersData?.data?.suppliers as Supplier[] | undefined;
  const products = productsData?.data?.products as Product[] | undefined;

  // Load preselected product
  useState(() => {
    if (preselectedProductId && products) {
      const product = products.find((p) => p.id === preselectedProductId);
      if (product && !items.find((i) => i.productId === product.id)) {
        addProduct(product);
      }
    }
  });

  const addProduct = (product: Product) => {
    if (items.find((i) => i.productId === product.id)) {
      alert('Este producto ya está en la orden');
      return;
    }

    const suggestedQty = Math.max(product.minStock - product.currentStock, 1);

    setItems([
      ...items,
      {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: suggestedQty,
        unitCost: product.costPrice,
        lineTotal: suggestedQty * product.costPrice,
      },
    ]);
    setProductSearch('');
    setShowProductSearch(false);
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    setItems(
      items.map((item) =>
        item.productId === productId
          ? { ...item, quantity, lineTotal: quantity * item.unitCost }
          : item
      )
    );
  };

  const updateItemCost = (productId: string, unitCost: number) => {
    setItems(
      items.map((item) =>
        item.productId === productId
          ? { ...item, unitCost, lineTotal: item.quantity * unitCost }
          : item
      )
    );
  };

  const removeItem = (productId: string) => {
    setItems(items.filter((item) => item.productId !== productId));
  };

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shippingCost = parseFloat(formData.shippingCost) || 0;
  const total = subtotal + shippingCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId) {
      setError('Seleccioná un proveedor');
      return;
    }

    if (items.length === 0) {
      setError('Agregá al menos un producto');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: formData.supplierId,
          expectedDeliveryDate: formData.expectedDeliveryDate || undefined,
          notes: formData.notes || undefined,
          shippingCost: shippingCost || 0,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/dashboard/inventory/purchase-orders/${data.data.order.id}`);
      } else {
        setError(data.error || 'Error al crear la orden');
      }
    } catch (_err) {
      setError('Error de conexión');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/inventory/purchase-orders"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva orden de compra</h1>
          <p className="text-gray-500">Crear orden para proveedor</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Supplier selection */}
            <div className="card p-6">
              <h3 className="mb-4 font-medium text-gray-900">Proveedor</h3>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className="input pl-10"
                  required
                  onInvalid={(e) => (e.target as HTMLSelectElement).setCustomValidity('Por favor, seleccioná un proveedor')}
                  onInput={(e) => (e.target as HTMLSelectElement).setCustomValidity('')}
                >
                  <option value="">Seleccionar proveedor</option>
                  {suppliers?.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              <Link
                href="/dashboard/inventory/suppliers/new"
                className="mt-2 inline-block text-sm text-primary-600 hover:underline"
              >
                + Nuevo proveedor
              </Link>
            </div>

            {/* Items */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Productos</h3>
                <button
                  type="button"
                  onClick={() => setShowProductSearch(!showProductSearch)}
                  className="btn-outline text-sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar producto
                </button>
              </div>

              {/* Product search */}
              {showProductSearch && (
                <div className="mb-4 rounded-lg border bg-gray-50 p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar producto por nombre o SKU..."
                      className="input pl-10"
                      autoFocus
                    />
                  </div>
                  {products && products.length > 0 && productSearch.length > 2 && (
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-md border bg-white">
                      {products.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addProduct(product)}
                          className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-gray-50"
                        >
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <p className="text-sm text-gray-500">{product.sku}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              {formatCurrency(product.costPrice)}
                            </p>
                            <p className="text-sm text-gray-500">
                              Stock: {product.currentStock}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Items list */}
              {items.length > 0 ? (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-4 rounded-lg border p-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-sm text-gray-500">{item.productSku}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemQuantity(item.productId, parseInt(e.target.value) || 1)
                          }
                          className="input w-20 text-center"
                        />
                        <span className="text-gray-500">×</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) =>
                            updateItemCost(item.productId, parseFloat(e.target.value) || 0)
                          }
                          className="input w-24 text-right"
                        />
                      </div>
                      <div className="w-24 text-right font-medium text-gray-900">
                        {formatCurrency(item.lineTotal)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <Package className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-gray-500">
                    No hay productos agregados
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="card p-6">
              <h3 className="mb-4 font-medium text-gray-900">Notas</h3>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales para el proveedor..."
                rows={3}
                className="input"
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Delivery info */}
            <div className="card p-6">
              <h3 className="mb-4 font-medium text-gray-900">Entrega</h3>
              <div>
                <label className="label mb-1 block">Fecha esperada</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) =>
                      setFormData({ ...formData, expectedDeliveryDate: e.target.value })
                    }
                    className="input pl-10"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="label mb-1 block">Costo de envío</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.shippingCost}
                  onChange={(e) => setFormData({ ...formData, shippingCost: e.target.value })}
                  placeholder="0.00"
                  className="input"
                />
              </div>
            </div>

            {/* Totals */}
            <div className="card p-6">
              <h3 className="mb-4 font-medium text-gray-900">Resumen</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Items ({items.length})
                  </span>
                  <span className="text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                {shippingCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Envío</span>
                    <span className="text-gray-900">{formatCurrency(shippingCost)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-3 font-medium">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="card p-6">
              {error && <p className="mb-4 text-sm text-danger-500">{error}</p>}
              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full justify-center"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Creando...' : 'Crear orden'}
                </button>
                <Link
                  href="/dashboard/inventory/purchase-orders"
                  className="btn-outline w-full justify-center"
                >
                  Cancelar
                </Link>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

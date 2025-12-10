'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Search,
  Package,
  Warehouse,
  ArrowUp,
  ArrowDown,
  FileText,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  currentStock: number;
}

interface WarehouseOption {
  id: string;
  name: string;
}

const ADJUSTMENT_REASONS = [
  { value: 'DAMAGE', label: 'Daño / Rotura' },
  { value: 'THEFT', label: 'Robo / Pérdida' },
  { value: 'EXPIRY', label: 'Vencimiento' },
  { value: 'CORRECTION', label: 'Corrección de conteo' },
  { value: 'RETURN', label: 'Devolución' },
  { value: 'INTERNAL_USE', label: 'Uso interno' },
  { value: 'OTHER', label: 'Otro' },
];

export default function StockAdjustPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get('productId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const [formData, setFormData] = useState({
    productId: preselectedProductId || '',
    warehouseId: '',
    adjustmentType: 'OUT' as 'IN' | 'OUT',
    quantity: '',
    reason: 'CORRECTION',
    notes: '',
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/warehouses');
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
    enabled: productSearch.length > 2,
  });

  // Fetch preselected product
  const { data: preselectedData } = useQuery({
    queryKey: ['product', preselectedProductId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/products?id=${preselectedProductId}`);
      return res.json();
    },
    enabled: !!preselectedProductId && !selectedProduct,
  });

  // Set preselected product when loaded
  if (preselectedData?.data?.product && !selectedProduct) {
    setSelectedProduct(preselectedData.data.product);
  }

  const warehouses = warehousesData?.data?.warehouses as WarehouseOption[] | undefined;
  const products = productsData?.data?.products as Product[] | undefined;

  const selectProduct = (product: Product) => {
    setSelectedProduct(product);
    setFormData({ ...formData, productId: product.id });
    setProductSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productId) {
      setError('Seleccioná un producto');
      return;
    }

    if (!formData.warehouseId) {
      setError('Seleccioná un almacén');
      return;
    }

    if (!formData.quantity || parseInt(formData.quantity) <= 0) {
      setError('Ingresá una cantidad válida');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjustment',
          productId: formData.productId,
          warehouseId: formData.warehouseId,
          direction: formData.adjustmentType,
          quantity: parseInt(formData.quantity),
          reason: formData.reason,
          notes: formData.notes || undefined,
          unitCost: selectedProduct?.costPrice || 0,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/dashboard/inventory/stock');
      } else {
        setError(data.error || 'Error al realizar el ajuste');
      }
    } catch (err) {
      setError('Error de conexión');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/inventory/stock"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ajuste de stock</h1>
          <p className="text-gray-500">Ajustar inventario manualmente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        {/* Product selection */}
        <div>
          <label className="label mb-1 block">Producto *</label>
          {selectedProduct ? (
            <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-4">
              <div>
                <p className="font-medium text-gray-900">{selectedProduct.name}</p>
                <p className="text-sm text-gray-500">
                  {selectedProduct.sku} • Stock actual: {selectedProduct.currentStock}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedProduct(null);
                  setFormData({ ...formData, productId: '' });
                }}
                className="text-sm text-primary-600 hover:underline"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar producto por nombre o SKU..."
                className="input pl-10"
              />
              {products && products.length > 0 && productSearch.length > 2 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => selectProduct(product)}
                      className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">{product.sku}</p>
                      </div>
                      <p className="text-sm text-gray-500">
                        Stock: {product.currentStock}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Warehouse selection */}
        <div>
          <label className="label mb-1 block">Almacén *</label>
          <div className="relative">
            <Warehouse className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={formData.warehouseId}
              onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
              className="input pl-10"
              required
            >
              <option value="">Seleccionar almacén</option>
              {warehouses?.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Adjustment type */}
        <div>
          <label className="label mb-2 block">Tipo de ajuste *</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, adjustmentType: 'IN' })}
              className={`flex items-center justify-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                formData.adjustmentType === 'IN'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <ArrowDown className="h-5 w-5" />
              <span className="font-medium">Entrada (+)</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, adjustmentType: 'OUT' })}
              className={`flex items-center justify-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                formData.adjustmentType === 'OUT'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <ArrowUp className="h-5 w-5" />
              <span className="font-medium">Salida (-)</span>
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label htmlFor="quantity" className="label mb-1 block">
            Cantidad *
          </label>
          <input
            id="quantity"
            type="number"
            min="1"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            placeholder="0"
            className="input"
            required
          />
          {selectedProduct && formData.quantity && (
            <p className="mt-1 text-sm text-gray-500">
              Stock resultante:{' '}
              <span className="font-medium">
                {formData.adjustmentType === 'IN'
                  ? selectedProduct.currentStock + parseInt(formData.quantity)
                  : selectedProduct.currentStock - parseInt(formData.quantity)}
              </span>
            </p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label htmlFor="reason" className="label mb-1 block">
            Motivo *
          </label>
          <select
            id="reason"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            className="input"
            required
          >
            {ADJUSTMENT_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="label mb-1 block">
            Notas
          </label>
          <textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Notas adicionales sobre el ajuste..."
            rows={3}
            className="input"
          />
        </div>

        {error && <p className="text-sm text-danger-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Link href="/dashboard/inventory/stock" className="btn-outline">
            Cancelar
          </Link>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Procesando...' : 'Realizar ajuste'}
          </button>
        </div>
      </form>
    </div>
  );
}

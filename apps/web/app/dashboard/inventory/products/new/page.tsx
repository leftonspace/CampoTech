'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Package, Tag, Barcode, DollarSign, Boxes } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

// Format number with thousand separators for display
const formatCurrency = (value: string): string => {
  // Remove all non-numeric except decimal point
  const numericValue = value.replace(/[^\d.]/g, '');
  if (!numericValue) return '';

  const parts = numericValue.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  // Add thousand separators
  const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (decimalPart !== undefined) {
    return `${formatted},${decimalPart.slice(0, 2)}`;
  }
  return formatted;
};

// Parse formatted currency back to number string
const parseCurrency = (formatted: string): string => {
  // Remove thousand separators (.) and replace decimal comma with point
  return formatted.replace(/\./g, '').replace(',', '.');
};

// Format on blur to always show 2 decimals
const formatOnBlur = (value: string): string => {
  const parsed = parseCurrency(value);
  const num = parseFloat(parsed);
  if (isNaN(num)) return '';

  // Format with 2 decimals
  const formatted = num.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatted;
};

export default function NewProductPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    categoryId: '',
    salePrice: '',
    costPrice: '',
    minStock: '',
    maxStock: '',
    unitOfMeasure: 'UNIT',
    unitsPerPackage: '',
    isActive: true,
  });

  // Display values for formatted inputs
  const [displaySalePrice, setDisplaySalePrice] = useState('');
  const [displayCostPrice, setDisplayCostPrice] = useState('');

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/products?view=categories');
      return res.json();
    },
  });

  const categories = categoriesData?.data?.categories as Category[] | undefined;

  // Check if unit requires package quantity
  const showUnitsPerPackage = ['BOX', 'PACK', 'PALLET'].includes(formData.unitOfMeasure);

  const handlePriceChange = (field: 'salePrice' | 'costPrice', value: string, setDisplay: (v: string) => void) => {
    // Allow only numbers, dots for thousands, comma for decimals
    const cleaned = value.replace(/[^\d.,]/g, '');
    setDisplay(formatCurrency(cleaned));
    setFormData({ ...formData, [field]: parseCurrency(cleaned) });
  };

  const handlePriceBlur = (field: 'salePrice' | 'costPrice', setDisplay: (v: string) => void) => {
    const value = formData[field];
    if (value) {
      const formatted = formatOnBlur(value);
      setDisplay(formatted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.sku || !formData.salePrice || !formData.costPrice) {
      setError('Completa todos los campos requeridos');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/inventory/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          sku: formData.sku,
          barcode: formData.barcode || undefined,
          categoryId: formData.categoryId || undefined,
          salePrice: parseFloat(formData.salePrice),
          costPrice: parseFloat(formData.costPrice),
          minStock: formData.minStock ? parseInt(formData.minStock) : 0,
          maxStock: formData.maxStock ? parseInt(formData.maxStock) : undefined,
          unitOfMeasure: formData.unitOfMeasure,
          unitsPerPackage: formData.unitsPerPackage ? parseInt(formData.unitsPerPackage) : undefined,
          isActive: formData.isActive,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/dashboard/inventory/products');
      } else {
        setError(data.error || 'Error al crear el producto');
      }
    } catch (err) {
      setError('Error de conexion');
    }

    setIsSubmitting(false);
  };

  const generateSku = () => {
    const prefix = formData.name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 3);
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    setFormData({ ...formData, sku: `${prefix}-${random}` });
  };

  // Calculate margin
  const margin = formData.salePrice && formData.costPrice
    ? (((parseFloat(formData.salePrice) - parseFloat(formData.costPrice)) / parseFloat(formData.salePrice)) * 100).toFixed(1)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/inventory/products"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo producto</h1>
          <p className="text-gray-500">Agregar producto al catálogo</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        {/* Basic info */}
        <div>
          <h3 className="mb-4 font-medium text-gray-900">Información básica</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="label mb-1 block">
                Nombre del producto *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Cable HDMI 2m"
                className="input"
                required
                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el nombre del producto')}
                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
              />
            </div>

            <div>
              <label htmlFor="description" className="label mb-1 block">
                Descripción
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción detallada del producto..."
                rows={3}
                className="input"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sku" className="label mb-1 block">
                  SKU *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="sku"
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="SKU-0001"
                      className="input pl-10"
                      required
                      onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el SKU')}
                      onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={generateSku}
                    className="btn-outline text-sm"
                  >
                    Generar
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="barcode" className="label mb-1 block">
                  Código de barras
                </label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="barcode"
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="7891234567890"
                    className="input pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="category" className="label mb-1 block">
                  Categoría
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <select
                    id="category"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="input pl-10"
                  >
                    <option value="">Sin categoría</option>
                    {categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="unitOfMeasure" className="label mb-1 block">
                  Unidad de medida
                </label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <select
                    id="unitOfMeasure"
                    value={formData.unitOfMeasure}
                    onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value, unitsPerPackage: '' })}
                    className="input pl-10"
                  >
                    <option value="UNIT">Unidad</option>
                    <option value="KG">Kilogramo</option>
                    <option value="LT">Litro</option>
                    <option value="MT">Metro</option>
                    <option value="M2">Metro cuadrado</option>
                    <option value="BOX">Caja</option>
                    <option value="PACK">Pack</option>
                    <option value="PALLET">Pallet</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Units per package - shown when BOX, PACK or PALLET is selected */}
            {showUnitsPerPackage && (
              <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
                <label htmlFor="unitsPerPackage" className="label mb-1 flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-primary-600" />
                  Unidades por {formData.unitOfMeasure === 'BOX' ? 'caja' : formData.unitOfMeasure === 'PACK' ? 'pack' : 'pallet'}
                </label>
                <input
                  id="unitsPerPackage"
                  type="text"
                  inputMode="numeric"
                  value={formData.unitsPerPackage}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, unitsPerPackage: val });
                  }}
                  placeholder="Ej: 20 (unidades dentro de cada caja)"
                  className="input"
                />
                <p className="mt-2 text-xs text-primary-700">
                  Esto permite calcular el total de unidades. Ej: 10 cajas x 20 unidades = 200 unidades totales
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pricing */}
        <div>
          <h3 className="mb-4 font-medium text-gray-900">Precios</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="salePrice" className="label mb-1 block">
                Precio de venta *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">$</span>
                <input
                  id="salePrice"
                  type="text"
                  inputMode="decimal"
                  value={displaySalePrice}
                  onChange={(e) => handlePriceChange('salePrice', e.target.value, setDisplaySalePrice)}
                  onBlur={() => handlePriceBlur('salePrice', setDisplaySalePrice)}
                  placeholder="0,00"
                  className="input pl-8 pr-14"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">ARS</span>
              </div>
            </div>

            <div>
              <label htmlFor="costPrice" className="label mb-1 block">
                Costo *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">$</span>
                <input
                  id="costPrice"
                  type="text"
                  inputMode="decimal"
                  value={displayCostPrice}
                  onChange={(e) => handlePriceChange('costPrice', e.target.value, setDisplayCostPrice)}
                  onBlur={() => handlePriceBlur('costPrice', setDisplayCostPrice)}
                  placeholder="0,00"
                  className="input pl-8 pr-14"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">ARS</span>
              </div>
            </div>
          </div>

          {margin && parseFloat(margin) > 0 && (
            <div className="mt-2 text-sm text-gray-500">
              Margen: <span className="font-medium text-green-600">{margin}%</span>
            </div>
          )}
        </div>

        {/* Stock settings */}
        <div>
          <h3 className="mb-4 font-medium text-gray-900">Configuracion de stock</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="minStock" className="label mb-1 block">
                Stock minimo
              </label>
              <input
                id="minStock"
                type="text"
                inputMode="numeric"
                value={formData.minStock}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setFormData({ ...formData, minStock: val });
                }}
                placeholder="0"
                className="input"
              />
              <p className="mt-1 text-xs text-gray-500">
                Alerta cuando el stock baja de este nivel
              </p>
            </div>

            <div>
              <label htmlFor="maxStock" className="label mb-1 block">
                Stock maximo
              </label>
              <input
                id="maxStock"
                type="text"
                inputMode="numeric"
                value={formData.maxStock}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setFormData({ ...formData, maxStock: val });
                }}
                placeholder="Opcional"
                className="input"
              />
              <p className="mt-1 text-xs text-gray-500">
                Nivel optimo de stock (opcional)
              </p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Producto activo (visible en el catálogo)</span>
          </label>
        </div>

        {error && <p className="text-sm text-danger-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Link href="/dashboard/inventory/products" className="btn-outline">
            Cancelar
          </Link>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Creando...' : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  );
}

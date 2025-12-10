'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Package, Tag, Barcode, DollarSign } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

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
    minStock: '0',
    maxStock: '',
    unitOfMeasure: 'UNIT',
    isActive: true,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/products?view=categories');
      return res.json();
    },
  });

  const categories = categoriesData?.data?.categories as Category[] | undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.sku || !formData.salePrice || !formData.costPrice) {
      setError('Completá todos los campos requeridos');
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
          minStock: parseInt(formData.minStock) || 0,
          maxStock: formData.maxStock ? parseInt(formData.maxStock) : undefined,
          unitOfMeasure: formData.unitOfMeasure,
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
      setError('Error de conexión');
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
                    onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                    className="input pl-10"
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
            </div>
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
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="salePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.salePrice}
                  onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                  placeholder="0.00"
                  className="input pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="costPrice" className="label mb-1 block">
                Costo *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  placeholder="0.00"
                  className="input pl-10"
                  required
                />
              </div>
            </div>
          </div>

          {formData.salePrice && formData.costPrice && (
            <div className="mt-2 text-sm text-gray-500">
              Margen: {(((parseFloat(formData.salePrice) - parseFloat(formData.costPrice)) / parseFloat(formData.salePrice)) * 100).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Stock settings */}
        <div>
          <h3 className="mb-4 font-medium text-gray-900">Configuración de stock</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="minStock" className="label mb-1 block">
                Stock mínimo
              </label>
              <input
                id="minStock"
                type="number"
                min="0"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                className="input"
              />
              <p className="mt-1 text-xs text-gray-500">
                Alerta cuando el stock baja de este nivel
              </p>
            </div>

            <div>
              <label htmlFor="maxStock" className="label mb-1 block">
                Stock máximo
              </label>
              <input
                id="maxStock"
                type="number"
                min="0"
                value={formData.maxStock}
                onChange={(e) => setFormData({ ...formData, maxStock: e.target.value })}
                className="input"
              />
              <p className="mt-1 text-xs text-gray-500">
                Nivel óptimo de stock (opcional)
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

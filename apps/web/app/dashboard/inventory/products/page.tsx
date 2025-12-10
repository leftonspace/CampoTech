'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { cn, formatCurrency } from '@/lib/utils';
import {
  Plus,
  Search,
  ChevronRight,
  Package,
  Filter,
  Tag,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  categoryName?: string;
  salePrice: number;
  currentStock: number;
  minStock: number;
  isActive: boolean;
  imageUrl?: string;
}

interface Category {
  id: string;
  name: string;
  productCount: number;
}

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/products?view=categories');
      return res.json();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', { search, categoryId, stockFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryId) params.set('categoryId', categoryId);
      if (stockFilter === 'low') params.set('filter', 'lowStock');
      if (stockFilter === 'out') params.set('filter', 'outOfStock');
      const res = await fetch(`/api/inventory/products?${params}`);
      return res.json();
    },
  });

  const products = data?.data?.products as Product[] | undefined;
  const categories = categoriesData?.data?.categories as Category[] | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-500">Catálogo de productos y materiales</p>
        </div>
        <Link href="/dashboard/inventory/products/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo producto
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, SKU o código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          {/* Category filter */}
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input pl-10 pr-8 appearance-none"
            >
              <option value="">Todas las categorías</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.productCount})
                </option>
              ))}
            </select>
          </div>

          {/* Stock filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="input pl-10 pr-8 appearance-none"
            >
              <option value="all">Todo el stock</option>
              <option value="low">Stock bajo</option>
              <option value="out">Sin stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products list */}
      <div className="card">
        {isLoading ? (
          <div className="divide-y">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="h-12 w-12 animate-pulse rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/4 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : products?.length ? (
          <div className="divide-y">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/dashboard/inventory/products/${product.id}`}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <Package className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900">{product.name}</p>
                    {!product.isActive && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>{product.sku}</span>
                    {product.categoryName && (
                      <>
                        <span>•</span>
                        <span>{product.categoryName}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="font-medium text-gray-900">
                    {formatCurrency(product.salePrice)}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-sm">
                    {product.currentStock <= 0 ? (
                      <>
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                        <span className="text-red-600">Sin stock</span>
                      </>
                    ) : product.currentStock <= product.minStock ? (
                      <>
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                        <span className="text-yellow-600">{product.currentStock} uds</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-green-600">{product.currentStock} uds</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No se encontraron productos</p>
            <Link href="/dashboard/inventory/products/new" className="btn-primary mt-4 inline-flex">
              <Plus className="mr-2 h-4 w-4" />
              Crear producto
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

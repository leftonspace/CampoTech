'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { cn, formatCurrency, formatPhone } from '@/lib/utils';
import {
  Plus,
  Search,
  ChevronRight,
  Users,
  Building2,
  Mail,
  Phone,
  Star,
  X,
} from 'lucide-react';

interface Supplier {
  id: string;
  code: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  category?: string;
  isActive: boolean;
  totalOrders?: number;
  totalPurchases?: number;
  rating?: number;
}

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', { search, showInactive }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (!showInactive) params.set('isActive', 'true');
      const res = await fetch(`/api/inventory/suppliers?${params}`);
      return res.json();
    },
  });

  const { data: topSuppliersData } = useQuery({
    queryKey: ['top-suppliers'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/suppliers?view=top&limit=5');
      return res.json();
    },
  });

  const suppliers = data?.data?.suppliers as Supplier[] | undefined;
  const topSuppliers = topSuppliersData?.data?.suppliers as Supplier[] | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-500">Gestiona proveedores y sus productos</p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo proveedor
        </button>
      </div>

      {/* Top suppliers */}
      {topSuppliers && topSuppliers.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title text-lg">Top proveedores</h2>
          </div>
          <div className="card-content">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {topSuppliers.map((supplier, index) => (
                <Link
                  key={supplier.id}
                  href={`/dashboard/inventory/suppliers/${supplier.id}`}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
                    #{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {supplier.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {supplier.totalOrders ?? 0} órdenes
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, código o contacto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Mostrar inactivos</span>
          </label>
        </div>
      </div>

      {/* Suppliers list */}
      <div className="card">
        {isLoading ? (
          <div className="divide-y">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="h-12 w-12 animate-pulse rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : suppliers?.length ? (
          <div className="divide-y">
            {suppliers.map((supplier) => (
              <Link
                key={supplier.id}
                href={`/dashboard/inventory/suppliers/${supplier.id}`}
                className={cn(
                  'flex items-center gap-4 p-4 transition-colors hover:bg-gray-50',
                  !supplier.isActive && 'opacity-60'
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-medium text-primary-600">
                  {supplier.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900">{supplier.name}</p>
                    {!supplier.isActive && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        Inactivo
                      </span>
                    )}
                    {supplier.rating && (
                      <span className="flex items-center gap-1 rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                        <Star className="h-3 w-3 fill-current" />
                        {supplier.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {supplier.code}
                    </span>
                    {supplier.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {supplier.email}
                      </span>
                    )}
                    {supplier.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {formatPhone(supplier.phone)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  {supplier.totalPurchases !== undefined && (
                    <>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(supplier.totalPurchases)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {supplier.totalOrders ?? 0} órdenes
                      </p>
                    </>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No se encontraron proveedores</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="btn-primary mt-4 inline-flex"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear proveedor
            </button>
          </div>
        )}
      </div>

      {/* New supplier modal */}
      {showNewModal && <NewSupplierModal onClose={() => setShowNewModal(false)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW SUPPLIER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function NewSupplierModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    category: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/inventory/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error creating supplier');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nuevo proveedor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre de la empresa
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input mt-1 w-full"
              placeholder="Distribuidora XYZ"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nombre de contacto
              </label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="input mt-1 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Categoría</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input mt-1 w-full"
                placeholder="Materiales, Repuestos..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input mt-1 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input mt-1 w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Dirección</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input mt-1 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Ciudad</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="input mt-1 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Notas</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input mt-1 w-full"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Creando...' : 'Crear proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

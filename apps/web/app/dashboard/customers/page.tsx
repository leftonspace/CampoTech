'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { cn, formatCUIT, formatPhone, IVA_CONDITION_LABELS } from '@/lib/utils';
import { Plus, Search, ChevronRight, User, Phone, FileText } from 'lucide-react';
import { Customer } from '@/types';

export default function CustomersPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search }],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      return api.customers.list(params);
    },
  });

  const customers = data?.data as Customer[] | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">Gestiona tu cartera de clientes</p>
        </div>
        <Link href="/dashboard/customers/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo cliente
        </Link>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o CUIT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Customers list */}
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
        ) : customers?.length ? (
          <div className="divide-y">
            {customers.map((customer) => (
              <Link
                key={customer.id}
                href={`/dashboard/customers/${customer.id}`}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600 font-medium">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-gray-900">{customer.name}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {formatPhone(customer.phone)}
                    </span>
                    {customer.cuit && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {formatCUIT(customer.cuit)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  <span className="text-sm text-gray-500">
                    {IVA_CONDITION_LABELS[customer.ivaCondition]}
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <User className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No se encontraron clientes</p>
            <Link href="/dashboard/customers/new" className="btn-primary mt-4 inline-flex">
              <Plus className="mr-2 h-4 w-4" />
              Crear cliente
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

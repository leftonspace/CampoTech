'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { cn, formatCurrency, formatPhone, formatAddress, getInitials } from '@/lib/utils';
import {
  Plus,
  Search,
  User,
  Mail,
  Phone,
  MapPin,
  Star,
  MoreHorizontal,
  ClipboardList,
  Eye,
  Edit2,
  Briefcase,
  History,
  Users,
  TrendingUp,
  Crown,
  LayoutGrid,
  List,
  Check,
} from 'lucide-react';
import { Customer } from '@/types';
import CustomerProfileModal from './CustomerProfileModal';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomerStats {
  totalCount: number;
  newThisMonth: number;
  vipCount: number;
  averageRating: number;
}

type FilterType = 'all' | 'vip' | 'new' | 'frequent';
type ViewType = 'cards' | 'table';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CustomersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewType, setViewType] = useState<ViewType>('cards');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());

  // Fetch customers with computed fields
  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search, filter: activeFilter }],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (activeFilter !== 'all') params.filter = activeFilter;
      return api.customers.list(params);
    },
  });

  // Fetch customer stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: async () => {
      const res = await fetch('/api/customers/stats');
      if (!res.ok) throw new Error('Error fetching stats');
      return res.json();
    },
  });

  // Toggle VIP status mutation
  const toggleVipMutation = useMutation({
    mutationFn: async ({ id, isVip }: { id: string; isVip: boolean }) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVip }),
      });
      if (!res.ok) throw new Error('Error updating customer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
    },
  });

  const customers = data?.data as Customer[] | undefined;
  const stats: CustomerStats = statsData?.data || {
    totalCount: 0,
    newThisMonth: 0,
    vipCount: 0,
    averageRating: 0,
  };

  // Check if customer is new (created within last 30 days)
  const isNewCustomer = (createdAt: string) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(createdAt) > thirtyDaysAgo;
  };

  const handleMenuAction = (action: string, customer: Customer) => {
    setMenuOpen(null);
    switch (action) {
      case 'view':
        // Open modal instead of navigating
        setSelectedCustomerId(customer.id);
        break;
      case 'edit':
        router.push(`/dashboard/customers/${customer.id}?edit=true`);
        break;
      case 'new-job':
        router.push(`/dashboard/jobs/new?customerId=${customer.id}`);
        break;
      case 'history':
        // Open modal to the jobs tab
        setSelectedCustomerId(customer.id);
        break;
      case 'toggle-vip':
        toggleVipMutation.mutate({ id: customer.id, isVip: !customer.isVip });
        break;
    }
  };

  const handleEditCustomer = (customerId: string) => {
    setSelectedCustomerId(null);
    router.push(`/dashboard/customers/${customerId}?edit=true`);
  };

  // Filter tabs
  // Filter tabs (VIP disabled until migration is applied)
  const filterTabs = [
    { id: 'all' as FilterType, label: 'Todos' },
    // { id: 'vip' as FilterType, label: 'VIP' }, // Disabled - migration pending
    { id: 'new' as FilterType, label: 'Nuevos' },
    { id: 'frequent' as FilterType, label: 'Frecuentes' },
  ];

  // Selection handlers for table view
  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!customers) return;
    if (selectedCustomers.size === customers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(customers.map(c => c.id)));
    }
  };

  const isAllSelected = customers && customers.length > 0 && selectedCustomers.size === customers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">Gestioná tu base de clientes</p>
        </div>
        <Link href="/dashboard/customers/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Clientes"
          value={stats.totalCount}
          loading={statsLoading}
        />
        <StatCard
          title="Nuevos Este Mes"
          value={stats.newThisMonth}
          color="teal"
          loading={statsLoading}
        />
        <StatCard
          title="Clientes VIP"
          value={stats.vipCount}
          loading={statsLoading}
        />
        <StatCard
          title="Rating Promedio"
          value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '-'}
          icon={stats.averageRating > 0 ? <Star className="h-5 w-5 text-amber-400 fill-amber-400" /> : undefined}
          loading={statsLoading}
        />
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Filter Tabs */}
            <div className="flex gap-1 overflow-x-auto">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
                    activeFilter === tab.id
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 border-l pl-4">
              <button
                onClick={() => setViewType('cards')}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  viewType === 'cards'
                    ? 'bg-white shadow-sm border border-teal-200 text-teal-600'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                )}
                title="Vista de tarjetas"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewType('table')}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  viewType === 'table'
                    ? 'bg-white shadow-sm border border-teal-200 text-teal-600'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                )}
                title="Vista de tabla"
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Display */}
      {isLoading ? (
        viewType === 'cards' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CustomerCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <CustomerTableSkeleton />
        )
      ) : customers?.length ? (
        viewType === 'cards' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {customers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                isNew={isNewCustomer(customer.createdAt)}
                menuOpen={menuOpen === customer.id}
                onMenuToggle={() => setMenuOpen(menuOpen === customer.id ? null : customer.id)}
                onMenuAction={(action) => handleMenuAction(action, customer)}
                onCardClick={() => setSelectedCustomerId(customer.id)}
              />
            ))}
          </div>
        ) : (
          <CustomerTable
            customers={customers}
            selectedCustomers={selectedCustomers}
            isAllSelected={!!isAllSelected}
            onToggleSelection={toggleCustomerSelection}
            onToggleSelectAll={toggleSelectAll}
            onRowClick={(customer) => setSelectedCustomerId(customer.id)}
            onMenuAction={handleMenuAction}
            menuOpen={menuOpen}
            onMenuToggle={(id) => setMenuOpen(menuOpen === id ? null : id)}
            isNewCustomer={isNewCustomer}
          />
        )
      ) : (
        <div className="card p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">
            {search ? 'No se encontraron clientes con esa búsqueda' : 'No hay clientes'}
          </p>
          <Link href="/dashboard/customers/new" className="btn-primary mt-4 inline-flex">
            <Plus className="mr-2 h-4 w-4" />
            Crear cliente
          </Link>
        </div>
      )}

      {/* Customer Profile Modal */}
      <CustomerProfileModal
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
        onEdit={handleEditCustomer}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  title: string;
  value: string | number;
  color?: 'teal' | 'default';
  icon?: React.ReactNode;
  loading?: boolean;
}

function StatCard({ title, value, color = 'default', icon, loading }: StatCardProps) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {loading ? (
        <div className="h-8 w-16 animate-pulse rounded bg-gray-200 mt-1" />
      ) : (
        <div className="flex items-center gap-2 mt-1">
          <p
            className={cn(
              'text-2xl font-bold',
              color === 'teal' ? 'text-teal-600' : 'text-gray-900'
            )}
          >
            {value}
          </p>
          {icon}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomerCardProps {
  customer: Customer;
  isNew: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onMenuAction: (action: string) => void;
  onCardClick: () => void;
}

function CustomerCard({
  customer,
  isNew,
  menuOpen,
  onMenuToggle,
  onMenuAction,
  onCardClick,
}: CustomerCardProps) {
  const addressStr = formatAddress(customer.address);

  return (
    <div
      className="card p-5 hover:shadow-md transition-shadow cursor-pointer"
      onClick={(e) => {
        // Don't navigate if clicking on menu
        if ((e.target as HTMLElement).closest('.menu-container')) return;
        onCardClick();
      }}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="h-12 w-12 rounded-full bg-teal-500 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
            {getInitials(customer.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 truncate">{customer.name}</h3>
              {/* Badges */}
              {isNew && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                  Nuevo
                </span>
              )}
              {/* VIP badge - disabled until migration is applied
              {customer.isVip && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  VIP
                </span>
              )}
              */}
            </div>
            {/* Customer Number */}
            <p className="text-sm text-gray-400">
              {customer.customerNumber || `CL-${customer.id.slice(-4).toUpperCase()}`}
            </p>
          </div>
        </div>

        {/* Menu Button */}
        <div className="menu-container relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle();
            }}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          >
            <MoreHorizontal className="h-5 w-5 text-gray-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white border rounded-lg shadow-lg z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuAction('view');
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <Eye className="h-4 w-4 text-gray-400" />
                Ver Perfil
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuAction('edit');
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit2 className="h-4 w-4 text-gray-400" />
                Editar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuAction('new-job');
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <Briefcase className="h-4 w-4 text-gray-400" />
                Nuevo Trabajo
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuAction('history');
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <History className="h-4 w-4 text-gray-400" />
                Historial
              </button>
              {/* VIP toggle - disabled until migration is applied
              <div className="border-t my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuAction('toggle-vip');
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <Crown className="h-4 w-4 text-amber-500" />
                {customer.isVip ? 'Quitar VIP' : 'Marcar VIP'}
              </button>
              */}
            </div>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-2 mt-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="truncate">{customer.email || 'Sin email'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span>{formatPhone(customer.phone)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="truncate">{addressStr || 'Sin dirección'}</span>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <ClipboardList className="h-4 w-4 text-gray-400" />
          <span>{customer.jobCount || 0} trabajos</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Star className={cn(
            'h-4 w-4',
            customer.averageRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
          )} />
          <span className={customer.averageRating ? 'font-medium' : 'text-gray-400'}>
            {customer.averageRating ? customer.averageRating.toFixed(1) : 'Sin rating'}
          </span>
        </div>
        <div className="text-sm font-semibold text-gray-900">
          {formatCurrency(customer.totalSpent || 0)}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function CustomerCardSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-200 rounded" />
        </div>
        <div className="h-6 w-6 bg-gray-200 rounded" />
      </div>
      <div className="space-y-2 mt-4">
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-4 w-3/4 bg-gray-200 rounded" />
        <div className="h-4 w-1/2 bg-gray-200 rounded" />
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="h-4 w-20 bg-gray-200 rounded" />
        <div className="h-4 w-16 bg-gray-200 rounded" />
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE SKELETON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function CustomerTableSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 w-12"><div className="h-4 w-4 bg-gray-200 rounded" /></th>
              <th className="px-4 py-3 text-left"><div className="h-4 w-20 bg-gray-200 rounded" /></th>
              <th className="px-4 py-3 text-left"><div className="h-4 w-16 bg-gray-200 rounded" /></th>
              <th className="px-4 py-3 text-left"><div className="h-4 w-24 bg-gray-200 rounded" /></th>
              <th className="px-4 py-3 text-center"><div className="h-4 w-16 bg-gray-200 rounded mx-auto" /></th>
              <th className="px-4 py-3 text-right"><div className="h-4 w-20 bg-gray-200 rounded ml-auto" /></th>
              <th className="px-4 py-3 text-center"><div className="h-4 w-12 bg-gray-200 rounded mx-auto" /></th>
              <th className="px-4 py-3 text-left"><div className="h-4 w-24 bg-gray-200 rounded" /></th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <tr key={i} className="border-b">
                <td className="px-4 py-3"><div className="h-4 w-4 bg-gray-200 rounded" /></td>
                <td className="px-4 py-3"><div className="h-8 w-32 bg-gray-200 rounded" /></td>
                <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
                <td className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 rounded" /></td>
                <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 rounded mx-auto" /></td>
                <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded ml-auto" /></td>
                <td className="px-4 py-3"><div className="h-4 w-10 bg-gray-200 rounded mx-auto" /></td>
                <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
                <td className="px-4 py-3"><div className="h-6 w-6 bg-gray-200 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE VIEW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomerTableProps {
  customers: Customer[];
  selectedCustomers: Set<string>;
  isAllSelected: boolean;
  onToggleSelection: (customerId: string) => void;
  onToggleSelectAll: () => void;
  onRowClick: (customer: Customer) => void;
  onMenuAction: (action: string, customer: Customer) => void;
  menuOpen: string | null;
  onMenuToggle: (id: string) => void;
  isNewCustomer: (createdAt: string) => boolean;
}

function CustomerTable({
  customers,
  selectedCustomers,
  isAllSelected,
  onToggleSelection,
  onToggleSelectAll,
  onRowClick,
  onMenuAction,
  menuOpen,
  onMenuToggle,
  isNewCustomer,
}: CustomerTableProps) {
  // Helper to extract zone/neighborhood from address
  const getZone = (address: Customer['address']) => {
    if (!address) return '-';
    if (typeof address === 'string') return address;
    return address.city || address.neighborhood || '-';
  };

  // Format last service date
  const formatLastService = (date: string | null | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="card overflow-hidden">
      {/* Bulk Actions Bar */}
      {selectedCustomers.size > 0 && (
        <div className="bg-teal-50 border-b border-teal-100 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-teal-700 font-medium">
            {selectedCustomers.size} cliente{selectedCustomers.size > 1 ? 's' : ''} seleccionado{selectedCustomers.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button className="text-sm text-teal-600 hover:text-teal-800 font-medium">
              Exportar
            </button>
            <button className="text-sm text-teal-600 hover:text-teal-800 font-medium">
              Enviar mensaje
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 w-12">
                <button
                  onClick={onToggleSelectAll}
                  className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                    isAllSelected
                      ? 'bg-teal-500 border-teal-500'
                      : 'border-gray-300 hover:border-gray-400'
                  )}
                >
                  {isAllSelected && <Check className="h-3 w-3 text-white" />}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Zona
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Contacto
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Trabajos
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Facturado
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Rating
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Último Servicio
              </th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((customer) => {
              const isSelected = selectedCustomers.has(customer.id);
              const isNew = isNewCustomer(customer.createdAt);

              return (
                <tr
                  key={customer.id}
                  className={cn(
                    'hover:bg-gray-50 cursor-pointer transition-colors',
                    isSelected && 'bg-teal-50/50'
                  )}
                  onClick={() => onRowClick(customer)}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onToggleSelection(customer.id)}
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-teal-500 border-teal-500'
                          : 'border-gray-300 hover:border-gray-400'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </button>
                  </td>

                  {/* Cliente */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-teal-500 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                        {getInitials(customer.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">{customer.name}</span>
                          {isNew && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600">
                              Nuevo
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {customer.customerNumber || `CL-${customer.id.slice(-4).toUpperCase()}`}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Zona */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{getZone(customer.address)}</span>
                  </td>

                  {/* Contacto */}
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="text-gray-900">{formatPhone(customer.phone)}</div>
                      {customer.email && (
                        <div className="text-gray-400 text-xs truncate max-w-[180px]">{customer.email}</div>
                      )}
                    </div>
                  </td>

                  {/* Trabajos */}
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-900">{customer.jobCount || 0}</span>
                  </td>

                  {/* Facturado */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(customer.totalSpent || 0)}
                    </span>
                  </td>

                  {/* Rating */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Star className={cn(
                        'h-4 w-4',
                        customer.averageRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                      )} />
                      <span className={cn(
                        'text-sm',
                        customer.averageRating ? 'font-medium text-gray-900' : 'text-gray-400'
                      )}>
                        {customer.averageRating ? customer.averageRating.toFixed(1) : '-'}
                      </span>
                    </div>
                  </td>

                  {/* Último Servicio */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">
                      {formatLastService(customer.lastServiceDate)}
                    </span>
                  </td>

                  {/* Actions Menu */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        onClick={() => onMenuToggle(customer.id)}
                        className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4 text-gray-400" />
                      </button>
                      {menuOpen === customer.id && (
                        <div className="absolute right-0 mt-1 w-44 bg-white border rounded-lg shadow-lg z-20">
                          <button
                            onClick={() => onMenuAction('view', customer)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4 text-gray-400" />
                            Ver Perfil
                          </button>
                          <button
                            onClick={() => onMenuAction('edit', customer)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit2 className="h-4 w-4 text-gray-400" />
                            Editar
                          </button>
                          <button
                            onClick={() => onMenuAction('new-job', customer)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Briefcase className="h-4 w-4 text-gray-400" />
                            Nuevo Trabajo
                          </button>
                          <button
                            onClick={() => onMenuAction('history', customer)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <History className="h-4 w-4 text-gray-400" />
                            Historial
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer with count */}
      <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-500">
        Mostrando {customers.length} cliente{customers.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

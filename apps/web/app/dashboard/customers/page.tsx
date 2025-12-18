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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CustomersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

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
  const filterTabs = [
    { id: 'all' as FilterType, label: 'Todos' },
    { id: 'vip' as FilterType, label: 'VIP' },
    { id: 'new' as FilterType, label: 'Nuevos' },
    { id: 'frequent' as FilterType, label: 'Frecuentes' },
  ];

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
        </div>
      </div>

      {/* Customer Cards Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CustomerCardSkeleton key={i} />
          ))}
        </div>
      ) : customers?.length ? (
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
              {customer.isVip && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  VIP
                </span>
              )}
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

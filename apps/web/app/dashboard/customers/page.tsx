'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { cn, formatCurrency, formatPhone, formatAddress, getInitials } from '@/lib/utils';
import {
  Plus,
  Search,
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
  LayoutGrid,
  List,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Customer } from '@/types';
import CustomerProfileModal from './CustomerProfileModal';
import NewCustomerModal from './NewCustomerModal';

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
type SortType = 'recent' | 'oldest' | 'jobs' | 'revenue' | 'name';

const ITEMS_PER_PAGE = 20;

// Column filter types
type TrabajosFilter = 'all' | '0' | '1-5' | '6-10' | '10+';
type FacturadoFilter = 'all' | '0' | '1-100000' | '100001-500000' | '500000+';
type RatingFilter = 'all' | 'none' | '1-2' | '3-4' | '5';
type UltimoServicioFilter = 'all' | 'today' | 'week' | 'month' | 'older';

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
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);

  // Pagination state
  const [allLoadedCustomers, setAllLoadedCustomers] = useState<Customer[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Track the current filter context to detect changes
  const [lastFilterContext, setLastFilterContext] = useState<string>('');

  // Sorting state - default based on filter
  const [sortOrder, setSortOrder] = useState<SortType>('recent');

  // Column filter states
  const [trabajosFilter, setTrabajosFilter] = useState<TrabajosFilter>('all');
  const [facturadoFilter, setFacturadoFilter] = useState<FacturadoFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [ultimoServicioFilter, setUltimoServicioFilter] = useState<UltimoServicioFilter>('all');
  const [openColumnFilter, setOpenColumnFilter] = useState<string | null>(null);

  // Track if menu was just closed to prevent row click on same click
  const menuJustClosedRef = useRef(false);

  // Close menus when clicking outside
  useEffect(() => {
    if (!openColumnFilter && !menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Close action menu if clicking outside
      if (menuOpen && !target.closest('.menu-container')) {
        setMenuOpen(null);
        // If click was inside the table (but not on the menu), mark that menu was just closed
        // This prevents the row click from triggering on the same click
        if (target.closest('table') || target.closest('.card')) {
          menuJustClosedRef.current = true;
          // Reset after a short delay to allow normal clicks
          setTimeout(() => {
            menuJustClosedRef.current = false;
          }, 100);
        }
      }
      // Close column filter if clicking outside
      if (openColumnFilter && !target.closest('.column-filter-container')) {
        setOpenColumnFilter(null);
      }
      // Close action menu if clicking outside
      if (menuOpen && !target.closest('.menu-container')) {
        setMenuOpen(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openColumnFilter, menuOpen]);

  // Get the API sort parameter based on sortOrder
  const getApiSort = (sort: SortType): string => {
    switch (sort) {
      case 'recent':
      case 'oldest':
        return 'recent'; // API handles direction, we'll reverse client-side for 'oldest'
      case 'jobs':
        return 'jobs';
      case 'revenue':
        return 'revenue';
      case 'name':
        return 'name';
      default:
        return 'recent';
    }
  };

  // Fetch customers with computed fields and pagination
  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search, filter: activeFilter, page: currentPage, sort: sortOrder }],
    queryFn: () => {
      const params: Record<string, string> = {
        limit: String(ITEMS_PER_PAGE),
        page: String(currentPage),
        sort: getApiSort(sortOrder),
      };
      if (search) params.search = search;
      if (activeFilter !== 'all') params.filter = activeFilter;
      return api.customers.list(params);
    },
  });

  // Create a unique context key for the current filter state
  const currentFilterContext = `${search}-${activeFilter}-${sortOrder}`;

  // Update displayed customers when data changes
  useEffect(() => {
    if (data?.data) {
      const newCustomers = data.data as Customer[];
      const pagination = (data as { pagination?: { total?: number; totalPages?: number } }).pagination;

      // For 'oldest' sort, reverse the results client-side
      const sortedCustomers = sortOrder === 'oldest'
        ? [...newCustomers].reverse()
        : newCustomers;

      // Check if filter context changed - if so, replace all customers
      const contextChanged = currentFilterContext !== lastFilterContext;

      if (currentPage === 1 || contextChanged) {
        // Replace customers for first page or when filter context changes
        setAllLoadedCustomers(sortedCustomers);
        setLastFilterContext(currentFilterContext);
      } else {
        // Append customers for subsequent pages (same filter context)
        setAllLoadedCustomers(prev => [...prev, ...sortedCustomers]);
      }

      // Update pagination info
      if (pagination) {
        setTotalCustomers(pagination.total || 0);
        setHasMore(currentPage < (pagination.totalPages || 1));
      }
      setIsLoadingMore(false);
    }
  }, [data, currentPage, sortOrder, currentFilterContext, lastFilterContext]);

  // Reset pagination when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeFilter]);

  // Determine sort order based on filter
  const getDefaultSortForFilter = (filter: FilterType): SortType => {
    switch (filter) {
      case 'new':
        return 'recent';
      case 'frequent':
        return 'jobs';
      default:
        return 'recent';
    }
  };

  // Update sort order based on filter
  useEffect(() => {
    setSortOrder(getDefaultSortForFilter(activeFilter));
  }, [activeFilter]);

  // Load more customers
  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    setCurrentPage(prev => prev + 1);
  };

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

  // Use allLoadedCustomers for rendering, which accumulates paginated results
  const customers = allLoadedCustomers;
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
        <button onClick={() => setShowNewCustomerModal(true)} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </button>
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
                onCardClick={() => {
                  // Prevent card click if menu was just closed by this same click
                  if (menuJustClosedRef.current) return;
                  setSelectedCustomerId(customer.id);
                }}
              />
            ))}
            {/* Load More Card */}
            {hasMore && (
              <LoadMoreCard
                onClick={handleLoadMore}
                isLoading={isLoadingMore}
                currentCount={customers.length}
                totalCount={totalCustomers}
              />
            )}
          </div>
        ) : (
          <CustomerTable
            customers={customers}
            selectedCustomers={selectedCustomers}
            isAllSelected={!!isAllSelected}
            onToggleSelection={toggleCustomerSelection}
            onToggleSelectAll={toggleSelectAll}
            onRowClick={(customer) => {
              // Prevent row click if menu was just closed by this same click
              if (menuJustClosedRef.current) return;
              setSelectedCustomerId(customer.id);
            }}
            onMenuAction={handleMenuAction}
            menuOpen={menuOpen}
            onMenuToggle={(id) => setMenuOpen(menuOpen === id ? null : id)}
            isNewCustomer={isNewCustomer}
            trabajosFilter={trabajosFilter}
            setTrabajosFilter={setTrabajosFilter}
            facturadoFilter={facturadoFilter}
            setFacturadoFilter={setFacturadoFilter}
            ratingFilter={ratingFilter}
            setRatingFilter={setRatingFilter}
            ultimoServicioFilter={ultimoServicioFilter}
            setUltimoServicioFilter={setUltimoServicioFilter}
            openColumnFilter={openColumnFilter}
            setOpenColumnFilter={setOpenColumnFilter}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            isLoadingMore={isLoadingMore}
            totalCount={totalCustomers}
          />
        )
      ) : (
        <div className="card p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">
            {search ? 'No se encontraron clientes con esa búsqueda' : 'No hay clientes'}
          </p>
          <button onClick={() => setShowNewCustomerModal(true)} className="btn-primary mt-4 inline-flex">
            <Plus className="mr-2 h-4 w-4" />
            Crear cliente
          </button>
        </div>
      )}

      {/* New Customer Modal */}
      <NewCustomerModal
        isOpen={showNewCustomerModal}
        onClose={() => setShowNewCustomerModal(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
        }}
      />

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
// COLUMN FILTER DROPDOWN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface FilterOption {
  value: string;
  label: string;
}

interface ColumnFilterDropdownProps {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  align?: 'left' | 'right' | 'center';
}

function ColumnFilterDropdown({
  label,
  options,
  value,
  onChange,
  isOpen,
  onToggle,
  align = 'left',
}: ColumnFilterDropdownProps) {
  const isFiltered = value !== 'all';

  return (
    <div className="relative inline-block column-filter-container">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          'flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors',
          isFiltered ? 'text-teal-600' : 'text-gray-500 hover:text-gray-700'
        )}
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && (
        <div
          className={cn(
            'absolute top-full mt-1 w-40 bg-white border rounded-lg shadow-lg z-30',
            align === 'right' && 'right-0',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'left' && 'left-0'
          )}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                onChange(option.value);
                onToggle();
              }}
              className={cn(
                'w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between',
                option.value === value && 'bg-teal-50 text-teal-700'
              )}
            >
              <span>{option.label}</span>
              {option.value === value && <Check className="h-4 w-4" />}
            </button>
          ))}
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
// LOAD MORE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface LoadMoreCardProps {
  onClick: () => void;
  isLoading: boolean;
  currentCount: number;
  totalCount: number;
}

function LoadMoreCard({ onClick, isLoading, currentCount, totalCount }: LoadMoreCardProps) {
  const remaining = totalCount - currentCount;

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="card p-5 hover:shadow-md transition-all cursor-pointer border-2 border-dashed border-gray-200 hover:border-teal-300 flex flex-col items-center justify-center min-h-[200px] group"
    >
      {isLoading ? (
        <>
          <div className="h-12 w-12 rounded-full border-4 border-teal-200 border-t-teal-500 animate-spin" />
          <p className="mt-4 text-sm text-gray-500">Cargando más clientes...</p>
        </>
      ) : (
        <>
          <div className="h-14 w-14 rounded-full bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
            <Plus className="h-7 w-7 text-teal-500" />
          </div>
          <p className="mt-4 text-base font-medium text-gray-700 group-hover:text-teal-600 transition-colors">
            Cargar más clientes
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {remaining} cliente{remaining !== 1 ? 's' : ''} restante{remaining !== 1 ? 's' : ''}
          </p>
          <p className="mt-2 text-xs text-gray-300">
            Mostrando {currentCount} de {totalCount}
          </p>
        </>
      )}
    </button>
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
  // Column filter props
  trabajosFilter: TrabajosFilter;
  setTrabajosFilter: (value: TrabajosFilter) => void;
  facturadoFilter: FacturadoFilter;
  setFacturadoFilter: (value: FacturadoFilter) => void;
  ratingFilter: RatingFilter;
  setRatingFilter: (value: RatingFilter) => void;
  ultimoServicioFilter: UltimoServicioFilter;
  setUltimoServicioFilter: (value: UltimoServicioFilter) => void;
  openColumnFilter: string | null;
  setOpenColumnFilter: (value: string | null) => void;
  // Pagination props
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  totalCount: number;
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
  trabajosFilter,
  setTrabajosFilter,
  facturadoFilter,
  setFacturadoFilter,
  ratingFilter,
  setRatingFilter,
  ultimoServicioFilter,
  setUltimoServicioFilter,
  openColumnFilter,
  setOpenColumnFilter,
  hasMore,
  onLoadMore,
  isLoadingMore,
  totalCount,
}: CustomerTableProps) {
  // Filter options
  const trabajosOptions: FilterOption[] = [
    { value: 'all', label: 'Todos' },
    { value: '0', label: 'Sin trabajos' },
    { value: '1-5', label: '1 - 5 trabajos' },
    { value: '6-10', label: '6 - 10 trabajos' },
    { value: '10+', label: 'Más de 10' },
  ];

  const facturadoOptions: FilterOption[] = [
    { value: 'all', label: 'Todos' },
    { value: '0', label: 'Sin facturar' },
    { value: '1-100000', label: '$ 1 - $ 100.000' },
    { value: '100001-500000', label: '$ 100.001 - $ 500.000' },
    { value: '500000+', label: 'Más de $ 500.000' },
  ];

  const ratingOptions: FilterOption[] = [
    { value: 'all', label: 'Todos' },
    { value: 'none', label: 'Sin rating' },
    { value: '1-2', label: '1 - 2 estrellas' },
    { value: '3-4', label: '3 - 4 estrellas' },
    { value: '5', label: '5 estrellas' },
  ];

  const ultimoServicioOptions: FilterOption[] = [
    { value: 'all', label: 'Todos' },
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mes' },
    { value: 'older', label: 'Más antiguo' },
  ];
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
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', timeZone: 'America/Buenos_Aires' });
  };

  // Filter customers based on column filters
  const filteredCustomers = customers.filter((customer) => {
    // Trabajos filter
    if (trabajosFilter !== 'all') {
      const jobCount = customer.jobCount || 0;
      switch (trabajosFilter) {
        case '0':
          if (jobCount !== 0) return false;
          break;
        case '1-5':
          if (jobCount < 1 || jobCount > 5) return false;
          break;
        case '6-10':
          if (jobCount < 6 || jobCount > 10) return false;
          break;
        case '10+':
          if (jobCount <= 10) return false;
          break;
      }
    }

    // Facturado filter
    if (facturadoFilter !== 'all') {
      const totalSpent = customer.totalSpent || 0;
      switch (facturadoFilter) {
        case '0':
          if (totalSpent !== 0) return false;
          break;
        case '1-100000':
          if (totalSpent < 1 || totalSpent > 100000) return false;
          break;
        case '100001-500000':
          if (totalSpent < 100001 || totalSpent > 500000) return false;
          break;
        case '500000+':
          if (totalSpent <= 500000) return false;
          break;
      }
    }

    // Rating filter
    if (ratingFilter !== 'all') {
      const rating = customer.averageRating;
      switch (ratingFilter) {
        case 'none':
          if (rating != null) return false;
          break;
        case '1-2':
          if (rating == null || rating < 1 || rating > 2) return false;
          break;
        case '3-4':
          if (rating == null || rating < 3 || rating > 4) return false;
          break;
        case '5':
          if (rating == null || rating < 4.5) return false;
          break;
      }
    }

    // Último Servicio filter
    if (ultimoServicioFilter !== 'all') {
      const lastDate = customer.lastServiceDate;
      if (!lastDate) {
        if (ultimoServicioFilter !== 'older') return false;
      } else {
        const d = new Date(lastDate);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

        switch (ultimoServicioFilter) {
          case 'today':
            if (diffDays !== 0) return false;
            break;
          case 'week':
            if (diffDays > 7) return false;
            break;
          case 'month':
            if (diffDays > 30) return false;
            break;
          case 'older':
            if (diffDays <= 30) return false;
            break;
        }
      }
    }

    return true;
  });

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
              <th className="px-4 py-3 text-center">
                <ColumnFilterDropdown
                  label="Trabajos"
                  options={trabajosOptions}
                  value={trabajosFilter}
                  onChange={(v) => setTrabajosFilter(v as TrabajosFilter)}
                  isOpen={openColumnFilter === 'trabajos'}
                  onToggle={() => setOpenColumnFilter(openColumnFilter === 'trabajos' ? null : 'trabajos')}
                  align="center"
                />
              </th>
              <th className="px-4 py-3 text-right">
                <div className="flex justify-end">
                  <ColumnFilterDropdown
                    label="Facturado"
                    options={facturadoOptions}
                    value={facturadoFilter}
                    onChange={(v) => setFacturadoFilter(v as FacturadoFilter)}
                    isOpen={openColumnFilter === 'facturado'}
                    onToggle={() => setOpenColumnFilter(openColumnFilter === 'facturado' ? null : 'facturado')}
                    align="right"
                  />
                </div>
              </th>
              <th className="px-4 py-3 text-center">
                <ColumnFilterDropdown
                  label="Rating"
                  options={ratingOptions}
                  value={ratingFilter}
                  onChange={(v) => setRatingFilter(v as RatingFilter)}
                  isOpen={openColumnFilter === 'rating'}
                  onToggle={() => setOpenColumnFilter(openColumnFilter === 'rating' ? null : 'rating')}
                  align="center"
                />
              </th>
              <th className="px-4 py-3 text-left">
                <ColumnFilterDropdown
                  label="Último Servicio"
                  options={ultimoServicioOptions}
                  value={ultimoServicioFilter}
                  onChange={(v) => setUltimoServicioFilter(v as UltimoServicioFilter)}
                  isOpen={openColumnFilter === 'ultimoServicio'}
                  onToggle={() => setOpenColumnFilter(openColumnFilter === 'ultimoServicio' ? null : 'ultimoServicio')}
                  align="left"
                />
              </th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCustomers.map((customer) => {
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
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <p className="text-gray-500">No hay clientes que coincidan con los filtros</p>
                  <button
                    onClick={() => {
                      setTrabajosFilter('all');
                      setFacturadoFilter('all');
                      setRatingFilter('all');
                      setUltimoServicioFilter('all');
                    }}
                    className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Limpiar filtros
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer with count and Load More */}
      <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
        <span className="text-sm text-gray-500">
          Mostrando {filteredCustomers.length} cliente{filteredCustomers.length !== 1 ? 's' : ''}
          {totalCount > 0 && (
            <span className="text-gray-400"> de {totalCount}</span>
          )}
        </span>
        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <div className="h-4 w-4 border-2 border-teal-300 border-t-teal-600 rounded-full animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Cargar más ({totalCount - customers.length} restantes)
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

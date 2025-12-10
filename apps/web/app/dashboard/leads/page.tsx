'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  Inbox,
  Clock,
  Send,
  CheckCircle,
  XCircle,
  MapPin,
  Calendar,
  DollarSign,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Image,
  AlertCircle,
  TrendingUp,
  Eye,
  MessageSquare,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Lead {
  id: string;
  requestNumber: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  budgetRange: string | null;
  preferredSchedule: string | null;
  photos: string[];
  consumer: {
    displayName: string | null;
    profilePhotoUrl: string | null;
    totalRequests: number;
    completedJobs: number;
  };
  location: {
    city: string;
    neighborhood: string | null;
    distance: number | null;
  };
  status: 'new' | 'viewed' | 'quoted' | 'accepted' | 'expired';
  myQuote: {
    id: string;
    quoteNumber: string;
    priceMin: number;
    priceMax: number;
    description: string;
    status: string;
    createdAt: string;
  } | null;
  competingQuotes: number;
  createdAt: string;
  expiresAt: string;
}

interface LeadStats {
  newLeads: number;
  viewedLeads: number;
  quotedLeads: number;
  acceptedLeads: number;
  totalLeadsThisMonth: number;
  conversionRate: number;
  avgResponseTimeHours: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Plomeria',
  electrical: 'Electricidad',
  hvac: 'Aire y Climatizacion',
  gas: 'Gas',
  locksmith: 'Cerrajeria',
  painting: 'Pintura',
  cleaning: 'Limpieza',
  moving: 'Mudanza',
  carpentry: 'Carpinteria',
  appliance_repair: 'Reparacion de Electrodomesticos',
  pest_control: 'Control de Plagas',
  roofing: 'Techos',
  landscaping: 'Jardineria',
  glass_repair: 'Vidrios',
  security: 'Seguridad',
  flooring: 'Pisos',
  general: 'Mantenimiento General',
  other: 'Otro',
};

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  emergency: { label: 'Urgente', color: 'bg-red-100 text-red-800' },
  today: { label: 'Hoy', color: 'bg-orange-100 text-orange-800' },
  this_week: { label: 'Esta semana', color: 'bg-yellow-100 text-yellow-800' },
  flexible: { label: 'Flexible', color: 'bg-gray-100 text-gray-800' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState<string>('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Fetch stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['lead-stats'],
    queryFn: () => apiRequest<LeadStats>('/leads/stats'),
    refetchInterval: 60000,
  });

  const stats = statsData?.data;

  // Fetch leads
  const { data: leadsData, isLoading: leadsLoading, refetch } = useQuery({
    queryKey: ['leads', activeTab, categoryFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.append('status', activeTab);
      if (categoryFilter) params.append('category', categoryFilter);
      return apiRequest<{ leads: Lead[]; total: number }>(`/leads?${params.toString()}`);
    },
    refetchInterval: 30000,
  });

  const leads = leadsData?.data?.leads || [];

  // Filter by search
  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.title.toLowerCase().includes(query) ||
      lead.description.toLowerCase().includes(query) ||
      lead.location.city.toLowerCase().includes(query) ||
      lead.location.neighborhood?.toLowerCase().includes(query)
    );
  });

  const isLoading = statsLoading || leadsLoading;

  // Status badge
  const getStatusBadge = (status: Lead['status']) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Nueva
          </span>
        );
      case 'viewed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
            <Eye className="h-3 w-3" />
            Vista
          </span>
        );
      case 'quoted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
            <Send className="h-3 w-3" />
            Cotizada
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
            <CheckCircle className="h-3 w-3" />
            Aceptada
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
            <Clock className="h-3 w-3" />
            Expirada
          </span>
        );
    }
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    if (diffDays < 7) return `hace ${diffDays}d`;
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads del Marketplace</h1>
          <p className="text-gray-500">
            Solicitudes de clientes buscando tus servicios
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/leads/settings" className="btn-outline">
            Preferencias
          </Link>
          <Link href="/dashboard/leads/analytics" className="btn-outline">
            <TrendingUp className="mr-2 h-4 w-4" />
            Analiticas
          </Link>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="btn-outline"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 lg:grid-cols-7">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2 text-red-600">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Nuevas</p>
              <p className="text-2xl font-bold text-red-600">{stats?.newLeads || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2 text-blue-600">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vistas</p>
              <p className="text-2xl font-bold">{stats?.viewedLeads || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-100 p-2 text-yellow-600">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Cotizadas</p>
              <p className="text-2xl font-bold">{stats?.quotedLeads || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ganadas</p>
              <p className="text-2xl font-bold text-green-600">
                {stats?.acceptedLeads || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2 text-purple-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Conversion</p>
              <p className="text-2xl font-bold">
                {(stats?.conversionRate || 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-indigo-100 p-2 text-indigo-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Respuesta</p>
              <p className="text-2xl font-bold">
                {(stats?.avgResponseTimeHours || 0).toFixed(1)}h
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gray-100 p-2 text-gray-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Este mes</p>
              <p className="text-2xl font-bold">{stats?.totalLeadsThisMonth || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-6">
          {[
            { key: 'new', label: 'Nuevas', count: stats?.newLeads },
            { key: 'quoted', label: 'Cotizadas', count: stats?.quotedLeads },
            { key: 'accepted', label: 'Ganadas', count: stats?.acceptedLeads },
            { key: 'all', label: 'Todas', count: null },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    activeTab === tab.key
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por titulo, descripcion o ubicacion..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todas las categorias</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Leads List */}
      <div className="space-y-4">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="card h-40 animate-pulse bg-gray-100" />
          ))
        ) : filteredLeads.length === 0 ? (
          <div className="card p-12 text-center">
            <Inbox className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-lg font-medium text-gray-900">
              No hay leads {activeTab !== 'all' ? 'en esta categoria' : ''}
            </p>
            <p className="mt-1 text-gray-500">
              Las nuevas solicitudes apareceran aqui
            </p>
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <Link
              key={lead.id}
              href={`/dashboard/leads/${lead.id}`}
              className="block"
            >
              <div className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex gap-4">
                  {/* Left: Photo preview or placeholder */}
                  <div className="flex-shrink-0">
                    {lead.photos.length > 0 ? (
                      <img
                        src={lead.photos[0]}
                        alt=""
                        className="h-24 w-24 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Image className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {lead.title}
                          </h3>
                          {getStatusBadge(lead.status)}
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              URGENCY_CONFIG[lead.urgency]?.color || 'bg-gray-100'
                            )}
                          >
                            {URGENCY_CONFIG[lead.urgency]?.label || lead.urgency}
                          </span>
                        </div>

                        {/* Meta info */}
                        <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {lead.location.neighborhood || lead.location.city}
                            {lead.location.distance && (
                              <span className="text-gray-400">
                                ({lead.location.distance.toFixed(1)}km)
                              </span>
                            )}
                          </span>
                          {lead.budgetRange && (
                            <span className="inline-flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              {lead.budgetRange}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {lead.preferredSchedule || 'Flexible'}
                          </span>
                        </div>
                      </div>

                      {/* Right side */}
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm text-gray-500">
                          {formatRelativeTime(lead.createdAt)}
                        </span>
                        {lead.competingQuotes > 0 && (
                          <span className="text-xs text-orange-600">
                            {lead.competingQuotes} cotizacion
                            {lead.competingQuotes > 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {lead.description}
                    </p>

                    {/* Footer */}
                    <div className="mt-3 flex items-center justify-between">
                      {/* Consumer info */}
                      <div className="flex items-center gap-2">
                        {lead.consumer.profilePhotoUrl ? (
                          <img
                            src={lead.consumer.profilePhotoUrl}
                            alt=""
                            className="h-6 w-6 rounded-full"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-gray-200" />
                        )}
                        <span className="text-sm text-gray-600">
                          {lead.consumer.displayName || 'Cliente'}
                        </span>
                        {lead.consumer.completedJobs > 0 && (
                          <span className="text-xs text-gray-400">
                            ({lead.consumer.completedJobs} trabajos)
                          </span>
                        )}
                      </div>

                      {/* Actions hint */}
                      <div className="flex items-center gap-2 text-sm">
                        {lead.myQuote ? (
                          <span className="text-green-600">
                            Tu cotizacion: ${lead.myQuote.priceMin.toLocaleString()} - $
                            {lead.myQuote.priceMax.toLocaleString()}
                          </span>
                        ) : lead.status !== 'expired' ? (
                          <span className="text-primary-600 font-medium">
                            Enviar cotizacion
                          </span>
                        ) : null}
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>

                    {/* Photos indicator */}
                    {lead.photos.length > 1 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <Image className="h-3 w-3" />
                        {lead.photos.length} fotos
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Load more / pagination placeholder */}
      {leadsData?.data?.total && leadsData.data.total > filteredLeads.length && (
        <div className="text-center">
          <button className="btn-outline">Cargar mas leads</button>
        </div>
      )}
    </div>
  );
}

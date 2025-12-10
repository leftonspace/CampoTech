'use client';

/**
 * Support Tickets Page
 * ====================
 *
 * Shows customer support tickets with the ability to create new ones.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved';

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'open', label: 'Abiertos' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'resolved', label: 'Resueltos' },
];

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  open: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Abierto' },
  in_progress: {
    color: 'bg-blue-100 text-blue-700',
    icon: MessageSquare,
    label: 'En progreso',
  },
  waiting_customer: {
    color: 'bg-purple-100 text-purple-700',
    icon: AlertCircle,
    label: 'Esperando respuesta',
  },
  resolved: {
    color: 'bg-green-100 text-green-700',
    icon: CheckCircle,
    label: 'Resuelto',
  },
  closed: { color: 'bg-gray-100 text-gray-600', icon: CheckCircle, label: 'Cerrado' },
};

const priorityConfig: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadTickets();
  }, [statusFilter, currentPage]);

  const loadTickets = async () => {
    setIsLoading(true);
    const result = await customerApi.getTickets({
      status: statusFilter === 'all' ? undefined : statusFilter,
      page: currentPage,
      limit: 10,
    });

    if (result.success && result.data) {
      setTickets(result.data.tickets || []);
      setTotalPages(result.data.pagination?.totalPages || 1);
    }
    setIsLoading(false);
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.subject?.toLowerCase().includes(query) ||
      ticket.ticketNumber?.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Soporte</h1>
          <p className="text-gray-600">
            Gestioná tus consultas y reclamos
          </p>
        </div>
        <Link href="/support/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por asunto o número..."
              className="input pl-10"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setStatusFilter(option.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                  statusFilter === option.value
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tickets list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : filteredTickets.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredTickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No tenés tickets de soporte</p>
            <Link href="/support/new" className="text-primary-600 hover:text-primary-700">
              Crear nuevo ticket
            </Link>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <span className="text-sm text-gray-500">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketCard({ ticket }: { ticket: any }) {
  const status = statusConfig[ticket.status] || statusConfig.open;
  const StatusIcon = status.icon;

  return (
    <Link
      href={`/support/${ticket.id}`}
      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
    >
      {/* Status icon */}
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
          status.color.split(' ')[0]
        )}
      >
        <StatusIcon className={cn('w-6 h-6', status.color.split(' ')[1])} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-medium text-gray-900 truncate">
              {ticket.subject}
            </h3>
            <p className="text-sm text-gray-500">
              #{ticket.ticketNumber} • {ticket.category}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {ticket.priority && ticket.priority !== 'medium' && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  priorityConfig[ticket.priority]
                )}
              >
                {ticket.priority === 'high' ? 'Alta' : ticket.priority === 'urgent' ? 'Urgente' : ''}
              </span>
            )}
            <span className={cn('px-2 py-1 rounded-full text-xs font-medium', status.color)}>
              {status.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <span>{formatRelativeTime(ticket.updatedAt || ticket.createdAt)}</span>
          {ticket.unreadMessages > 0 && (
            <span className="flex items-center gap-1 text-primary-600">
              <MessageSquare className="w-3 h-3" />
              {ticket.unreadMessages} nuevo(s)
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
    </Link>
  );
}

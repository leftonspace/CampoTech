'use client';

/**
 * Invoices List Page
 * ==================
 *
 * Shows customer's invoice history with filtering and payment status.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  FileText,
  CreditCard,
  Download,
  ArrowRight,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

type StatusFilter = 'all' | 'paid' | 'pending' | 'overdue';

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'overdue', label: 'Vencidas' },
  { value: 'paid', label: 'Pagadas' },
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({
    totalPending: 0,
    totalOverdue: 0,
    pendingCount: 0,
    overdueCount: 0,
  });

  useEffect(() => {
    loadInvoices();
  }, [statusFilter, currentPage]);

  const loadInvoices = async () => {
    setIsLoading(true);
    const result = await customerApi.getInvoices({
      status: statusFilter === 'all' ? undefined : statusFilter,
      page: currentPage,
      limit: 10,
    });

    if (result.success && result.data) {
      setInvoices(result.data.invoices || []);
      setTotalPages(result.data.pagination?.totalPages || 1);
      if (result.data.summary) {
        setSummary(result.data.summary);
      }
    }
    setIsLoading(false);
  };

  const filteredInvoices = invoices.filter((invoice) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      invoice.invoiceNumber?.toLowerCase().includes(query) ||
      invoice.jobServiceType?.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mis facturas</h1>
        <p className="text-gray-600">
          Historial de facturación y pagos
        </p>
      </div>

      {/* Summary cards */}
      {(summary.pendingCount > 0 || summary.overdueCount > 0) && (
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {summary.pendingCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-yellow-700">
                    {summary.pendingCount} factura(s) pendiente(s)
                  </p>
                  <p className="text-xl font-bold text-yellow-800">
                    {formatCurrency(summary.totalPending)}
                  </p>
                </div>
              </div>
            </div>
          )}
          {summary.overdueCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-sm text-red-700">
                    {summary.overdueCount} factura(s) vencida(s)
                  </p>
                  <p className="text-xl font-bold text-red-800">
                    {formatCurrency(summary.totalOverdue)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
              placeholder="Buscar por número de factura..."
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

      {/* Invoices list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : filteredInvoices.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredInvoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron facturas</p>
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

function InvoiceCard({ invoice }: { invoice: any }) {
  const isPaid = invoice.status === 'paid';
  const isOverdue = invoice.status === 'overdue' || (invoice.dueDate && new Date(invoice.dueDate) < new Date() && !isPaid);

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
      {/* Icon */}
      <div
        className={cn(
          'w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0',
          isPaid ? 'bg-green-50' : isOverdue ? 'bg-red-50' : 'bg-yellow-50'
        )}
      >
        {isPaid ? (
          <CheckCircle className="w-7 h-7 text-green-600" />
        ) : isOverdue ? (
          <AlertTriangle className="w-7 h-7 text-red-600" />
        ) : (
          <Clock className="w-7 h-7 text-yellow-600" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-medium text-gray-900">
              Factura #{invoice.invoiceNumber}
            </h3>
            <p className="text-sm text-gray-500 truncate">
              {invoice.jobServiceType || 'Servicio'}
            </p>
          </div>
          <span
            className={cn(
              'px-2 py-1 rounded-full text-xs font-medium flex-shrink-0',
              isPaid
                ? 'bg-green-100 text-green-700'
                : isOverdue
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
            )}
          >
            {isPaid ? 'Pagada' : isOverdue ? 'Vencida' : 'Pendiente'}
          </span>
        </div>

        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <span>{formatDate(invoice.issueDate)}</span>
          {invoice.dueDate && !isPaid && (
            <span className={isOverdue ? 'text-red-600' : ''}>
              Vence: {formatDate(invoice.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Amount and actions */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="font-bold text-gray-900">{formatCurrency(invoice.total)}</p>
          {!isPaid && invoice.pendingAmount && invoice.pendingAmount !== invoice.total && (
            <p className="text-xs text-gray-500">
              Pendiente: {formatCurrency(invoice.pendingAmount)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isPaid && (
            <Link
              href={`/payments?invoice=${invoice.id}`}
              className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
              title="Pagar"
            >
              <CreditCard className="w-5 h-5" />
            </Link>
          )}
          <Link
            href={`/invoices/${invoice.id}`}
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
            title="Ver detalle"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

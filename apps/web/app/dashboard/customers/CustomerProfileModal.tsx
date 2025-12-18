'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Star,
  Edit2,
  Briefcase,
  FileText,
  MessageSquare,
  Copy,
  ExternalLink,
  Calendar,
  Clock,
  Crown,
  ClipboardList,
  ChevronRight,
} from 'lucide-react';
import { cn, formatCurrency, formatPhone, formatAddress, formatDate, formatRelativeTime, getInitials } from '@/lib/utils';
import { Customer, Job, Invoice } from '@/types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomerDetail extends Customer {
  jobs?: Job[];
  invoices?: Invoice[];
}

interface CustomerProfileModalProps {
  customerId: string | null;
  onClose: () => void;
  onEdit?: (customerId: string) => void;
}

type TabType = 'trabajos' | 'facturas' | 'notas';

// ═══════════════════════════════════════════════════════════════════════════════
// JOB STATUS HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const jobStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-gray-100 text-gray-700' },
  ASSIGNED: { label: 'Asignado', color: 'bg-blue-100 text-blue-700' },
  EN_ROUTE: { label: 'En Camino', color: 'bg-purple-100 text-purple-700' },
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Completado', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

const invoiceStatusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
  PENDING_CAE: { label: 'Pendiente CAE', color: 'bg-yellow-100 text-yellow-700' },
  ISSUED: { label: 'Emitida', color: 'bg-blue-100 text-blue-700' },
  SENT: { label: 'Enviada', color: 'bg-indigo-100 text-indigo-700' },
  PAID: { label: 'Pagada', color: 'bg-green-100 text-green-700' },
  PARTIALLY_PAID: { label: 'Pago Parcial', color: 'bg-teal-100 text-teal-700' },
  OVERDUE: { label: 'Vencida', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700' },
  REJECTED: { label: 'Rechazada', color: 'bg-red-100 text-red-700' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CustomerProfileModal({
  customerId,
  onClose,
  onEdit,
}: CustomerProfileModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('trabajos');
  const [copied, setCopied] = useState(false);

  // Fetch customer details
  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-detail', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const res = await fetch(`/api/customers/${customerId}`);
      if (!res.ok) throw new Error('Error fetching customer');
      return res.json();
    },
    enabled: !!customerId,
  });

  const customer: CustomerDetail | null = data?.data || null;

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Don't render if no customer selected
  if (!customerId) return null;

  const handleCopyPhone = () => {
    if (customer?.phone) {
      navigator.clipboard.writeText(customer.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    if (customer?.phone) {
      const cleanPhone = customer.phone.replace(/\D/g, '');
      const whatsappPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;
      window.open(`https://wa.me/${whatsappPhone}`, '_blank');
    }
  };

  const handleNewJob = () => {
    router.push(`/dashboard/jobs/new?customerId=${customerId}`);
    onClose();
  };

  const handleViewJob = (jobId: string) => {
    router.push(`/dashboard/jobs/${jobId}`);
    onClose();
  };

  const handleViewInvoice = (invoiceId: string) => {
    router.push(`/dashboard/invoices/${invoiceId}`);
    onClose();
  };

  // Check if customer is new (created within last 30 days)
  const isNewCustomer = customer?.createdAt
    ? new Date(customer.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    : false;

  const addressStr = customer ? formatAddress(customer.address) : '';

  const tabs = [
    { id: 'trabajos' as TabType, label: 'Trabajos', count: customer?.jobs?.length || 0 },
    { id: 'facturas' as TabType, label: 'Facturas', count: customer?.invoices?.length || 0 },
    { id: 'notas' as TabType, label: 'Notas', count: 0 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          {isLoading ? (
            <div className="flex items-center gap-4 animate-pulse">
              <div className="h-16 w-16 rounded-full bg-gray-200" />
              <div className="space-y-2">
                <div className="h-5 w-40 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
            </div>
          ) : customer ? (
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="h-16 w-16 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                {getInitials(customer.name)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
                  {isNewCustomer && (
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
                <p className="text-sm text-gray-500">
                  {customer.customerNumber || `CL-${customer.id.slice(-4).toUpperCase()}`}
                </p>
              </div>
            </div>
          ) : null}

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Stats Row */}
        {customer && (
          <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-gray-50 border-b">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{customer.jobCount || 0}</p>
              <p className="text-sm text-gray-500">Trabajos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(customer.totalSpent || 0)}
              </p>
              <p className="text-sm text-gray-500">Facturado</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className={cn(
                  'h-5 w-5',
                  customer.averageRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                )} />
                <p className="text-2xl font-bold text-gray-900">
                  {customer.averageRating ? customer.averageRating.toFixed(1) : '-'}
                </p>
              </div>
              <p className="text-sm text-gray-500">Rating</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-4 animate-pulse">
              <div className="h-4 w-full bg-gray-200 rounded" />
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-red-500">Error al cargar el cliente</p>
            </div>
          ) : customer ? (
            <>
              {/* Contact Section */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Contacto
                </h3>
                <div className="space-y-3">
                  {customer.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <a href={`mailto:${customer.email}`} className="text-sm text-gray-700 hover:text-teal-600">
                        {customer.email}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{formatPhone(customer.phone)}</span>
                    <button
                      onClick={handleCopyPhone}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Copiar"
                    >
                      <Copy className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                    {copied && <span className="text-xs text-green-600">Copiado!</span>}
                  </div>
                  {addressStr && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{addressStr}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Acciones Rápidas
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleWhatsApp}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp
                  </button>
                  <button
                    onClick={handleNewJob}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                  >
                    <Briefcase className="h-4 w-4" />
                    Nuevo Trabajo
                  </button>
                  {onEdit && (
                    <button
                      onClick={() => onEdit(customerId!)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b">
                <div className="flex">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                        activeTab === tab.id
                          ? 'text-teal-600 border-teal-600'
                          : 'text-gray-500 border-transparent hover:text-gray-700'
                      )}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-gray-100">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'trabajos' && (
                  <div className="space-y-3">
                    {customer.jobs && customer.jobs.length > 0 ? (
                      customer.jobs.map((job: Job) => {
                        const statusInfo = jobStatusConfig[job.status] || {
                          label: job.status,
                          color: 'bg-gray-100 text-gray-700',
                        };
                        return (
                          <div
                            key={job.id}
                            onClick={() => handleViewJob(job.id)}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-900">{job.jobNumber}</span>
                                <span className={cn(
                                  'px-2 py-0.5 text-xs font-medium rounded-full',
                                  statusInfo.color
                                )}>
                                  {statusInfo.label}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 truncate mt-0.5">
                                {job.serviceType}
                              </p>
                              {job.scheduledDate && (
                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(job.scheduledDate)}
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8">
                        <ClipboardList className="mx-auto h-10 w-10 text-gray-300" />
                        <p className="mt-2 text-sm text-gray-500">Sin trabajos registrados</p>
                        <button
                          onClick={handleNewJob}
                          className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium"
                        >
                          Crear primer trabajo
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'facturas' && (
                  <div className="space-y-3">
                    {customer.invoices && customer.invoices.length > 0 ? (
                      customer.invoices.map((invoice: Invoice) => {
                        const statusInfo = invoiceStatusConfig[invoice.status?.toUpperCase()] || {
                          label: invoice.status,
                          color: 'bg-gray-100 text-gray-700',
                        };
                        return (
                          <div
                            key={invoice.id}
                            onClick={() => handleViewInvoice(invoice.id)}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-900">
                                  {invoice.invoiceType}-{invoice.number || 'Borrador'}
                                </span>
                                <span className={cn(
                                  'px-2 py-0.5 text-xs font-medium rounded-full',
                                  statusInfo.color
                                )}>
                                  {statusInfo.label}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-0.5">
                                {formatCurrency(invoice.total)}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(invoice.issueDate || invoice.createdAt)}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="mx-auto h-10 w-10 text-gray-300" />
                        <p className="mt-2 text-sm text-gray-500">Sin facturas registradas</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'notas' && (
                  <div className="space-y-3">
                    {customer.notes ? (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <MessageSquare className="mx-auto h-10 w-10 text-gray-300" />
                        <p className="mt-2 text-sm text-gray-500">Sin notas</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Activity Timeline */}
              {customer.createdAt && (
                <div className="px-6 pb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Información
                  </h3>
                  <div className="text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Cliente desde {formatDate(customer.createdAt)}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
